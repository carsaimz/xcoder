import settings from "lib/settings";

/**
 * XCoder site backend client (app ↔ site ↔ repo integration).
 *
 * Talks to the community site (github.com/carsaimz/xcoder-web, deployed on
 * Vercel). The site URL no longer needs to be configured by hand: it
 * defaults to the official deployment and can be overridden for
 * self-hosters via settings.json (`backendUrl`) or by the site itself via
 * remote config (`config.backendUrl`).
 *
 * Consumed endpoints:
 *  - GET  /api/config    → marketplaceUrl, announcements, changelog repo,
 *                          stableVersion, firebase (native) config
 *  - POST /api/feedback  → anonymous logs/feedback events (X-Device-ID)
 *
 * The app identifies itself with an anonymous `X-Device-ID` header (UUID
 * generated on first run) — no login required.
 *
 * Everything silently no-ops when the backend is unreachable or the
 * payload is invalid — boot is never blocked.
 */

const CACHE_KEY = "xcoder.backend.config";
const CACHE_TTL = 30 * 60 * 1000;
const FETCH_TIMEOUT = 8000;
const DEVICE_ID_KEY = "xcoder.deviceId";

/** Official site deployment (Vercel). Overridable via settings/remote config. */
export const DEFAULT_BACKEND_URL = "https://xcoder.vercel.app";

/** @type {any | null} module-level cached config (sync access for consumers) */
let cached = readCache();

/** @type {string | null} URL of the config currently in `cached` */
let cachedUrl = null;
let inFlight = false;

// Kick a background refresh shortly after boot (no-op offline).
setTimeout(() => {
	ensureBackendConfig().catch(() => {});
}, 2000);

/**
 * Anonymous device id (UUID) generated on first run and kept in
 * localStorage. Sent as `X-Device-ID` so the site can aggregate anonymous
 * usage without any account.
 * @returns {string}
 */
export function deviceId() {
	try {
		let id = localStorage.getItem(DEVICE_ID_KEY);
		if (!id) {
			id =
				typeof crypto?.randomUUID === "function"
					? crypto.randomUUID()
					: `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
			localStorage.setItem(DEVICE_ID_KEY, id);
		}
		return id;
	} catch {
		return "anonymous";
	}
}

/**
 * Returns the effective backend URL: manual settings override first, then
 * the URL advertised by the remote config itself, then the official site.
 * @returns {string}
 */
export function backendUrl() {
	const manual = String(settings.value?.backendUrl || "")
		.trim()
		.replace(/\/+$/, "");
	if (/^https?:\/\//.test(manual)) return manual;

	const remote = String(cached?.backendUrl || "")
		.trim()
		.replace(/\/+$/, "");
	if (/^https?:\/\//.test(remote)) return remote;

	return DEFAULT_BACKEND_URL;
}

/**
 * Synchronously returns the last known backend config (or null).
 * @returns {any | null}
 */
export function backendConfig() {
	return cached;
}

/**
 * Fetches `/api/config` when needed (stale-while-revalidate) and returns
 * the freshest config available, or null when the backend is unreachable.
 * @param {boolean} [force] bypass the TTL and refetch
 * @returns {Promise<any | null>}
 */
export async function ensureBackendConfig(force = false) {
	const url = backendUrl();

	if (cached && cachedUrl === url && !force && !isExpired()) {
		return cached;
	}

	if (inFlight) return cached;
	inFlight = true;

	try {
		const config = await httpGetJson(`${url}/api/config`);
		if (!config || typeof config !== "object") {
			throw new Error("Invalid backend config payload");
		}

		cached = config;
		cachedUrl = url;
		writeCache(config);
		document.dispatchEvent(
			new CustomEvent("backendconfigchange", { detail: config }),
		);
		return config;
	} catch (error) {
		console.warn("Backend config refresh failed:", error?.message);
		return cached;
	} finally {
		inFlight = false;
	}
}

/**
 * Sends an anonymous feedback/log event to the site (`POST /api/feedback`).
 * @param {string} type e.g. "feedback" | "event" | "crash"
 * @param {Record<string, any>} payload small JSON-serializable fields
 * @returns {Promise<boolean>} true when accepted
 */
export async function sendFeedback(type, payload = {}) {
	try {
		const url = backendUrl();
		const body = JSON.stringify({
			type: String(type || "feedback").slice(0, 40),
			payload,
			deviceId: deviceId(),
			appVersion: window.BuildInfo?.version || null,
			platform: window.cordova ? "android" : "web",
			at: Date.now(),
		});
		const response = await Promise.race([
			fetch(`${url}/api/feedback`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Device-ID": deviceId(),
				},
				body,
			}),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT),
			),
		]);
		return response?.ok === true;
	} catch {
		return false;
	}
}

/**
 * @returns {boolean}
 */
function isExpired() {
	try {
		const raw = localStorage.getItem(`${CACHE_KEY}.at`);
		const at = Number(raw || 0);
		return !at || Date.now() - at > CACHE_TTL;
	} catch {
		return true;
	}
}

/**
 * @returns {any | null}
 */
function readCache() {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * @param {any} config
 * @returns {void}
 */
function writeCache(config) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(config));
		localStorage.setItem(`${CACHE_KEY}.at`, String(Date.now()));
	} catch {
		/* storage full/blocked — cache is best effort */
	}
}

/**
 * JSON fetch with timeout (no AbortController dependency — older WebViews).
 * @param {string} url
 * @returns {Promise<any>}
 */
function httpGetJson(url) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("Backend config timeout")),
			FETCH_TIMEOUT,
		);

		fetch(url, {
			cache: "no-cache",
			headers: { "X-Device-ID": deviceId() },
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				return response.json();
			})
			.then((data) => {
				clearTimeout(timer);
				resolve(data);
			})
			.catch((error) => {
				clearTimeout(timer);
				reject(error);
			});
	});
}
