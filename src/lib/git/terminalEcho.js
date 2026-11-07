/**
 * Sidebar ⇄ terminal reflection for git operations.
 *
 * When the Source Control sidebar (or any UI surface) runs a git
 * operation, the equivalent command is echoed into the open local
 * terminal so what happened is visible in BOTH surfaces — the VS Code
 * feeling of one integrated tool. Terminal commands (vshell `git` /
 * engine calls) broadcast git-change events in the other direction and
 * the sidebar refreshes on them (see lib/git/events.js).
 */

/** Last terminal echo (dedupes rapid double events in tests). */
let lastEcho = "";

/**
 * Writes a dim "[xcoder] git …" line into every connected LOCAL
 * terminal (never SSH sessions) without executing anything.
 * @param {string} command full command line, e.g. `git commit -m "x"`
 */
export async function echoGitCommand(command) {
	const line = `[xcoder] ${command}`;
	if (line === lastEcho) return;
	lastEcho = line;
	try {
		const { TerminalManager } = await import("components/terminal");
		for (const entry of TerminalManager.terminals.values()) {
			const component = entry?.component;
			if (!component?.write || component.remoteSsh) continue;
			try {
				component.writeln(`\x1b[2m${line}\x1b[0m`);
			} catch {
				/* terminal closing — ignore */
			}
		}
	} catch {
		/* TerminalManager unavailable (tests / early boot) — ignore */
	}
}

/** Clears the dedupe cache (tests). */
export function resetGitEcho() {
	lastEcho = "";
}
