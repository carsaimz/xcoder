import Url from "utils/Url";

/**
 * Keyless web tools for the agent: web search + page reader.
 *
 * Search uses DuckDuckGo's endpoints (no API key):
 *  1. the Instant Answer JSON API (clean, structured)
 *  2. the "lite" HTML result page parsed for titles/URLs/snippets
 *
 * All requests ride the native cordova http plugin when available
 * (no CORS inside the webview) with a fetch fallback for browser builds.
 */

const READ_MAX_CHARS = 8000;

/**
 * CORS-free GET returning the response body as text.
 * @param {string} url
 * @param {Record<string, string>} [headers]
 * @returns {Promise<string>}
 */
async function httpGetText(url, headers = {}) {
	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return new Promise((resolve, reject) => {
			cordova.plugin.http.sendRequest(
				url,
				{
					method: "GET",
					headers,
					serializer: "utf8",
					responseType: "text",
					timeout: 30000,
				},
				(response) => {
					const data = response.data;
					resolve(typeof data === "string" ? data : String(data ?? ""));
				},
				(error) => {
					reject(
						new Error(
							`${error?.status || "Network"}: ${error?.statusText || "request failed"}`,
						),
					);
				},
			);
		});
	}
	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`${response.status}: ${response.statusText}`);
	}
	return response.text();
}

/** @param {string} value */
function decodeEntities(value) {
	return String(value)
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;|&#39;/g, "'")
		.replace(/&nbsp;/g, " ");
}

/** Strips tags/scripts/styles and collapses whitespace. @param {string} html */
export function htmlToText(html) {
	return decodeEntities(
		String(html)
			.replace(/<script[\s\S]*?<\/script>/gi, " ")
			.replace(/<style[\s\S]*?<\/style>/gi, " ")
			.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
			.replace(/<!--[\s\S]*?-->/g, " ")
			.replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<[^>]+>/g, " "),
	)
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Parses DuckDuckGo lite HTML results (rows of links + snippets).
 * @param {string} html
 * @returns {Array<{title: string, url: string, snippet: string}>}
 */
export function parseLiteResults(html) {
	const results = [];
	const rowPattern =
		/<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
	const snippetPattern =
		/<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
	const snippets = [];
	let snippetMatch;
	while ((snippetMatch = snippetPattern.exec(html))) {
		snippets.push(htmlToText(snippetMatch[1]));
	}
	let match;
	let index = 0;
	while ((match = rowPattern.exec(html)) && results.length < 8) {
		let href = decodeEntities(match[1]);
		// ddg redirect links: //duckduckgo.com/l/?uddg=<encoded>&rut=...
		const uddg = /[?&]uddg=([^&]+)/.exec(href);
		if (uddg) href = decodeURIComponent(uddg[1]);
		const title = htmlToText(match[2]);
		if (!title || !/^https?:\/\//i.test(href)) continue;
		results.push({ title, url: href, snippet: snippets[index] || "" });
		index++;
	}
	return results;
}

/**
 * Web search via DuckDuckGo (keyless). Falls back between the Instant
 * Answer API and the lite HTML page.
 * @param {string} query
 * @returns {Promise<string>} agent-readable result block
 */
export async function webSearch(query) {
	const trimmed = String(query || "").trim();
	if (!trimmed) return "ERROR: empty search query";

	// 1) Instant Answer API — structured, but only has "instant" topics
	let results = [];
	try {
		const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&no_html=1&no_redirect=1`;
		const text = await httpGetText(url);
		const data = JSON.parse(text);
		const topics = [];
		const walk = (list) => {
			for (const item of list || []) {
				if (item?.Topics) {
					walk(item.Topics);
				} else if (item?.FirstURL) {
					topics.push({
						title: item.Text || item.FirstURL,
						url: item.FirstURL,
						snippet: (item.Text || "").slice(0, 220),
					});
				}
			}
		};
		walk(data?.RelatedTopics);
		if (data?.AbstractText && data?.AbstractURL) {
			results.push({
				title: data.Heading || "DuckDuckGo abstract",
				url: data.AbstractURL,
				snippet: data.AbstractText,
			});
		}
		results = results.concat(topics.slice(0, 8));
	} catch {
		/* fall through to lite HTML */
	}

	// 2) lite HTML page — real result list
	if (results.length < 3) {
		try {
			const html = await httpGetText(
				`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(trimmed)}`,
				{
					"User-Agent":
						"Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
				},
			);
			const parsed = parseLiteResults(html);
			results = parsed.length ? parsed : results;
		} catch (error) {
			if (!results.length) {
				return `ERROR: web search failed (${error.message || error})`;
			}
		}
	}

	if (!results.length) {
		return `No results for "${trimmed}". Try different keywords or read_url a known documentation page.`;
	}

	const lines = results
		.slice(0, 8)
		.map(
			(item, index) =>
				`${index + 1}. ${item.title}\n   ${item.url}${item.snippet ? `\n   ${item.snippet}` : ""}`,
		);
	return `Web results for "${trimmed}":\n\n${lines.join("\n\n")}`;
}

/**
 * Fetches a page and returns readable text.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function readUrl(url) {
	const target = String(url || "").trim();
	if (!/^https?:\/\//i.test(target)) {
		return "ERROR: read_url needs an absolute http(s) URL";
	}
	try {
		const html = await httpGetText(target, {
			Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
			"User-Agent":
				"Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
		});
		const contentType = html.slice(0, 400);
		const looksHtml = /<\/?[a-z][\s\S]*>/i.test(contentType);
		const text = looksHtml ? htmlToText(html) : html;
		if (!text) return "ERROR: page returned no readable text";
		const host =
			/^https?:\/\/([^/?#]+)/i.exec(target)?.[1] ||
			Url.parse?.(target)?.host ||
			"";
		return `Content of ${host} (${target}):\n\n${text.slice(0, READ_MAX_CHARS)}${
			text.length > READ_MAX_CHARS ? "\n... (truncated)" : ""
		}`;
	} catch (error) {
		return `ERROR: could not fetch ${target} (${error.message || error})`;
	}
}
