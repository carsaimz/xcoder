/**
 * GitHub sign-in orchestration for the UI (settings page + git
 * sidebar app).
 *
 * Policy: NO user-owned OAuth clients. Sign-in is either the official
 * built-in client (Device Flow, client id baked into
 * config.GH_OAUTH_CLIENT_ID) or the user's own personal access token
 * (PAT). Legacy installs that saved a client id keep working via the
 * settings.ghOAuthClientId fallback, but users are never asked to
 * create their own apps.
 */
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import config from "lib/config";
import { fetchGhUser, pollForToken, requestDeviceCode } from "lib/ghAuth";
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
 * Chooses the sign-in method. The Device Flow is offered only when a
 * client id is available. @returns {Promise<"pat"|"device"|null>}
 */
export async function chooseGhSignInMethod() {
	const options = [
		[
			"pat",
			strings["github pat sign in"] || "Use a personal access token (PAT)",
			"svg:key",
		],
	];
	if (resolveGhClientId()) {
		options.push([
			"device",
			strings["github device sign in"] || "Sign in with a code (device flow)",
			"svg:qr_code",
		]);
	}
	const choice = await select(
		strings["sign in with github"] || "Sign in with GitHub",
		options,
	);
	return choice || null;
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
	const value = String(token || "").trim();
	if (!value) return false;

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
 * Full sign-in flow: method chooser, then PAT or Device Flow.
 * @returns {Promise<boolean>} whether a session was saved
 */
export async function signInGitHubFlow() {
	const method = await chooseGhSignInMethod();
	if (method === "pat") return signInWithPat();
	if (method === "device") return signInWithDeviceFlow();
	return false;
}
