import "./style.scss";
import Sidebar from "components/sidebar";
import fileIcons from "lib/fileIcons";
import settings from "lib/settings";

/**@type {HTMLElement} */
let container;

export default [
	"svg:files", // icon
	"files", // id
	strings["files"], // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
	{
		titleKey: "files",
		group: "primary",
		titleActions: getTitleActions,
	},
];

/**
 * View title actions for the Explorer title bar (VS Code parity):
 * new file, new folder, refresh and collapse-all. Dependencies load on
 * first tap — the module itself must stay import-light because it sits
 * in the boot graph of the sidebar (and of every fileIcons consumer).
 * @returns {{icon: string, title?: string, onclick: Function}[]}
 */
function getTitleActions() {
	return [
		{
			icon: "file-plus",
			title: strings["new file"],
			onclick: () => createEntry("file"),
		},
		{
			icon: "folder-plus",
			title: strings["new folder"],
			onclick: () => createEntry("folder"),
		},
		{
			icon: "refresh-cw",
			title: strings["refresh"],
			onclick: refreshFolders,
		},
		{
			icon: "chevrons-down",
			title: strings["collapse all"] || "Collapse All",
			onclick: collapseAll,
		},
	];
}

/**
 * Shared dependencies of the title actions, resolved once on first use.
 * @returns {Promise<object>} { addedFolder, fsOperation, prompt, select, toast, config, helpers, Url }
 */
let depsPromise = null;
function loadDeps() {
	depsPromise ??= Promise.all([
		import("lib/openFolder"),
		import("fileSystem"),
		import("dialogs/prompt"),
		import("dialogs/select"),
		import("components/toast"),
		import("lib/config"),
		import("utils/helpers"),
		import("utils/Url"),
	]).then(
		([
			{ addedFolder },
			{ default: fsOperation },
			{ default: prompt },
			{ default: select },
			{ default: toast },
			{ default: config },
			{ default: helpers },
			{ default: Url },
		]) => ({
			addedFolder,
			fsOperation,
			prompt,
			select,
			toast,
			config,
			helpers,
			Url,
		}),
	);
	return depsPromise;
}

/**
 * Creates a file or folder at the root of the target folder.
 * @param {"file"|"folder"} kind
 * @returns {Promise<void>}
 */
async function createEntry(kind) {
	const { addedFolder, fsOperation, prompt, toast, config, helpers, Url } =
		await loadDeps();

	if (!addedFolder.length) {
		toast(strings["open folder"]);
		return;
	}

	let name = await prompt(
		kind === "file" ? strings["enter file name"] : strings["folder name"],
		"",
		"filename",
		{
			match: config.FILE_NAME_REGEX,
			required: true,
		},
	);

	name = helpers.fixFilename(name);
	if (!name) return;

	const folder = await resolveTargetFolder({ addedFolder, select, toast });
	if (!folder) return;

	const entryUrl = Url.join(folder.url, name);
	if (await fsOperation(entryUrl).exists()) {
		toast(`${name}: ${strings["already exists"]}`);
		return;
	}

	try {
		if (kind === "file") {
			await fsOperation(folder.url).createFile(name);
		} else {
			await fsOperation(folder.url).createDirectory(name);
		}
		folder.reload();
	} catch (error) {
		helpers.error(error);
	}
}

/**
 * Picks the folder root a title action applies to: the only open folder
 * when there is exactly one, otherwise a selection dialog.
 * @param {{addedFolder: object[], select: Function, toast: Function}} deps
 * @returns {Promise<object|null>} folder object or null when cancelled
 */
async function resolveTargetFolder({ addedFolder, select, toast }) {
	const folders = addedFolder.filter((folder) => folder.url);
	if (!folders.length) {
		toast(strings["open folder"]);
		return null;
	}
	if (folders.length === 1) return folders[0];

	const options = folders.map((folder) => [
		folder.url,
		folder.title || folder.url,
	]);
	const url = await select(strings["select folder"], options);
	if (!url) return null;
	return folders.find((folder) => folder.url === url) || null;
}

/** Reloads every open folder (Explorer refresh button). */
async function refreshFolders() {
	const { addedFolder, toast } = await loadDeps();
	if (!addedFolder.length) {
		toast(strings["open folder"]);
		return;
	}
	addedFolder.forEach((folder) => folder.reload?.());
}

/** Collapses every folder list in the Explorer (VS Code collapse-all). */
function collapseAll() {
	const lists = container.getAll(":scope > div");
	lists.forEach((list) => {
		if (typeof list.collapse === "function" && !list.collapsed) {
			list.collapse();
		}
	});
	if (lists.length) fixHeight(lists[0]);
}

/**
 * Initialize files app
 * @param {HTMLElement} el
 */
function initApp(el) {
	container = el;
	container.classList.add("files");
	container.setAttribute("data-msg", strings["open folder"]);
	// VS Code Explorer-style section header (rendered via CSS ::before)
	container.setAttribute(
		"data-title",
		(strings["explorer title"] || "Explorer").toUpperCase(),
	);
	container.style.overflowX = "auto";
	container.addEventListener("click", clickHandler);
	editorManager.on(
		["new-file", "int-open-file-list", "remove-file"],
		(position) => {
			if (
				typeof position === "string" &&
				position !== settings.OPEN_FILE_LIST_POS_SIDEBAR
			)
				return;
			const fileList = container.get(":scope > div.file-list");
			if (fileList) fixHeight(fileList);
		},
	);
	editorManager.on("add-folder", fixHeight);
	Sidebar.on("show", onSelected);
}

/**
 * On selected handler for files app
 * @param {HTMLElement} el
 */
function onSelected(el) {
	// Phone sidebars and inactive sidebar apps are detached, so document-wide
	// icon updates cannot reach them until this view is shown again.
	fileIcons.refreshRenderedIcons(container);
	const $scrollableLists = container.getAll(":scope .scroll[data-scroll-top]");
	$scrollableLists.forEach(($el) => {
		$el.scrollTop = $el.dataset.scrollTop;
	});
}

/**
 * Click handler for files app
 * @param {MouseEvent} e
 * @returns
 */
function clickHandler(e) {
	if (!container.children.length) {
		xcoder.exec("open-folder");
		return;
	}

	const { target } = e;
	if (target.matches(".files>.list>.tile")) {
		fixHeight(target.parentElement);
	}
}

/**
 * Update list height
 * @param {HTMLElement} target Target element
 */
export function fixHeight(target) {
	const lists = Array.from(container.getAll(":scope > div"));
	const ITEM_HEIGHT = 30;

	let height = (lists.length - 1) * ITEM_HEIGHT;
	let activeFileList;

	if (settings.value.openFileListPos === settings.OPEN_FILE_LIST_POS_SIDEBAR) {
		const [firstList] = lists;
		if (firstList.classList.contains("file-list")) {
			activeFileList = firstList;
			if (firstList.unclasped) {
				const heightOffset = height - ITEM_HEIGHT;
				const totalHeight =
					ITEM_HEIGHT * activeFileList.$ul.children.length + ITEM_HEIGHT;
				const maxHeight =
					lists.length === 1 || !lists.slice(1).find((list) => list.unclasped)
						? window.innerHeight
						: window.innerHeight / 2;
				const minHeight = Math.min(totalHeight, maxHeight - heightOffset);

				activeFileList.style.maxHeight = `${minHeight}px`;
				activeFileList.style.height = `${minHeight}px`;
				height += minHeight - ITEM_HEIGHT;
			}
		}
	}

	lists.forEach((list) => {
		if (list === activeFileList) return;

		if (target === activeFileList) {
			if (list.collapsed) {
				list.style.removeProperty("max-height");
				list.style.removeProperty("height");
				return;
			}
			target = list;
		}

		if (list === target && target.unclasped) {
			list.style.maxHeight = `calc(100% - ${height}px)`;
			list.style.height = `calc(100% - ${height}px)`;
			return;
		}

		if (list.collapsed) {
			list.style.removeProperty("max-height");
			list.style.removeProperty("height");
			return;
		}

		list.collapse();
		list.style.removeProperty("max-height");
		list.style.removeProperty("height");
		return;
	});
}
