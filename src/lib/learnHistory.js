/**
 * Learn history — persistent memory of visited study sites.
 *
 * Pure module (no DOM): the Learn tool page records every site the user
 * opens and the catalog shows badges + a "Recentes" row from it.
 * Stored in localStorage so the memory survives restarts.
 */

/** localStorage key holding the visited-site registry. */
const HISTORY_KEY = "learnVisited";

/** @returns {Object<string, {count: number, last: number}>} */
function readStore() {
	try {
		const raw = localStorage.getItem(HISTORY_KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function writeStore(store) {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
	} catch {
		/* storage unavailable — persistence is best-effort */
	}
}

/**
 * Records a visit (increments the counter and updates the timestamp).
 * @param {string} url site URL
 */
export function recordVisit(url) {
	if (!url) return;
	const store = readStore();
	const entry = store[url] || { count: 0, last: 0 };
	entry.count += 1;
	entry.last = Date.now();
	store[url] = entry;
	writeStore(store);
}

/** @param {string} url @returns {boolean} */
export function isVisited(url) {
	return Boolean(readStore()[url]);
}

/** @param {string} url @returns {number} visit count (0 when never visited) */
export function visitCount(url) {
	return readStore()[url]?.count || 0;
}

/** @returns {Object<string, {count: number, last: number}>} */
export function getVisited() {
	return readStore();
}

/**
 * Most recently visited sites, newest first.
 * @param {string[]} catalogUrls urls to map back to catalog entries
 * @param {number} [limit]
 * @returns {Array<{url: string, count: number, last: number}>}
 */
export function getRecent(catalogUrls, limit = 4) {
	const store = readStore();
	const wanted = new Set(catalogUrls);
	return Object.entries(store)
		.filter(([url]) => wanted.has(url))
		.map(([url, entry]) => ({ url, count: entry.count, last: entry.last }))
		.sort((a, b) => b.last - a.last)
		.slice(0, limit);
}

/** Clears the visited-site memory. */
export function clearVisited() {
	writeStore({});
}
