import { backendConfig, ensureBackendConfig } from "lib/backend";
import settings from "lib/settings";
import registryJson from "res/plugin-registry.json";
import config from "./config";

/**
 * Xcoder plugin marketplace.
 *
 * The list merges three sources: the XCoder registry
 * (`carsaimz/xcoder-plugins` repository + bundled fallback), an optional
 * custom registry URL, and the official Acode plugin store
 * (`https://acode.app/api`) — the bridge that lets plugins published for
 * the Acode editor show up, install and run in XCoder. The XCoder
 * registry is fetched from the remote registry (jsDelivr CDN with a
 * raw.githubusercontent.com fallback), cached locally so the marketplace
 * keeps working offline, and merged with the bundled fallback registry
 * (`src/res/plugin-registry.json`). A custom marketplace URL can be set in
 * the app settings (`marketplaceUrl`) to point at a self-hosted registry;
 * when unset, a `marketplaceUrl` provided by the companion backend
 * (lib/backend.js remote config) is used as a managed fallback.
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

// --- Acode plugin store bridge (https://acode.app) ---
const ACODE_API_BASE = "https://acode.app/api";
const ACODE_CACHE_KEY = "xcoder.pluginRegistry.acodeCache";
const ACODE_DETAIL_CACHE_KEY = "xcoder.pluginRegistry.acodeDetail";
const ACODE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const ACODE_DETAIL_TTL = 30 * 60 * 1000; // 30 minutes
const ACODE_PAGE_SIZE = 50;
const ACODE_MAX_PAGES = 30; // hard cap: 1500 store plugins

/** @type {Array<object>|null} remote registry entries (cached/fetched) */
let remotePlugins = null;
/** @type {Array<object>|null} custom registry entries */
let customPlugins = null;
/** @type {Array<object>|null} Acode store entries (mapped) */
let acodePlugins = null;
let revalidating = false;
let acodeRevalidating = false;
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

/**
 * Parses the keywords field of an Acode store item (a JSON string).
 * @param {string|string[]|null} raw raw keywords value
 * @returns {string[]}
 */
export function parsePluginKeywords(raw) {
	if (Array.isArray(raw)) return raw.filter(Boolean);
	if (typeof raw !== "string") return [];
	const trimmed = raw.trim();
	if (!trimmed) return [];
	try {
		const parsed = JSON.parse(trimmed);
		if (Array.isArray(parsed)) return parsed.filter(Boolean);
	} catch (error) {
		// Not JSON — treat as a plain comma separated list.
	}
	return trimmed
		.split(",")
		.map((keyword) => keyword.trim())
		.filter(Boolean);
}

/**
 * Maps an Acode store item into the XCoder registry entry shape.
 *
 * Download URLs point at the official store endpoint
 * (`/api/plugin/download/<id>`) — the same one the Acode editor uses.
 * Paid plugins (Acode in-app purchases) and packages built for another
 * editor core are filtered out.
 * @param {object} item Acode store item
 * @returns {object|null} registry entry marked with vendor "acode"
 */
export function mapAcodePlugin(item) {
	if (!item || !item.id || !item.name) return null;
	const editor = item.supported_editor;
	if (editor && editor !== config.SUPPORTED_EDITOR && editor !== "all") {
		return null;
	}
	if (Number(item.price) > 0) return null;
	const id = String(item.id);
	const source = `${ACODE_API_BASE}/plugin/download/${encodeURIComponent(id)}`;
	return normalizeEntry({
		id,
		name: String(item.name),
		version: item.version || "0.0.0",
		icon: item.icon,
		author: typeof item.author === "string" ? item.author : item.author?.name,
		author_github: item.author_github,
		author_email: item.author_email,
		author_verified: Boolean(item.author_verified),
		downloads: item.downloads,
		license: item.license,
		keywords: parsePluginKeywords(item.keywords),
		repository: item.repository,
		supported_editor: editor || config.SUPPORTED_EDITOR,
		min_version_code: item.min_version_code ?? item.minVersionCode,
		description: typeof item.description === "string" ? item.description : "",
		source,
		vendor: "acode",
	});
}

/**
 * Fetches every page of the Acode store catalog.
 * @returns {Promise<Array<object>>} raw store items
 */
async function fetchAllAcodePlugins() {
	const items = [];
	for (let page = 1; page <= ACODE_MAX_PAGES; page++) {
		const data = await httpGetJson(
			`${ACODE_API_BASE}/plugins?page=${page}&limit=${ACODE_PAGE_SIZE}&supported_editor=${config.SUPPORTED_EDITOR}`,
		);
		const batch = Array.isArray(data)
			? data
			: Array.isArray(data?.plugins)
				? data.plugins
				: [];
		items.push(...batch);
		if (batch.length < ACODE_PAGE_SIZE) break;
	}
	return items;
}

/**
 * Guarantees that every Acode entry carries a download source — caches
 * written by older app versions may lack the field.
 * @param {object} entry registry entry
 * @returns {object} entry with a guaranteed source url
 */
function withAcodeSource(entry) {
	if (!entry || entry.vendor !== "acode" || entry.source) return entry;
	return {
		...entry,
		source: `${ACODE_API_BASE}/plugin/download/${encodeURIComponent(entry.id)}`,
	};
}

function revalidateAcode() {
	if (acodeRevalidating) return;
	acodeRevalidating = true;
	fetchAllAcodePlugins()
		.then((items) => {
			acodePlugins = items
				.map(mapAcodePlugin)
				.filter(Boolean)
				.map(withAcodeSource);
			writeCache(ACODE_CACHE_KEY, acodePlugins);
			document.dispatchEvent(new CustomEvent("pluginregistryupdate"));
		})
		.catch((error) => {
			console.warn("Acode plugin store refresh failed:", error?.message);
		})
		.finally(() => {
			acodeRevalidating = false;
		});
}

function ensureAcode() {
	if (acodePlugins) return;
	const cache = readCache(ACODE_CACHE_KEY, ACODE_CACHE_TTL);
	if (cache) {
		acodePlugins = cache.plugins
			.map(normalizeEntry)
			.filter(Boolean)
			.map(withAcodeSource);
		if (cache.expired) revalidateAcode();
		return;
	}
	revalidateAcode();
}

/**
 * Enriches an Acode entry with the store detail payload (readme markdown,
 * changelogs, contributors...) so the plugin page renders like in Acode.
 * @param {object} entry mapped Acode registry entry
 * @returns {Promise<object>} enriched entry
 */
async function enrichAcodeEntry(entry) {
	const downloadSource =
		entry.source ||
		`${ACODE_API_BASE}/plugin/download/${encodeURIComponent(entry.id)}`;
	const cacheKey = `${ACODE_DETAIL_CACHE_KEY}:${entry.id}`;
	const cache = readCache(cacheKey, ACODE_DETAIL_TTL);
	let detail = cache ? cache.plugins?.[0] : null;
	if (!detail) {
		try {
			detail = await httpGetJson(
				`${ACODE_API_BASE}/plugin/${encodeURIComponent(entry.id)}`,
			);
			if (!detail || detail.id !== entry.id) detail = null;
			if (detail) writeCache(cacheKey, [detail]);
		} catch (error) {
			console.warn(`Acode plugin detail failed (${entry.id}):`, error?.message);
			detail = null;
		}
	}
	if (!detail) {
		return { ...entry, source: downloadSource };
	}
	const keywords = parsePluginKeywords(detail.keywords);
	return normalizeEntry({
		...entry,
		version: detail.version || entry.version,
		description: detail.description || entry.description,
		changelogs: detail.changelogs || entry.changelogs,
		contributors: detail.contributors || entry.contributors,
		repository: detail.repository || entry.repository,
		keywords: keywords.length ? keywords : entry.keywords,
		author_github: detail.author_github || entry.author_github,
		author_email: detail.author_email || entry.author_email,
		min_version_code: detail.min_version_code ?? entry.min_version_code,
		supported_editor: detail.supported_editor || entry.supported_editor,
		downloads: detail.downloads ?? entry.downloads,
		source: downloadSource,
		vendor: "acode",
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

/**
 * Marketplace URL remotely provisioned by the companion backend.
 * Only used when the user has not set a custom marketplace URL.
 * @returns {string | null}
 */
function backendRegistryUrl() {
	try {
		const url = String(backendConfig()?.marketplaceUrl || "").trim();
		return /^https?:\/\//.test(url) ? url : null;
	} catch (error) {
		return null;
	}
}

function loadCustomRegistry() {
	const url = customRegistryUrl() || backendRegistryUrl();
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
		...(acodePlugins || []),
	]) {
		const normalized = normalizeEntry(entry);
		if (!normalized || seen.has(normalized.id)) continue;
		seen.add(normalized.id);
		merged.push(normalized);
	}
	return merged;
}

// Re-evaluate the custom registry when a backend config lands (it may
// provision a marketplaceUrl at runtime).
document.addEventListener("backendconfigchange", () => {
	if (customRegistryUrl()) return;
	customUrlInFlight = null;
	loadCustomRegistry();
});

function ensureRemote() {
	// Prime the backend config so a remotely managed marketplace URL is
	// picked up without waiting for the boot timer inside lib/backend.js.
	ensureBackendConfig().catch(() => {});

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
	ensureAcode();
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
		const entry = allPlugins().find((plugin) => plugin.id === id) || null;
		if (!entry) return null;
		if (entry.vendor === "acode") {
			return enrichAcodeEntry(entry);
		}
		return entry;
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
