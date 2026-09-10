import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import lang, { getIntlLocale } from "lib/lang";
import {
	loadReplHistory,
	pushReplEntry,
	saveReplHistory,
} from "lib/replHistory";
import {
	collectSpecs,
	isRelativeSpec,
	resolveSnippetImports,
} from "lib/replImports";
import {
	loadReplSnippets,
	removeSnippet,
	saveReplSnippets,
	upsertSnippet,
} from "lib/replSnippets";

/**
 * JS Console sidebar app (roadmap v1.6.x item 2) — a sandboxed REPL.
 * User code runs in a dedicated Web Worker: no DOM, no Cordova, no app
 * state, so experiments can never break the editor.
 */

const OUTPUT_CAP = 200;

/** @type {HTMLElement} */
let container = null;
/** @type {HTMLElement} */
let $output = null;
/** @type {HTMLTextAreaElement} */
let $input = null;
/** @type {Worker} */
let worker = null;
let requestSeq = 0;
/** Persisted executed-code history (oldest first). @type {string[]} */
const history = loadReplHistory(safeStorage());
let historyIndex = -1;
/** Saved snippets, persisted alongside the history. */
const snippets = loadReplSnippets(safeStorage());
/** Blob URLs of the current run's workspace modules. */
let activeUrls = [];

/** localStorage can throw in rare contexts — never crash over it. */
function safeStorage() {
	try {
		return typeof localStorage !== "undefined" ? localStorage : null;
	} catch {
		return null;
	}
}

export default [
	"svg:square-terminal",
	"repl",
	strings["js console"] || "JS Console",
	initApp,
	false,
	onSelected,
	{ titleKey: "js console" },
];

function onSelected(el) {
	// live in the sidebar panel; focus the editor when opened
	el?.querySelector("textarea.repl-input")?.focus?.();
}

/**
 * @param {HTMLElement} el
 */
function initApp(el) {
	container = el;
	el.classList.add("repl-app", "scroll");
	el.content = buildUi();

	return () => {
		container = null;
		$output = null;
		$input = null;
		revokeActiveUrls();
		terminateWorker();
	};
}

function buildUi() {
	const $clear = (
		<span
			className="icon delete"
			title={strings["console clear"] || "Clear"}
			onclick={clearOutput}
		></span>
	);
	const $snippets = (
		<span
			className="icon bookmark"
			title={strings["console snippets"] || "Snippets"}
			onclick={showSnippets}
		></span>
	);
	const $saveSnippet = (
		<span
			className="icon save"
			title={strings["console save snippet"] || "Save snippet"}
			onclick={saveSnippetAction}
		></span>
	);

	$output = (
		<div
			className="repl-output"
			data-empty={strings["console empty"] || "Output appears here"}
		></div>
	);

	$input = (
		<textarea
			className="repl-input"
			rows="3"
			placeholder={
				strings["console placeholder"] || "// JavaScript — sandboxed"
			}
			onkeydown={onKeydown}
		></textarea>
	);

	return (
		<div className="repl-panel">
			<div className="repl-toolbar">
				<span className="repl-title">
					{strings["js console"] || "JS Console"}
				</span>
				{$saveSnippet}
				{$snippets}
				{$clear}
			</div>
			{$output}
			{$input}
			<div className="repl-actions">
				<button className="repl-run-btn" onclick={runCode}>
					{strings["console run"] || "Run"}
				</button>
				<span className="repl-hint">
					{strings["console hint"] ||
						"Ctrl+Enter runs · sandboxed Web Worker (no DOM/Cordova)"}
				</span>
			</div>
		</div>
	);
}

/**
 * Ctrl/Cmd+Enter runs; ArrowUp/Down walk the history.
 * @param {KeyboardEvent} event
 */
function onKeydown(event) {
	if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
		event.preventDefault();
		runCode();
		return;
	}

	if (event.key === "ArrowUp" && !event.shiftKey && history.length) {
		const current = $input?.value ?? "";
		const atStart = $input.selectionStart === 0 || !current.includes("\n");
		if (!atStart) return;
		event.preventDefault();
		if (historyIndex === -1) historyIndex = history.length - 1;
		else historyIndex = Math.max(0, historyIndex - 1);
		$input.value = history[historyIndex];
		return;
	}

	if (event.key === "ArrowDown" && !event.shiftKey && historyIndex !== -1) {
		const atEnd = $input.selectionStart >= $input.value.length;
		if (!atEnd) return;
		event.preventDefault();
		historyIndex += 1;
		if (historyIndex >= history.length) {
			historyIndex = -1;
			$input.value = "";
		} else {
			$input.value = history[historyIndex];
		}
	}
}

/** Lazily starts (or restarts) the sandbox worker. */
function ensureWorker() {
	if (worker) return worker;
	worker = new Worker("build/replWorker.js");
	worker.onmessage = (event) => {
		const { kind, text } = event.data || {};
		if (kind === "done") return;
		appendLine(kind || "log", text || "");
	};
	worker.onerror = (event) => {
		appendLine("error", event?.message || "Worker error");
	};
	return worker;
}

function terminateWorker() {
	if (worker) {
		worker.terminate();
		worker = null;
	}
}

async function runCode() {
	const code = ($input?.value || "").trim();
	if (!code) {
		toast(strings["console empty code"] || "Write some code first");
		return;
	}

	pushReplEntry(history, code);
	saveReplHistory(safeStorage(), history);
	historyIndex = -1;

	appendLine("input", code);
	$input.value = "";

	let prepared;
	try {
		prepared = await prepareImports(code);
	} catch (error) {
		appendLine("error", error?.message || String(error));
		return;
	}
	if (prepared === null) return; // import errors already reported

	try {
		ensureWorker().postMessage({ id: ++requestSeq, code: prepared });
	} catch (error) {
		appendLine("error", error?.message || String(error));
	}
}

/**
 * Resolves relative workspace imports to Blob URLs before posting the
 * snippet to the sandbox. Returns null when import errors were reported.
 * @param {string} code
 * @returns {Promise<string|null>}
 */
async function prepareImports(code) {
	const hasRelative = collectSpecs(code).some((entry) =>
		isRelativeSpec(entry.spec),
	);
	if (!hasRelative) return code;

	const baseDir = activeFileDir();
	if (!baseDir) {
		appendLine(
			"error",
			strings["console no base"] ||
				"Open a file or folder first to import workspace modules",
		);
		return null;
	}

	const prepared = await resolveSnippetImports(code, {
		baseDir,
		readFile: (uri) => fsOperation(uri).readFile("utf-8"),
		createObjectUrl: (source) =>
			URL.createObjectURL(new Blob([source], { type: "text/javascript" })),
	});

	revokeActiveUrls();
	activeUrls = prepared.urls.map((entry) => entry.url);

	for (const entry of prepared.missing) {
		appendLine(
			"error",
			`${strings["console module not found"] || "Module not found"}: ${entry.spec}`,
		);
	}
	if (prepared.missing.length) return null;
	return prepared.code;
}

/** Folder of the active file — the anchor for relative imports. */
function activeFileDir() {
	const file = window.editorManager?.activeFile;
	if (!file) return "";
	if (file.location) return file.location;
	if (file.uri) {
		const uri = String(file.uri);
		return uri.includes("/") ? uri.slice(0, uri.lastIndexOf("/")) : "";
	}
	return "";
}

function revokeActiveUrls() {
	for (const url of activeUrls) {
		try {
			URL.revokeObjectURL(url);
		} catch {
			/* already gone */
		}
	}
	activeUrls = [];
}

/** Saves the current input as a named snippet. */
async function saveSnippetAction() {
	const code = ($input?.value || "").trim();
	if (!code) {
		toast(strings["console empty code"] || "Write some code first");
		return;
	}
	const existing = snippets.find((item) => item.code === code);
	const name = await prompt(
		strings["console snippet name"] || "Snippet name",
		existing?.name || "",
		"text",
	);
	if (name === null || name === undefined) return;
	if (!String(name).trim()) {
		toast(strings["console snippet name"] || "Snippet name");
		return;
	}
	upsertSnippet(snippets, String(name), code);
	saveReplSnippets(safeStorage(), snippets);
	toast(strings["console snippet saved"] || "Snippet saved");
}

/** Lists saved snippets: load one into the input or delete some. */
async function showSnippets() {
	if (!snippets.length) {
		toast(strings["console no snippets"] || "No saved snippets yet");
		return;
	}
	const choice = await select(strings["console snippets"] || "Snippets", [
		...snippets.map((item) => [item.name, item.name, "file-code"]),
		[
			"__delete",
			strings["console delete snippets"] || "Delete snippets",
			"delete",
		],
	]);
	if (!choice) return;
	if (choice === "__delete") return deleteSnippetFlow();
	const snippet = snippets.find((item) => item.name === choice);
	if (!snippet || !$input) return;
	$input.value = snippet.code;
	$input.focus();
	toast(strings["console snippet loaded"] || "Snippet loaded");
}

/** Deletes snippets one at a time through a select dialog. */
async function deleteSnippetFlow() {
	const choice = await select(
		strings["console delete snippets"] || "Delete snippets",
		snippets.map((item) => [item.name, item.name, "delete"]),
	);
	if (!choice) return;
	if (removeSnippet(snippets, choice)) {
		saveReplSnippets(safeStorage(), snippets);
		toast(strings["console snippet deleted"] || "Snippet deleted");
	}
}

function clearOutput() {
	if ($output) $output.content = "";
}

/**
 * Appends one output line (oldest are trimmed).
 * @param {"input"|"log"|"warn"|"error"|"result"} kind
 * @param {string} text
 */
function appendLine(kind, text) {
	if (!$output?.isConnected) return;
	const $line = (
		<div className={`repl-line repl-${kind}`}>{String(text || "")}</div>
	);
	$output.append($line);
	while ($output.childElementCount > OUTPUT_CAP) {
		$output.firstElementChild?.remove();
	}
	$output.scrollTop = $output.scrollHeight;
}

/** Locale-aware time (kept for parity with the git app helpers). */
function shortTime() {
	try {
		return new Intl.DateTimeFormat(getIntlLocale(lang?.code), {
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date());
	} catch {
		return "";
	}
}
