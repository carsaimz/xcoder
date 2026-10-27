import toast from "components/toast";
import tag from "html-tag-js";
import logger from "lib/logger";
import appSettings from "lib/settings";
import SidebarApp from "./sidebarApp";

const SIDEBAR_APPS_LAST_SECTION = "sidebarAppsLastSection";

/**@type {HTMLElement} */
let $apps;
/**@type {HTMLElement} */
let $sidebar;
/**@type {string} */
let currentSection = localStorage.getItem(SIDEBAR_APPS_LAST_SECTION);
/**@type {SidebarApp[]} */
const apps = [];

/**
 * @param {string} icon icon of the app
 * @param {string} id id of the app
 * @param {HTMLElement} el element to show in sidebar
 * @param {string} title title of the app
 * @param {(container:HTMLElement)=>(void|Function)} initFunction
 * @param {boolean} prepend weather to show this app at the top of the sidebar or not
 * @param {(container:HTMLElement)=>void} onSelected
 * @param {{tabbed?: boolean}} [opts] tabbed apps host their UI in an editor tab
 * @returns {void}
 */
function add(
	icon,
	id,
	title,
	initFunction,
	prepend = false,
	onSelected = () => {},
	opts = {},
) {
	currentSection ??= id;

	const app = new SidebarApp(icon, id, title, initFunction, onSelected, opts);
	apps.push(app);
	app.install(prepend);

	// tabbed and launcher apps never own the sidebar panel on restore
	if (currentSection === id && !opts.tabbed && !opts.launcher) {
		setActiveApp(id);
	}
}

/**
 * Removes a sidebar app with the given ID.
 * @param {string} id - The ID of the sidebar app to remove.
 * @returns {void}
 */
function remove(id) {
	const app = apps.find((app) => app.id === id);
	if (!app) return;
	const wasActive = app.active;
	app.remove();
	apps.splice(apps.indexOf(app), 1);
	if (wasActive && apps.length > 0) {
		const preferredApp = apps.find((app) => app.id === currentSection);
		setActiveApp(preferredApp?.id || apps[0].id);
		return;
	}

	if (!apps.length) {
		currentSection = null;
		localStorage.removeItem(SIDEBAR_APPS_LAST_SECTION);
	}
}

/**
 * Initialize sidebar apps
 * @param {HTMLElement} $el
 */
function init($el) {
	$sidebar = $el;
	$apps = $sidebar.get(".app-icons-container");
	$apps.addEventListener("click", onclick);
	SidebarApp.init($el, $apps);
	attachLongPressTooltips($apps);
}

/**
 * Loads all sidebar apps.
 *
 * Each registration is isolated: a throw inside one app's module evaluation
 * or init function used to reject the whole loadApps() promise, which — via
 * the unguarded `await sidebarApps.loadApps()` in main.js — aborted the rest
 * of the boot chain (editorManager.onupdate, quicktools visibility, folder/
 * file restore, welcome tab, terminal...). That is how a single missing
 * `import Sidebar` in the AI app froze the entire editor at startup
 * ("Sidebar is not defined", v1.4.19 → v1.5.0). Now a failing app is logged
 * and skipped; the remaining apps still register.
 */
async function loadApps() {
	const loaders = [
		["files", () => import("./files")],
		["searchInFiles", () => import("./searchInFiles")],
		["extensions", () => import("./extensions")],
		["ai", () => import("./ai")],
		["git", () => import("./git")],
		// sandboxed JS console (Web Worker)
		["repl", () => import("./repl")],
		// webdev utilities (shadow/gradient/card/placeholder generators)
		["devtools", () => import("./devtools")],
		// offline web libraries (htmx, bootstrap, icon fonts…) shipped in the app
		["libs", () => import("./libs")],
		// embedded webview of the official site (docs/marketplace/sponsor)
		["websiteApp", () => import("./website")],
		["notification", () => import("./notification")],
		["profileApp", () => import("./profile")],
		["settingsApp", () => import("./settings")],
		["aboutApp", () => import("./about")],
	];
	// NOTE: the "updates" launcher app was removed on purpose — the
	// changelog stays reachable from About ("Actualizações").

	for (const [id, loader] of loaders) {
		try {
			add(...(await loader()).default);
		} catch (error) {
			logger.log(
				"error",
				`Failed to register sidebar app "${id}": ${error?.message || error}\n${error?.stack || ""}`,
			);
			toast(
				`${strings["sidebar app error"] || "App indisponível"}: ${id}`,
				3500,
			);
		}
	}
}

/**
 * Ensures that at least one app is active.
 * Call this AFTER all plugins have been loaded to handle cases where
 * the stored section was from an uninstalled plugin.
 * @returns {void}
 */
function ensureActiveApp() {
	const activeApps = apps.filter((app) => app.active);
	if (activeApps.length === 1) return;

	if (activeApps.length > 1) {
		const preferredActiveApp = activeApps.find(
			(app) => app.id === currentSection && !app.tabbed,
		);
		setActiveApp(preferredActiveApp?.id || activeApps[0].id);
		return;
	}

	if (apps.length > 0) {
		const preferredApp =
			apps.find((app) => app.id === currentSection && !app.tabbed) ||
			apps.find((app) => !app.tabbed);
		setActiveApp(preferredApp?.id || apps[0].id);
	}
}

/**
 * Gets the container of the app with the given ID.
 * @param {string} id
 * @returns
 */
function get(id) {
	const app = apps.find((app) => app.id === id);
	return app.container;
}

/**
 * VS Code-style badge on an activity bar icon.
 * @param {string} id app id
 * @param {number|boolean|null} value number -> count pill, true -> dot, falsy -> clear
 * @returns {boolean} false when no app with that id exists
 */
function setBadge(id, value) {
	const app = apps.find((candidate) => candidate.id === id);
	if (!app) return false;
	app.setBadge(value);
	return true;
}

/**
 * Handles click on sidebar apps
 * @param {MouseEvent} e
 */
function onclick(e) {
	// Use closest() so taps on the inner SVG glyph (path/svg) still resolve
	// to the app icon — fixes the "need multiple taps" bug where the event
	// target was a child of the icon without the data-action attribute.
	const $target = e.target.closest?.('[data-action="sidebar-app"]');
	if (!$target) return;
	const { id } = $target.dataset;

	pulseApp(id);
}

/**
 * Activates the given sidebar app and deactivates all others.
 * @param {string} id
 * @returns {void}
 */
function setActiveApp(id) {
	const app = apps.find((app) => app.id === id);
	if (!app) return;

	currentSection = id;
	localStorage.setItem(SIDEBAR_APPS_LAST_SECTION, id);

	for (const currentApp of apps) {
		currentApp.active = currentApp.id === id;
	}
}

/**
 * Activates an app; tabbed apps open/focus their editor tab instead of
 * taking over the sidebar panel.
 * @param {string} id
 * @returns {void}
 */
function pulseApp(id) {
	const app = apps.find((app) => app.id === id);
	if (!app) return;

	// Guard: any synchronous throw inside launch()/pulse()/activate()
	// used to bubble to the click handler and kill the icon silently
	// ("Ícone de conta não funciona"). Now it becomes a visible toast.
	try {
		if (app.launcher) {
			app.launch();
			return;
		}
		if (app.tabbed) {
			app.pulse();
			return;
		}
		setActiveApp(id);
	} catch (error) {
		logger.log(
			"error",
			`Sidebar app "${id}" failed: ${error?.message || error}`,
		);
		toast(
			`${strings["sidebar app error"] || "Não foi possível abrir"}: ${app.title || id}`,
			3500,
		);
	}
}

export default {
	init,
	add,
	get,
	remove,
	setBadge,
	loadApps,
	ensureActiveApp,
	setActiveApp,
	pulseApp,
};

// --- long-press tooltip (VS Code shows view labels on hover; on touch we
// show them on hold, since the native title attribute never appears) ------
const TOOLTIP_HOLD_MS = 500;
/**@type {ReturnType<typeof setTimeout>|null} */
let tooltipTimer = null;
/**@type {HTMLElement|null} */
let $tooltip = null;

/**
 * Shows the app title when an activity bar icon is pressed and held.
 * @param {HTMLElement} $container the .app-icons-container element
 * @returns {void}
 */
function attachLongPressTooltips($container) {
	$container.addEventListener("touchstart", onTooltipTouchStart, {
		passive: true,
	});
	$container.addEventListener("touchmove", dismissTooltip, { passive: true });
	$container.addEventListener("touchend", dismissTooltip, { passive: true });
	$container.addEventListener("touchcancel", dismissTooltip, {
		passive: true,
	});
}

/**
 * @param {TouchEvent} e
 * @returns {void}
 */
function onTooltipTouchStart(e) {
	const $icon = e.target?.closest?.('[data-action="sidebar-app"]');
	if (!$icon) return;
	clearTimeout(tooltipTimer);
	tooltipTimer = setTimeout(() => showTooltip($icon), TOOLTIP_HOLD_MS);
}

/**
 * @param {HTMLElement} $icon
 * @returns {void}
 */
function showTooltip($icon) {
	dismissTooltip();
	const app = apps.find((candidate) => candidate.id === $icon.dataset.id);
	const title = app?.title || $icon.title || "";
	if (!title) return;

	$tooltip = tag("div", { className: "apps-tooltip", textContent: title });
	document.body.append($tooltip);

	const rect = $icon.getBoundingClientRect();
	const tip = $tooltip.getBoundingClientRect();
	const top = Math.min(
		Math.max(rect.top + rect.height / 2 - tip.height / 2, 8),
		window.innerHeight - tip.height - 8,
	);
	const left = Math.min(rect.right + 10, window.innerWidth - tip.width - 8);
	$tooltip.style.top = `${Math.max(top, 8)}px`;
	$tooltip.style.left = `${Math.max(left, 8)}px`;
	$tooltip.classList.add("show");
}

/**
 * @returns {void}
 */
function dismissTooltip() {
	clearTimeout(tooltipTimer);
	tooltipTimer = null;
	if ($tooltip) {
		$tooltip.remove();
		$tooltip = null;
	}
}
