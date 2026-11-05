/**
 * GitHub sign-in orchestration for the UI (settings page + git
 * sidebar app).
 *
 * Policy (SITE-ONLY login — user request: "Login deve ser apenas pelo
 * site, o mesmo vale para GitHub"): sign-in always goes through the
 * browser. The GitHub App web flow opens the official site, which
 * exchanges the code server-side and hands the session back to the app
 * (xcoder://github/session). When the site deployment is not configured
 * yet, the Device Flow keeps working (github.com in the browser, only a
 * short code typed there — never credentials inside the app). The in-app
 * PAT prompt is no longer part of the sign-in chooser; a PAT can still
 * be set in Settings > GitHub for advanced/self-hosted setups.
 */
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import config from "lib/config";
import {
	fetchGhUser,
	looksLikeGhToken,
	normalizeGhToken,
	pollForToken,
	requestDeviceCode,
} from "lib/ghAuth";
import {
	ghWebFlowEnabled,
	signInWithGitHubApp,
	siteGhWebConfigured,
} from "lib/ghWebFlow";
import settings from "lib/settings";

/**
 * Fetches the profile for a token, tolerating failures (the token
 * itself is already valid — the profile is cosmetic and can be
 * refreshed later from the settings page).
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function tryFetchGhUser(token) {
	try {
		return await fetchGhUser(token);
	} catch {
		// profile is cosmetic — the session stays valid without it
		return null;
	}
}

/**
 * Resolves the OAuth App client id used for the Device Flow: the
 * official built-in id first, then the legacy per-user setting. May be
 * empty — the Device Flow option is hidden when it is.
 * @returns {string}
 */
export function resolveGhClientId() {
	return (
		String(config.GH_OAUTH_CLIENT_ID || "").trim() ||
		String(settings.value.ghOAuthClientId || "").trim()
	);
}

/**
 * Resolves the sign-in method — SITE FIRST. When the site deployment has
 * the GitHub App credentials the web flow is used directly (no chooser:
 * one tap opens the site, sign in there, session comes back to the
 * app). Otherwise the Device Flow is the fallback (still browser-based).
 * @returns {Promise<"web"|"device"|"pat"|null>}
 */
export async function chooseGhSignInMethod() {
	// only take the browser route when the site deployment really has
	// the GitHub App credentials — otherwise it dead-ends on the site's
	// "não configurada" error page and the account stays empty
	if (ghWebFlowEnabled() && (await siteGhWebConfigured())) {
		return "web";
	}
	if (resolveGhClientId()) {
		return "device";
	}
	// last resort (no site config, no client id): the manual PAT prompt,
	// so the entry point never feels dead
	return "pat";
}

/**
 * Stores token + profile after a successful sign-in.
 * @param {string} token
 * @param {object} user
 */
export async function saveGhSession(token, user) {
	if (!token) throw new Error("Cannot save a GitHub session without a token");
	settings.value.ghToken = token;
	settings.value.ghUserLogin = user?.login || "";
	settings.value.ghUserName = user?.name || "";
	settings.value.ghUserAvatar = user?.avatarUrl || "";
	await settings.update();
}

/**
 * PAT sign-in: prompts for the token, validates it against the
 * profile API and stores the session.
 * @returns {Promise<boolean>} whether a session was saved
 */
export async function signInWithPat() {
	const token = await prompt(
		strings["github pat prompt"] ||
			"Personal access token (repo, workflow, gist)",
		"",
		"text",
		{ required: false },
	);
	// normalise: strip whitespace/zero-width chars from copies that
	// wrapped in messengers or email (a stray char = 401 later)
	const value = normalizeGhToken(token);
	if (!value) return false;
	if (!looksLikeGhToken(value)) {
		toast(
			strings["github pat shape"] ||
				"O token não parece um PAT do GitHub (ghp_… / github_pat_…) — vamos tentar mesmo assim.",
			4000,
		);
	}

	const hide = await loader.show();
	try {
		const user = await fetchGhUser(value);
		await saveGhSession(value, user);
		toast(`${strings["signed in as"] || "Signed in as"} ${user?.login || "?"}`);
		return true;
	} catch (error) {
		toast(
			`${strings["sign in failed"] || "Sign in failed"}: ${error.message || error}`,
		);
		return false;
	} finally {
		hide();
	}
}

/**
 * Device Flow sign-in using the official (or legacy) client id.
 * @returns {Promise<boolean>} whether a session was saved
 */
export async function signInWithDeviceFlow() {
	const clientId = resolveGhClientId();
	if (!clientId) {
		toast(
			strings["github no builtin client"] ||
				"No built-in GitHub client yet — use a personal access token (PAT) for now.",
			4000,
		);
		return false;
	}
	try {
		const code = await requestDeviceCode(clientId);
		const proceed = await confirm(
			strings["sign in with github"] || "Sign in with GitHub",
			`${strings["device code"] || "Code"}: ${code.userCode}\n\n${
				strings["github device steps"] ||
				"Open the verification page in your browser and enter the code above."
			}`,
		);
		if (!proceed) return false;

		system.openInBrowser(code.verificationUri);

		const hide = await loader.show();
		try {
			// pollForToken resolves with the access token STRING (not an
			// object) — destructuring it left token/user undefined and
			// silently saved an EMPTY session (v1.5.3 bug: "connected"
			// toast, but no account data and no repositories).
			const token = await pollForToken(
				clientId,
				code.deviceCode,
				code.interval,
				{ maxMs: code.expiresIn * 1000 },
			);
			const user = await tryFetchGhUser(token);
			await saveGhSession(token, user);
			toast(
				`${strings["signed in as"] || "Signed in as"} ${user?.login || "?"}`,
			);
			return true;
		} finally {
			hide();
		}
	} catch (error) {
		toast(
			`${strings["sign in failed"] || "Sign in failed"}: ${error.message || error}`,
		);
		return false;
	}
}

/**
 * Full sign-in flow: site web flow first, Device Flow fallback,
 * manual PAT only as the last resort.
 * @returns {Promise<boolean>} whether a session was saved
 */
export async function signInGitHubFlow() {
	const method = await chooseGhSignInMethod();
	if (method === "web") return signInWithGitHubApp();
	if (method === "device") return signInWithDeviceFlow();
	if (method === "pat") return signInWithPat();
	return false;
}

/**
 * Re-fetches the profile for the STORED token and saves it. Used by
 * the git sidebar account card and the settings page when a token is
 * set but the profile never arrived (the "token set — no account"
 * state after a failed first fetch).
 * @returns {Promise<boolean>} whether the profile was refreshed
 */
export async function refreshGhProfile() {
	const token = normalizeGhToken(settings.value.ghToken);
	if (!token) {
		toast(
			strings["github token needed"] ||
				"Sign in or set a token to list repositories",
			3000,
		);
		return false;
	}
	const hide = await loader.show();
	try {
		const user = await fetchGhUser(token);
		settings.value.ghToken = token;
		settings.value.ghUserLogin = user?.login || "";
		settings.value.ghUserName = user?.name || "";
		settings.value.ghUserAvatar = user?.avatarUrl || "";
		await settings.update();
		toast(`${strings["signed in as"] || "Signed in as"} ${user?.login || "?"}`);
		return true;
	} catch (error) {
		toast(
			`${strings["github profile failed"] || "Could not load profile"}: ${
				error.message || error
			}`,
		);
		return false;
	} finally {
		hide();
	}
}
