import settings from "lib/settings";

/**
 * XCoder companion backend client (Task 9.4).
 *
 * Talks to an optional self-hosted backend (see
 * github.com/carsaimz/xcoder-backend). When the user configures a
 * "Backend URL" in Settings, the app fetches `/api/config` with a
 * stale-while-revalidate cache and consumes:
 *
 *  - marketplaceUrl — remote-managed plugin marketplace fallback
 *  - firebase       — externalized Firebase credentials (Task 9.3)
 *  - announcements  — remote messages for future UI use
 *
 * Everything silently no-ops when the URL is unset, the backend is
 * unreachable or the payload is invalid — boot is never blocked.
 */

const CACHE_KEY = "xcoder.backend.config";
const CACHE_TTL = 30 * 60 * 1000;
const FETCH_TIMEOUT = 8000;

/** @type {any | null} module-level cached config (sync access for consumers) */
let cached = readCache();

/** @type {string | null} URL of the config currently in `cached` */
let cachedUrl = null;
let inFlight = false;

// Kick a background refresh shortly after boot (no-op without backend URL).
setTimeout(() => {
	ensureBackendConfig().catch(() => {});
}, 2000);

/**
 * Returns the configured backend URL (trailing slashes stripped) or null.
 * @returns {string | null}
 */
export function backendUrl() {
	try {
		const url = String(settings.value?.backendUrl || "")
			.trim()
			.replace(/\/+$/, "");
		return /^https?:\/\//.test(url) ? url : null;
	} catch {
		return null;
	}
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
 * the freshest config available, or null when the backend is unset/unreachable.
 * @param {boolean} [force] bypass the TTL and refetch
 * @returns {Promise<any | null>}
 */
export async function ensureBackendConfig(force = false) {
	const url = backendUrl();
	if (!url) return null;

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

		fetch(url, { cache: "no-cache" })
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
