import floatingWindow from "components/sidebar/floatingWindow";
import toast from "components/toast";
import tag from "html-tag-js";
import logger from "lib/logger";
import appSettings from "lib/settings";
import svgIcon from "utils/svgIcons";
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
/**@type {HTMLElement|null} floating-mode menu (option names + categories) */
let $menu = null;

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
	if ($menu?.isConnected) renderSidebarMenu();

	// tabbed and launcher apps never own the sidebar panel on restore;
	// docked (native) apps restore their panel even in floating mode —
	// only floating tools boot with no panel (first tap opens it)
	if (
		currentSection === id &&
		!opts.tabbed &&
		!opts.launcher &&
		(!floatingWindow.floatingEnabled() || !opts.floating)
	) {
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
	if ($menu?.isConnected) renderSidebarMenu();
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
	// icon names under the glyphs (categorized views)
	if (localStorage.getItem("sidebarIconLabels") !== "0") {
		$apps.classList.add("with-labels");
	}
	// floating window closed by its header button
	document.addEventListener("sidebar-float-closed", (e) => {
		if (currentSection === e.detail?.id) {
			currentSection = null;
			localStorage.removeItem(SIDEBAR_APPS_LAST_SECTION);
		}
	});
	// floating mode: the freed docked-panel area hosts the categorized menu
	syncSidebarMenu();
	// keep it in sync with mode switches and fresh badges on every open
	import("components/sidebar")
		.then(({ default: SidebarModule }) =>
			SidebarModule.on?.("show", syncSidebarMenu),
		)
		.catch(() => {});
	// rebuild after the per-app langchange listeners refreshed their
	// titles (registry listeners registered before the apps existed)
	document.addEventListener("langchange", () => {
		setTimeout(renderSidebarMenu, 0);
	});
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
	updateMenuBadge(id, value);
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
	const floatMode = usesFloat(app);
	// a docked panel takes the whole area — the menu goes; switching
	// from an open tool window to a docked app drops the window
	if (!floatMode) {
		$menu?.remove();
		const windowId = floatingWindow.activeWindowId();
		if (windowId && windowId !== id) floatingWindow.reset();
	}

	currentSection = id;
	localStorage.setItem(SIDEBAR_APPS_LAST_SECTION, id);

	for (const currentApp of apps) {
		currentApp.active = currentApp.id === id;
	}
	// float mode: the sidebar keeps the categorized menu next to the
	// rail while the tool lives in its own window
	if (floatMode) syncSidebarMenu();
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
		// tap again on the open window = close it (VS Code toggle);
		// minimized windows restore instead of closing
		if (app.active && usesFloat(app) && floatingWindow.isOpenFor(id)) {
			if (floatingWindow.isMinimized()) {
				floatingWindow.toggleMinimize();
				return;
			}
			floatingWindow.close();
			return;
		}
		// opening a floating tool hands the screen to its window: the
		// sidebar (rail + panel space) only stays up for docked apps
		const activatesFloat = usesFloat(app) && !app.active;
		// tap again on a docked panel = classic toggle: hide the
		// sidebar, keep the panel docked for when it reopens
		if (app.active && !usesFloat(app)) {
			hideSidebar();
			return;
		}
		setActiveApp(id);
		if (activatesFloat) hideSidebar();
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

/** Whether the app opens as a floating window in the current mode. */
function usesFloat(app) {
	return Boolean(app?.floating && floatingWindow.floatingEnabled());
}

// --- sidebar menu ------------------------------------------------------------
// With floating windows the docked-panel area of the sidebar stays empty;
// it now hosts a categorized menu of the options ("usar o lugar para títulos
// de opções e categorias") — names, rail badges and group captions, the
// floating-window counterpart of VS Code's view list.

const MENU_SECTIONS = [
	["primary", "sidebar group primary", "Views"],
	["tools", "sidebar group tools", "Tools"],
	["bottom", "sidebar group bottom", "Account"],
];

/** Mounts/unmounts the sidebar menu according to the floating-windows mode. */
function syncSidebarMenu() {
	if (!floatingWindow.floatingEnabled()) {
		$menu?.remove();
		return;
	}
	if (!$sidebar) return;
	if (!$menu) {
		$menu = <div className="sidebar-menu scroll" />;
	}
	if (!$menu.isConnected) {
		const $container = $sidebar.get(":scope > .container");
		if ($container) {
			$container.before($menu);
		} else {
			const $resize = $sidebar.get(":scope > .resize-bar");
			if ($resize) $resize.before($menu);
			else $sidebar.append($menu);
		}
	}
	renderSidebarMenu();
}

/** Rebuilds the menu rows from the registered apps. */
function renderSidebarMenu() {
	if (!$menu?.isConnected) return;
	$menu.textContent = "";
	$menu.append(
		<div className="sidebar-menu-head">
			<span className="sidebar-menu-title">
				{strings["sidebar menu title"] || "Panels"}
			</span>
			<span className="sidebar-menu-hint">
				{strings["sidebar menu hint"] || "Tap to open"}
			</span>
		</div>,
	);
	for (const [group, key, fallback] of MENU_SECTIONS) {
		const items = apps.filter((app) => app.group === group);
		if (!items.length) continue;
		const $section = <div className={`sidebar-menu-section ${group}`} />;
		$section.append(
			<div className="sidebar-menu-caption">{strings[key] || fallback}</div>,
		);
		for (const app of items) {
			$section.append(menuRowFor(app));
		}
		$menu.append($section);
	}
}

/** Builds one tappable row (glyph + name + badge + open affordance). */
function menuRowFor(app) {
	const $row = (
		<div
			className={`sidebar-menu-item${app.active ? " active" : ""}`}
			data-id={app.id}
		>
			<span className="sidebar-menu-name">{app.title}</span>
			{glyphFor(app.iconName, app.title)}
			{app.badge ? <span className="app-badge count">{app.badge}</span> : null}
			<span
				className={`icon ${
					usesFloat(app) ? "open_in_new" : "chevron_right"
				} sidebar-menu-open`}
			/>
		</div>
	);
	$row.addEventListener("click", () => openFromMenu(app.id));
	return $row;
}

/** Builds the glyph span for a menu row from the raw icon spec. */
function glyphFor(iconSpec, title) {
	if (iconSpec?.startsWith("svg:")) {
		const $svg = svgIcon(iconSpec.slice(4));
		if ($svg) {
			return (
				<span className="icon xc-svgicon" title={title}>
					{$svg}
				</span>
			);
		}
	}
	return <span className={`icon ${iconSpec || ""}`} title={title} />;
}

/** Hides the sidebar overlay (dynamic import keeps boot order safe). */
function hideSidebar() {
	import("components/sidebar")
		.then(({ default: SidebarModule }) => SidebarModule.hide?.())
		.catch(() => {});
}

/** Opens an app from the menu; on phones the sidebar only yields to windows. */
function openFromMenu(id) {
	const app = apps.find((candidate) => candidate.id === id);
	pulseApp(id);
	// only floating tools take over the screen — the sidebar space is
	// for docked panels, so it always yields to the opened window
	if (usesFloat(app)) {
		hideSidebar();
	}
}

/** Mirrors a rail badge into the matching menu row (targeted, no rebuild). */
function updateMenuBadge(id, value) {
	if (!$menu?.isConnected) return;
	const $row = $menu.get(`.sidebar-menu-item[data-id="${id}"]`);
	if (!$row) return;
	let $badge = $row.get(".app-badge");
	const count =
		typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
	if (count <= 0 && value !== true) {
		$badge?.remove();
		return;
	}
	if (!$badge) {
		$badge = <span className="app-badge" />;
		$row.get(".sidebar-menu-name")?.after($badge);
	}
	if (value === true) {
		$badge.textContent = "";
		$badge.classList.add("dot");
		$badge.classList.remove("count");
		return;
	}
	$badge.textContent = count > 99 ? "99+" : String(count);
	$badge.classList.add("count");
	$badge.classList.remove("dot");
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
