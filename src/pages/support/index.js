import toast from "components/toast";
import logger from "lib/logger";

/**
 * Support page entry — other code paths (settings, agent quota, profile)
 * open the Support page by importing "pages/support". Failures are
 * visible: the entry point logs and toasts instead of failing silently.
 */
function Support() {
	import(/* webpackChunkName: "support" */ "./support")
		.then((res) => {
			res.default();
		})
		.catch((error) => {
			logger.log("error", `Support page failed: ${error?.message || error}`);
			toast(
				strings["support page error"] ||
					"Não foi possível abrir o apoio — reinicie o app e tente de novo.",
				4000,
			);
		});
}

export default Support;
