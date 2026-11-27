import "./style.scss";
import fsOperation from "fileSystem";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import { addedFolder } from "lib/openFolder";
import { sandboxPathOf } from "lib/terminalCwd";
import TaskRunner, { parsePackageScripts } from "lib/taskRunner";
import Url from "utils/Url";

/**@type {HTMLElement} */
let container;
let $list = null;
let $outputPre = null;
let $outputStatus = null;
let $outputTitle = null;
let runner = null;
/**@type {{rootUrl: string, cwdPath: string|null}|null} */
let project = null;
/**@type {{name: string, command: string}[]} */
let scripts = [];
let currentTask = null;

export default [
	"cod:run-all", // icon
	"tasks", // id
	strings["tasks"] || "Tasks", // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
	{ titleKey: "tasks", group: "tools" },
];

const $header = (
	<div className="header">
		<div className="title">
			<span>{strings["tasks"] || "Tasks"}</span>
			<span className="header-actions">
				<button
					type="button"
					className="icon-button"
					data-action="refresh-tasks"
					onclick={() => refresh()}
				>
					<span className="icon codicon-refresh" />
				</button>
				<button
					type="button"
					className="icon-button"
					data-action="clear-task-output"
					onclick={() => clearOutput()}
				>
					<span className="icon codicon-clear-all" />
				</button>
			</span>
		</div>
	</div>
);

const $outputSection = (
	<div className="task-output">
		<div className="task-output-head">
			<span className="task-output-title" data-role="task-output-title">
				{strings["task output"] || "Task output"}
			</span>
			<span className="task-output-status" data-role="task-output-status" />
		</div>
		<pre className="task-output-body scroll" data-role="task-output-body" />
	</div>
);

/**
 * Initialize tasks app
 * @param {HTMLElement} el
 */
function initApp(el) {
	container = el;
	container.classList.add("tasks");
	container.content = $header;
	$list = <div className="task-list scroll" />;
	container.append($list);
	container.append($outputSection);
	$outputPre = container.$('[data-role="task-output-body"]');
	$outputStatus = container.$('[data-role="task-output-status"]');
	$outputTitle = container.$('[data-role="task-output-title"]');

	runner = new TaskRunner();
	runner.on("start", ({ scriptName }) => {
		if (!currentTask) setCurrentTask(scriptName);
		renderList();
	});
	runner.on("output", ({ scriptName, data }) => {
		if (scriptName !== currentTask) return;
		appendOutput(data);
	});
	runner.on("exit", ({ scriptName, status, exitCode }) => {
		renderStatus(scriptName, status, exitCode);
		renderList();
	});

	refresh();
	Sidebar.on("show", onSelected);
}

function onSelected() {
	// package.json may have changed since the last open
	refresh();
}

/** Workspace root: first opened folder, fallback to the active file folder. */
function getProjectRoot() {
	const folder = addedFolder?.[0];
	if (folder?.url) return folder.url;
	const activeFile = window.editorManager?.activeFile;
	if (activeFile?.url) return Url.dirname(activeFile.url);
	return null;
}

/** Loads/refreshes the script list from the project package.json. */
async function refresh() {
	const rootUrl = getProjectRoot();
	project = null;
	scripts = [];

	if (!rootUrl) {
		renderEmpty(strings["no project folder open"] || "No project folder open");
		return;
	}

	const packageJsonUrl = Url.join(rootUrl, "package.json");
	/** @type {string} */
	let text;
	try {
		text = await fsOperation(packageJsonUrl).readFile("utf8");
	} catch (error) {
		renderEmpty(
			strings["no package.json in project"] ||
				"No package.json in this project",
		);
		return;
	}

	project = {
		rootUrl,
		cwdPath: sandboxPathOf(rootUrl),
	};
	scripts = parsePackageScripts(text);
	if (!scripts.length) {
		renderEmpty(strings["no scripts found"] || "No scripts in package.json");
		return;
	}
	renderList();
}

function renderEmpty(message) {
	$list.content = (
		<div className="tasks-empty">
			<span className="icon codicon-package" />
			<span>{message}</span>
		</div>
	);
}

/** Renders the script list with run/stop buttons. */
function renderList() {
	if (!$list || !scripts.length) return;
	$list.content = scripts.map((script) => {
		const running = runner?.isActive(script.name);
		return (
			<div
				className={`task-item ${running ? "running" : ""}`}
				data-task={script.name}
			>
				<button
					type="button"
					className="task-info"
					data-action="show-task-output"
					data-task={script.name}
					onclick={() => openTaskOutput(script.name)}
				>
					<span className="task-name">{script.name}</span>
					<span className="task-command">{script.command}</span>
				</button>
				<button
					type="button"
					className="icon-button"
					data-action={running ? "stop-task" : "run-task"}
					data-task={script.name}
					onclick={() =>
						running ? stopTask(script.name) : runTask(script.name)
					}
				>
					<span
						className={`icon ${running ? "codicon-debug-stop" : "codicon-debug-start"}`}
					/>
				</button>
			</div>
		);
	});
}

/**
 * Runs one script in the project folder inside the sandbox.
 * @param {string} name
 */
async function runTask(name) {
	if (!project) await refresh();
	if (!project) return;

	if (!runner.executor) {
		toast(strings["terminal not available"] || "Terminal not available", 3000);
		return;
	}
	if (!project.cwdPath) {
		toast(
			strings["project outside terminal"] ||
				"Project folder is not visible to the terminal",
			3500,
		);
		return;
	}

	setCurrentTask(name);
	renderStatus(name, "running", null);
	await runner.run(name, {
		cwdPath: project.cwdPath,
		packageManager: "npm",
	});
}

/**
 * @param {string} name
 */
async function stopTask(name) {
	const stopped = await runner?.stop(name);
	if (stopped) {
		toast(`${strings["task stopped"] || "Task stopped"}: ${name}`, 2000);
	}
}

/** Shows the buffered output of one task in the output pane. */
function openTaskOutput(name) {
	setCurrentTask(name);
	const task = runner?.tasks.get(name);
	const status = task?.status || "idle";
	renderStatus(name, status, task?.exitCode ?? null);
	if (task?.buffer?.length) {
		$outputPre.textContent = task.buffer.join("\n");
		scrollOutputToEnd();
	}
}

function setCurrentTask(name) {
	currentTask = name;
	if ($outputTitle) {
		$outputTitle.textContent = `${strings["task output"] || "Task output"} — ${name}`;
	}
	if ($outputPre) $outputPre.textContent = "";
}

function clearOutput() {
	if (currentTask && runner?.tasks.has(currentTask)) {
		runner.tasks.get(currentTask).buffer = [];
	}
	if ($outputPre) $outputPre.textContent = "";
}

/** Appends one streamed chunk to the output pane. */
function appendOutput(data) {
	if (!data) return;
	$outputPre.textContent += data;
	$outputPre.textContent = trimOutput($outputPre.textContent);
	scrollOutputToEnd();
}

const OUTPUT_CHAR_LIMIT = 64 * 1024;

function trimOutput(text) {
	if (text.length <= OUTPUT_CHAR_LIMIT) return text;
	return text.slice(text.length - OUTPUT_CHAR_LIMIT);
}

function scrollOutputToEnd() {
	if ($outputPre) $outputPre.scrollTop = $outputPre.scrollHeight;
}

/**
 * @param {string} name
 * @param {string} status running|exit|failed|idle
 * @param {number|null} exitCode
 */
function renderStatus(name, status, exitCode) {
	if (!currentTask) setCurrentTask(name);
	if (name !== currentTask) return;
	let text = "";
	if (status === "running") {
		text = strings["running"] || "Running";
	} else if (status === "failed") {
		text = strings["task failed"] || "Task failed";
	} else if (status === "exit" && exitCode == null) {
		text = strings["task stopped"] || "Task stopped";
	} else {
		text = `${strings["task finished"] || "Task finished"} (${strings["exit code"] || "exit code"} ${exitCode})`;
	}
	if ($outputStatus) {
		$outputStatus.textContent = text;
		$outputStatus.dataset.status = status;
	}
}

// --- command palette helpers (runNpmTask / stopRunningTask commands) -------

/**
 * Lets the user pick a script and runs it (palette "runNpmTask").
 * @returns {Promise<boolean>} true when a task was started
 */
export async function runNpmTaskDialog() {
	const rootUrl = getProjectRoot();
	if (!rootUrl) {
		toast(strings["no project folder open"] || "No project folder open", 2500);
		return false;
	}
	let scriptsLocal = [];
	try {
		const text = await fsOperation(Url.join(rootUrl, "package.json")).readFile(
			"utf8",
		);
		scriptsLocal = parsePackageScripts(text);
	} catch (error) {
		toast(
			strings["no package.json in project"] ||
				"No package.json in this project",
			2500,
		);
		return false;
	}
	if (!scriptsLocal.length) {
		toast(strings["no scripts found"] || "No scripts in package.json", 2500);
		return false;
	}

	const { default: select } = await import("dialogs/select");
	const choice = await select(
		strings["run task"] || "Run task",
		scriptsLocal.map((script) => script.name),
	);
	if (!choice) return false;

	const { default: sidebarApps } = await import("sidebarApps");
	sidebarApps.setActiveApp("tasks");
	// let the panel mount before the task starts streaming
	await new Promise((resolve) => setTimeout(resolve, 150));
	await runTask(choice);
	return true;
}

/** Stops the most recent running task (palette "stopRunningTask"). */
export async function stopActiveNpmTask() {
	const active = runner?.getActiveTask();
	if (!active) {
		toast(strings["no running task"] || "No running task", 2000);
		return false;
	}
	await stopTask(active);
	return true;
}
