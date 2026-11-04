import palette from "components/palette";
import fileIndex from "lib/fileIndex";
import files from "lib/fileList";
import openFile from "lib/openFile";
import { addedFolder } from "lib/openFolder";
import recents from "lib/recents";
import { highlightMatches, rankCandidates } from "utils/fuzzyMatch";
import helpers from "utils/helpers";

/**
 * @typedef {import('components/inputhints').HintModification} HintModification
 */

/**@type {HintModification} */
let hintsModification;
export default async function findFile() {
	palette(
		generateHints,
		onselect,
		strings["type filename"],
		() => {
			files.off("add-file", onAddFile);
			files.off("remove-file", onRemoveFile);
		},
		{ dynamic: true },
	);

	files.on("add-file", onAddFile);
	files.on("remove-file", onRemoveFile);

	/**
	 * Generates fuzzy-ranked hints for the current query. Open files come
	 * first, then recently used, then the folder listing and the native
	 * file index (VS Code Quick Open behaviour).
	 * @param {HintModification} hints Hint modification object
	 * @param {string} [query]
	 */
	async function generateHints(hints, query = "") {
		hintsModification = hints;
		const seen = new Set();
		const candidates = [];

		// already-open tabs: priority 1 (also the natural recents order)
		editorManager.files.forEach((file, index) => {
			if (file.uri) seen.add(file.uri);
			let { location = "" } = file;
			if (location) {
				location = helpers.getVirtualPath(location);
			}
			candidates.push({
				name: file.name,
				path: location || file.uri || "",
				url: file.uri || file.id,
				priority: 1 + index * 0.001,
			});
		});

		// on-disk files of open folders: priority 3 (recents get 2)
		const recentSet = new Set(recents.files);
		files().forEach((file) => {
			if (seen.has(file.url)) return;
			seen.add(file.url);
			const visiblePath = helpers.getVirtualPath(file.path || "");
			candidates.push({
				name: file.name,
				path: visiblePath || file.url,
				url: file.url,
				priority: recentSet.has(file.url) ? 2 : 3,
			});
		});

		const nativeRoots = addedFolder
			.filter(({ listFiles }) => listFiles)
			.map(({ url }) => url)
			.filter((url) => fileIndex.supports(url));
		if (nativeRoots.length) {
			try {
				const { entries = [] } = await fileIndex.query({
					roots: nativeRoots,
					text: query,
					limit: 300,
				});
				entries.forEach((file) => {
					if (seen.has(file.url)) return;
					seen.add(file.url);
					candidates.push({
						name: file.name,
						path: file.path || file.url,
						url: file.url,
						priority: 4,
					});
				});
			} catch (error) {
				console.warn("Unable to query native file index:", error);
			}
		}

		const ranking = rankCandidates(candidates, query, 50);
		return ranking.map(({ item, indices }) =>
			hintItem(item.name, item.path, item.url, indices),
		);
	}

	function onselect(value) {
		if (!value) return;
		openFile(value);
	}
}

/**
 * Generates hint item for inputhints. The filename renders with the
 * matched characters highlighted (VS Code quick-open look).
 * @param {string|{name: string, path: string, url: string}} name Hint text
 * @param {string} path Hint subtext
 * @param {string} url Hint value
 * @param {number[]} [indices] matched character positions inside name
 * @returns {{text: string, value: string}}
 */
function hintItem(name, path, url, indices = []) {
	if (typeof name === "object") {
		({ name, path, url } = name);
	}
	const recent = recents.files.find((file) => file === url);
	let subText = (path || url) ?? strings["new file"];
	if (subText.length > 50) {
		subText = `...${subText.slice(-50)}`;
	}
	const nameHtml = highlightMatches(name, indices);
	const recentBadge = recent ? `data-str='${strings["recently used"]}'` : "";
	return {
		text: `<div style="display: flex; flex-direction: column;">
        <strong ${recentBadge} style="font-size: 1rem;">${nameHtml}</strong>
        <span style="font-size: 0.8rem; opacity: 0.8;">${subText}</span>
      <div>`,
		value: url,
	};
}

function onAddFile({ name, url, path: visiblePath }) {
	hintsModification?.add(hintItem(name, visiblePath, url));
}

function onRemoveFile({ name, url, path: visiblePath }) {
	hintsModification?.remove(hintItem(name, visiblePath, url));
}
