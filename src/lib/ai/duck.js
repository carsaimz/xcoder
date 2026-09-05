/**
 * DuckDuckGo "duck.ai" chat adapter — keyless (no API key).
 *
 * duck.ai exposes GPT-4o-mini, Claude Haiku, Llama and Mistral models for
 * free through duckduckgo.com/duckchat/v1. The flow is:
 *
 *   1. GET  /duckchat/v1/status  → response header `x-vqd-4` (session token)
 *   2. POST /duckchat/v1/chat    with header `x-vqd-4` + { model, messages }
 *   3. parse the answer (SSE `data:` lines with {message, action} chunks,
 *      or a plain JSON body, depending on what the endpoint decides)
 *
 * EXPERIMENTAL: DuckDuckGo rotates model availability and throttles per
 * IP. The adapter fails SOFT — every error carries an actionable message
 * and the chat UI already suggests the built-in provider as fallback.
 *
 * In the Cordova app requests ride the native http plugin (no CORS);
 * in the browser build fetch is used (duckduckgo.com may refuse — the
 * provider is advertised as app-only for that reason).
 */

const STATUS_URL = "https://duckduckgo.com/duckchat/v1/status";
const CHAT_URL = "https://duckduckgo.com/duckchat/v1/chat";

const BROWSER_UA =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

/** VQD token cache (module-level, short TTL — they rotate often). */
let vqdCache = { token: "", at: 0 };
const VQD_TTL = 4 * 60 * 1000;

/** @param {string} token */
function rememberVqd(token) {
	vqdCache = { token: String(token || ""), at: Date.now() };
}

function forgetVqd() {
	vqdCache = { token: "", at: 0 };
}

function cachedVqd() {
	if (vqdCache.token && Date.now() - vqdCache.at < VQD_TTL)
		return vqdCache.token;
	return "";
}

/**
 * duck.ai only accepts plain alternating user/assistant turns starting
 * with "user". System prompts are merged into the first user message and
 * consecutive same-role turns are joined — the agent's message history
 * (system + tool-ish turns) is normalized into that shape.
 * @param {Array<object>} messages OpenAI-format messages
 * @returns {Array<{role: string, content: string}>}
 */
export function normalizeDuckMessages(messages) {
	const flat = [];
	for (const message of Array.isArray(messages) ? messages : []) {
		// system turns are merged into the first user turn below
		if (message?.role === "system") continue;
		const role = message?.role === "assistant" ? "assistant" : "user";
		const content = String(
			typeof message?.content === "string"
				? message.content
				: Array.isArray(message?.content)
					? message.content
							.map((part) =>
								typeof part === "string" ? part : part?.text || "",
							)
							.join("\n")
					: "",
		).trim();
		if (!content) continue;
		const last = flat[flat.length - 1];
		if (last && last.role === role) {
			last.content += `\n\n${content}`;
		} else {
			flat.push({ role, content });
		}
	}
	// merge the leading system prompt into the first user turn
	if (
		flat.length &&
		flat[0].role === "user" &&
		messages?.[0]?.role === "system"
	) {
		const system = String(messages[0]?.content || "").trim();
		if (system) {
			flat[0].content = `${system}\n\n${flat[0].content}`;
		}
	}
	// must START with a user turn
	while (flat.length && flat[0].role !== "user") flat.shift();
	return flat;
}

/**
 * Low-level request that returns {status, headers, text} through the
 * native http plugin when available, else fetch.
 * @param {object} opts
 * @param {string} opts.url
 * @param {Record<string, string>} opts.headers
 * @param {string} opts.method
 * @param {object} [opts.body]
 * @param {AbortSignal} [opts.signal]
 */
async function rawRequest({ url, headers, method, body, signal }) {
	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return await new Promise((resolve, reject) => {
			try {
				cordova.plugin.http.sendRequest(
					url,
					{
						method,
						headers,
						...(body ? { data: body, serializer: "json" } : {}),
						responseType: "text",
						timeout: 120000,
					},
					(response) => {
						resolve({
							status: Number(response.status) || 200,
							headers: response.headers || {},
							text:
								typeof response.data === "string"
									? response.data
									: JSON.stringify(response.data ?? ""),
						});
					},
					(error) => {
						reject(
							new Error(
								`${error?.status || "Network"}: ${
									(typeof error?.error === "string" && error.error) ||
									error?.statusText ||
									"request failed"
								}`,
							),
						);
					},
				);
			} catch (error) {
				reject(error);
			}
		});
	}

	const response = await fetch(url, {
		method,
		headers,
		signal,
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await response.text().catch(() => "");
	return { status: response.status, headers: response.headers, text };
}

function headerValue(headers, name) {
	if (!headers) return "";
	if (typeof headers.get === "function") return headers.get(name) || "";
	const direct = headers[name] ?? headers[name.toLowerCase()];
	if (Array.isArray(direct)) return direct[0] || "";
	return String(direct || "");
}

/**
 * Obtains a fresh x-vqd-4 session token (cached).
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
async function ensureVqd(signal) {
	const cached = cachedVqd();
	if (cached) return cached;
	const response = await rawRequest({
		url: STATUS_URL,
		method: "GET",
		headers: {
			Accept: "*/*",
			"x-vqd-accept": "1",
			"User-Agent": BROWSER_UA,
			Origin: "https://duckduckgo.com",
			Referer: "https://duckduckgo.com/",
		},
		signal,
	});
	const token = headerValue(response.headers, "x-vqd-4");
	if (!token) {
		throw new Error(
			"503: DuckDuckGo AI não respondeu com sessão (x-vqd-4). Serviço indisponível ou bloqueado nesta rede — troque de provedor.",
		);
	}
	rememberVqd(token);
	return token;
}

/**
 * Parses a duck.ai answer body (SSE or JSON) into {content}.
 * Handles both the OpenAI-ish shapes and duck's {message, action} chunks.
 * @param {string} text
 * @returns {string}
 */
export function parseDuckBody(text) {
	const raw = String(text || "");
	if (!raw.startsWith("data:")) {
		// plain JSON answer
		try {
			const json = JSON.parse(raw);
			return (
				json?.choices?.[0]?.message?.content ??
				json?.message ??
				(typeof json?.content === "string" ? json.content : "")
			);
		} catch {
			return "";
		}
	}
	let content = "";
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) continue;
		const payload = trimmed.slice(5).trim();
		if (!payload || payload === "[DONE]") continue;
		try {
			const chunk = JSON.parse(payload);
			if (typeof chunk?.message === "string") {
				content += chunk.message;
			} else if (chunk?.choices?.[0]?.delta?.content) {
				content += chunk.choices[0].delta.content;
			} else if (chunk?.choices?.[0]?.message?.content) {
				content += chunk.choices[0].message.content;
			}
			if (chunk?.action === "done") break;
		} catch {
			/* keep-alive comment or partial line */
		}
	}
	return content;
}

/**
 * duck.ai chat completion (OpenAI-compatible result shape).
 * @param {object} opts
 * @param {string} opts.model
 * @param {Array<object>} opts.messages
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{content: string, toolCalls: Array<object>, raw: object}>}
 */
export async function duckChatCompletion({ model, messages, signal }) {
	const body = {
		model: String(model || "gpt-4o-mini"),
		messages: normalizeDuckMessages(messages),
	};
	if (!body.messages.length) {
		throw new Error("empty conversation");
	}

	let lastError = null;
	for (let attempt = 0; attempt < 2; attempt++) {
		const vqd = await ensureVqd(signal);
		try {
			const response = await rawRequest({
				url: CHAT_URL,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "text/event-stream",
					"User-Agent": BROWSER_UA,
					"x-vqd-4": vqd,
					Origin: "https://duckduckgo.com",
					Referer: "https://duckduckgo.com/",
				},
				body,
				signal,
			});
			if (response.status === 200) {
				const content = parseDuckBody(response.text);
				if (content) {
					rememberVqd(vqd);
					return {
						content,
						toolCalls: [],
						raw: {
							model: body.model,
							choices: [{ message: { role: "assistant", content } }],
						},
					};
				}
				throw new Error(
					"502: DuckDuckGo AI devolveu uma resposta vazia — tente novamente ou troque de modelo.",
				);
			}
			// token expired / throttled → refresh and retry once
			forgetVqd();
			lastError = new Error(
				response.status === 429
					? "429: DuckDuckGo AI atingiu o limite por IP — aguarde alguns segundos e reenvie."
					: `${response.status}: DuckDuckGo AI recusou o pedido. O serviço é experimental — use o provedor Integrado ou adicione uma chave Groq gratuita.`,
			);
		} catch (error) {
			if (signal?.aborted) throw error;
			forgetVqd();
			lastError = error;
		}
	}
	throw lastError || new Error("503: DuckDuckGo AI indisponível");
}

export default {
	duckChatCompletion,
	normalizeDuckMessages,
	parseDuckBody,
};
