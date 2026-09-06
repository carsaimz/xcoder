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

// duck.ai validates a browser-like client: consistent UA + client hints,
// a static anti-bot header (x-vqd-hash-1, base64 JSON captured from real
// traffic — see reverse/README of duckduckgo-chat-cli) and frontend
// signal headers. The dynamic token still comes from /status.
const BROWSER_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const SEC_CH_UA = '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"';

/** Minimal cookies duck.ai expects on the session domain. */
const DUCK_COOKIES = "5=1; dcm=3; dcs=1";

/**
 * Static anti-bot header (base64 JSON with server/client hashes and
 * challenge metadata captured from real browser traffic). duck.ai keeps
 * accepting it even after the frontend version moves on — when it stops,
 * the adapter fails soft with an actionable message.
 */
const STATIC_VQD_HASH_1 =
	"eyJzZXJ2ZXJfaGFzaGVzIjpbImRQSlJJTWczZnFYQXIvaStaa3c2cEpFVzEwckdTdmxJVlVkNlFsOVRGWXc9IiwiMUN3Qzg3N0Q3WXE1dzlEeTc4UjhBVi9qZVZWaUlYbmV0Q0xvckx3c01QZz0iLCJQSzc3TGc2L25weDdWQ2J2UWxsTEhBR3cyenJIVmEvQUFBRFBhQTl1ekVRPSJdLCJjbGllbnRfaGFzaGVzIjpbImxWblI0MStCMVFWZ0o4d0hhMUdBNmdxR0JoSjlWdjN5K0dISkdGekJmTGM9IiwiVS9RRUc2RE1qdEU4V2hHU1FxOUU1Z0VGNmw1SWJrNk9NVlBuY01DU1licz0iLCJ6SURsYUNvZG9JUjNwbTNSVTlWOUJXaUJkZDJqenRMODAyN0VYTHhkWll3PSJdLCJzaWduYWxzIjp7fSwibWV0YSI6eyJ2IjoiNCIsImNoYWxsZW5nZV9pZCI6ImM4M2Q0ZTc5NTU2MjJmZjU3Mzc0ZDUzOTk2ZjliMmJhZGE2ZDQxZTMzNDM1ZjVlNzMyYjFmNmZjNmQ0ZTE1NzVoOGpidCIsInRpbWVzdGFtcCI6IjE3NTIxNTU3Nzc4NjYiLCJvcmlnaW4iOiJodHRwczovL2R1Y2tkdWNrZ28uY29tIiwic3RhY2siOiJFcnJvclxuYXQgRSAoaHR0cHM6Ly9kdWNrZHVja2dvLmNvbS9kaXN0L3dwbS5jaGF0LjcwZWFjYTZhZWEyOTQ4YjBiYjYwLmpzOjE6MTQ4MjUpXG5hdCBhc3luYyBodHRwczovL2R1Y2tkdWNrZ28uY29tL2Rpc3Qvd3BtLmNoYXQuNzBlYWNhNmFlYTI5NDhiMGJiNjAuanM6MToxNjk4NSIsImR1cmF0aW9uIjoiNTgifX0=";
/** Frontend signal/version headers captured with the hash above. */
const FE_SIGNALS =
	"eyJzdGFydCI6MTc1MjE1NTc3NzQ4MCwiZXZlbnRzIjpbeyJuYW1lIjoic3RhcnROZXdDaGF0IiwiZGVsdGEiOjc1fSx7Im5hbWUiOiJyZWNlbnRDaGF0c0xpc3RJbXByZXNzaW9uIiwiZGVsdGEiOjEyNH1dLCJlbmQiOjQzNDN9";
const FE_VERSION = "serp_20250710_090702_ET-70eaca6aea2948b0bb60";

/** Browser-identical headers for both duck.ai endpoints. */
function duckHeaders(extra = {}) {
	return {
		Accept: "*/*",
		"Accept-Language": "en-US,en;q=0.9",
		"Cache-Control": "no-store",
		"Sec-CH-UA": SEC_CH_UA,
		"Sec-CH-UA-Mobile": "?0",
		"Sec-CH-UA-Platform": '"Windows"',
		"Sec-Fetch-Dest": "empty",
		"Sec-Fetch-Mode": "cors",
		"Sec-Fetch-Site": "same-origin",
		"User-Agent": BROWSER_UA,
		Origin: "https://duckduckgo.com",
		Referer: "https://duckduckgo.com/",
		...(extra || {}),
	};
}

/**
 * Feeds the essential duck.ai cookies through the native http plugin when
 * available (fetch cannot set the Cookie header; the browser build just
 * skips this — duck.ai mainly enforces cookies against plain HTTP bots).
 */
function injectDuckCookies() {
	try {
		if (typeof cordova !== "undefined" && cordova.plugin?.http?.setCookie) {
			for (const cookie of DUCK_COOKIES.split("; ")) {
				cordova.plugin.http.setCookie("https://duckduckgo.com", cookie);
			}
		}
	} catch {
		/* best-effort */
	}
}

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
 * Matches the advanced-http/tough-cookie crash on a corrupted cookie jar
 * ("Cannot read properties of null (reading 'hostOnly')") — the plugin's
 * localStorage cookie store can end up with a broken entry and then EVERY
 * request through it dies before reaching the network. Clearing the jar
 * heals it (duck.ai's real session lives in the x-vqd-4 header, not in
 * cookies).
 * @param {unknown} error
 * @returns {boolean}
 */
function isCookieJarError(error) {
	return /hostOnly|hostcookie|cookiejar|tough-cookie/i.test(
		String(error?.message || error || ""),
	);
}

/**
 * Low-level request that returns {status, headers, text} through the
 * native http plugin when available, else fetch. A corrupted native
 * cookie jar is cleared once and the request retried.
 * @param {object} opts
 * @param {string} opts.url
 * @param {Record<string, string>} opts.headers
 * @param {string} opts.method
 * @param {object} [opts.body]
 * @param {AbortSignal} [opts.signal]
 */
async function rawRequest({ url, headers, method, body, signal }) {
	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		const send = () =>
			new Promise((resolve, reject) => {
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
		try {
			return await send();
		} catch (error) {
			if (isCookieJarError(error)) {
				try {
					cordova.plugin?.http?.clearCookies?.();
				} catch {
					/* best effort */
				}
				return send();
			}
			throw error;
		}
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
	injectDuckCookies();
	const response = await rawRequest({
		url: STATUS_URL,
		method: "GET",
		headers: duckHeaders({
			"x-vqd-accept": "1",
			...(typeof fetch === "function" && typeof cordova === "undefined"
				? { Cookie: DUCK_COOKIES }
				: {}),
		}),
		signal,
	});
	// duck.ai normally answers x-vqd-4; some builds answer with
	// x-vqd-hash-1 carrying the session value instead — accept both
	const token =
		headerValue(response.headers, "x-vqd-4") ||
		headerValue(response.headers, "x-vqd-hash-1");
	if (!token) {
		throw new Error(
			"503: DuckDuckGo AI não respondeu com sessão (x-vqd-4). Serviço indisponível, instável ou bloqueado nesta rede — troque de provedor (o Integrado continua funcionando).",
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
		// current duck.ai payloads carry tool-choice metadata; the
		// adapter has no tools — everything off, keys may be omitted
		metadata: {
			toolChoice: {
				NewsSearch: false,
				VideosSearch: false,
				LocalSearch: false,
				WeatherForecast: false,
			},
		},
		canUseTools: false,
		canUseApproxLocation: false,
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
				headers: duckHeaders({
					"Content-Type": "application/json",
					Accept: "text/event-stream",
					"x-vqd-4": vqd,
					"x-vqd-hash-1": STATIC_VQD_HASH_1,
					"x-fe-signals": FE_SIGNALS,
					"x-fe-version": FE_VERSION,
				}),
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
			// token expired / anti-bot / throttled → refresh & retry once
			forgetVqd();
			lastError = new Error(
				response.status === 429
					? "429: DuckDuckGo AI atingiu o limite por IP — aguarde alguns segundos e reenvie."
					: response.status === 418
						? "418: DuckDuckGo AI recusou o desafio anti-bot. O serviço é experimental e muda com frequência — use o provedor Integrado (Integrado → Pollinations) ou adicione uma chave Groq gratuita."
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
