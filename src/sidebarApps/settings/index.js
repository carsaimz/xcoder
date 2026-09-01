import Sidebar from "components/sidebar";

/**
 * Settings sidebar app — a launcher: tapping the gear icon opens the
 * full settings page (like About) instead of hosting a sidebar panel.
 * The icon never becomes "active" and nothing is persisted as the
 * last sidebar section.
 */
export default [
	"settings", // icon
	"settingsApp", // id
	strings.settings?.capitalize() || "Settings", // title
	(/**@type {HTMLElement} */ el) => {
		el.classList.add("settings-app");
	}, // init function
	false, // prepend
	() => {
		Sidebar.hide();
		import("settings/mainSettings").then(({ default: mainSettings }) => {
			mainSettings();
		});
	}, // onSelected function
	{ launcher: true, titleKey: "settings" }, // opts
];
