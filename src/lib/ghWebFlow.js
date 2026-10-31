/**
 * GitHub App web flow (user-to-server) — the smoothest sign-in route.
 *
 * The app opens the system browser at
 *   github.com/login/oauth/authorize?client_id=…&redirect_uri=<site>/api/github/callback
 * The official site (xcoder-web) exchanges the temporary `code` for an
 * access token SERVER-SIDE (the client secret never leaves the site
 * environment) and hands the session back to the app through the
 * registered custom scheme:
 *   xcoder://github/session#access_token=…&state=…&login=…&avatar=…
 *
 * The return leg is handled here (intent handler) — same pattern as
 * lib/oauthIntent.js for the site account (xcoder://auth/oauth).
 */
import toast from "components/toast";
import { addIntentHandler, removeIntentHandler } from "handlers/intent";
import config from "lib/config";
import { fetchGhUser, normalizeGhToken } from "lib/ghAuth";
import settings from "lib/settings";

const STATE_KEY = "xcoder.ghWebFlow.state";

/**
 * Whether the GitHub App web flow is available: requires the built-in
 * GitHub App client id (prefix `Ov23li…` — OAuth Apps use `Iv1…`).
 * @returns {boolean}
 */
export function ghWebFlowEnabled() {
	return /^Ov23li[\w]{6,}$/.test(
		String(config.GH_OAUTH_CLIENT_ID || "").trim(),
	);
}

const STATUS_TTL_MS = 10 * 60 * 1000;
/** @type {{at: number, configured: boolean}} cached /api/github/status probe */
let webStatusCache = { at: 0, configured: false };

/** Clears the site status probe cache (tests). */
export function resetGhWebStatusCache() {
	webStatusCache = { at: 0, configured: false };
}

/**
 * CORS-free GET inside the webview (cordova-plugin-advanced-http, same
 * strategy as lib/ghAuth for github.com), with a fetch fallback for
 * tests and plain browsers.
 * @param {string} url
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<any>} parsed JSON
 */
async function getJson(url, fetchImpl) {
	if (typeof cordova !== "undefined" && cordova?.plugin?.http) {
		return new Promise((resolve, reject) => {
			cordova.plugin.http.get(
				url,
				{},
				{},
				(response) => {
					let data = response.data;
					if (typeof data === "string") {
						try {
							data = JSON.parse(data);
						} catch {
							data = null;
						}
					}
					resolve(data);
				},
				(error) => {
					reject(new Error(error?.error || error?.status || "Network error"));
				},
			);
		});
	}
	const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
	if (!doFetch) throw new Error("No HTTP client available");
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 4000);
	try {
		const res = await doFetch(url, {
			signal: controller.signal,
			headers: { Accept: "application/json" },
		});
		if (!res.ok) throw new Error(`status ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Whether THIS deployment of the site actually has the GitHub App
 * credentials (GITHUB_APP_CLIENT_ID/SECRET). The client id baked into
 * the app only says the flow exists — the code exchange happens
 * server-side, and when the site lacks the env vars the "browser"
 * option just landed on the site's error page and the account stayed
 * empty ("Git até agora fica sem conta"). The sign-in chooser probes
 * this cheap status endpoint (10 min cache) and hides the web option
 * when it is not configured, leaving the device flow (no backend) and
 * the PAT route, which always work.
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<boolean>}
 */
export async function siteGhWebConfigured(opts = {}) {
	if (!ghWebFlowEnabled()) return false;
	const site = String(config.WEBSITE_URL || "").replace(/\/+$/, "");
	if (!site) return false;
	const now = Date.now();
	if (now - webStatusCache.at < STATUS_TTL_MS) return webStatusCache.configured;
	let configured = false;
	try {
		const json = await getJson(`${site}/api/github/status`, opts.fetchImpl);
		configured = json?.configured === true;
	} catch {
		configured = false;
	}
	webStatusCache = { at: now, configured };
	return configured;
}

/**
 * Builds the authorize URL opened in the system browser.
 * @param {string} state random nonce echoed back by the callback
 * @returns {string}
 */
export function buildGhAuthorizeUrl(state) {
	const clientId = String(config.GH_OAUTH_CLIENT_ID || "").trim();
	const site = String(config.WEBSITE_URL || "").replace(/\/+$/, "");
	const redirectUri = `${site}/api/github/callback`;
	// GitHub Apps: no scope param — permissions come from the App
	// installation; state comes back to the app for CSRF validation.
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		state,
	});
	return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Random state nonce kept in sessionStorage so completeGhWebFlow can
 * reject forged return links.
 * @returns {string}
 */
export function makeGhState() {
	const state =
		typeof crypto?.randomUUID === "function"
			? crypto.randomUUID()
			: `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
	try {
		sessionStorage.setItem(STATE_KEY, state);
	} catch {
		/* private mode — validation then happens server-side only */
	}
	return state;
}

/**
 * Opens the system browser to start the GitHub App web flow.
 * @returns {Promise<string>} the authorize URL that was opened
 */
export async function signInWithGitHubApp() {
	if (!ghWebFlowEnabled()) {
		throw new Error("GitHub App web flow is not available");
	}
	const url = buildGhAuthorizeUrl(makeGhState());
	try {
		system.openInBrowser(url);
	} catch {
		window.open(url, "_blank", "noopener");
	}
	toast(
		strings["github web hint"] ||
			"Finish in the browser — you return to the app automatically",
		6000,
	);
	return url;
}

/**
 * Parses a return URL/fragment and stores the session.
 * Pure parsing + settings write so it is unit-testable.
 * @param {string} rawUrl URL containing the fragment params
 * @param {{expectedState?: string}} [opts]
 * @returns {Promise<boolean>} true when a session was saved
 */
export async function applyGhWebTokens(rawUrl, opts = {}) {
	const value = String(rawUrl || "");
	if (!value) return false;
	const fragment = value.includes("#")
		? value.slice(value.indexOf("#") + 1)
		: "";
	const params = new URLSearchParams(fragment);
	// normalise: URL-encoded fragments can carry %0A/zero-width leftovers
	const token = normalizeGhToken(params.get("access_token"));
	if (!token) return false;

	let expectedState = opts.expectedState;
	if (expectedState === undefined) {
		try {
			expectedState = sessionStorage.getItem(STATE_KEY) || "";
		} catch {
			expectedState = "";
		}
	}
	// reject forged links when we know which state we sent
	const state = params.get("state") || "";
	if (expectedState && state && state !== expectedState) {
		return false;
	}

	let user = null;
	try {
		user = await fetchGhUser(token);
	} catch {
		user = null;
	}
	const login = user?.login || params.get("login") || "";

	settings.value.ghToken = token;
	settings.value.ghUserLogin = login;
	settings.value.ghUserName = user?.name || "";
	settings.value.ghUserAvatar = user?.avatarUrl || params.get("avatar") || "";
	await settings.update();
	return true;
}

/**
 * Completes the web flow from an intent/callback URL: validates the
 * state, stores the session and reports with a toast.
 * @param {string} rawUrl
 * @returns {Promise<boolean>}
 */
export async function completeGhWebFlow(rawUrl) {
	let expectedState = "";
	try {
		expectedState = sessionStorage.getItem(STATE_KEY) || "";
	} catch {
		expectedState = "";
	}
	const ok = await applyGhWebTokens(rawUrl, { expectedState });
	if (!ok) {
		toast(
			strings["github web failed"] || "Could not complete the GitHub sign-in",
			4000,
		);
		return false;
	}
	const login = settings.value.ghUserLogin || "";
	toast(
		`${strings["signed in as"] || "Signed in as"} ${login || "?"}`.trim(),
		3000,
	);
	try {
		sessionStorage.removeItem(STATE_KEY);
	} catch {
		/* ignore */
	}
	return true;
}

/** @type {((event: any) => void) | null} */
let handler = null;

/**
 * Registers the xcoder://github/session intent handler (once at boot).
 */
export function registerGhIntentHandler() {
	if (handler) return;
	handler = (event) => {
		if (event.module !== "github" || event.action !== "session") return;
		event.preventDefault();
		completeGhWebFlow(event.url);
	};
	addIntentHandler(handler);
}

/**
 * Removes the intent handler (tests / hot reload).
 */
export function unregisterGhIntentHandler() {
	if (handler) {
		removeIntentHandler(handler);
		handler = null;
	}
}
