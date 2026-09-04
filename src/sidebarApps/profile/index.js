import Sidebar from "components/sidebar";

/**
 * Profile sidebar app — a launcher: tapping the person icon opens the
 * Profile (account) page. Same pattern as settingsApp/aboutApp.
 */
export default [
	"svg:user", // icon
	"profileApp", // id
	strings.profile?.capitalize() || "Profile", // title
	(/**@type {HTMLElement} */ el) => {
		el.classList.add("profile-app");
	}, // init function
	false, // prepend
	() => {
		Sidebar.hide();
		import("pages/profile").then(({ default: profile }) => {
			profile();
		});
	}, // onSelected function
	{ launcher: true, titleKey: "profile" }, // opts
];
