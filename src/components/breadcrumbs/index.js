import tag from "html-tag-js";

/**
 * Editor breadcrumbs — the VS Code path bar between the file tabs and
 * the code: "src › components › App.js". One element per editor pane;
 * segments come from the pane's active file (relative to the workspace
 * root when possible, name only for virtual files).
 */

/**
 * Pure path splitter used by the renderer (and unit tests).
 * @param {string} uri full file uri (file://...)
 * @param {string} [root] workspace root to relativize against
 * @returns {string[]} segments from the folder down to the filename
 */
export function crumbSegments(uri, root) {
	let path = String(uri || "").replace(/^file:\/\//, "");
	if (!path) return [];
	if (root) {
		const cleanRoot = String(root)
			.replace(/^file:\/\//, "")
			.replace(/\/+$/, "");
		if (cleanRoot && path.startsWith(`${cleanRoot}/`)) {
			path = path.slice(cleanRoot.length + 1);
		}
	}
	return path.split("/").filter(Boolean).slice(-4);
}

/**
 * Repaints a pane's breadcrumb element.
 * @param {HTMLElement} $crumbs the .editor-crumbs element
 * @param {object} [file] active file (editorManager file object)
 * @param {string} [root] workspace root
 */
export function updateCrumbs($crumbs, file, root) {
	if (!$crumbs) return;
	$crumbs.textContent = "";
	if (!file || file.type !== "editor") {
		$crumbs.classList.remove("has-path");
		return;
	}
	const segments = crumbSegments(file.uri || file.filename, root);
	if (!segments.length) {
		$crumbs.classList.remove("has-path");
		return;
	}
	$crumbs.classList.add("has-path");
	segments.forEach((segment, index) => {
		if (index > 0) {
			$crumbs.append(<span className="editor-crumbs-sep">›</span>);
		}
		$crumbs.append(
			<span
				className="editor-crumbs-seg"
				data-path={segments.slice(0, index + 1).join("/")}
			>
				{segment}
			</span>,
		);
	});
}

/**
 * Creates the breadcrumb element for an editor pane.
 * @returns {HTMLElement}
 */
export default function createBreadcrumbs() {
	return <div className="editor-crumbs" />;
}
