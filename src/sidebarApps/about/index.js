import Sidebar from "components/sidebar";

/**
 * About sidebar app — a launcher: tapping the info icon opens the About
 * page. The icon never becomes "active" and nothing is persisted as the
 * last sidebar section (same pattern as settingsApp).
 */
export default [
	"svg:info", // icon
	"aboutApp", // id
	strings.about?.capitalize() || "About", // title
	(/**@type {HTMLElement} */ el) => {
		el.classList.add("about-app");
	}, // init function
	false, // prepend
	() => {
		Sidebar.hide();
		import("pages/about").then(({ default: about }) => {
			about();
		});
	}, // onSelected function
	{ launcher: true, titleKey: "about" }, // opts
];
