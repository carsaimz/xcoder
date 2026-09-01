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

	// tabbed apps never own the sidebar panel on restore
	if (currentSection === id && !opts.tabbed) {
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
}

/**
 * Loads all sidebar apps.
 */
async function loadApps() {
	add(...(await import("./files")).default);
	add(...(await import("./searchInFiles")).default);
	add(...(await import("./extensions")).default);
	add(...(await import("./ai")).default);
	add(...(await import("./git")).default);
	add(...(await import("./notification")).default);
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
 * Handles click on sidebar apps
 * @param {MouseEvent} e
 */
function onclick(e) {
	const target = e.target;
	const { action, id } = target.dataset;

	if (action !== "sidebar-app") return;

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

	if (app.tabbed) {
		app.pulse();
		return;
	}
	setActiveApp(id);
}

export default {
	init,
	add,
	get,
	remove,
	loadApps,
	ensureActiveApp,
	setActiveApp,
	pulseApp,
};
