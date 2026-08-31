/**
 * Bridge between the AI agent and the editor currently open in the app.
 *
 * Every function takes an editorManager-like object as its first argument
 * so the whole module stays unit-testable without the real editor runtime:
 *  - manager.activeFile: { type, uri, filename, isUnsaved } | null
 *  - manager.editor: CodeMirror EditorView (state.doc, state.selection, dispatch)
 *  - manager.files: array of open file records
 */

/** Max characters of buffer text returned to the model. */
const MAX_EDITOR_READ_CHARS = 12000;

/** Max characters accepted for a single editor mutation. */
const MAX_APPLY_CHARS = 30000;

/**
 * Collects context about the active editor file.
 * @param {object} manager editorManager-like
 * @returns {object} context record (hasFile=false when nothing is open)
 */
export function getEditorContext(manager) {
	const file = manager?.activeFile;
	if (!file || file.type !== "editor") {
		return { hasFile: false };
	}

	const view = manager.editor;
	const context = {
		hasFile: true,
		path: file.uri || file.filename || "(unsaved)",
		name: file.filename || "(unsaved)",
		dirty: Boolean(file.isUnsaved),
		lines: 0,
		selectionChars: 0,
		selectionLines: 0,
		hasSelection: false,
		cursorLine: 0,
		cursorColumn: 0,
	};

	if (view?.state?.doc) {
		const doc = view.state.doc;
		const selection = view.state.selection?.main;
		context.lines = doc.lines;
		if (selection) {
			context.hasSelection = selection.to > selection.from;
			context.selectionChars = selection.to - selection.from;
			if (context.hasSelection && doc.lineAt) {
				try {
					context.selectionLines =
						doc.lineAt(selection.to).number -
						doc.lineAt(selection.from).number +
						1;
				} catch {
					context.selectionLines = 0;
				}
			}
			if (doc.lineAt) {
				try {
					const line = doc.lineAt(selection.head);
					context.cursorLine = line.number;
					context.cursorColumn = selection.head - line.from + 1;
				} catch {
					/* ignore cursor position errors */
				}
			}
		}
	}

	return context;
}

/**
 * Formats the editor context as a compact report for the model.
 * @param {object} context record from getEditorContext
 * @returns {string}
 */
export function formatEditorContext(context) {
	if (!context?.hasFile) {
		return "No file is currently open in the editor.";
	}
	const parts = [
		`path: ${context.path}`,
		`lines: ${context.lines}`,
		`unsaved changes: ${context.dirty ? "yes" : "no"}`,
	];
	if (context.hasSelection) {
		parts.push(
			`selection: ${context.selectionChars} chars across ${context.selectionLines} line(s)`,
		);
	}
	if (context.cursorLine) {
		parts.push(`cursor: line ${context.cursorLine}, column ${context.cursorColumn}`);
	}
	return `Active editor file\n${parts.join("\n")}`;
}

/**
 * Reads the live editor buffer (including unsaved changes) with line
 * numbers, using the same "N: text" convention as read_file.
 * @param {object} manager editorManager-like
 * @param {{startLine?: number, lineCount?: number}} [range]
 * @returns {string}
 */
export function readActiveBuffer(manager, range = {}) {
	const file = manager?.activeFile;
	if (!file || file.type !== "editor") {
		return "ERROR: no file is open in the editor.";
	}
	const view = manager.editor;
	if (!view?.state?.doc) {
		return "ERROR: the active editor is not ready.";
	}

	const text = view.state.doc.toString();
	const lines = text.split("\n");
	const start = Math.max(1, Number(range.startLine) || 1);
	const count = Math.min(800, Number(range.lineCount) || 400);
	const slice = lines.slice(start - 1, start - 1 + count);
	if (!slice.length) {
		return `ERROR: start_line ${start} is beyond the end of the file (${lines.length} lines).`;
	}
	const numbered = slice
		.map((line, index) => `${start + index}: ${line}`)
		.join("\n");
	return truncate(numbered, MAX_EDITOR_READ_CHARS);
}

/**
 * Lists the files currently open in editor tabs.
 * @param {object} manager editorManager-like
 * @returns {string}
 */
export function listOpenFiles(manager) {
	const files = Array.isArray(manager?.files) ? manager.files : [];
	const open = files.filter((file) => file?.type === "editor" || file?.uri);
	if (!open.length) {
		return "No files are open.";
	}
	const active = manager?.activeFile;
	return open
		.map((file) => {
			const flags = [];
			if (active && file === active) flags.push("active");
			if (file.isUnsaved) flags.push("unsaved");
			const suffix = flags.length ? ` (${flags.join(", ")})` : "";
			return `${file.filename || file.uri || "(untitled)"}${suffix}`;
		})
		.join("\n");
}

/**
 * Applies text to the live editor buffer. The change stays unsaved so the
 * user can review it before saving.
 * @param {object} manager editorManager-like
 * @param {{action: "insert"|"replace_selection"|"replace_all", text: string}} args
 * @returns {{ok: boolean, message: string}}
 */
export function applyToEditor(manager, args) {
	const file = manager?.activeFile;
	if (!file || file.type !== "editor") {
		return { ok: false, message: "ERROR: no file is open in the editor." };
	}
	const view = manager.editor;
	if (!view?.state || typeof view.dispatch !== "function") {
		return { ok: false, message: "ERROR: the active editor is not ready." };
	}

	const action = args?.action;
	const text = String(args?.text ?? "");
	if (!action) {
		return { ok: false, message: "ERROR: action is required." };
	}
	if (text.length > MAX_APPLY_CHARS) {
		return {
			ok: false,
			message: `ERROR: text is too large (${text.length} chars, max ${MAX_APPLY_CHARS}).`,
		};
	}

	const selection = view.state.selection?.main ?? { from: 0, to: 0 };
	let transaction;
	let description;

	if (action === "insert") {
		const at = selection.to ?? 0;
		transaction = { changes: { from: at, to: at, insert: text } };
		description = `inserted ${text.length} chars at cursor`;
	} else if (action === "replace_selection") {
		if (!selection || selection.to === selection.from) {
			return {
				ok: false,
				message: "ERROR: there is no selection to replace. Use action 'insert' or 'replace_all'.",
			};
		}
		transaction = {
			changes: { from: selection.from, to: selection.to, insert: text },
		};
		description = `replaced selection (${selection.to - selection.from} chars)`;
	} else if (action === "replace_all") {
		const length = view.state.doc.length ?? 0;
		transaction = { changes: { from: 0, to: length, insert: text } };
		description = `replaced whole buffer (${length} chars)`;
	} else {
		return {
			ok: false,
			message: `ERROR: unknown action '${action}'. Use insert, replace_selection or replace_all.`,
		};
	}

	view.dispatch(transaction);
	return {
		ok: true,
		message: `Applied to ${file.filename || file.uri || "buffer"}: ${description}. The change is unsaved — ask the user to review and save.`,
	};
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
	if (!text) return "";
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n... (truncated)`;
}
