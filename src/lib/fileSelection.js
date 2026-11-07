/**
 * Explorer multi-selection store (VS Code-like).
 *
 * Ctrl/Shift-click on desktop and the "Select" context-menu action on
 * touch enter selection mode; taps then toggle rows instead of opening
 * files and the context menu becomes a batch actions menu (copy, cut,
 * delete, open…). The explorer tree reads the state to highlight rows.
 */

/** @type {Set<string>} */
const selected = new Set();
/** Ordered urls of the list the last row was selected from (for ranges). */
let rangeContext = [];
let anchorUrl = "";
let active = false;
/** @type {Set<(state: {urls: string[], active: boolean}) => void>} */
const listeners = new Set();

/**
 * @param {string} url
 */
export function isSelected(url) {
	return selected.has(url);
}

/** Whether selection mode is currently on. */
export function isSelectionMode() {
	return active;
}

/** Selected urls (insertion order). */
export function selectedUrls() {
	return [...selected];
}

/** Number of selected rows. */
export function selectionCount() {
	return selected.size;
}

/**
 * Enters selection mode, optionally seeding the first row.
 * @param {string} [url]
 */
export function enterSelectionMode(url) {
	active = true;
	if (url) {
		selected.add(url);
		anchorUrl = url;
	}
	notify();
}

/** Exits selection mode and clears the selection. */
export function exitSelectionMode() {
	if (!active && !selected.size) return;
	active = false;
	selected.clear();
	anchorUrl = "";
	rangeContext = [];
	notify();
}

/**
 * Toggles one row (Ctrl-click / tap in selection mode).
 * @param {string} url
 * @param {string[]} [orderedUrls] list order for the range anchor
 */
export function toggle(url, orderedUrls = []) {
	if (orderedUrls.length) rangeContext = orderedUrls;
	if (selected.has(url)) {
		selected.delete(url);
		if (!selected.size) {
			active = false;
			rangeContext = [];
		}
	} else {
		selected.add(url);
		active = true;
		anchorUrl = url;
	}
	notify();
}

/**
 * Selects the range between the anchor and `url` inside the given
 * ordered list (Shift-click).
 * @param {string} url
 * @param {string[]} orderedUrls
 */
export function selectRange(url, orderedUrls) {
	if (!orderedUrls.length) return;
	rangeContext = orderedUrls;
	if (!anchorUrl || !orderedUrls.includes(anchorUrl)) {
		anchorUrl = orderedUrls.includes(url) ? url : orderedUrls[0];
	}
	const start = orderedUrls.indexOf(anchorUrl);
	const end = orderedUrls.indexOf(url);
	if (start === -1 || end === -1) return;
	const [from, to] = start <= end ? [start, end] : [end, start];
	for (let i = from; i <= to; i++) {
		selected.add(orderedUrls[i]);
	}
	active = true;
	notify();
}

/**
 * Selects every url of the current list context.
 * @param {string[]} orderedUrls
 */
export function selectAll(orderedUrls) {
	if (!orderedUrls?.length) return;
	rangeContext = orderedUrls;
	orderedUrls.forEach((url) => selected.add(url));
	active = true;
	notify();
}

/**
 * Removes urls from the selection (e.g. after delete/move).
 * @param {string[]} urls
 */
export function unselect(urls) {
	let changed = false;
	for (const url of urls) {
		if (selected.delete(url)) changed = true;
	}
	if (changed) {
		if (!selected.size) active = false;
		notify();
	}
}

/**
 * Subscribes to selection changes.
 * @param {(state: {urls: string[], active: boolean}) => void} listener
 * @returns {() => void} unsubscribe
 */
export function onSelectionChange(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** Clears everything (tests / hot reload). */
export function resetSelection() {
	selected.clear();
	rangeContext = [];
	anchorUrl = "";
	active = false;
	listeners.clear();
}

function notify() {
	const state = { urls: selectedUrls(), active };
	for (const listener of listeners) {
		try {
			listener(state);
		} catch (error) {
			window.log?.("error", "selection listener failed:", error);
		}
	}
}
