import toast from "components/toast";
import prompt from "dialogs/prompt";
import { buildActionPrompt, MAX_CODE_CHARS } from "./actionPrompt";

/**
 * Selection-aware AI actions ("AI: explain/fix/refactor/comments/ask").
 *
 * They grab the current selection (or the whole file), build a context-rich
 * prompt and hand it to the AI chat sidebar, where the full agent runs —
 * so mutating actions (fix/refactor/comments) can actually edit the file
 * with its tools, honoring the configured permission mode.
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
        let code = state.doc.sliceString(selection.from, selection.to);
        let lineStart = 1;

        // Nothing selected -> operate on the whole file (capped).
        if (!code.trim()) {
                code = state.doc.toString();
                lineStart = 1;
        } else {
                lineStart = state.doc.lineAt(selection.from).number;
        }

        let truncated = false;
        if (code.length > MAX_CODE_CHARS) {
                code = code.slice(0, MAX_CODE_CHARS);
                truncated = true;
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
                fileName: file.name || "untitled",
                code,
                truncated,
                instruction,
                lineStart,
        });

        try {
                const { askAI } = await import("sidebarApps/ai");
                const ok = await askAI(promptText);
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
