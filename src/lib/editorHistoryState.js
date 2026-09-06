/**
 * Tab-history persistence (roadmap v1.5.x item 3).
 *
 * The editor keeps a back/forward history of visited files (v1.4.22).
 * The stack holds live file objects, which cannot be written to
 * localStorage directly — these helpers convert it to/from a plain
 * `{ ids, index }` snapshot that survives app restarts:
 *
 *   - serialize: live stack + index → `{ ids, index }` (index keeps
 *     pointing at the SAME file even if id-less entries are dropped);
 *   - deserialize: `{ ids, index }` + a resolver → `{ stack, index }`
 *     built from actually-resolvable files, with the cursor pinned to
 *     the recorded active id (falls back to the most recent entry).
 */

/** Hard cap, mirroring MAX_HISTORY in editorManager. */
export const MAX_EDITOR_HISTORY = 100;

/**
 * Serialize the live history stack into a JSON-safe snapshot.
 * @param {Array<{id?: string}>|undefined} stack live history stack (file objects)
 * @param {number|undefined} index current cursor position in the stack
 * @returns {{ids: string[], index: number}}
 */
export function serializeEditorHistory(stack, index) {
	if (!Array.isArray(stack) || stack.length === 0) {
		return { ids: [], index: -1 };
	}

	const ids = [];
	let newIndex = -1;
	stack.forEach((file, position) => {
		if (typeof file?.id === "string" && file.id) {
			ids.push(file.id);
			if (position === index) newIndex = ids.length - 1;
		}
	});

	if (!ids.length) return { ids: [], index: -1 };
	if (newIndex < 0) newIndex = ids.length - 1; // cursor was on an id-less entry
	return { ids, index: newIndex };
}

/**
 * Rebuild a history stack from a saved snapshot.
 * @param {{ids?: unknown, index?: unknown}|null|undefined} state saved snapshot
 * @param {(id: string) => unknown} resolveFile maps a stored id to a live file
 * @param {number} [maxEntries=MAX_EDITOR_HISTORY] hard cap on restored entries
 * @returns {{stack: Array<object>, index: number}}
 */
export function deserializeEditorHistory(
	state,
	resolveFile,
	maxEntries = MAX_EDITOR_HISTORY,
) {
	const ids = Array.isArray(state?.ids)
		? state.ids.filter((id) => typeof id === "string" && id)
		: [];

	const stack = [];
	for (const id of ids) {
		if (stack.length >= maxEntries) break;
		const file = typeof resolveFile === "function" ? resolveFile(id) : null;
		if (file && !stack.some((entry) => entry.id === id)) stack.push(file);
	}

	if (!stack.length) return { stack: [], index: -1 };

	// Pin the cursor to the recorded active FILE (id at snapshot index);
	// positions may shift when old ids no longer resolve.
	const activeId =
		typeof state?.ids?.[state?.index] === "string"
			? state.ids[state.index]
			: null;
	let index = activeId ? stack.findIndex((entry) => entry.id === activeId) : -1;
	if (index < 0) index = stack.length - 1;
	return { stack, index };
}
