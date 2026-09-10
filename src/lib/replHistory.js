/**
 * REPL history persistence (roadmap v1.7.x item 3).
 *
 * Pure helpers shared by the JS Console sidebar app: the executed-code
 * history survives app restarts through a storage backend (localStorage
 * in production). Kept dependency-free so unit tests run in Node.
 */

export const REPL_HISTORY_KEY = "repl.history";
export const REPL_HISTORY_CAP = 50;

/**
 * Reads the persisted history. Returns [] for missing/corrupt data.
 * @param {Storage|{getItem:(k:string)=>string|null}} storage
 * @param {string} [key]
 * @returns {string[]}
 */
export function loadReplHistory(storage, key = REPL_HISTORY_KEY) {
	try {
		const raw = storage?.getItem?.(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((entry) => typeof entry === "string")
			.map((entry) => entry.slice(0, 10000))
			.slice(-REPL_HISTORY_CAP);
	} catch {
		return [];
	}
}

/**
 * Persists the history. Failures (quota, private mode, tests) are silent:
 * the in-memory list keeps working.
 * @param {Storage|{setItem:(k:string,v:string)=>void}} storage
 * @param {string[]} list
 * @param {string} [key]
 */
export function saveReplHistory(storage, list, key = REPL_HISTORY_KEY) {
	try {
		storage?.setItem?.(key, JSON.stringify(list.slice(-REPL_HISTORY_CAP)));
	} catch {
		/* storage unavailable — history stays in memory only */
	}
}

/**
 * Appends a command to the history list (mutates and returns the list).
 * Consecutive duplicates collapse into one entry and the cap is enforced.
 * @param {string[]} list in-memory history (oldest first)
 * @param {string} code executed code
 * @param {number} [cap]
 * @returns {string[]}
 */
export function pushReplEntry(list, code, cap = REPL_HISTORY_CAP) {
	const entry = String(code ?? "").trim();
	if (!entry) return list;
	if (list[list.length - 1] !== entry) {
		list.push(entry);
		while (list.length > cap) list.shift();
	}
	return list;
}
