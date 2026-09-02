import Sidebar from "components/sidebar";

/**
 * Updates sidebar app — a launcher: tapping the history icon opens the
 * Changelog ("Actualizações") page. The icon never becomes "active" and
 * nothing is persisted as the last sidebar section (same pattern as
 * settingsApp).
 */
export default [
	"svg:history", // icon
	"updatesApp", // id
	strings["changelog"]?.capitalize() || "Updates", // title
	(/**@type {HTMLElement} */ el) => {
		el.classList.add("updates-app");
	}, // init function
	false, // prepend
	() => {
		Sidebar.hide();
		import("pages/changelog").then(({ default: changelog }) => {
			changelog();
		});
	}, // onSelected function
	{ launcher: true, titleKey: "changelog" }, // opts
];
