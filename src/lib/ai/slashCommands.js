/**
 * AI chat slash commands.
 *
 * A slash command expands a short "/fix something broke" input into a full
 * structured prompt for the agent, optionally including the current editor
 * selection. Expansion is pure so it can be unit-tested.
 */

const MAX_INLINE_SELECTION = 8000;

/**
 * @typedef {object} SlashCommand
 * @property {string} id command name without the slash
 * @property {string} descriptionKey i18n key resolved by the UI
 * @property {string} fallbackDescription English fallback for the popup
 * @property {(args: {text: string, ctx: SlashContext}) => string} build prompt builder
 */

/**
 * @typedef {object} SlashContext
 * @property {boolean} hasFile is a file open in the editor
 * @property {string} [fileName] name/path of the active file
 * @property {string} [selection] current editor selection (may be empty)
 */

/** @type {SlashCommand[]} */
export const SLASH_COMMANDS = [
	{
		id: "explain",
		descriptionKey: "ai cmd explain",
		fallbackDescription: "Explain the selected code or the active file",
		build: ({ text, ctx }) =>
			[
				"Explain the following code in clear terms: what it does, its inputs/outputs and any notable behavior.",
				codeRef(ctx),
				text ? `Focus on: ${text}` : "",
				codeBlock(ctx),
			]
				.filter(Boolean)
				.join("\n\n"),
	},
	{
		id: "fix",
		descriptionKey: "ai cmd fix",
		fallbackDescription: "Find and fix bugs in the selection or active file",
		build: ({ text, ctx }) =>
			[
				"Find the bug or problem in the code below and fix it.",
				codeRef(ctx),
				text ? `Symptoms / context: ${text}` : "",
				codeBlock(ctx),
				"When you know the fix, apply it with edit_file (or apply_to_editor for the open buffer) and show the changed snippet.",
			]
				.filter(Boolean)
				.join("\n\n"),
	},
	{
		id: "refactor",
		descriptionKey: "ai cmd refactor",
		fallbackDescription: "Refactor for clarity and structure",
		build: ({ text, ctx }) =>
			[
				"Refactor the code below to improve clarity and structure without changing its behavior.",
				codeRef(ctx),
				text ? `Preferences: ${text}` : "",
				codeBlock(ctx),
				"Apply the changes with edit_file (or apply_to_editor for the open buffer) and summarize what you changed.",
			]
				.filter(Boolean)
				.join("\n\n"),
	},
	{
		id: "tests",
		descriptionKey: "ai cmd tests",
		fallbackDescription: "Write unit tests for the code",
		build: ({ text, ctx }) =>
			[
				"Write focused unit tests for the code below. Cover the happy paths, edge cases and error handling.",
				codeRef(ctx),
				text ? `Extra requirements: ${text}` : "",
				codeBlock(ctx),
				"Return the tests in a single code block and, when a test file already exists in the workspace, propose where to add them.",
			]
				.filter(Boolean)
				.join("\n\n"),
	},
	{
		id: "review",
		descriptionKey: "ai cmd review",
		fallbackDescription: "Review the code and list findings",
		build: ({ text, ctx }) =>
			[
				"Review the code below like a senior engineer. List concrete findings ordered by severity (bugs, security, performance, readability) with exact locations, then give an overall verdict.",
				codeRef(ctx),
				text ? `Focus areas: ${text}` : "",
				codeBlock(ctx),
			]
				.filter(Boolean)
				.join("\n\n"),
	},
	{
		id: "commit",
		descriptionKey: "ai cmd commit",
		fallbackDescription: "Commit a workspace snapshot via vcs",
		build: ({ text, ctx }) =>
			[
				"Create a version-control snapshot of the workspace.",
				"Steps: run `vcs status` to inspect what changed, derive a short conventional-commit message (feat/fix/chore/...), then run `vcs commit <message>`.",
				text ? `Message hint from the user: ${text}` : "",
			]
				.filter(Boolean)
				.join("\n\n"),
	},
];

export const SLASH_MAP = Object.fromEntries(
	SLASH_COMMANDS.map((command) => [command.id, command]),
);

/**
 * Returns the commands matching the current input prefix (used by the
 * autocomplete popup). Matches "/", "/ab", "/fix " etc.
 * @param {string} input current input value
 * @returns {SlashCommand[]}
 */
export function matchSlashCommands(input) {
	const value = String(input || "");
	if (!value.startsWith("/")) return [];
	const rest = value.slice(1);
	// once the user typed a space the command word is finished — close popup
	if (/\s/.test(rest)) return [];
	const query = rest.toLowerCase();
	return SLASH_COMMANDS.filter((command) => command.id.startsWith(query));
}

/**
 * Expands a slash command input into a full prompt.
 * @param {string} input raw chat input
 * @param {SlashContext} [ctx] editor context
 * @returns {string | null} expanded prompt, or null when the input is not a
 *                          valid slash command (plain input passes through)
 */
export function expandSlashCommand(input, ctx = {}) {
	const value = String(input || "").trim();
	if (!value.startsWith("/")) return null;

	const [rawId, ...rest] = value.slice(1).split(/\s+/);
	const command = SLASH_MAP[(rawId || "").toLowerCase()];
	if (!command) return null;

	return command.build({
		text: rest.join(" ").trim(),
		ctx: { selection: "", ...ctx },
	});
}

/**
 * Reference to the code location for the prompt preamble.
 * @param {SlashContext} ctx
 * @returns {string}
 */
function codeRef(ctx) {
	if (ctx.selection) return "Target: the editor selection below.";
	if (ctx.hasFile)
		return `Target: the active file "${ctx.fileName}". Read it with read_active_file if you need more context.`;
	return "Target: none — no file is open and nothing is selected. Ask the user which file to use if needed.";
}

/**
 * The fenced code block with the selection, when available.
 * @param {SlashContext} ctx
 * @returns {string}
 */
function codeBlock(ctx) {
	if (!ctx.selection) return "";
	const selection =
		ctx.selection.length > MAX_INLINE_SELECTION
			? `${ctx.selection.slice(0, MAX_INLINE_SELECTION)}\n... (selection truncated)`
			: ctx.selection;
	return `\`\`\`\n${selection}\n\`\`\``;
}
