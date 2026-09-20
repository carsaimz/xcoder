import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import { applyToEditor } from "lib/ai/editorBridge";
import editorManager from "lib/editorManager";
import lang from "lib/lang";
import {
	cdnTags,
	copyPlan,
	formatBytes,
	LOCAL_LIBS,
	libSize,
	localTags,
} from "lib/localLibs";
import Url from "utils/Url";

/**
 * Local Libraries sidebar app — ships htmx, Alpine.js, jQuery, Bootstrap,
 * icon fonts (Bootstrap Icons, Boxicons, Font Awesome) and Chart.js inside
 * the app so projects can use them offline. Data lives in lib/localLibs.js
 * (pure, unit-tested); this file is only the UI: list → detail → actions.
 */

const t = (key, fallback) => strings[key] || fallback;

let $panel = null;
/** @type {string|null} */
let selectedId = null;

/** Description in the active UI language. */
function desc(lib) {
	return lang.code === "pt-br" ? lib.descPt : lib.descEn;
}

/**
 * Copies generated code to the clipboard (Cordova + browser).
 * @param {string} text
 */
function copyText(text) {
	const cordova = globalThis.cordova;
	if (cordova?.plugins?.clipboard) {
		cordova.plugins.clipboard.copy(text);
		toast(t("local libs copied", "Copied to clipboard"));
		return;
	}
	navigator.clipboard
		.writeText(text)
		.then(() => toast(t("local libs copied", "Copied to clipboard")))
		.catch((error) => toast(`clipboard: ${error.message || error}`));
}

/** Inserts a snippet at the editor cursor. */
function insertText(text) {
	const result = applyToEditor(editorManager, {
		action: "insert",
		text,
	});
	if (result.ok) {
		toast(t("dev tools inserted", "Inserted at cursor"));
	} else {
		toast(result.message);
	}
}

/** Creates every missing directory between base and base/...parts. */
async function ensureChain(base, parts) {
	let current = base;
	for (const part of parts) {
		if (!part) continue;
		const next = Url.join(current, part);
		if (!(await fsOperation(next).exists())) {
			await fsOperation(current).createDirectory(part);
		}
		current = next;
	}
	return current;
}

/** Reads a bundled lib file (cordova assets or fetch in browser builds). */
async function readAsset(url) {
	if (globalThis.ASSETS_DIRECTORY) {
		return fsOperation(url).readFile();
	}
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status}: ${url}`);
	return res.blob();
}

/** Removes the url scheme so paths can be shown in toasts. */
function shortDir(url) {
	return String(url).replace(/^file:\/\//, "");
}

/**
 * Copies the bundled files of a lib into the active file's folder, under
 * libs/<id>/…, so the local tags resolve offline.
 * @param {LocalLib} lib
 */
async function copyToProject(lib) {
	const file = editorManager.activeFile;
	const base = file?.uri
		? Url.dirname(file.uri)
		: globalThis.DATA_STORAGE || "";
	if (!base) {
		toast(t("local libs no folder", "Open a file or folder first"));
		return;
	}
	const destRoot = Url.join(base, "libs");
	const plan = copyPlan(lib, destRoot);
	for (const entry of plan) {
		const parts = [lib.id, ...entry.dirParts, entry.name].filter(Boolean);
		await ensureChain(destRoot, parts.slice(0, -1));
		const data = await readAsset(entry.from);
		await fsOperation(Url.join(destRoot, parts.join("/"))).writeFile(data);
	}
	toast(
		t("local libs copied to", "Copied to {dir}").replace(
			/\{dir\}/g,
			shortDir(destRoot),
		),
	);
}

/** Card for the list view. */
function libCard(lib) {
	const $card = (
		<button className="libs-card" type="button">
			<span className="libs-card-head">
				<span className="libs-name">{lib.name}</span>
				<span className="libs-version">v{lib.version}</span>
			</span>
			<span className="libs-desc">{desc(lib)}</span>
			<span className="libs-meta">
				<span>{formatBytes(libSize(lib))}</span>
				<span>
					{lib.files.length} {lib.files.length === 1 ? "file" : "files"}
				</span>
				<span>{lib.license}</span>
			</span>
		</button>
	);
	$card.onclick = () => {
		selectedId = lib.id;
		render();
	};
	return $card;
}

/** Detail view with files and actions. */
function libDetail(lib) {
	const $view = <div className="libs-detail scroll" />;
	const $back = (
		<button className="libs-back" type="button">
			← {t("local libs all", "All libraries")}
		</button>
	);
	$back.onclick = () => {
		selectedId = null;
		render();
	};

	const $actions = <div className="libs-actions" />;
	const action = (label, primary, onclick) => {
		const $btn = (
			<button
				className={primary ? "libs-btn primary" : "libs-btn"}
				type="button"
			>
				{label}
			</button>
		);
		$btn.onclick = onclick;
		$actions.append($btn);
	};
	action(t("local libs copy local", "Copy local tag"), true, () =>
		copyText(localTags(lib)),
	);
	action(t("local libs copy cdn", "Copy CDN tag"), false, () =>
		copyText(cdnTags(lib)),
	);
	action(t("dev tools insert", "Insert"), false, () =>
		insertText(localTags(lib)),
	);
	action(t("local libs copy project", "Copy to project"), false, () =>
		copyToProject(lib).catch((error) =>
			toast(`copy: ${error.message || error}`),
		),
	);

	$view.append(
		<div className="libs-detail-head">
			{$back}
			<h2 className="libs-title">{lib.name}</h2>
			<div className="libs-meta">
				<span>v{lib.version}</span>
				<span>{formatBytes(libSize(lib))}</span>
				<span>{lib.license}</span>
				<span>{lib.site.replace(/^https?:\/\//, "")}</span>
			</div>
			<p className="libs-desc">{desc(lib)}</p>
		</div>,
		$actions,
		<div className="libs-files">
			{lib.files.map((file) => (
				<div className="libs-file">
					<span className="libs-file-path">{file.path}</span>
					<span className="libs-file-size">{formatBytes(file.size)}</span>
				</div>
			))}
		</div>,
		<div className="libs-snippet">
			<span className="libs-snippet-label">
				{t("local libs tag local", "Local tag (after copy)")}
			</span>
			<pre className="libs-snippet-code scroll">{localTags(lib)}</pre>
		</div>,
	);
	return $view;
}

/** Renders list or detail for the current selection. */
function render() {
	if (!$panel?.isConnected) return;
	$panel.textContent = "";
	if (selectedId) {
		const lib = LOCAL_LIBS.find((entry) => entry.id === selectedId);
		if (lib) {
			$panel.append(libDetail(lib));
			return;
		}
		selectedId = null;
	}
	$panel.append(
		<div className="libs-list scroll">
			{LOCAL_LIBS.map((lib) => libCard(lib))}
		</div>,
	);
}

/** Retranslates when the language changes mid-session. */
function onLangChange() {
	render();
}

/** Sidebar app init — runs once at install. */
function initApp(el) {
	el.classList.add("libs-app");
	el.append(<div className="libs-root" />);
	$panel = el.get(".libs-root");
	render();
	document.addEventListener("langchange", onLangChange);
	return () => {
		document.removeEventListener("langchange", onLangChange);
	};
}

function onSelected(el) {
	el?.querySelector(".libs-root")?.scrollTo?.(0, 0);
}

export default [
	"svg:book-open",
	"libs",
	strings["local libs"] || "Bibliotecas",
	initApp,
	false,
	onSelected,
	{ titleKey: "local libs" },
];
