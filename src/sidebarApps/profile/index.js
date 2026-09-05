import Sidebar from "components/sidebar";
import toast from "components/toast";
import logger from "lib/logger";

/**
 * Profile sidebar app — a launcher: tapping the person icon opens the
 * Profile (account) page. Same pattern as settingsApp/aboutApp.
 *
 * Hardened: the page chunk is imported directly (single hop) and any
 * failure surfaces as a visible toast + log entry — the icon must never
 * feel "dead" (reported: "Ícone de conta não funciona").
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
		import(/* webpackChunkName: "profile" */ "pages/profile/profile")
			.then(({ default: profile }) => {
				profile();
			})
			.catch((error) => {
				logger.log("error", `Profile page failed: ${error?.message || error}`);
				toast(
					strings["account page error"] ||
						"Não foi possível abrir a conta — reinicie o app e tente de novo.",
					4000,
				);
			});
	}, // onSelected function
	{ launcher: true, titleKey: "profile" }, // opts
];
