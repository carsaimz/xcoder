import toast from "components/toast";
import logger from "lib/logger";

/**
 * Support entry point — kept for backwards compatibility with every
 * call site (settings, agent quota, profile page).
 *
 * Since v1.4.19 the support experience is a REAL PAGE (pages/support),
 * not a modal dialog. The account sign-in/sign-up form lives exclusively
 * in the Profile page (pages/profile) — creating an account no longer
 * depends on the support option.
 */

/**
 * Opens the support page (premium status, payment methods, unlock code).
 * @returns {Promise<void>}
 */
export async function showSupportDialog() {
	const mod = await import(
		/* webpackChunkName: "support" */ "pages/support/support"
	);
	mod.default();
}

/** Resilient variant that never throws — used by background flows
 * (agent daily-limit notice) where an unhandled rejection would be
 * invisible to the user. */
export function openSupportPage() {
	showSupportDialog().catch((error) => {
		logger.log("error", `Support page failed: ${error?.message || error}`);
		toast(
			strings["support page error"] ||
				"Não foi possível abrir o apoio — reinicie o app e tente de novo.",
			4000,
		);
	});
}

// --------------------------------------------------------------- themes

/** App themes reserved for supporters (free users keep every other one). */
export const PREMIUM_THEMES = Object.freeze([]);

/**
 * Always false now — themes are free since v1.4.18 (legacy export).
 * @param {string} [id]
 * @returns {boolean}
 */
export function isThemePremium(id) {
	return false;
}

/**
 * Always true now — themes are free since v1.4.18 (legacy export).
 * @param {string} [id]
 * @returns {boolean}
 */
export function canUseTheme(id) {
	return true;
}

export default { showSupportDialog, openSupportPage };
