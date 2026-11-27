import { MergeView } from "@codemirror/merge";
import { EditorView, lineNumbers } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { getThemeExtensions } from "cm/themes";
import { getModeForPath } from "cm/modelist";
import FileBrowser from "pages/fileBrowser";
import fsOperation from "fileSystem";
import appSettings from "lib/settings";
import { openToolPage } from "pages/tools/toolPage";
import { diffStats } from "./lineDiff";
import "./style.scss";

const t = (key, fallback) => strings[key] || fallback;

/**
 * Visual diff editor (VS Code parity, roadmap v1.8.48): compare two
 * files side by side or inline, with change gutters and unchanged-region
 * collapsing — plus a «diff vs current» action in the file timeline
 * (compare a snapshot against the live file without restoring it).
 *
 * Opened from:
 *   - the tools hub (Ferramentas → Diff)
 *   - the command palette («openDiff»)
 *   - the timeline page (diff button per snapshot)
 *   - openDiffPage({...texts}) programmatic callers
 */

/** @type {{left: {path: string, text: string|null}, right: {path: string, text: string|null}} | null} */
let state = null;
/** @type {MergeView | null} */
let mergeView = null;
/** @type {HTMLElement | null} cached page container */
let $container = null;
/** @type {HTMLElement | null} */
let $host = null;
/** @type {HTMLElement | null} */
let $stats = null;
/** @type {HTMLElement | null} */
let $leftName = null;
/** @type {HTMLElement | null} */
let $rightName = null;
/** @type {HTMLElement | null} */
let $modeLabel = null;
let sideBySide = true;

const PAGE_ID = "diff-page";

/**
 * Opens (or refocuses) the diff page. Texts are optional — omit them to
 * start with two file pickers; pass leftText/rightText (e.g. from the
 * timeline) to compare immediately.
 *
 * @param {object} [opts]
 * @param {string} [opts.leftText] left document content
 * @param {string} [opts.rightText] right document content
 * @param {string} [opts.leftPath] display name / path of the left doc
 * @param {string} [opts.rightPath] display name / path of the right doc
 * @returns {HTMLElement} the page element
 */
export function openDiffPage(opts = {}) {
	const $page = openToolPage({
		id: PAGE_ID,
		titleKey: "diff",
		title: "Diff",
		className: "xc-diff",
		build: buildInto,
	});
	const $el = $page.querySelector(".xc-diff");
	if (!$el.__built) {
		buildInto($el);
	} else {
		resolveRefs($el);
		applyOpts(opts);
	}
	return $page;
}

/**
 * Compares arbitrary texts (timeline snapshots, scratch comparisons).
 * @param {object} opts
 * @param {string} opts.leftText snapshot/document text
 * @param {string} opts.rightText live/current text
 * @param {string} [opts.leftTitle] label for the left pane
 * @param {string} [opts.rightTitle] label for the right pane
 * @returns {HTMLElement} the page element
 */
export function openDiffForTexts({
	leftText,
	rightText,
	leftTitle,
	rightTitle,
}) {
	return openDiffPage({
		leftText,
		rightText,
		leftPath: leftTitle || t("diff snapshot", "snapshot"),
		rightPath: rightTitle || t("diff current", "atual"),
	});
}

/** Fresh build: initial state + toolbar + host + stats. */
function buildInto($el) {
	$el.__built = true;
	$container = $el;
	if (!state) {
		state = { left: { path: "", text: null }, right: { path: "", text: null } };
	}
	$el.append(buildToolbar());
	$host = <div className="xc-diff-host" />;
	$el.append($host);
	$stats = <div className="xc-diff-stats" />;
	$el.append($stats);
	rebuild();
}

/**
 * Re-resolves the module refs from a cached container (openToolPage
 * keeps the container alive between opens — the build runs once).
 * @param {HTMLElement} $el
 */
function resolveRefs($el) {
	$container = $el;
	$host = $el.querySelector(".xc-diff-host");
	$stats = $el.querySelector(".xc-diff-stats");
	$leftName = $el.querySelector(".xc-diff-left .xc-diff-name");
	$rightName = $el.querySelector(".xc-diff-right .xc-diff-name");
	$modeLabel = $el.querySelector(".xc-diff-mode-label");
}

/** @param {object} opts */
function applyOpts(opts) {
	if (!state) {
		state = { left: { path: "", text: null }, right: { path: "", text: null } };
	}
	if (opts.leftText !== undefined) {
		state.left = {
			path: opts.leftPath || state.left.path,
			text: opts.leftText,
		};
	} else if (opts.leftPath) {
		state.left.path = opts.leftPath;
	}
	if (opts.rightText !== undefined) {
		state.right = {
			path: opts.rightPath || state.right.path,
			text: opts.rightText,
		};
	} else if (opts.rightPath) {
		state.right.path = opts.rightPath;
	}
	rebuild();
}

/** Header toolbar: pickers, swap, side-by-side/inline toggle. */
function buildToolbar() {
	$leftName = <span className="xc-diff-name" />;
	$rightName = <span className="xc-diff-name" />;

	return (
		<div className="xc-diff-toolbar">
			<button
				type="button"
				className="xc-diff-btn xc-diff-left"
				onclick={() => pickFile("left")}
			>
				<span className="icon codicon-go-to-file" />
				{$leftName}
			</button>
			<button
				type="button"
				className="xc-diff-btn xc-diff-swap"
				title={t("diff swap", "Inverter lados")}
				aria-label={t("diff swap", "Inverter lados")}
				onclick={swapSides}
			>
				<span className="icon codicon-arrow-both" />
			</button>
			<button
				type="button"
				className="xc-diff-btn xc-diff-right"
				onclick={() => pickFile("right")}
			>
				<span className="icon codicon-go-to-file" />
				{$rightName}
			</button>
			<button
				type="button"
				className="xc-diff-btn xc-diff-mode"
				onclick={toggleMode}
			>
				<span className="icon codicon-split-horizontal" />
				<span className="xc-diff-mode-label">
					{sideBySide
						? t("diff side by side", "lado a lado")
						: t("diff inline", "em linha")}
				</span>
			</button>
		</div>
	);
}

/** Lets the user choose one side of the comparison via the file browser. */
async function pickFile(side) {
	try {
		const res = await FileBrowser(
			"file",
			side === "left"
				? t("diff pick a", "Ficheiro A")
				: t("diff pick b", "Ficheiro B"),
		);
		if (!res?.url) return;
		const text = await fsOperation(res.url).readFile("utf8");
		state[side] = { path: res.url, text };
		rebuild();
	} catch (error) {
		console.error(error);
		toast(strings.error || "Error");
	}
}

/** Swaps left/right documents and rebuilds. */
function swapSides() {
	const { left, right } = state;
	state = { left: right, right: left };
	rebuild();
}

/** Toggles side-by-side ↔ inline (unified) rendering. */
function toggleMode() {
	sideBySide = !sideBySide;
	if ($modeLabel) {
		$modeLabel.textContent = sideBySide
			? t("diff side by side", "lado a lado")
			: t("diff inline", "em linha");
	}
	if (mergeView?.reconfigure) {
		try {
			mergeView.reconfigure({ sideBySide });
			return;
		} catch (error) {
			console.error(error);
		}
	}
	rebuild();
}

/** @returns {string} short display name for a path */
function displayName(path) {
	if (!path) return t("diff select a file", "escolher ficheiro");
	return String(path).split(/[/\\]/).pop() || path;
}

/** Destroys the current MergeView (if any). */
function destroyMergeView() {
	try {
		mergeView?.destroy();
	} catch (error) {
		console.error(error);
	}
	mergeView = null;
}

/** Rebuilds the MergeView + stats from the current state. */
async function rebuild() {
	if (!$host || !state) return;
	destroyMergeView();
	if ($leftName) $leftName.textContent = displayName(state.left.path);
	if ($rightName) $rightName.textContent = displayName(state.right.path);
	$host.replaceChildren();

	const leftText = state.left.text;
	const rightText = state.right.text;
	if (leftText == null || rightText == null) {
		$host.append(
			<p className="xc-diff-empty">
				{t(
					"diff select two files",
					"Escolha dois ficheiros para comparar — lado a lado ou em linha.",
				)}
			</p>,
		);
		renderStats();
		return;
	}

	// languages load asynchronously (lazy @codemirror/lang-* bundles) —
	// await both before constructing the view so highlighting is there
	// from the first paint
	const [langA, langB] = await Promise.all([
		loadLanguageExt(state.left.path),
		loadLanguageExt(state.right.path),
	]);

	mergeView = new MergeView({
		a: { doc: leftText, extensions: editorExtensions(langA) },
		b: { doc: rightText, extensions: editorExtensions(langB) },
		parent: $host,
		gutter: true,
		sideBySide,
		highlightChanges: true,
		syntaxHighlightDeletions: true,
		collapseUnchanged: { margin: 3, minSize: 5 },
	});
	renderStats();
}

/**
 * Lazily loads the CM language extension for a path (best effort).
 * @param {string} path
 * @returns {Promise<Array>} extension array (possibly empty)
 */
async function loadLanguageExt(path) {
	try {
		const mode = getModeForPath(path);
		if (!mode?.languageExtension) return [];
		const ext = await mode.languageExtension();
		if (!ext) return [];
		return Array.isArray(ext) ? ext : [ext];
	} catch (error) {
		console.error(error);
		return [];
	}
}

/** Shared editor extensions for both diff panes. @param {Array} langExt */
function editorExtensions(langExt) {
	const theme = getThemeExtensions(appSettings?.value?.editorTheme, [oneDark]);
	return [
		lineNumbers(),
		EditorView.lineWrapping,
		EditorView.editable.of(true),
		theme,
		EditorView.theme({
			"&": { height: "100%", fontSize: "13px" },
			".cm-scroller": { overflow: "auto" },
			".cm-content": { fontFamily: "monospace" },
			".cm-gutters": { flexShrink: 0 },
		}),
		...(Array.isArray(langExt) ? langExt : langExt ? [langExt] : []),
	];
}

/** Renders the header stat chips (+added / −removed / identical). */
function renderStats() {
	if (!$stats || !state) return;
	$stats.replaceChildren();
	if (state.left.text == null || state.right.text == null) return;

	const { added, removed, identical } = diffStats(
		state.left.text,
		state.right.text,
	);
	if (identical) {
		$stats.append(
			<span className="xc-diff-chip identical">
				{t("diff identical", "idênticos")}
			</span>,
		);
		return;
	}
	if (added > 0) {
		$stats.append(
			<span className="xc-diff-chip added">
				+{added} {t("diff added", "adicionadas")}
			</span>,
		);
	}
	if (removed > 0) {
		$stats.append(
			<span className="xc-diff-chip removed">
				−{removed} {t("diff removed", "removidas")}
			</span>,
		);
	}
}
