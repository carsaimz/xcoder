import tag from "html-tag-js";
import actionStack from "lib/actionStack";

/**
 * Floating sidebar windows — "após sidebar abrissem como janelas
 * independentes de sidebar (assim seriam um pouco grandes)".
 *
 * Instead of the panel living INSIDE the narrow sidebar overlay, each
 * app panel becomes a movable, resizable, maximizable window above the
 * editor (VS Code floating-window style). One window at a time —
 * activating another app swaps its content in, like VS Code does.
 *
 * The window is plain DOM moved around with pointer events; the app
 * container element itself is REUSED (moved into .sidebar-float-body),
 * so app code keeps working (isConnected stays true while the window
 * is in the document).
 */

const POS_KEY = "sidebarFloatPos";
const FLOAT_ENABLED_KEY = "sidebarFloatingWindows";

/** @type {HTMLElement|null} */
let $win = null;
/** @type {HTMLElement|null} */
let $body = null;
/** @type {HTMLElement|null} */
let $title = null;
/** @type {string|null} */
let currentId = null;
/** @type {(()=>void)|null} */
let onClose = null;

/** Whether floating windows are enabled (default ON). */
export function floatingEnabled() {
	return localStorage.getItem(FLOAT_ENABLED_KEY) !== "0";
}

export function setFloatingEnabled(value) {
	localStorage.setItem(FLOAT_ENABLED_KEY, value ? "1" : "0");
}

/**
 * Boot hold: while loading saved state the registry auto-activates
 * the last section - that must NOT pop a window open at launch.
 * The first user tap opens the window normally.
 */
let bootHold = true;

/** @param {boolean} value false when the boot restore is done */
export function setBootHold(value) {
	bootHold = value;
}

/** Whether a window is currently shown for the given app id. */
export function isOpenFor(id) {
	return Boolean($win) && currentId === id;
}

/**
 * Shows (or retargets) the floating window with the app's container.
 * @param {string} id app id
 * @param {string} title localized app title
 * @param {HTMLElement} container the app's .container element
 * @param {()=>void} [closeCallback] invoked by the window close button
 */
export function show(id, title, container, closeCallback) {
	if (!$win) buildWindow();
	if (onClose && currentId !== id) {
		// previous app still considers itself active — let the registry decide
	}
	onClose = closeCallback || null;
	if (bootHold) return;
	currentId = id;
	$title.textContent = title;
	$win.dataset.app = id;

	// move the SAME container node in (keeps listeners and scroll state)
	$body.textContent = "";
	$body.append(container);
	$win.classList.add("show");

	restorePos();
	// one back-button entry per open window
	try {
		actionStack.remove("sidebar-float");
	} catch {
		/* first open */
	}
	actionStack.push({
		id: "sidebar-float",
		action: close,
	});
}

/** Hides the window without touching the registry. */
export function close() {
	if (!$win) return;
	$win.classList.remove("show");
	currentId = null;
	if (onClose) {
		const cb = onClose;
		onClose = null;
		cb();
	}
	try {
		actionStack.remove("sidebar-float");
	} catch {
		/* stack already cleared */
	}
}

/** Removes the window from the registry's point of view (silent). */
export function reset() {
	currentId = null;
	onClose = null;
	if ($win) $win.classList.remove("show");
	try {
		actionStack.remove("sidebar-float");
	} catch {
		/* not pushed */
	}
}

/** Toggles maximize (inset:0). */
export function toggleMaximize() {
	if (!$win) return;
	const max = $win.classList.toggle("maximized");
	localStorage.setItem("sidebarFloatMax", max ? "1" : "0");
	syncMaxIcon();
}

function syncMaxIcon() {
	if (!$win) return;
	const $icon = $win.get(".sidebar-float-max");
	if (!$icon) return;
	const max = $win.classList.contains("maximized");
	$icon.className = `icon ${max ? "fullscreen_exit" : "fullscreen"} sidebar-float-max`;
}

function buildWindow() {
	$title = tag("span", { className: "sidebar-float-title" });
	const $close = tag("span", {
		className: "icon close sidebar-float-close",
		title: strings?.close || "Close",
		onclick: () => close(),
	});
	const $max = tag("span", {
		className: "icon fullscreen sidebar-float-max",
		title: strings?.["sidebar float maximize"] || "Maximize",
		onclick: () => toggleMaximize(),
	});
	const $header = tag("div", { className: "sidebar-float-header" });
	$header.append($title, $max, $close);
	$body = tag("div", { className: "sidebar-float-body scroll" });
	const $resize = tag("div", { className: "sidebar-float-resize" });
	$win = tag("div", { className: "sidebar-float" });
	$win.append($header, $body, $resize);
	document.body.append($win);

	makeDraggable($header, $win);
	makeResizable($resize, $win);

	if (localStorage.getItem("sidebarFloatMax") === "1") {
		$win.classList.add("maximized");
	}
	syncMaxIcon();
}

function clampRect(left, top, width, height) {
	const maxLeft = window.innerWidth - 80;
	const maxTop = window.innerHeight - 60;
	return {
		left: Math.min(Math.max(left, 0), Math.max(maxLeft, 0)),
		top: Math.min(Math.max(top, 0), Math.max(maxTop, 0)),
		width: Math.min(Math.max(width, 240), window.innerWidth - 12),
		height: Math.min(Math.max(height, 200), window.innerHeight - 12),
	};
}

function savePos() {
	if (!$win || $win.classList.contains("maximized")) return;
	localStorage.setItem(
		POS_KEY,
		JSON.stringify({
			left: $win.offsetLeft,
			top: $win.offsetTop,
			width: $win.offsetWidth,
			height: $win.offsetHeight,
		}),
	);
}

function restorePos() {
	if ($win.classList.contains("maximized")) return;
	let rect;
	try {
		rect = JSON.parse(localStorage.getItem(POS_KEY) || "null");
	} catch {
		rect = null;
	}
	const defaults = {
		left: 62,
		top: Math.round(window.innerHeight * 0.1),
		width: Math.min(Math.round(window.innerWidth * 0.78), 680),
		height: Math.round(window.innerHeight * 0.8),
	};
	const r = clampRect(
		rect?.left ?? defaults.left,
		rect?.top ?? defaults.top,
		rect?.width ?? defaults.width,
		rect?.height ?? defaults.height,
	);
	$win.style.left = `${r.left}px`;
	$win.style.top = `${r.top}px`;
	$win.style.width = `${r.width}px`;
	$win.style.height = `${r.height}px`;
}

function makeDraggable($handle, $target) {
	$handle.addEventListener("pointerdown", (e) => {
		if ($target.classList.contains("maximized")) return;
		if (e.target.closest(".sidebar-float-close, .sidebar-float-max")) return;
		e.preventDefault();
		const startX = e.clientX - $target.offsetLeft;
		const startY = e.clientY - $target.offsetTop;

		const move = (ev) => {
			const r = clampRect(
				ev.clientX - startX,
				ev.clientY - startY,
				$target.offsetWidth,
				$target.offsetHeight,
			);
			$target.style.left = `${r.left}px`;
			$target.style.top = `${r.top}px`;
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			savePos();
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	});
}

function makeResizable($handle, $target) {
	$handle.addEventListener("pointerdown", (e) => {
		if ($target.classList.contains("maximized")) return;
		e.preventDefault();
		e.stopPropagation();
		const startX = e.clientX;
		const startY = e.clientY;
		const startW = $target.offsetWidth;
		const startH = $target.offsetHeight;

		const move = (ev) => {
			const r = clampRect(
				$target.offsetLeft,
				$target.offsetTop,
				startW + (ev.clientX - startX),
				startH + (ev.clientY - startY),
			);
			$target.style.width = `${r.width}px`;
			$target.style.height = `${r.height}px`;
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			savePos();
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	});
}

export default {
	setBootHold,
	floatingEnabled,
	setFloatingEnabled,
	isOpenFor,
	show,
	close,
	reset,
	toggleMaximize,
};
