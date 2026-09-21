/**
 * GitHub OAuth Device Flow sign-in (RFC 8628).
 *
 * Works with both GitHub OAuth Apps and GitHub Apps that have "Device
 * Flow" enabled — only the client_id is required (no client secret, no
 * backend). The user opens https://github.com/login/device in a browser,
 * enters the displayed code and the app polls for the access token.
 * GitHub Apps (client ids "Ov23li"/"Iv1.") do NOT take a scope: the
 * user-token permissions come from the app settings on GitHub.
 *
 * HTTP strategy: github.com endpoints do NOT send CORS headers, so inside
 * the Cordova webview we use the native cordova-plugin-advanced-http
 * (bypasses CORS). `fetch` is the fallback (used in unit tests / non-Cordova
 * environments).
 */

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

/** Default scopes (classic OAuth Apps only): repo, workflow, gists, profile. */
export const GH_SCOPES = ["repo", "workflow", "gist", "read:user"];

/**
 * Cleans a pasted/stored token: strips every whitespace character
 * (spaces, tabs, newlines — tokens can wrap when copied from messengers)
 * and invisible Unicode (zero-width spaces, joiners, BOM). A single
 * stray character makes GitHub answer 401 "Bad credentials".
 * @param {string} raw
 * @returns {string}
 */
export function normalizeGhToken(raw) {
	return String(raw || "").replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, "");
}

/**
 * True when the token has the shape of a real GitHub token (classic
 * ghp_/gho_/ghu_/ghs_/ghr_ prefixes or the fine-grained github_pat_).
 * Used only for friendlier hints — never blocks a save.
 * @param {string} token
 * @returns {boolean}
 */
export function looksLikeGhToken(token) {
	return /^(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)/.test(
		normalizeGhToken(token),
	);
}

/**
 * Maps a GitHub API failure to a user-facing message. The raw GitHub
 * detail ("Bad credentials", "Requires authentication"…) is kept for
 * transparency, but the actionable hint comes first.
 * @param {number|string} status HTTP status (0/undefined = network)
 * @param {string} [detail] raw error detail from the API/plugin
 * @returns {string}
 */
export function describeGhError(status, detail) {
	const raw = String(detail || "").trim();
	const code = Number(status) || 0;
	if (code === 401 || /bad credentials/i.test(raw)) {
		const hint =
			(typeof strings !== "undefined" && strings["github bad token"]) ||
			"Token inválido ou revogado — reconecte a conta ou cole um novo token.";
		return `GitHub 401: ${hint}${raw ? ` (${raw})` : ""}`;
	}
	if (code === 403 && /rate limit/i.test(raw)) {
		const hint =
			(typeof strings !== "undefined" && strings["github rate limit"]) ||
			"Limite de pedidos do GitHub atingido — tente de novo em alguns minutos.";
		return `GitHub 403: ${hint}${raw ? ` (${raw})` : ""}`;
	}
	if (!code && /failed|network|timed?\s?out/i.test(raw)) {
		const hint =
			(typeof strings !== "undefined" && strings["github network error"]) ||
			"Sem resposta do GitHub — verifique a conexão.";
		return `${hint}${raw ? ` (${raw})` : ""}`;
	}
	return raw
		? `GitHub ${code || ""}: ${raw}`.replace(/\s+:/, ":")
		: `GitHub ${code}`;
}

/**
 * POSTs url-encoded params and parses the JSON response.
 * @param {string} url
 * @param {Record<string, string>} params
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{status: number, data: any}>}
 */
async function postForm(url, params, fetchImpl) {
	if (typeof cordova !== "undefined" && cordova?.plugin?.http) {
		const data = await cordovaPost(url, params);
		return data;
	}

	const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
	if (!doFetch) throw new Error("No HTTP client available");

	const res = await doFetch(url, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams(params).toString(),
	});

	const text = await res.text();
	let data = null;
	try {
		data = JSON.parse(text);
	} catch {
		data = { error_description: text?.slice(0, 200) };
	}
	if (!res.ok) {
		throw new Error(
			`GitHub request failed (${res.status}): ${data?.error_description || data?.error || "unknown error"}`,
		);
	}
	return { status: res.status, data };
}

/**
 * Native (CORS-free) POST via cordova-plugin-advanced-http.
 * @param {string} url
 * @param {Record<string, string>} params
 * @returns {Promise<{status: number, data: any}>}
 */
function cordovaPost(url, params) {
	return new Promise((resolve, reject) => {
		const http = cordova.plugin.http;
		try {
			http.setDataSerializer("urlencoded");
		} catch {
			/* serializer already default */
		}
		http.post(
			url,
			params,
			{ Accept: "application/json" },
			(response) => {
				let data = response.data;
				if (typeof data === "string") {
					try {
						data = JSON.parse(data);
					} catch {
						data = { error_description: data?.slice(0, 200) };
					}
				}
				resolve({ status: response.status, data });
			},
			(error) => {
				reject(new Error(error?.error || error?.status || "Network error"));
			},
		);
	});
}

/**
 * Detects a GitHub App client id (vs a classic OAuth App one). GitHub
 * App client ids start with "Iv1." (legacy) or "Ov23li" (current).
 * @param {string} clientId
 * @returns {boolean}
 */
export function isGitHubAppClientId(clientId) {
	return /^(Iv1\.|Ov23li)/.test(String(clientId || ""));
}

/**
 * Step 1 of the device flow: request a device + user code.
 * @param {string} clientId OAuth App / GitHub App client id
 * @param {{scopes?: string[], fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<{deviceCode: string, userCode: string, verificationUri: string, expiresIn: number, interval: number}>}
 */
export async function requestDeviceCode(
	clientId,
	{ scopes = GH_SCOPES, fetchImpl } = {},
) {
	if (!clientId) throw new Error("Missing GitHub OAuth App client id");

	// GitHub Apps (client ids "Ov23li"/"Iv1.") do not take a scope — their
	// user tokens get the permissions configured in the app settings on
	// GitHub. Only classic OAuth Apps accept scopes here.
	const params = { client_id: clientId };
	if (!isGitHubAppClientId(clientId)) {
		params.scope = scopes.join(" ");
	}

	const { data } = await postForm(DEVICE_CODE_URL, params, fetchImpl);

	if (!data?.device_code) {
		throw new Error(
			data?.error_description || data?.error || "No device code returned",
		);
	}

	return {
		deviceCode: data.device_code,
		userCode: data.user_code,
		verificationUri: data.verification_uri || "https://github.com/login/device",
		expiresIn: Number(data.expires_in) > 0 ? Number(data.expires_in) : 900,
		interval: Number(data.interval) > 0 ? Number(data.interval) : 5,
	};
}

/**
 * Step 2 of the device flow: poll until the user authorizes the code.
 * @param {string} clientId
 * @param {string} deviceCode
 * @param {number} interval polling interval in seconds
 * @param {{fetchImpl?: typeof fetch, sleepImpl?: (ms: number) => Promise<void>, maxMs?: number}} [opts]
 * @returns {Promise<string>} the access token
 */
export async function pollForToken(
	clientId,
	deviceCode,
	interval,
	{ fetchImpl, sleepImpl, maxMs = 900000 } = {},
) {
	if (!clientId || !deviceCode) {
		throw new Error("Missing client id or device code");
	}

	const sleep =
		sleepImpl || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	const startedAt = Date.now();
	let currentInterval = Math.max(1, Number(interval) || 5);

	while (true) {
		if (Date.now() - startedAt > maxMs) {
			throw new Error("Device code expired — start the sign-in again");
		}

		await sleep(currentInterval * 1000);

		let data;
		try {
			({ data } = await postForm(
				TOKEN_URL,
				{
					client_id: clientId,
					device_code: deviceCode,
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				},
				fetchImpl,
			));
		} catch {
			// transient network error — keep retrying until the deadline
			continue;
		}

		if (data?.access_token) return data.access_token;

		switch (data?.error) {
			case "authorization_pending":
				continue;
			case "slow_down":
				currentInterval += 5;
				continue;
			case "expired_token":
				throw new Error("Device code expired — start the sign-in again");
			case "access_denied":
				throw new Error("Authorization was denied");
			default:
				throw new Error(
					data?.error_description || data?.error || "GitHub sign-in failed",
				);
		}
	}
}

/**
 * Native (CORS-free) GET via cordova-plugin-advanced-http — same
 * strategy as the token endpoints, because api.github.com requests
 * from the webview can fail CORS preflight on some Android versions.
 * @param {string} url
 * @param {Record<string, string>} headers
 * @returns {Promise<any>} parsed JSON body
 */
function cordovaGetJson(url, headers) {
	return new Promise((resolve, reject) => {
		cordova.plugin.http.sendRequest(
			url,
			{
				method: "GET",
				headers,
				serializer: "json",
				responseType: "json",
				timeout: 20000,
			},
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
				// error.error can be a STRING body or the parsed
				// JSON object ({message: "Bad credentials"}) —
				// normalise both, or the toast shows [object Object].
				let detail = error?.error || error?.statusText || "request failed";
				if (detail && typeof detail === "object") {
					detail = detail?.message || JSON.stringify(detail);
				}
				reject(new Error(describeGhError(error?.status, detail)));
			},
		);
	});
}

/**
 * Fetches the authenticated user profile for a token.
 * @param {string} token
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<{login: string, name: string, avatarUrl: string}>}
 */
export async function fetchGhUser(token, { fetchImpl } = {}) {
	// defensive normalisation: the token may come straight from a
	// paste (whitespace/zero-width) or an old stored session
	const clean = normalizeGhToken(token);
	if (!clean) throw new Error("No token provided");

	const headers = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${clean}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (typeof cordova !== "undefined" && cordova?.plugin?.http?.sendRequest) {
		const user = await cordovaGetJson(USER_URL, headers);
		if (!user?.login) throw new Error("GitHub user request failed");
		return {
			login: user?.login || "",
			name: user?.name || "",
			avatarUrl: user?.avatar_url || "",
		};
	}

	const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
	if (!doFetch) throw new Error("No HTTP client available");

	const res = await doFetch(USER_URL, { headers });
	if (!res.ok) {
		let detail = "";
		try {
			const body = await res.json();
			detail = body?.message || "";
		} catch {
			/* non-JSON body */
		}
		throw new Error(describeGhError(res.status, detail));
	}
	const user = await res.json();
	return {
		login: user?.login || "",
		name: user?.name || "",
		avatarUrl: user?.avatar_url || "",
	};
}

/**
 * Full sign-in orchestration: device code -> user authorization -> token
 * -> profile.
 * @param {{clientId: string, onUserCode?: (info: {userCode: string, verificationUri: string}) => (void|Promise<void>), fetchImpl?: typeof fetch, sleepImpl?: (ms: number) => Promise<void>}} opts
 * @returns {Promise<{token: string, user: {login: string, name: string, avatarUrl: string} | null}>}
 */
export async function signInWithGitHub({
	clientId,
	onUserCode,
	fetchImpl,
	sleepImpl,
} = {}) {
	const device = await requestDeviceCode(clientId, { fetchImpl });
	if (onUserCode) await onUserCode(device);
	const token = await pollForToken(
		clientId,
		device.deviceCode,
		device.interval,
		{
			fetchImpl,
			sleepImpl,
			maxMs: device.expiresIn * 1000,
		},
	);
	let user = null;
	try {
		user = await fetchGhUser(token, { fetchImpl });
	} catch {
		user = null;
	}
	return { token, user };
}
