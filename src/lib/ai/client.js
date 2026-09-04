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
 * Extra per-provider auth headers. Gemini accepts Bearer on its OpenAI
 * compatibility endpoint, but the native key header is also sent as a
 * safety net (e.g. proxies and future endpoint changes).
 */
const EXTRA_AUTH_HEADERS = /** @type {const} */ ({
	google: (apiKey) => ({ "x-goog-api-key": apiKey }),
});

/**
 * @param {string} baseURL
 * @param {string} path
 */
export function endpoint(baseURL, path) {
	const base = String(baseURL || "").replace(/\/+$/, "");
	return `${base}/${path.replace(/^\/+/, "")}`;
}

/**
 * Cleans a pasted API key: surrounding whitespace, wrapping quotes and
 * hidden newlines are the #1 real-world cause of "falha de autenticação"
 * right after a wrong-provider key (the provider literally receives
 * " Bearer sk-...\n" and answers 401).
 * @param {string} key
 * @returns {string}
 */
export function sanitizeApiKey(key) {
	let value = String(key || "");
	value = value.replace(/[\r\n\t]/g, "").trim();
	if (
		(value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
		(value.startsWith("'") && value.endsWith("'") && value.length > 1)
	) {
		value = value.slice(1, -1).trim();
	}
	return value;
}

/**
 * @param {string} baseURL
 * @param {string} apiKey
 */
export function buildHeaders(baseURL, apiKey, providerId) {
	/** @type {Record<string, string>} */
	const headers = { "Content-Type": "application/json" };
	const cleanKey = sanitizeApiKey(apiKey);
	// OpenRouter etiquette (harmless everywhere else)
	headers["HTTP-Referer"] = "https://github.com/carsaimz/xcoder";
	headers["X-Title"] = "XCoder";
	if (cleanKey) {
		headers[API_KEY_HEADER] = `Bearer ${cleanKey}`;
		const extra = providerId && EXTRA_AUTH_HEADERS[providerId];
		if (extra) Object.assign(headers, extra(cleanKey));
	}
	return headers;
}

/**
 * @param {object} opts
 * @param {string} opts.baseURL
 * @param {string} opts.apiKey
 * @param {string} [opts.providerId] provider id for per-provider headers
 * @param {boolean} [opts.strict] when true, HTTP errors THROW instead of
 *        resolving to [] — used by the connection test so a bad key is
 *        actually detected (listModels used to swallow every error and
 *        the test always reported "Connected").
 * @returns {Promise<string[]>}
 */
export async function listModels({ baseURL, apiKey, providerId, strict }) {
	try {
		const json = await nativeOrFetchJson({
			url: endpoint(baseURL, "models"),
			headers: buildHeaders(baseURL, apiKey, providerId),
			method: "GET",
		});
		const data = json?.data || json?.models || [];
		return data.map((model) => model?.id || model?.name).filter(Boolean);
	} catch (error) {
		if (strict) throw error;
		window.log("error", "AI listModels failed:", error);
		return [];
	}
}

/**
 * Streams a chat completion over SSE (fetch + ReadableStream).
 *
 * Most OpenAI-compatible providers send `access-control-allow-origin: *`,
 * so streaming works inside the Cordova webview. When fetch/streaming is
 * unavailable (CORS-blocked host, old webview) the caller can fall back
 * to the non-streaming chatCompletion().
 *
 * @param {object} opts
 * @param {string} opts.baseURL
 * @param {string} opts.apiKey
 * @param {string} [opts.providerId]
 * @param {string} opts.model
 * @param {Array<object>} opts.messages
 * @param {Array<object>} [opts.tools]
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {AbortSignal} [opts.signal]
 * @param {(delta: {content?: string, reasoning?: string}) => void} [opts.onDelta]
 *        called for every chunk as the answer types out
 * @returns {Promise<{content: string, toolCalls: Array<object>, raw: object, reasoning: string}>}
 */
export async function streamChatCompletion({
	baseURL,
	apiKey,
	providerId,
	model,
	messages,
	tools,
	temperature,
	maxTokens,
	signal,
	onDelta,
}) {
	const body = {
		model,
		messages,
		stream: true,
	};
	if (tools?.length) {
		body.tools = tools;
		body.tool_choice = "auto";
	}
	if (typeof temperature === "number") body.temperature = temperature;
	if (typeof maxTokens === "number" && maxTokens > 0) {
		body.max_tokens = maxTokens;
	}
	// ask providers to report usage in the final chunk (OpenAI spec;
	// unknown fields are ignored by providers that don't support it)
	if (!tools?.length) body.stream_options = { include_usage: true };

	const response = await fetch(endpoint(baseURL, "chat/completions"), {
		method: "POST",
		headers: buildHeaders(baseURL, apiKey, providerId),
		body: JSON.stringify(body),
		signal,
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		let json = {};
		try {
			json = text ? JSON.parse(text) : {};
		} catch {
			/* non-JSON error body */
		}
		const detail =
			json?.error?.message ||
			String(text || response.statusText || "request failed").slice(0, 200);
		throw new Error(`${response.status}: ${detail}`);
	}

	if (!response.body || typeof response.body.getReader !== "function") {
		throw new Error("streaming not supported");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let content = "";
	let reasoning = "";
	/** @type {Array<object>} accumulated tool calls from deltas */
	const toolAcc = [];
	let finishReason = null;
	let usage = null;

	/** Pushes accumulated tool-call deltas into OpenAI-shaped calls. */
	const absorbToolDelta = (toolDelta) => {
		const index = toolDelta.index ?? toolAcc.length;
		const current = toolAcc[index] || {
			id: "",
			type: "function",
			function: { name: "", arguments: "" },
		};
		if (toolDelta.id) current.id = toolDelta.id;
		if (toolDelta.function?.name) {
			current.function.name += toolDelta.function.name;
		}
		if (toolDelta.function?.arguments) {
			current.function.arguments += toolDelta.function.arguments;
		}
		toolAcc[index] = current;
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";

		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!line.startsWith("data:")) continue;
			const payload = line.slice(5).trim();
			if (!payload || payload === "[DONE]") continue;
			let chunk;
			try {
				chunk = JSON.parse(payload);
			} catch {
				continue;
			}
			if (chunk?.usage) usage = chunk.usage;
			const choice = chunk?.choices?.[0];
			if (!choice) continue;
			if (choice.finish_reason) finishReason = choice.finish_reason;
			const delta = choice.delta || {};
			const reasoningPiece = delta.reasoning_content ?? delta.reasoning ?? null;
			if (typeof reasoningPiece === "string" && reasoningPiece) {
				reasoning += reasoningPiece;
				onDelta?.({ reasoning: reasoningPiece });
			}
			if (typeof delta.content === "string" && delta.content) {
				content += delta.content;
				onDelta?.({ content: delta.content });
			}
			if (Array.isArray(delta.tool_calls)) {
				for (const toolDelta of delta.tool_calls) {
					absorbToolDelta(toolDelta);
				}
			}
		}
	}

	const toolCalls = toolAcc.filter(Boolean).map((call, index) => ({
		id: call.id || `call_${index}`,
		type: "function",
		function: {
			name: call.function?.name,
			arguments: call.function?.arguments || "{}",
		},
	}));

	const raw = {
		model,
		choices: [
			{
				finish_reason: finishReason,
				message: {
					content,
					...(toolCalls.length ? { tool_calls: toolAcc } : {}),
				},
			},
		],
		...(usage ? { usage } : {}),
	};

	return { content, toolCalls, raw, reasoning };
}

/**
 * Turns raw provider errors ("401: ...", timeouts, CORS TypeErrors) into
 * actionable messages for the chat UI. Auth errors name the provider and
 * where to fix the key — no raw stack/config detail.
 * @param {Error | string} error
 * @param {string} [providerId]
 * @returns {string}
 */
export function explainError(error, providerId) {
	const message = String(error?.message || error || "");
	const provider = providerId ? PROVIDER_NAMES[providerId] || providerId : "";
	const status = /^(\d{3}):/.exec(message)?.[1];
	if (status === "401" || status === "403") {
		return (
			`${provider ? `${provider}: ` : ""}Chave de API inválida, expirada ou sem permissão (${status}). ` +
			`Abra Configurações › IA › Provedores e verifique/renove a chave deste provedor.`
		);
	}
	if (status === "402") {
		return `${provider ? `${provider}: ` : ""}Saldo/credito insuficiente na conta do provedor (402).`;
	}
	if (status === "404") {
		return `${provider ? `${provider}: ` : ""}Modelo ou endpoint não encontrado (404). Confirme o nome do modelo nas configurações do provedor.`;
	}
	if (status === "429") {
		return `${provider ? `${provider}: ` : ""}Limite de requisições atingido (429) — aguarde alguns segundos e tente de novo. Provedores gratuitos são compartilhados e limitados (~1 req/s).`;
	}
	if (/^5\d\d:/.test(message)) {
		return `${provider ? `${provider}: ` : ""}O servidor do provedor falhou (${message.slice(0, 3)}). Tente novamente ou troque de modelo.`;
	}
	if (/timeout|timed out/i.test(message)) {
		return `${provider ? `${provider}: ` : ""}Tempo esgotado (timeout). Verifique a conexão e tente novamente.`;
	}
	return message;
}

/** Display names for error messages (subset — falls back to the id). */
const PROVIDER_NAMES = {
	groq: "Groq",
	"openrouter-free": "OpenRouter (free)",
	"openrouter-paid": "OpenRouter",
	gemini: "Google Gemini",
	mistral: "Mistral",
	together: "Together AI",
	cerebras: "Cerebras",
	chutes: "Chutes",
	pollinations: "Built-in",
};

/**
 * Runs a (non-streaming) chat completion.
 * @param {object} opts
 * @param {string} opts.baseURL
 * @param {string} opts.apiKey
 * @param {string} [opts.providerId] provider id for per-provider headers
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
	providerId,
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
		headers: buildHeaders(baseURL, apiKey, providerId),
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
 * Mirrors the request headers into the plugin's host-scoped global headers
 * before every send. Some advanced-http builds lose per-call headers in
 * specific paths (redirects, aborted pooled connections); the host-scoped
 * store is applied by getMergedHeaders() on the Java side too, so auth
 * always rides along. Values are overwritten on every call, so a changed
 * key or provider never goes stale.
 * @param {string} url
 * @param {Record<string, string>} headers
 */
function mirrorHeadersToHost(url, headers) {
	try {
		const host = /^https?:\/\/([^/?#]+)/i.exec(url)?.[1];
		if (!host || !cordova.plugin?.http?.setHeader) return;
		for (const [name, value] of Object.entries(headers)) {
			cordova.plugin.http.setHeader(host, name, value);
		}
		// keyless request on a host previously used WITH a key: drop
		// the stale global Authorization so it never leaks back in
		if (!headers.Authorization) {
			cordova.plugin.http.setHeader(host, "Authorization", null);
		}
	} catch {
		/* best effort — per-call headers still apply */
	}
}

/**
 * @param {object} opts
 */
function nativeRequest({ url, headers, method, body }) {
	const attempt = () =>
		new Promise((resolve, reject) => {
			cordova.plugin.http.sendRequest(
				url,
				{
					method,
					headers,
					data: body,
					// CRITICAL: the plugin's default serializer is
					// "urlencoded", which silently converts the JSON
					// body into a form-encoded string
					// ("...&messages=[object Object]") while the
					// header still says application/json — every
					// provider then answers 400/401. "json" sends
					// the body exactly as built above.
					serializer: "json",
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
							detail = detail?.error?.message || JSON.stringify(detail);
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

	// First pass: per-call headers (+ mirrored host headers).
	mirrorHeadersToHost(url, headers);
	return attempt().catch(async (firstError) => {
		const status = /^\d{3}/.exec(String(firstError?.message || ""))?.[0];
		if (status !== "401" && status !== "403") throw firstError;

		// Second pass: re-mirror explicitly and retry ONCE — covers
		// plugin builds where the first per-call header set is
		// dropped (fresh host, redirect, pooled connection).
		mirrorHeadersToHost(url, headers);
		try {
			return await attempt();
		} catch (secondError) {
			throw secondError;
		}
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
	const text = await response.text().catch(() => "");
	let json = {};
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		/* non-JSON error body (HTML proxy pages etc.) */
	}
	if (!response.ok) {
		const detail =
			json?.error?.message ||
			String(text || response.statusText || "request failed").slice(0, 200);
		// Same "<status>: <detail>" shape as the native path so
		// httpStatus() and the recovery logic treat both alike.
		throw new Error(`${response.status}: ${detail}`);
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
	streamChatCompletion,
	listModels,
	resolveBaseURL,
	endpoint,
	buildHeaders,
	sanitizeApiKey,
	explainError,
	Url,
};
