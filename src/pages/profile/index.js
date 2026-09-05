import toast from "components/toast";
import logger from "lib/logger";

/**
 * Account page entry — kept as a separate module so other code paths
 * (commands, plugins) can open the Profile page by importing
 * "pages/profile". Failures are visible: the entry point logs and toasts
 * instead of failing silently.
 */
function Profile() {
	import(/* webpackChunkName: "profile" */ "./profile")
		.then((res) => {
			res.default();
		})
		.catch((error) => {
			logger.log("error", `Profile page failed: ${error?.message || error}`);
			toast(
				strings["account page error"] ||
					"Não foi possível abrir a conta — reinicie o app e tente de novo.",
				4000,
			);
		});
}

export default Profile;
