/**
 * Pure helpers of the minimap — kept import-free so unit tests can
 * exercise them without dragging CodeMirror into the test environment.
 */

/**
 * Classification of a Lezer node name into a minimap color role.
 * Node names come from the various Lezer grammars (javascript, html,
 * css, python...) but share conventions: *Comment, *String, *Number...
 * @param {string} name Lezer node name
 * @returns {"comment"|"string"|"number"|"keyword"|"tag"|"text"}
 */
export function tokenRole(name) {
	const n = String(name || "").toLowerCase();
	if (!n || n === "document" || n === "content") return "text";
	if (n.includes("comment")) return "comment";
	if (n.includes("string") || n.includes("char")) return "string";
	if (
		n.includes("number") ||
		n.includes("bool") ||
		n.includes("null") ||
		n.includes("undefined") ||
		n.includes("atom")
	) {
		return "number";
	}
	if (
		n.includes("keyword") ||
		n.includes("statement") ||
		n.includes("control") ||
		n === "if" ||
		n === "for" ||
		n === "while" ||
		n === "return"
	) {
		return "keyword";
	}
	if (n.includes("tag") || n.includes("element") || n.includes("component")) {
		return "tag";
	}
	return "text";
}

/**
 * Color per role, tuned for dark and light editor backgrounds.
 * @param {"comment"|"string"|"number"|"keyword"|"tag"|"text"} role
 * @param {boolean} dark whether the editor theme is dark
 * @returns {string} css color
 */
export function roleColor(role, dark) {
	if (dark) {
		switch (role) {
			case "comment":
				return "rgba(160, 166, 178, 0.55)";
			case "string":
				return "rgba(134, 197, 102, 0.8)";
			case "number":
				return "rgba(220, 156, 98, 0.85)";
			case "keyword":
				return "rgba(197, 134, 192, 0.85)";
			case "tag":
				return "rgba(86, 156, 214, 0.85)";
			default:
				return "rgba(212, 216, 224, 0.75)";
		}
	}
	switch (role) {
		case "comment":
			return "rgba(106, 115, 128, 0.5)";
		case "string":
			return "rgba(12, 121, 25, 0.75)";
		case "number":
			return "rgba(175, 88, 0, 0.8)";
		case "keyword":
			return "rgba(0, 92, 197, 0.8)";
		case "tag":
			return "rgba(128, 7, 190, 0.8)";
		default:
			return "rgba(60, 66, 74, 0.8)";
	}
}

/**
 * Measures one line for the block render: indentation level (visual,
 * tabs count as `tabSize` columns) and the trimmed text length.
 * @param {string} line raw line text
 * @param {number} tabSize indent size for tabs
 * @returns {{indent: number, length: number}}
 */
export function lineMetrics(line, tabSize = 2) {
	let indent = 0;
	let i = 0;
	for (; i < line.length; i++) {
		const ch = line[i];
		if (ch === " ") indent += 1;
		else if (ch === "\t") indent += tabSize;
		else break;
	}
	return { indent, length: line.length - i };
}

/**
 * Maps a vertical click position on the minimap to the target editor
 * scroll offset (top of the viewport), given the document height in
 * minimap pixels and the editor scroll extent.
 * @param {number} y click offset inside the minimap canvas
 * @param {number} canvasHeight minimap canvas height (css px)
 * @param {number} scrollHeight editor scrollHeight
 * @param {number} clientHeight editor clientHeight
 * @returns {number} scrollTop to apply
 */
export function scrollToFromClick(y, canvasHeight, scrollHeight, clientHeight) {
	if (!canvasHeight || scrollHeight <= clientHeight) return 0;
	const max = scrollHeight - clientHeight;
	// center the viewport on the clicked document position
	const offset = (y / canvasHeight) * scrollHeight - clientHeight / 2;
	return Math.round(Math.min(Math.max(offset, 0), max));
}
