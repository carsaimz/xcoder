import settings from "lib/settings";

/**
 * Tool names that power the "search the web" quick toggle in the chat
 * composer. `settings.aiWebTools` (default: on) decides whether they are
 * offered to the model.
 * @type {Set<string>}
 */
export const WEB_TOOL_NAMES = new Set(["web_search", "read_url"]);

/**
 * Applies the "search the web" quick toggle to a tool allowlist.
 *
 * - toggle ON + agent allowlist → unchanged (web tools were already in);
 * - toggle ON + empty allowlist (chat mode) → ONLY the web tools ride
 *   along — the user explicitly enabled web search, not agent tools;
 * - toggle OFF → web tools are dropped from whatever was requested
 *   (for `null`/agent mode the full name list is needed to rebuild).
 *
 * Kept as a tiny dependency-light module so the chat UI, the agent and
 * the unit tests can share the exact same rule.
 * @param {string[] | null} allowlist tool allowlist ([] = chat mode,
 *        null = agent mode with every tool)
 * @param {string[]} [allToolNames] every registered tool name (agent mode)
 * @returns {string[] | null} effective allowlist
 */
export function applyWebToolsToggle(allowlist, allToolNames = []) {
	const webOn = settings.value?.aiWebTools !== false;
	if (webOn) {
		if (allowlist && allowlist.length) return allowlist;
		if (allowlist) return [...WEB_TOOL_NAMES];
		return allowlist; // null = agent mode with every tool
	}
	const source = allowlist || allToolNames;
	return source.filter((name) => !WEB_TOOL_NAMES.has(name));
}
