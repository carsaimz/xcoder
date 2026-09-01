import settings from "lib/settings";
import registryJson from "res/plugin-registry.json";

/**
 * Xcoder plugin marketplace.
 *
 * The marketplace is backed by the `carsaimz/xcoder-plugins` repository.
 * The plugin list is fetched from the remote registry (jsDelivr CDN with a
 * raw.githubusercontent.com fallback), cached locally so the marketplace
 * keeps working offline, and merged with the bundled fallback registry
 * (`src/res/plugin-registry.json`). A custom marketplace URL can be set in
 * the app settings (`marketplaceUrl`) to point at a self-hosted registry.
 *
 * Plugins can also always be installed from any direct URL (http/https)
 * or from a local `.zip` file via the "Add source" button.
 */

const REMOTE_REGISTRY_URLS = [
	"https://cdn.jsdelivr.net/gh/carsaimz/xcoder-plugins@main/plugins.json",
	"https://raw.githubusercontent.com/carsaimz/xcoder-plugins/main/plugins.json",
];

const CACHE_KEY = "xcoder.pluginRegistry.cache";
const CUSTOM_CACHE_KEY = "xcoder.pluginRegistry.customCache";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const CUSTOM_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const FETCH_TIMEOUT = 10 * 1000;

/** @type {Array<object>|null} remote registry entries (cached/fetched) */
let remotePlugins = null;
/** @type {Array<object>|null} custom registry entries */
let customPlugins = null;
let revalidating = false;
let customUrlInFlight = null;

function normalizeEntry(entry) {
	if (!entry || !entry.id || !entry.name) return null;
	return {
		...entry,
		price: 0,
		author_verified: Boolean(entry.author_verified),
	};
}

function bundledPlugins() {
	const list = Array.isArray(registryJson?.plugins) ? registryJson.plugins : [];
	return list.map(normalizeEntry).filter(Boolean);
}

function readCache(key, ttl) {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || !Array.isArray(parsed.plugins)) return null;
		// Expired entries are still useful as an offline fallback — the
		// revalidation simply runs in the background.
		return {
			plugins: parsed.plugins,
			age: Date.now() - (parsed.t || 0),
			expired: Date.now() - (parsed.t || 0) > ttl,
		};
	} catch (error) {
		return null;
	}
}

function writeCache(key, plugins) {
	try {
		localStorage.setItem(key, JSON.stringify({ t: Date.now(), plugins }));
	} catch (error) {
		// storage full/unavailable — the bundled registry remains as fallback
	}
}

/**
 * Fetch a JSON document using every transport available in the current
 * environment (cordova HTTP plugin inside the app, fetch elsewhere).
 * @param {string} url
 * @returns {Promise<any>}
 */
function httpGetJson(url) {
	return new Promise((resolve, reject) => {
		if (typeof cordova !== "undefined" && cordova?.plugin?.http?.sendRequest) {
			cordova.plugin.http.sendRequest(
				url,
				{ method: "GET", responseType: "json", timeout: FETCH_TIMEOUT / 1000 },
				(response) => resolve(response.data),
				(response) =>
					reject(new Error(response?.status || "registry request failed")),
			);
			return;
		}

		if (typeof fetch === "function") {
			const timer = setTimeout(
				() => reject(new Error("registry request timeout")),
				FETCH_TIMEOUT,
			);
			fetch(url, { cache: "no-cache" })
				.then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
			return;
		}

		reject(new Error("No HTTP transport available"));
	});
}

async function fetchRegistryList(urls) {
	let lastError = null;
	for (const url of urls) {
		try {
			const data = await httpGetJson(url);
			const list = Array.isArray(data?.plugins) ? data.plugins : null;
			if (!list) throw new Error("Invalid registry payload");
			return list;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError || new Error("Registry unavailable");
}

function revalidate() {
	if (revalidating) return;
	revalidating = true;
	fetchRegistryList(REMOTE_REGISTRY_URLS)
		.then((list) => {
			remotePlugins = list.map(normalizeEntry).filter(Boolean);
			writeCache(CACHE_KEY, remotePlugins);
			document.dispatchEvent(new CustomEvent("pluginregistryupdate"));
		})
		.catch((error) => {
			console.warn("Plugin marketplace refresh failed:", error?.message);
		})
		.finally(() => {
			revalidating = false;
		});
}

function customRegistryUrl() {
	try {
		const url = String(settings.value?.marketplaceUrl || "").trim();
		return /^https?:\/\//.test(url) ? url : null;
	} catch (error) {
		return null;
	}
}

function loadCustomRegistry() {
	const url = customRegistryUrl();
	if (!url) {
		customPlugins = null;
		return;
	}

	if (customUrlInFlight === url) return;
	customUrlInFlight = url;

	const cache = readCache(`${CUSTOM_CACHE_KEY}:${url}`, CUSTOM_CACHE_TTL);
	if (cache) {
		customPlugins = cache.plugins.map(normalizeEntry).filter(Boolean);
		if (!cache.expired) return;
	}

	fetchRegistryList([url])
		.then((list) => {
			customPlugins = list.map(normalizeEntry).filter(Boolean);
			writeCache(`${CUSTOM_CACHE_KEY}:${url}`, customPlugins);
			document.dispatchEvent(new CustomEvent("pluginregistryupdate"));
		})
		.catch((error) => {
			console.warn(`Custom plugin registry failed (${url}):`, error?.message);
		});
}

function mergeLists() {
	const seen = new Set();
	const merged = [];
	for (const entry of [
		...(customPlugins || []),
		...(remotePlugins || []),
		...bundledPlugins(),
	]) {
		const normalized = normalizeEntry(entry);
		if (!normalized || seen.has(normalized.id)) continue;
		seen.add(normalized.id);
		merged.push(normalized);
	}
	return merged;
}

function ensureRemote() {
	if (remotePlugins) return;
	const cache = readCache(CACHE_KEY, CACHE_TTL);
	if (cache) {
		remotePlugins = cache.plugins.map(normalizeEntry).filter(Boolean);
		if (cache.expired) revalidate();
		return;
	}
	revalidate();
}

function allPlugins() {
	loadCustomRegistry();
	ensureRemote();
	return mergeLists();
}

export default {
	/**
	 * @returns {Promise<Array<object>>} all marketplace plugins
	 */
	async list() {
		return allPlugins();
	},

	/**
	 * @param {string} id
	 * @returns {Promise<object|null>} marketplace plugin or null
	 */
	async get(id) {
		if (!id) return null;
		return allPlugins().find((plugin) => plugin.id === id) || null;
	},

	/**
	 * @param {string} query
	 * @returns {Promise<Array<object>>} plugins matching the query
	 */
	async search(query) {
		const term = String(query || "")
			.trim()
			.toLowerCase();
		if (!term) return [];
		return allPlugins().filter((plugin) => {
			const haystack = [
				plugin.name,
				plugin.description,
				plugin.author?.name,
				Array.isArray(plugin.keywords) ? plugin.keywords.join(" ") : "",
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(term);
		});
	},
};
