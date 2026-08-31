/**
 * Prompt builders for the AI selection actions ("explain", "fix", etc.).
 *
 * Kept pure (no editor/DOM imports) so it can be unit-tested.
 */

/** Maximum characters of code sent in a single action prompt. */
export const MAX_CODE_CHARS = 12000;

/**
 * @typedef {"explain"|"fix"|"refactor"|"comments"|"custom"} AiActionKind
 */

/** Kinds that may modify the file (the agent is told to use its tools). */
export const MUTATING_KINDS = new Set(["fix", "refactor", "comments"]);

const INSTRUCTIONS = {
	explain:
		"Explain the code below: what it does, its key logic and any pitfalls or bugs you notice. Be concise and structured. Do not modify anything.",
	fix: "Find the bugs and problems in the code below and FIX them. Use your editing tools (read_file + edit_file) to apply the changes to the real file, then list each change you made.",
	refactor:
		"Refactor the code below for readability and maintainability without changing its behavior. Use your editing tools (read_file + edit_file) to apply the changes to the real file, then summarize what you improved.",
	comments:
		"Add clear, helpful comments/docstrings to the code below, keeping the existing style. Use your editing tools (read_file + edit_file) to apply them to the real file, then show the updated code.",
};

/**
 * Builds the user message sent to the AI chat for a selection action.
 *
 * @param {AiActionKind} kind
 * @param {object} ctx
 * @param {string} ctx.fileName name of the active file
 * @param {string} ctx.code selected code (or whole file)
 * @param {boolean} [ctx.truncated] whether code was cut at MAX_CODE_CHARS
 * @param {string} [ctx.instruction] free-form instruction (kind === "custom")
 * @param {number} [ctx.lineStart] 1-based line where the code starts
 * @returns {string} prompt text
 */
export function buildActionPrompt(kind, ctx) {
	const { fileName, code, truncated, instruction, lineStart } = ctx || {};
	const where = fileName ? `\`${fileName}\`` : "the current file";
	const location =
		lineStart && lineStart > 1 ? ` (starting at line ${lineStart})` : "";

	switch (kind) {
		case "custom": {
			const ask = String(instruction || "").trim();
			const head = ask || "Review the code below and share your thoughts.";
			return [
				head,
				"",
				`Code from ${where}${location}:`,
				fence(code),
			].join("\n");
		}
		default: {
			const lines = [INSTRUCTIONS[kind] || INSTRUCTIONS.explain, ""];
			if (truncated) {
				lines.push(
					`Note: the code was truncated at ${MAX_CODE_CHARS} characters — ask to read the full file if needed.`,
					"",
				);
			}
			lines.push(`Code from ${where}${location}:`, fence(code));
			return lines.join("\n");
		}
	}
}

/**
 * Wraps code in a fenced block, inferring nothing (model sees the filename).
 * @param {string} code
 * @returns {string}
 */
function fence(code) {
	return `\`\`\`\n${String(code ?? "")}\n\`\`\``;
}
