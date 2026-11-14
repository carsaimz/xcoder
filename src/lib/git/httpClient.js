/**
 * CORS-free HTTP client for isomorphic-git.
 *
 * Why this exists: the Android WebView enforces CORS, and git smart-HTTP
 * endpoints (github.com/…/info/refs) do not send CORS headers — so the
 * stock `isomorphic-git/http/web` client fails every clone/push/pull with
 * «TypeError: Failed to fetch». This module keeps the exact IHttpPlugin
 * contract but tries three transports in order:
 *
 *   1. NATIVE — cordova-plugin-advanced-http (no CORS inside a webview).
 *      Binary request bodies go through the "raw" serializer; HTTP-level
 *      failures (401/404…) are RETURNED as responses so isomorphic-git's
 *      own auth handling still works. Only transport errors fall through.
 *   2. FETCH — direct fetch (works where the remote sends CORS headers).
 *   3. PROXY — fetch through a CORS proxy (default cors.isomorphic-git.org,
 *      configurable in settings.gitCorsProxy).
 *
 * Ports are injectable for unit tests (setGitHttpPorts).
 */
import settings from "lib/settings";

/** Default public CORS proxy for git smart-HTTP (isomorphic-git's own). */
export const DEFAULT_CORS_PROXY = "https://cors.isomorphic-git.org";

/** Native sendRequest timeout (seconds) — big packfiles need minutes. */
const NATIVE_TIMEOUT_S = 1800;

/** Response cap for the native transport (guards WebView memory). */
const NATIVE_MAX_BYTES = 400 * 1024 * 1024;

/** @type {{native?: any, fetch?: any, proxy?: string|null}} test ports */
let ports = { native: null, fetch: null, proxy: undefined };

/**
 * Replaces transports (tests). Pass null to restore defaults.
 * @param {{native?: any|null, fetch?: any|null, proxy?: string|null}|null} [next]
 */
export function setGitHttpPorts(next) {
	ports = next ? { ...next } : { native: null, fetch: null, proxy: undefined };
}

/** The configured CORS proxy ("" disables it). */
export function corsProxy() {
	if (typeof ports.proxy === "string") return ports.proxy;
	return String(settings.value.gitCorsProxy ?? DEFAULT_CORS_PROXY).trim();
}

/**
 * Builds the proxied url. isomorphic-git's proxy convention: the proxy
 * host forwards "<proxy>/<full-url>".
 * @param {string} proxy
 * @param {string} url
 */
export function proxyUrl(proxy, url) {
	return `${proxy.replace(/\/+$/, "")}/${url}`;
}

/** Whether the native http plugin can serve git requests here. */
export function nativeAvailable() {
	if (ports.native) return true;
	return Boolean(globalThis.cordova?.plugin?.http?.sendRequest);
}

/** Native plugin handle (test port or the real one). */
function nativeHttp() {
	return ports.native || globalThis.cordova?.plugin?.http;
}

/**
 * Collapses an isomorphic-git request body (AsyncIterable<Uint8Array>)
 * into one ArrayBuffer for the native "raw" serializer.
 * @param {AsyncIterable<Uint8Array>|Uint8Array|undefined} body
 * @returns {Promise<ArrayBuffer|undefined>}
 */
export async function collectBody(body) {
	if (!body) return undefined;
	if (body instanceof Uint8Array) {
		const copy = new Uint8Array(body);
		return copy.buffer;
	}
	const parts = [];
	let total = 0;
	for await (const chunk of body) {
		const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
		parts.push(view);
		total += view.length;
		if (total > NATIVE_MAX_BYTES) {
			throw new Error("git payload too large for the native transport");
		}
	}
	if (!parts.length) return new Uint8Array(0).buffer;
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out.buffer;
}

/**
 * Minimal Headers-like view over a plain object ([name, value] pairs).
 * isomorphic-git reads headers.get(...) / headers.forEach(...).
 * @param {Record<string, string>} source
 */
export function headersLike(source = {}) {
	const entries = Object.entries(source).map(
		([name, value]) =>
			/** @type {[string, string]} */ ([String(name), String(value)]),
	);
	return {
		entries: () => entries.map((pair) => [...pair]),
		forEach(callback) {
			for (const pair of entries) callback(pair[1], pair[0]);
		},
		get(name) {
			const needle = String(name).toLowerCase();
			const hit = entries.find(([key]) => key.toLowerCase() === needle);
			return hit ? hit[1] : null;
		},
		has(name) {
			return this.get(name) !== null;
		},
	};
}

/**
 * Wraps a full ArrayBuffer body as an async iterator of Uint8Array
 * chunks (the shape isomorphic-git's pack parser consumes).
 * @param {ArrayBuffer|Uint8Array|null} buffer
 */
export function bodyIterator(buffer) {
	if (!buffer) {
		return (async function* empty() {
			/* no body */
		})();
	}
	const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	return (async function* single() {
		yield view;
	})();
}

/** Native transport: cordova-plugin-advanced-http (CORS-free). */
async function nativeRequest(url, method, headers, payload, signal) {
	const http = nativeHttp();
	if (signal?.aborted) {
		throw Object.assign(new Error("cancelled"), { code: "cancelled" });
	}
	const options = {
		method,
		headers: { ...headers },
		responseType: "arraybuffer",
		timeout: NATIVE_TIMEOUT_S,
	};
	if (payload) {
		options.data = payload;
		options.serializer = "raw";
	}
	return new Promise((resolve, reject) => {
		http.sendRequest(
			url,
			options,
			/** @param {{status: number, data: any, headers: any}} response */
			(response) => {
				resolve({
					status: response.status,
					statusText: "",
					data: response.data,
					headers: response.headers || {},
				});
			},
			/** @param {any} error */
			(error) => {
				// HTTP-level failures (401/403/404…) are valid git
				// responses — isomorphic-git maps them to auth errors
				if (typeof error?.status === "number") {
					resolve({
						status: error.status,
						statusText: error?.statusText || "",
						data: error.error,
						headers: error.headers || {},
					});
					return;
				}
				reject(
					new Error(
						`native git http: ${error?.error || error?.source || "transport failed"}`,
					),
				);
			},
		);
	});
}

/** Web transport: fetch (direct or through a proxy). */
async function fetchRequest(url, method, headers, payload, signal) {
	const doFetch = ports.fetch || globalThis.fetch.bind(globalThis);
	const response = await doFetch(url, {
		method,
		headers,
		body: payload,
		signal,
	});
	const text = await response.text();
	return {
		status: response.status,
		statusText: response.statusText || "",
		data: text,
		headers: Object.fromEntries(response.headers.entries()),
	};
}

/** Normalizes transport output into the IHttpPlugin response shape. */
function toGitResponse(raw, onProgress) {
	let buffer = raw.data;
	if (typeof buffer === "string") {
		buffer = new TextEncoder().encode(buffer).buffer;
	} else if (buffer instanceof ArrayBuffer) {
		/* already binary */
	} else if (buffer instanceof Uint8Array) {
		buffer = buffer.slice().buffer;
	} else if (buffer?.buffer instanceof ArrayBuffer) {
		buffer = buffer.buffer;
	} else {
		buffer = new ArrayBuffer(0);
	}
	const bytes = buffer.byteLength;
	onProgress?.({
		phase: "response",
		loaded: bytes,
		total: bytes,
		lengthComputable: true,
	});
	return {
		status: raw.status,
		statusText: raw.statusText,
		headers: headersLike(raw.headers),
		body: bodyIterator(buffer),
	};
}

/**
 * isomorphic-git IHttpPlugin.request — tries native → fetch → proxy.
 * @param {{url: string, method?: string, headers?: object, body?: any,
 *          signal?: AbortSignal, onProgress?: (info: object) => void}} args
 */
export async function request(args) {
	const url = String(args.url || "");
	const method = String(args.method || "GET").toUpperCase();
	const headers = { ...(args.headers || {}) };
	const signal = args.signal;
	const payload = await collectBody(args.body);
	/** @type {Error[]} */
	const failures = [];

	if (nativeAvailable()) {
		try {
			const raw = await nativeRequest(url, method, headers, payload, signal);
			return toGitResponse(raw, args.onProgress);
		} catch (error) {
			if (signal?.aborted) throw error;
			failures.push(error);
		}
	}

	try {
		const raw = await fetchRequest(url, method, headers, payload, signal);
		return toGitResponse(raw, args.onProgress);
	} catch (error) {
		if (signal?.aborted) throw error;
		failures.push(error);
		const proxy = corsProxy();
		if (!proxy) throw composeError(failures, url);
		try {
			const raw = await fetchRequest(
				proxyUrl(proxy, url),
				method,
				headers,
				payload,
				signal,
			);
			return toGitResponse(raw, args.onProgress);
		} catch (proxyError) {
			if (signal?.aborted) throw proxyError;
			failures.push(proxyError);
			throw composeError(failures, url);
		}
	}
}

/** One actionable error message from the transport chain. */
function composeError(failures, url) {
	const detail = failures
		.map((error) => String(error?.message || error))
		.find((text) => text && !/^native git http/.test(text));
	const host = (() => {
		try {
			return new URL(url).host;
		} catch {
			return url;
		}
	})();
	return new Error(
		`git: não foi possível conectar a ${host}${
			detail ? ` (${detail})` : " (sem conexão ou host sem CORS)"
		}`,
	);
}

export default { request };
