import toast from "components/toast";
import prompt from "dialogs/prompt";
import { buildActionPrompt, MUTATING_KINDS } from "./actionPrompt";

/**
 * Selection-aware AI actions ("AI: explain/fix/refactor/comments/ask").
 *
 * They reference the active file (name + selection line range) and hand
 * the prompt to the AI chat sidebar, where the agent runs — the file
 * content is NOT copied into the message: the model reads the file
 * itself with its tools (read_active_file / read_file), honoring the
 * configured permission mode. Mutating actions (fix/refactor/comments)
 * get the full toolset; explain/ask run with read-only tools.
 */

/**
 * Runs an AI action on the active editor selection.
 * @param {"explain"|"fix"|"refactor"|"comments"|"custom"} kind
 * @returns {Promise<void>}
 */
export async function runAiAction(kind) {
	const editorManager = window.editorManager;
	const file = editorManager?.activeFile;

	if (!file || file.type !== "editor") {
		toast(strings["ai no file open"] || "Open a file first");
		return;
	}

	const editor = editorManager.editor;
	if (!editor) {
		toast(strings["ai no file open"] || "Open a file first");
		return;
	}

	const state = editor.state;
	const selection = state.selection.main;
	const hasSelection = selection.to > selection.from;

	let lineStart = 0;
	let lineEnd = 0;
	let selectionChars = 0;
	if (hasSelection) {
		lineStart = state.doc.lineAt(selection.from).number;
		lineEnd = state.doc.lineAt(selection.to).number;
		selectionChars = selection.to - selection.from;
	}

	let instruction = "";
	if (kind === "custom") {
		instruction = await prompt(
			strings["ai ask about selection"] || "Ask AI about this code",
			"",
			"text",
		);
		if (!instruction) return;
	}

	const promptText = buildActionPrompt(kind, {
		fileName: file.name || file.filename || "untitled",
		lineStart,
		lineEnd,
		selectionChars,
		instruction,
	});

	try {
		const { askAI } = await import("sidebarApps/ai");
		const mutating = MUTATING_KINDS.has(kind);
		const ok = await askAI(promptText, {
			readOnly: !mutating,
			forceTools: mutating,
		});
		if (ok !== false) {
			toast(strings["ai sent to chat"] || "Sent to AI chat");
		}
	} catch (error) {
		toast(`AI: ${error.message || error}`);
	}
}

/**
 * Opens the AI chat sidebar without sending anything.
 * @returns {Promise<void>}
 */
export async function openAiChat() {
	try {
		const { openAiChat: open } = await import("sidebarApps/ai");
		await open();
	} catch (error) {
		toast(`AI: ${error.message || error}`);
	}
}
