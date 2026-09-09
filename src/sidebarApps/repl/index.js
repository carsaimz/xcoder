import "./style.scss";
import toast from "components/toast";
import lang, { getIntlLocale } from "lib/lang";

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
/** @type {string[]} */
const history = [];
let historyIndex = -1;

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

	if (history[history.length - 1] !== code) history.push(code);
	if (history.length > 50) history.shift();
	historyIndex = -1;

	appendLine("input", code);
	$input.value = "";

	try {
		ensureWorker().postMessage({ id: ++requestSeq, code });
	} catch (error) {
		appendLine("error", error?.message || String(error));
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
