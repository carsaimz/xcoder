import "./style.scss";
import { getLspDiagnostics, LSP_DIAGNOSTICS_EVENT } from "cm/lsp/diagnostics";
import { getModeForPath } from "cm/modelist";
import tag from "html-tag-js";
import appSettings from "lib/settings";

/**
 * VS Code-style status bar — the slim bar at the very bottom showing
 * real editor facts (cursor position, indent, encoding, language mode,
 * LSP diagnostics). Only real data is shown: sections that have nothing
 * to say stay hidden.
 *
 * Updates come from editorManager events + document selectionchange
 * (covers taps/drags/typing in the contenteditable editor without
 * adding a CodeMirror extension) + the LSP diagnostics event.
 */

const UPDATE_DELAY = 120;

/**@type {HTMLElement|null} */
let $bar = null;
/**@type {HTMLElement|null} */
let $left = null;
/**@type {HTMLElement|null} */
let $right = null;
/**@type {HTMLElement|null} */
let $diagnostics = null;
/**@type {HTMLElement|null} */
let $cursor = null;
/**@type {HTMLElement|null} */
let $indent = null;
/**@type {HTMLElement|null} */
let $encoding = null;
/**@type {HTMLElement|null} */
let $mode = null;
/**@type {ReturnType<typeof setTimeout>|null} */
let updateTimer = null;
/**@type {boolean} */
let started = false;

/** The manager instance backing the editor right now. */
function manager() {
	return window.editorManager;
}

/** Marks the active editor file (null for terminal/welcome/preview tabs). */
function activeEditorFile() {
	const file = manager()?.activeFile;
	return file?.type === "editor" ? file : null;
}

/** Shows the bar only while an editor file is open. */
function syncVisibility() {
	if (!$bar) return;
	if (activeEditorFile()) {
		$bar.classList.add("show");
	} else {
		$bar.classList.remove("show");
	}
}

/** Re-reads everything the bar displays from the live editor. */
function update() {
	if (!$bar) return;
	syncVisibility();
	const file = activeEditorFile();
	if (!file) return;

	const view = manager()?.editor;
	const state = view?.state;
	if (state?.doc) {
		const head = state.selection?.main?.head ?? 0;
		let line = 1;
		let column = 1;
		try {
			const cursorLine = state.doc.lineAt(head);
			line = cursorLine.number;
			column = head - cursorLine.from + 1;
		} catch {
			/* keep 1/1 for empty or just-swapped states */
		}
		if ($cursor) {
			$cursor.textContent = `${strings["status bar line"] || "Ln"} ${line}, ${
				strings["status bar column"] || "Col"
			} ${column}`;
		}
	} else if ($cursor) {
		$cursor.textContent = "";
	}

	const { softTab = true, tabSize = 2 } = appSettings?.value || {};
	if ($indent) {
		$indent.textContent = softTab
			? `${strings["status bar spaces"] || "Spaces"}: ${tabSize}`
			: `${strings["status bar tab size"] || "Tab Size"}: ${tabSize}`;
	}

	if ($encoding) {
		$encoding.textContent = String(file.encoding || "UTF-8").toUpperCase();
	}

	if ($mode) {
		const mode = getModeForPath(file.uri || file.filename || "");
		$mode.textContent = mode?.caption || mode?.name || "";
	}

	updateDiagnostics(state);
}

/** Sets the diagnostics section from the live editor state. */
function updateDiagnostics(state) {
	if (!$diagnostics) return;
	let errors = 0;
	let warnings = 0;
	try {
		for (const diagnostic of getLspDiagnostics(
			state ?? manager()?.editor?.state,
		)) {
			if (diagnostic?.severity === "error") errors++;
			else if (diagnostic?.severity === "warning") warnings++;
		}
	} catch {
		/* diagnostics are optional decoration */
	}
	if (!errors && !warnings) {
		$diagnostics.classList.remove("show");
		$diagnostics.textContent = "";
		return;
	}
	$diagnostics.classList.add("show");
	$diagnostics.textContent = "";
	if (errors) {
		$diagnostics.append(
			tag("span", {
				className: "statusbar-diag errors",
				textContent: `✕ ${errors}`,
			}),
		);
	}
	if (warnings) {
		$diagnostics.append(
			tag("span", {
				className: "statusbar-diag warnings",
				textContent: `⚠ ${warnings}`,
			}),
		);
	}
}

/** Debounced update — selectionchange can fire rapidly while dragging. */
function scheduleUpdate() {
	ensureWired();
	if (updateTimer) clearTimeout(updateTimer);
	updateTimer = setTimeout(() => {
		updateTimer = null;
		update();
	}, UPDATE_DELAY);
}

/** Opens the go-to-line prompt (VS Code Ln/Col click behavior). */
function gotoLine() {
	xcoder.exec("goto");
}

/** Opens the language-mode palette. */
function changeMode() {
	import("palettes/changeMode")
		.then(({ default: changeModePalette }) => changeModePalette())
		.catch(() => {});
}

/** Opens the encoding palette. */
function changeEncoding() {
	import("palettes/changeEncoding")
		.then(({ default: changeEncodingPalette }) => changeEncodingPalette())
		.catch(() => {});
}

/**
 * Creates (once) and returns the status bar element; starts its listeners.
 * The caller appends it after the quicktools footer (very bottom).
 * @returns {HTMLElement}
 */
export default function getStatusBar() {
	if ($bar) return $bar;

	$diagnostics = <span className="statusbar-item statusbar-diagnostics" />;
	$cursor = (
		<span
			className="statusbar-item clickable"
			data-action="statusbar-goto"
			ontouchend={gotoLine}
			onclick={gotoLine}
		/>
	);
	$indent = <span className="statusbar-item" />;
	$encoding = (
		<span
			className="statusbar-item clickable"
			data-action="statusbar-encoding"
			ontouchend={changeEncoding}
			onclick={changeEncoding}
		/>
	);
	$mode = (
		<span
			className="statusbar-item clickable"
			data-action="statusbar-mode"
			ontouchend={changeMode}
			onclick={changeMode}
		/>
	);

	$left = <div className="statusbar-side left">{$diagnostics}</div>;
	$right = (
		<div className="statusbar-side right">
			{$cursor}
			{$indent}
			{$encoding}
			{$mode}
		</div>
	);
	$bar = (
		<div id="status-bar" className="statusbar" role="status">
			{$left}
			{$right}
		</div>
	);

	startListeners();
	// paint whatever is already open (restored session) — later changes
	// arrive through the listeners
	update();
	return $bar;
}

/** Manager instance currently wired to the editor events. */
let wiredManager = null;

/** Binds the editor events once per manager instance (the editor boots
 * async, so the first attempts run before window.editorManager exists). */
function ensureWired() {
	const em = manager();
	if (!em || em === wiredManager || typeof em.on !== "function") return;
	wiredManager = em;
	em.on(["switch-file", "file-loaded", "rename-file"], scheduleUpdate);
	em.on("editor-state-changed", scheduleUpdate);
	em.on("focus", scheduleUpdate);
	em.on("blur", scheduleUpdate);
}

/** Wires the manager events, selectionchange and LSP diagnostics event. */
function startListeners() {
	if (started) return;
	started = true;

	ensureWired();
	document.addEventListener("selectionchange", scheduleUpdate);
	document.addEventListener(LSP_DIAGNOSTICS_EVENT, scheduleUpdate);
	window.addEventListener("resize", scheduleUpdate);
	// events give instant updates; this light tick guarantees the bar
	// eventually matches the editor even when an event is missed (late
	// boot, swapped manager instance, programmatic changes)
	setInterval(() => {
		ensureWired();
		scheduleUpdate();
	}, 1000);
}
