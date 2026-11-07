/**
 * Git credential manager — the app's equivalent of VS Code's
 * credential-helper ("gh auth"/os-keyring) flow:
 *
 *   1. The signed-in GitHub session (device flow / site web flow / PAT
 *      saved in settings) is used automatically — no prompt, exactly
 *      like a configured credential helper.
 *   2. When there is no session or GitHub answers 401, the user is
 *      asked once for a Personal Access Token; "remember" stores it in
 *      the session so later push/pull/clone never prompt again.
 *
 * isomorphic-git expects `{username, password}` credentials for HTTPS.
 * GitHub accepts any username for classic PATs; fine-grained tokens
 * (github_pat_) and GitHub App tokens (ghs_) must use "x-access-token"
 * as the username, which is also what gitcredential does for GH.
 */
import toast from "components/toast";
import prompt from "dialogs/prompt";
import { normalizeGhToken } from "lib/ghAuth";
import settings from "lib/settings";

/**
 * Picks the GitHub username that pairs with a token for HTTPS git.
 * @param {string} token
 * @param {string} login
 * @returns {string}
 */
export function ghUsernameFor(token, login) {
	const clean = normalizeGhToken(token);
	if (/^(github_pat_|ghs_)/.test(clean)) return "x-access-token";
	return login || "x-access-token";
}

/**
 * Current stored credentials (may be empty — callers decide whether to
 * prompt).
 * @returns {{username: string, password: string, token: string}}
 */
export function storedCredentials() {
	const token = normalizeGhToken(settings.value.ghToken);
	return {
		username: ghUsernameFor(token, settings.value.ghUserLogin || ""),
		password: token,
		token,
	};
}

/**
 * Whether the token is allowed to talk to this remote (GitHub HTTPS
 * remotes only — other hosts would need their own credential entry).
 * @param {string} url
 */
export function isGitHubRemote(url) {
	return /^https:\/\/([^@]+@)?(www\.)?github\.com\//i.test(String(url || ""));
}

/**
 * Resolves credentials for an HTTPS remote: the stored session first,
 * then a one-shot PAT prompt. The prompt result is remembered when the
 * user opts in (saving the session is the "credential store" step).
 * @param {string} url remote url being authenticated
 * @param {{allowPrompt?: boolean}} [opts]
 * @returns {Promise<{username: string, password: string} | undefined>}
 */
export async function resolveCredentials(url, opts = {}) {
	const stored = storedCredentials();
	if (stored.token) return stored;
	if (opts.allowPrompt === false) return undefined;
	return promptForToken(url);
}

/**
 * The VS Code-style auth prompt on 401: asks for a PAT, optionally
 * remembers it as the app session.
 * @param {string} url remote url
 * @returns {Promise<{username: string, password: string} | undefined>}
 */
export async function promptForToken(url) {
	const host = isGitHubRemote(url) ? "GitHub" : "git";
	const value = normalizeGhToken(
		await prompt(
			strings["git auth prompt"] ||
				`Personal access token for ${host} (repo scope)`,
			"",
			"text",
			{ required: false },
		),
	);
	if (!value) return undefined;
	return { username: ghUsernameFor(value, ""), password: value, token: value };
}

/**
 * Offers to remember a token that authenticated successfully (updates
 * the stored session so the next git operation needs no prompt).
 * @param {{token?: string}} creds
 * @returns {Promise<void>}
 */
export async function rememberCredentials(creds) {
	if (!creds?.token) return;
	if (normalizeGhToken(settings.value.ghToken) === creds.token) return;
	settings.value.ghToken = creds.token;
	await settings.update();
	toast(strings["git auth saved"] || "Credentials saved", 2500);
}
