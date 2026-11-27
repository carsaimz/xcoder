import fsOperation from "fileSystem";
import { shellQuote } from "lib/terminalCwd";

/**
 * Task runner — VS Code-style "Tasks" backed by `package.json` scripts.
 *
 * Scripts run inside the Alpine sandbox (AXS terminal plugin) with the
 * workspace folder as working directory, streaming stdout/stderr/exit into
 * a bounded buffer that UI panels (sidebar app, palette) can render.
 *
 * The executor is injected so unit tests can drive the full state machine
 * without Cordova: pass `{ executor }` with a
 * `{ start(command, onData, alpine), write(uuid, input), stop(uuid) }` fake.
 */

/** Number of output lines kept per task (ring buffer cap). */
export const MAX_TASK_OUTPUT_LINES = 800;

/**
 * Parses the `scripts` object of a package.json text.
 * @param {string} jsonText raw package.json contents
 * @returns {{name: string, command: string, lifecycle: "pre"|"post"|"normal"}[]}
 */
export function parsePackageScripts(jsonText) {
	const scripts = [];
	if (typeof jsonText !== "string" || !jsonText.trim()) return scripts;
	let pkg;
	try {
		pkg = JSON.parse(jsonText);
	} catch (error) {
		return scripts;
	}
	const raw = pkg?.scripts;
	if (!raw || typeof raw !== "object") return scripts;
	for (const [name, command] of Object.entries(raw)) {
		if (typeof command !== "string" || !command.trim()) continue;
		const lifecycle = name.startsWith("pre")
			? "pre"
			: name.startsWith("post")
				? "post"
				: "normal";
		scripts.push({ name, command, lifecycle });
	}
	return scripts.sort((a, b) => {
		// lifecycle scripts (pre/post) stick next to their main task;
		// alphabetical keeps the list stable
		if (a.name !== b.name) return a.name < b.name ? -1 : 1;
		return 0;
	});
}

/**
 * Builds the shell command that runs one npm script inside the sandbox.
 * @param {string} scriptName
 * @param {string} cwdPath absolute path inside the sandbox
 * @param {string} [packageManager] default "npm"
 * @returns {string}
 */
export function buildRunCommand(scriptName, cwdPath, packageManager = "npm") {
	const dir = cwdPath ? shellQuote(cwdPath) : null;
	const runLine = `${packageManager} run ${shellQuote(scriptName)}`;
	return dir ? `cd ${dir} && ${runLine}` : runLine;
}

/** Minimal observer emitter (on/off/emit) used by TaskRunner. */
class TaskEmitter {
	constructor() {
		this.handlers = new Map();
	}
	on(event, handler) {
		if (typeof handler !== "function") return () => {};
		if (!this.handlers.has(event)) this.handlers.set(event, new Set());
		this.handlers.get(event).add(handler);
		return () => this.off(event, handler);
	}
	off(event, handler) {
		this.handlers.get(event)?.delete(handler);
	}
	emit(event, payload) {
		for (const handler of this.handlers.get(event) || []) {
			try {
				handler(payload);
			} catch (error) {
				console.error(`task event ${event} handler failed`, error);
			}
		}
	}
}

/**
 * Runs npm scripts through the terminal executor and keeps a bounded
 * output buffer per task. Multiple tasks may run concurrently.
 */
export default class TaskRunner extends TaskEmitter {
	/**
	 * @param {{executor?: object|null, maxLines?: number, alpine?: boolean}} [options]
	 * executor defaults to globalThis.Executor (Cordova terminal plugin).
	 */
	constructor({
		executor,
		maxLines = MAX_TASK_OUTPUT_LINES,
		alpine = true,
	} = {}) {
		super();
		this.executor = executor || globalThis.Executor || null;
		this.maxLines = maxLines;
		this.alpine = alpine;
		/** @type {Map<string, {uuid: string|null, buffer: string[], status: "running"|"exit"|"failed", exitCode: number|null, startedAt: number}>} */
		this.tasks = new Map();
	}

	/** @param {string} scriptName */
	isActive(scriptName) {
		return this.tasks.get(scriptName)?.status === "running";
	}

	/** Names of tasks currently running (latest first). */
	runningTasks() {
		return Array.from(this.tasks.entries())
			.filter(([, task]) => task.status === "running")
			.map(([name]) => name);
	}

	/** Latest running task name or null. */
	getActiveTask() {
		const names = this.runningTasks();
		return names.length ? names[names.length - 1] : null;
	}

	/**
	 * @param {string} scriptName
	 * @param {{cwdPath?: string|null, packageManager?: string}} [options]
	 * @returns {Promise<{exitCode: number|null, status: string}>} resolves when the process exits or fails to start
	 */
	run(scriptName, { cwdPath = null, packageManager = "npm" } = {}) {
		if (!this.executor?.start) {
			return Promise.resolve({ exitCode: null, status: "no-executor" });
		}
		if (this.isActive(scriptName)) {
			return Promise.resolve({ exitCode: null, status: "already-running" });
		}

		const task = {
			uuid: null,
			buffer: [],
			status: "running",
			exitCode: null,
			startedAt: Date.now(),
		};
		this.tasks.set(scriptName, task);
		this.emit("start", { scriptName });

		const command = buildRunCommand(scriptName, cwdPath, packageManager);
		const settle = (status, exitCode) => {
			if (task.status !== "running") return;
			task.status = status;
			task.exitCode = exitCode;
			this.emit("exit", { scriptName, status, exitCode });
		};
		let settleAndResolve = (status, exitCode) => settle(status, exitCode);
		task.finish = (status, exitCode) => settleAndResolve(status, exitCode);

		return new Promise((resolve) => {
			let settled = false;
			settleAndResolve = (status, exitCode) => {
				settle(status, exitCode);
				if (settled) return;
				settled = true;
				resolve({ status: task.status, exitCode: task.exitCode });
			};

			this.executor
				.start(
					command,
					(type, data) => {
						if (type === "exit") {
							const code = Number.parseInt(data, 10);
							settleAndResolve("exit", Number.isNaN(code) ? null : code);
							return;
						}
						if (type === "stdout" || type === "stderr") {
							this.append(task, data);
							this.emit("output", {
								scriptName,
								stream: type,
								data,
							});
							return;
						}
						this.append(task, data);
						this.emit("output", {
							scriptName,
							stream: "stdout",
							data,
						});
					},
					this.alpine,
				)
				.then((uuid) => {
					task.uuid = uuid;
				})
				.catch((error) => {
					this.append(task, `${error?.message || error}`);
					settleAndResolve("failed", null);
				});
		});
	}

	/** Appends one chunk to the ring buffer (bounded). */
	append(task, data) {
		if (!data) return;
		const lines = String(data).split("\n");
		for (const line of lines) {
			task.buffer.push(line);
		}
		if (task.buffer.length > this.maxLines) {
			task.buffer.splice(0, task.buffer.length - this.maxLines);
		}
	}

	/** @param {string} scriptName stops a running task */
	async stop(scriptName) {
		const task = this.tasks.get(scriptName);
		if (!task || task.status !== "running") return false;
		if (task.uuid) {
			try {
				await this.executor.stop?.(task.uuid);
			} catch (error) {
				console.error(`failed to stop task ${scriptName}`, error);
			}
		}
		task.finish?.("exit", null);
		return true;
	}

	/** Stops every running task (app shutdown / clear). */
	async stopAll() {
		for (const name of this.runningTasks()) {
			await this.stop(name);
		}
	}

	/**
	 * Reads the workspace package.json and parses its scripts.
	 * @param {string} packageJsonUrl file:// URL of package.json
	 */
	async loadScripts(packageJsonUrl) {
		try {
			const text = await fsOperation(packageJsonUrl).readFile("utf8");
			return parsePackageScripts(text);
		} catch (error) {
			return [];
		}
	}
}
