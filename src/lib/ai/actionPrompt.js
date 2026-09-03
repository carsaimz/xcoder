/**
 * Prompt builders for the AI selection actions ("explain", "fix", etc.).
 *
 * The file content is NOT embedded in the message: the agent reads the
 * file itself with its tools (read_active_file / read_file), so it always
 * sees the live buffer and the whole project context. Kept pure (no
 * editor/DOM imports) so it can be unit-tested.
 */

/**
 * @typedef {"explain"|"fix"|"refactor"|"comments"|"custom"} AiActionKind
 */

/** Kinds that may modify the file (the agent is told to use its tools). */
export const MUTATING_KINDS = new Set(["fix", "refactor", "comments"]);

const INSTRUCTIONS = {
	explain:
		"Explain the file below: what it does, its key logic and any pitfalls or bugs you notice. Be concise and structured. Do not modify anything.",
	fix: "Find the bugs and problems in the file below and FIX them. Read the file first, then use your editing tools (read_file + edit_file or apply_to_editor) to apply the changes to the real file, then list each change you made.",
	refactor:
		"Refactor the file below for readability and maintainability without changing its behavior. Read the file first, then use your editing tools (read_file + edit_file or apply_to_editor) to apply the changes, then summarize what you improved.",
	comments:
		"Add clear, helpful comments/docstrings to the file below, keeping the existing style. Read the file first, then use your editing tools (read_file + edit_file or apply_to_editor) to apply them to the real file, then show the updated code.",
};

/**
 * Builds the user message sent to the AI chat for a selection action.
 *
 * @param {AiActionKind} kind
 * @param {object} ctx
 * @param {string} [ctx.fileName] name of the active file
 * @param {number} [ctx.lineStart] 1-based first line of the selection
 * @param {number} [ctx.lineEnd] 1-based last line of the selection
 * @param {number} [ctx.selectionChars] size of the selection, if any
 * @param {string} [ctx.instruction] free-form instruction (kind === "custom")
 * @returns {string} prompt text
 */
export function buildActionPrompt(kind, ctx) {
	const { fileName, lineStart, lineEnd, selectionChars, instruction } =
		ctx || {};
	const where = fileName ? `\`${fileName}\`` : "the file open in the editor";
	const readHint =
		"Read the file yourself first (read_active_file for the live buffer incl. unsaved edits, or read_file with the path) — its content is intentionally not included in this message.";

	let target = where;
	if (lineStart && selectionChars) {
		const lines =
			lineEnd && lineEnd > lineStart
				? `${lineStart}-${lineEnd}`
				: `${lineStart}`;
		target = `${where} — the current selection (lines ${lines}, ${selectionChars} chars)`;
	}

	switch (kind) {
		case "custom": {
			const ask = String(instruction || "").trim();
			return [
				ask || `Review ${where} and share your thoughts.`,
				"",
				`Target: ${target}.`,
				readHint,
			].join("\n");
		}
		default: {
			const instruction2 = INSTRUCTIONS[kind] || INSTRUCTIONS.explain;
			return [instruction2, "", `Target: ${target}.`, readHint].join("\n");
		}
	}
}
