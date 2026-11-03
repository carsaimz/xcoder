import "./style.scss";
import tag from "html-tag-js";
import actionStack from "lib/actionStack";

/**
 * Right dock — the VS Code "secondary side bar": a fixed panel docked to
 * the RIGHT edge of the screen, next to the editor (used by the AI chat
 * "painel de IA ancorado").
 *
 * Like floatingWindow, the app container element itself is MOVED into the
 * dock body, so app code keeps working (isConnected stays true). One app
 * at a time; the floating window stays ABOVE the dock so other tools never
 * get hidden behind it.
 *
 * Geometry mirrors the shell: the dock ends above the status bar (which
 * spans the full width, VS Code style) and above the quicktools footer.
 */

const WIDTH_KEY = "rightDockWidth";
/** app ids remembered as "anchored" (dock instead of floating window) */
const DOCK_PREF_KEY = "rightDockPrefs";
/** apps that open ANCHORED by default (user request: painel de IA ancorado) */
const DEFAULT_ANCHORED = new Set(["ai"]);

/** @type {HTMLElement|null} */
let $dock = null;
/** @type {HTMLElement|null} */
let $body = null;
/** @type {HTMLElement|null} */
let $title = null;
/** @type {string|null} */
let currentId = null;
/** @type {(()=>void)|null} */
let onClose = null;
/** @type {MutationObserver|null} */
let bottomObserver = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let measureTimer = null;

/** Parsed dock preferences: { [appId]: "right" } */
function prefs() {
	try {
		return JSON.parse(localStorage.getItem(DOCK_PREF_KEY) || "{}");
	} catch {
		return {};
	}
}

/** Whether the app prefers the anchored right panel over a window. */
export function prefEnabled(id) {
	const saved = prefs()[id];
	if (saved) return saved === "right";
	return DEFAULT_ANCHORED.has(id);
}

/** Remember (or clear) the "anchored" preference of an app. */
export function setPref(id, value) {
	const map = prefs();
	// store the explicit choice so the default can evolve later
	map[id] = value ? "right" : "float";
	localStorage.setItem(DOCK_PREF_KEY, JSON.stringify(map));
}

/** Whether the dock is currently shown for the given app id. */
export function isOpenFor(id) {
	return Boolean($dock?.classList.contains("show")) && currentId === id;
}

/** App id currently docked (null when empty). */
export function activeWindowId() {
	return currentId;
}

/** Docked width in px (persisted, clamped to the viewport). */
function width() {
	const saved = Number(localStorage.getItem(WIDTH_KEY));
	const max = Math.max(Math.round(window.innerWidth * 0.9), 280);
	if (Number.isFinite(saved) && saved >= 260) {
		return Math.min(saved, max);
	}
	return Math.min(Math.max(Math.round(window.innerWidth * 0.42), 300), 560);
}

/**
 * Bottom offset that keeps the status bar (and the quicktools footer when
 * the status bar is hidden) fully visible — VS Code keeps its status bar
 * spanning the whole width with panels ending above it.
 * @returns {number}
 */
function bottomOffset() {
	const lines = Number(window.root?.getAttribute?.("footer-height")) || 0;
	const $bar = document.getElementById("status-bar");
	if ($bar?.isConnected && $bar.classList.contains("show")) {
		const bottom = Number.parseFloat(getComputedStyle($bar).bottom);
		return (Number.isFinite(bottom) ? bottom : lines * 40) + $bar.offsetHeight;
	}
	return lines * 40;
}

/** Recomputes the dock bottom edge (status bar / footer aware). */
function syncBottom() {
	if (!$dock) return;
	$dock.style.bottom = `${bottomOffset()}px`;
}

function watchBottom() {
	syncBottom();
	bottomObserver?.disconnect();
	bottomObserver = new MutationObserver(syncBottom);
	const $bar = document.getElementById("status-bar");
	if ($bar) {
		bottomObserver.observe($bar, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}
	if (window.root) {
		bottomObserver.observe(window.root, {
			attributes: true,
			attributeFilter: ["footer-height"],
		});
	}
}

/** Refresh the CodeMirror measuring after layout changes. */
function refreshEditor() {
	clearTimeout(measureTimer);
	measureTimer = setTimeout(() => {
		const editor = window.editorManager?.editor;
		try {
			editor?.resize?.(true);
		} catch {
			editor?.requestMeasure?.();
		}
	}, 250);
}

/**
 * Shows (or retargets) the right dock with the app's container.
 * @param {string} id app id
 * @param {string} title localized app title
 * @param {HTMLElement} container the app's .container element
 * @param {()=>void} [closeCallback] invoked by the dock close button
 */
export function show(id, title, container, closeCallback) {
	if (!$dock) build();
	onClose = closeCallback || null;
	currentId = id;
	$title.textContent = title;
	$dock.dataset.app = id;

	// move the SAME container node in (keeps listeners and scroll state)
	$body.textContent = "";
	$body.append(container);
	$dock.style.width = `${width()}px`;
	$dock.classList.add("show");
	watchBottom();
	refreshEditor();

	try {
		actionStack.remove("right-dock");
	} catch {
		/* first open */
	}
	actionStack.push({
		id: "right-dock",
		action: close,
	});
}

/** Closes the dock (fires the close callback). */
export function close() {
	if (!$dock) return;
	$dock.classList.remove("show");
	currentId = null;
	bottomObserver?.disconnect();
	bottomObserver = null;
	if (onClose) {
		const cb = onClose;
		onClose = null;
		cb();
	}
	try {
		actionStack.remove("right-dock");
	} catch {
		/* already removed */
	}
	refreshEditor();
}

/** Silent reset (registry bookkeeping) — no callback. */
export function reset() {
	if (!$dock) return;
	$dock.classList.remove("show");
	currentId = null;
	onClose = null;
	bottomObserver?.disconnect();
	bottomObserver = null;
	try {
		actionStack.remove("right-dock");
	} catch {
		/* not pushed */
	}
}

function build() {
	$title = tag("span", { className: "right-dock-title" });
	const $undock = tag("span", {
		className: "icon launch right-dock-undock",
		title: strings?.["right dock undock"] || "Open as window",
		onclick: () => {
			const detail = { id: currentId };
			close();
			// sidebarApp.js opens the floating window for this app
			document.dispatchEvent(new CustomEvent("sidebar-app-undock", { detail }));
		},
	});
	const $close = tag("span", {
		className: "icon close right-dock-close",
		title: strings?.close || "Close",
		onclick: () => close(),
	});
	const $header = tag("div", { className: "right-dock-header" });
	$header.append($title, $undock, $close);
	$body = tag("div", { className: "right-dock-body scroll" });
	const $resize = tag("div", {
		className: "right-dock-resize w-resize",
	});
	$dock = tag("div", { className: "right-dock", id: "right-dock" });
	$dock.append($resize, $header, $body);
	document.body.append($dock);

	makeResizable($resize);
	window.addEventListener("resize", () => {
		if (!$dock?.classList.contains("show")) return;
		$dock.style.width = `${width()}px`;
		syncBottom();
		refreshEditor();
	});
}

/** Drags the left edge to resize the dock (west edge). */
function makeResizable($handle) {
	$handle.addEventListener("pointerdown", (e) => {
		if (!$dock?.classList.contains("show")) return;
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startW = $dock.offsetWidth;

		const move = (ev) => {
			const w = startW - (ev.clientX - startX);
			const max = Math.max(Math.round(window.innerWidth * 0.9), 280);
			$dock.style.width = `${Math.min(Math.max(w, 260), max)}px`;
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			localStorage.setItem(WIDTH_KEY, String($dock.offsetWidth));
			refreshEditor();
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	});
}

export default {
	prefEnabled,
	setPref,
	isOpenFor,
	activeWindowId,
	show,
	close,
	reset,
};
