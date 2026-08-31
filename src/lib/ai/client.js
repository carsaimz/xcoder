import Url from "utils/Url";

/**
 * OpenAI-compatible chat client.
 *
 * In the Cordova app, requests go through the native http plugin
 * (no CORS restrictions). In the browser/PWA build, fetch is used with
 * streaming support when possible.
 */

/** @type {string} */
const API_KEY_HEADER = "Authorization";

/**
 * @param {string} baseURL
 * @param {string} path
 */
function endpoint(baseURL, path) {
	const base = String(baseURL || "").replace(/\/+$/, "");
	return `${base}/${path.replace(/^\/+/, "")}`;
}

/**
 * @param {string} baseURL
 * @param {string} apiKey
 */
function buildHeaders(baseURL, apiKey) {
	/** @type {Record<string, string>} */
	const headers = { "Content-Type": "application/json" };
	if (apiKey) {
		headers[API_KEY_HEADER] = `Bearer ${apiKey}`;
		// OpenRouter etiquette
		headers["HTTP-Referer"] = "https://github.com/carsaimz/xcoder";
		headers["X-Title"] = "XCoder";
	}
	return headers;
}

/**
 * Lists models available at the endpoint (best effort).
 * @param {object} opts
 * @param {string} opts.baseURL
 * @param {string} opts.apiKey
 * @returns {Promise<string[]>}
 */
export async function listModels({ baseURL, apiKey }) {
	try {
		const json = await nativeOrFetchJson({
			url: endpoint(baseURL, "models"),
			headers: buildHeaders(baseURL, apiKey),
			method: "GET",
		});
		const data = json?.data || json?.models || [];
		return data
			.map((model) => model?.id || model?.name)
			.filter(Boolean);
	} catch (error) {
		window.log("error", "AI listModels failed:", error);
		return [];
	}
}

/**
 * Runs a (non-streaming) chat completion.
 * @param {object} opts
 * @param {string} opts.baseURL
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {Array<object>} opts.messages OpenAI-format messages
 * @param {Array<object>} [opts.tools] OpenAI-format tools
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{content: string, toolCalls: Array<object>, raw: object}>}
 */
export async function chatCompletion({
	baseURL,
	apiKey,
	model,
	messages,
	tools,
	temperature,
	maxTokens,
	signal,
}) {
	const body = {
		model,
		messages,
	};
	if (tools?.length) {
		body.tools = tools;
		body.tool_choice = "auto";
	}
	if (typeof temperature === "number") body.temperature = temperature;
	if (typeof maxTokens === "number" && maxTokens > 0) {
		body.max_tokens = maxTokens;
	}

	const json = await nativeOrFetchJson({
		url: endpoint(baseURL, "chat/completions"),
		headers: buildHeaders(baseURL, apiKey),
		method: "POST",
		body,
		signal,
	});

	if (json?.error) {
		const message =
			typeof json.error === "string"
				? json.error
				: json.error?.message || JSON.stringify(json.error);
		throw new Error(message);
	}

	const choice = json?.choices?.[0];
	const message = choice?.message || {};
	const toolCalls = (message.tool_calls || []).map((call, index) => ({
		id: call.id || `call_${index}`,
		type: "function",
		function: {
			name: call.function?.name,
			arguments: call.function?.arguments || "{}",
		},
	}));

	return {
		content: message.content || "",
		toolCalls,
		raw: json,
	};
}

/**
 * Uses the native cordova http plugin when available (avoids CORS inside
 * the webview), otherwise falls back to fetch.
 * @param {object} opts
 * @param {string} opts.url
 * @param {Record<string, string>} opts.headers
 * @param {string} opts.method
 * @param {object} [opts.body]
 * @param {AbortSignal} [opts.signal]
 */
function nativeOrFetchJson({ url, headers, method, body, signal }) {
	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return nativeRequest({ url, headers, method, body });
	}
	return fetchRequest({ url, headers, method, body, signal });
}

/**
 * @param {object} opts
 */
function nativeRequest({ url, headers, method, body }) {
	return new Promise((resolve, reject) => {
		cordova.plugin.http.sendRequest(
			url,
			{
				method,
				headers,
				data: body,
				responseType: "json",
				timeout: 120000,
			},
			(response) => {
				let data = response.data;
				if (typeof data === "string") {
					try {
						data = JSON.parse(data);
					} catch (error) {
						reject(new Error("Invalid JSON from AI endpoint"));
						return;
					}
				}
				resolve(data);
			},
			(error) => {
				let detail = error?.error || "";
				if (detail && typeof detail !== "string") {
					try {
						detail =
							detail?.error?.message ||
							JSON.stringify(detail);
					} catch {
						detail = String(detail);
					}
				}
				reject(
					new Error(
						`${error?.status || "Network"}: ${detail || error?.statusText || "request failed"}`,
					),
				);
			},
		);
	});
}

/**
 * @param {object} opts
 */
async function fetchRequest({ url, headers, method, body, signal }) {
	const response = await fetch(url, {
		method,
		headers,
		signal,
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await response.json().catch(() => ({}));
	if (!response.ok) {
		const message =
			json?.error?.message || `HTTP ${response.status}`;
		throw new Error(message);
	}
	return json;
}

/**
 * Resolves the effective base URL for a provider (applies template slots).
 * @param {object} provider AIProvider
 * @param {string} [override]
 * @returns {string}
 */
export function resolveBaseURL(provider, override) {
	if (override && override.trim()) return override.trim();
	return provider?.baseURL || "";
}

export default {
	chatCompletion,
	listModels,
	resolveBaseURL,
	endpoint,
	Url,
};
