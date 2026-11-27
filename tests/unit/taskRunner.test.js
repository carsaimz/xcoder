import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fileSystem", () => {
	const fsOperation = vi.fn(() => ({
		readFile: vi.fn(async () => "{}"),
	}));
	return { default: fsOperation };
});

import TaskRunner, {
	buildRunCommand,
	MAX_TASK_OUTPUT_LINES,
	parsePackageScripts,
} from "lib/taskRunner";

/** Fake Cordova terminal Executor: start()/write()/stop() contract. */
function fakeExecutor() {
	const state = {
		commands: [],
		listeners: [],
		stopped: [],
		onData: null,
	};
	const executor = {
		start(command, onData, alpine) {
			state.commands.push({ command, alpine });
			state.onData = onData;
			state.listeners.push(onData);
			return Promise.resolve(`uuid-${state.commands.length}`);
		},
		write(uuid, input) {
			state.written = state.written || [];
			state.written.push({ uuid, input });
			return Promise.resolve(uuid);
		},
		stop(uuid) {
			state.stopped.push(uuid);
			return Promise.resolve(uuid);
		},
	};
	return { executor, state };
}

const PKG = JSON.stringify({
	name: "demo",
	scripts: {
		start: "node server.js",
		prebuild: "rimraf dist",
		build: "webpack",
		postbuild: "node post.js",
		empty: "",
		notAString: 42,
	},
});

describe("parsePackageScripts", () => {
	it("parses scripts with lifecycle flags, sorted by name", () => {
		const scripts = parsePackageScripts(PKG);
		const names = scripts.map((s) => s.name);
		expect(names).toContain("build");
		expect(names).toContain("prebuild");
		expect(names).toContain("postbuild");
		const build = scripts.find((s) => s.name === "build");
		expect(build.command).toBe("webpack");
		expect(build.lifecycle).toBe("normal");
		expect(scripts.find((s) => s.name === "prebuild").lifecycle).toBe("pre");
		expect(scripts.find((s) => s.name === "postbuild").lifecycle).toBe("post");
	});

	it("drops non-string and empty entries", () => {
		const scripts = parsePackageScripts(PKG);
		expect(scripts.find((s) => s.name === "notAString")).toBeUndefined();
		expect(scripts.find((s) => s.name === "empty")).toBeUndefined();
	});

	it("returns [] for garbage input", () => {
		expect(parsePackageScripts("")).toEqual([]);
		expect(parsePackageScripts("not json {")).toEqual([]);
		expect(parsePackageScripts('{"name":"x"}')).toEqual([]);
		expect(parsePackageScripts('{"scripts": "nope"}')).toEqual([]);
	});
});

describe("buildRunCommand", () => {
	it("cds into the sandbox path and runs npm run", () => {
		expect(buildRunCommand("build", "/public/app")).toBe(
			"cd '/public/app' && npm run 'build'",
		);
	});

	it("skips cd when there is no path and quotes odd names", () => {
		expect(buildRunCommand("start", null)).toBe("npm run 'start'");
		expect(buildRunCommand("test:unit", "/x")).toBe(
			"cd '/x' && npm run 'test:unit'",
		);
		expect(buildRunCommand("build", "/x", "pnpm")).toBe(
			"cd '/x' && pnpm run 'build'",
		);
	});
});

describe("TaskRunner", () => {
	let runner;
	let fake;

	beforeEach(() => {
		fake = fakeExecutor();
		runner = new TaskRunner({ executor: fake.executor });
	});

	it("reports no-executor when the terminal plugin is missing", async () => {
		const none = new TaskRunner({ executor: null });
		await expect(none.run("build")).resolves.toEqual({
			status: "no-executor",
			exitCode: null,
		});
	});

	it("streams output and resolves with the exit code", async () => {
		const events = [];
		runner.on("start", (e) => events.push(["start", e.scriptName]));
		runner.on("output", (e) =>
			events.push(["output", e.scriptName, e.stream, e.data]),
		);

		const pending = runner.run("build", { cwdPath: "/public/app" });
		const onData = fake.state.onData;
		onData("stdout", "building…");
		onData("stderr", "1 warning");
		onData("exit", "0");
		await expect(pending).resolves.toEqual({ status: "exit", exitCode: 0 });

		expect(events[0]).toEqual(["start", "build"]);
		expect(events[1]).toEqual(["output", "build", "stdout", "building…"]);
		expect(events[2]).toEqual(["output", "build", "stderr", "1 warning"]);
		expect(runner.isActive("build")).toBe(false);
		const task = runner.tasks.get("build");
		expect(task.uuid).toBe("uuid-1");
		expect(task.buffer).toContain("building…");
		expect(task.buffer).toContain("1 warning");
	});

	it("runs the script in the alpine sandbox via npm run", async () => {
		const pending = runner.run("build", { cwdPath: "/public/app" });
		fake.state.onData("exit", "0");
		await pending;
		expect(fake.state.commands[0]).toEqual({
			command: "cd '/public/app' && npm run 'build'",
			alpine: true,
		});
	});

	it("refuses a second run of an active task", async () => {
		const pending = runner.run("dev");
await new Promise((r) => setTimeout(r, 0));
		expect(runner.isActive("dev")).toBe(true);
		await expect(runner.run("dev")).resolves.toEqual({
			status: "already-running",
			exitCode: null,
		});
		fake.state.onData("exit", "0");
		await pending;
	});

	it("stops a running task through the executor", async () => {
		const exitEvents = [];
		runner.on("exit", (e) => exitEvents.push(e));
		const pending = runner.run("dev");
		// let the executor promise resolve so the task gets its uuid
		await new Promise((r) => setTimeout(r, 0));
		const stopped = await runner.stop("dev");
		expect(stopped).toBe(true);
		expect(fake.state.stopped).toEqual(["uuid-1"]);
		expect(exitEvents.at(-1)).toEqual({
			scriptName: "dev",
			status: "exit",
			exitCode: null,
		});
		fake.state.listeners.forEach((l) => l("exit", "1"));
		await pending;
		// already settled by stop — the late exit event must not win
		expect(exitEvents.filter((e) => e.status === "exit")).toHaveLength(1);
	});

	it("marks tasks failed when the executor rejects", async () => {
		const broken = {
			start: () => Promise.reject(new Error("terminal not installed")),
			stop: () => Promise.resolve(),
		};
		const failing = new TaskRunner({ executor: broken });
		await expect(failing.run("build")).resolves.toEqual({
			status: "failed",
			exitCode: null,
		});
		const task = failing.tasks.get("build");
		expect(task.buffer.join("\n")).toContain("terminal not installed");
	});

	it("caps the output ring buffer", () => {
		const task = { buffer: [] };
		for (let i = 0; i < MAX_TASK_OUTPUT_LINES + 50; i++) {
			runner.append(task, `line ${i}`);
		}
		expect(task.buffer.length).toBe(MAX_TASK_OUTPUT_LINES);
		expect(task.buffer[0]).toBe("line 50");
		expect(task.buffer.at(-1)).toBe(`line ${MAX_TASK_OUTPUT_LINES + 49}`);
	});

	it("tracks the latest running task", async () => {
		const a = runner.run("a");
		const b = runner.run("b");
		expect(runner.getActiveTask()).toBe("b");
		expect(runner.runningTasks()).toEqual(["a", "b"]);
		// every spawned process reports its own exit

		fake.state.listeners.forEach((l) => l("exit", "0"));
		await Promise.all([a, b]);
		expect(runner.getActiveTask()).toBeNull();
	});
});
