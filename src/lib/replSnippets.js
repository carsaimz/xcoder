/**
 * REPL saved snippets (roadmap v1.7.x item 3).
 *
 * Pure helpers for naming, storing and listing console snippets in a
 * storage backend (localStorage in production). Dependency-free so unit
 * tests run in Node.
 */

export const REPL_SNIPPETS_KEY = "repl.snippets";
export const REPL_SNIPPETS_CAP = 30;
export const SNIPPET_NAME_MAX = 60;
export const SNIPPET_CODE_MAX = 20000;

/**
 * Reads saved snippets. Returns [] for missing/corrupt data.
 * @param {Storage|{getItem:(k:string)=>string|null}} storage
 * @param {string} [key]
 * @returns {{name: string, code: string, ts: number}[]}
 */
export function loadReplSnippets(storage, key = REPL_SNIPPETS_KEY) {
	try {
		const raw = storage?.getItem?.(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(item) =>
					item &&
					typeof item === "object" &&
					typeof item.name === "string" &&
					typeof item.code === "string",
			)
			.map((item) => ({
				name: item.name.slice(0, SNIPPET_NAME_MAX),
				code: item.code.slice(0, SNIPPET_CODE_MAX),
				ts: Number(item.ts) || 0,
			}))
			.slice(-REPL_SNIPPETS_CAP);
	} catch {
		return [];
	}
}

/**
 * Persists snippets. Failures are silent (in-memory list keeps working).
 * @param {Storage|{setItem:(k:string,v:string)=>void}} storage
 * @param {{name: string, code: string, ts: number}[]} list
 * @param {string} [key]
 */
export function saveReplSnippets(storage, list, key = REPL_SNIPPETS_KEY) {
	try {
		storage?.setItem?.(
			key,
			JSON.stringify(
				list.map((item) => ({
					name: String(item.name).slice(0, SNIPPET_NAME_MAX),
					code: String(item.code).slice(0, SNIPPET_CODE_MAX),
					ts: Number(item.ts) || 0,
				})),
			),
		);
	} catch {
		/* storage unavailable — snippets stay in memory only */
	}
}

/**
 * Creates or replaces a snippet (same name wins). Mutates and returns
 * the list. Empty names/code are rejected.
 * @param {{name: string, code: string, ts: number}[]} list
 * @param {string} name
 * @param {string} code
 * @param {number} [now]
 * @returns {{list: typeof list, saved: boolean}}
 */
export function upsertSnippet(list, name, code, now = Date.now()) {
	const cleanName = String(name ?? "")
		.trim()
		.slice(0, SNIPPET_NAME_MAX);
	const cleanCode = String(code ?? "").slice(0, SNIPPET_CODE_MAX);
	if (!cleanName || !cleanCode.trim()) return { list, saved: false };

	const index = list.findIndex((item) => item.name === cleanName);
	const entry = { name: cleanName, code: cleanCode, ts: now };
	if (index >= 0) list.splice(index, 1, entry);
	else list.push(entry);
	while (list.length > REPL_SNIPPETS_CAP) list.shift();
	return { list, saved: true };
}

/**
 * Removes a snippet by name. Mutates and returns the list.
 * @param {{name: string, code: string, ts: number}[]} list
 * @param {string} name
 * @returns {boolean} whether an entry was removed
 */
export function removeSnippet(list, name) {
	const index = list.findIndex((item) => item.name === name);
	if (index === -1) return false;
	list.splice(index, 1);
	return true;
}
