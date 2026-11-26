import fsOperation from "fileSystem";
import Url from "utils/Url";

/**
 * Project instructions — the Acode AI Agent / Pi convention (ported to
 * the built-in chat): the first of `AGENTS.md`, `.agents.md` or
 * `CLAUDE.md` in the workspace root is added to the agent's system
 * prompt, so per-project rules ("use tabs", "run the tests before
 * answering", "this is a monorepo") survive every conversation.
 * `AGENTS.md` wins when several exist.
 */

/** Instruction file names, in priority order. */
export const INSTRUCTION_FILES = ["AGENTS.md", ".agents.md", "CLAUDE.md"];

/** Max characters of instructions included in the system prompt. */
export const MAX_INSTRUCTION_CHARS = 24000;

/**
 * Picks the highest-priority instruction file present in the workspace
 * root. Pure — unit-testable.
 * @param {Object<string, boolean>} presence name -> exists
 * @returns {string|null} the file name to read
 */
export function pickInstructionFile(presence) {
	for (const name of INSTRUCTION_FILES) {
		if (presence[name]) return name;
	}
	return null;
}

/**
 * Reads the project instructions from the workspace root.
 * @param {string} root workspace root URL (empty/undefined when no folder)
 * @param {(path: string|string[]) => object} [fsOp] fsOperation factory (injectable for tests)
 * @returns {Promise<{file: string, text: string}|null>}
 */
export async function readProjectInstructions(root, fsOp = fsOperation) {
	if (!root || typeof root !== "string") return null;
	for (const name of INSTRUCTION_FILES) {
		try {
			const fs = fsOp(Url.join(root, name));
			if (!(await fs.exists())) continue;
			const text = String((await fs.readFile()) || "");
			if (!text.trim()) continue;
			const trimmed = text.trim();
			return {
				file: name,
				text:
					trimmed.length > MAX_INSTRUCTION_CHARS
						? `${trimmed.slice(0, MAX_INSTRUCTION_CHARS)}\n... (instructions truncated at ${MAX_INSTRUCTION_CHARS} chars)`
						: trimmed,
			};
		} catch {
			/* unreadable file — try the next one */
		}
	}
	return null;
}

/**
 * Formats the instructions as a system-prompt section.
 * @param {{file: string, text: string}|null} instructions
 * @returns {string} empty string when there are none
 */
export function formatProjectInstructions(instructions) {
	if (!instructions?.text) return "";
	return `PROJECT INSTRUCTIONS (${instructions.file}):\nThe workspace provides the following rules from the project owner — follow them for every change in this folder.\n\n${instructions.text}`;
}
