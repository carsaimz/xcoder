/**
 * Web Scraper + reverse engineering toolkit (pure, unit-tested helpers).
 *
 * The scraping UI (sidebarApps/scrape) fetches a page either through the
 * native http client (raw source) or a hidden webview (rendered DOM —
 * see lib/webInspector.fetchRenderedHtml), then this module does the
 * analysis:
 *
 *   - extractAssets(): images / scripts / stylesheets / fonts / media
 *     with absolute URLs resolved against the page base
 *   - findSecrets(): credential scanning (AWS keys, Google API keys,
 *     OpenAI, GitHub tokens, JWTs, generic api_key/secret assignments)
 *   - findEndpoints(): absolute URLs + API paths referenced in the code
 *   - extractMeta(): <title>, description, generator, Open Graph tags
 *   - beautifyCode(): prettier-based formatter for js/css/html/json
 */

const BROWSER_UA =
	"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

/** @param {string} url @param {Record<string,string>} [headers] */
export function buildRequestHeaders(url, headers = {}) {
	const host = (() => {
		try {
			return new URL(url).host;
		} catch {
			return "";
		}
	})();
	return {
		"User-Agent": BROWSER_UA,
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9,pt;q=0.8",
		...(host ? { Referer: `https://${host}/` } : {}),
		...headers,
	};
}

/**
 * Native http GET (no CORS) with a fetch fallback.
 * @param {string} url
 * @param {{headers?: Record<string, string>, responseType?: "text"|"arraybuffer"}} [options]
 * @returns {Promise<string|ArrayBuffer>}
 */
export async function httpFetch(url, options = {}) {
	const headers = buildRequestHeaders(url, options.headers);
	const responseType = options.responseType || "text";
	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return new Promise((resolve, reject) => {
			cordova.plugin.http.sendRequest(
				url,
				{
					method: "GET",
					headers,
					serializer: "utf8",
					responseType,
					timeout: 45000,
				},
				(response) => resolve(response?.data ?? ""),
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
	if (!response.ok)
		throw new Error(`${response.status}: ${response.statusText}`);
	if (responseType === "arraybuffer") return response.arrayBuffer();
	return response.text();
}

/**
 * Resolves a possibly relative URL against a base, filtering out
 * data:/blob:/javascript: and anchors.
 * @param {string} raw
 * @param {string} base
 * @returns {string|null}
 */
export function resolveUrl(raw, base) {
	const value = String(raw || "").trim();
	if (!value || value.startsWith("#")) return null;
	if (/^(data|blob|javascript|mailto|tel|about):/i.test(value)) return null;
	try {
		return new URL(value, base || undefined).toString();
	} catch {
		return null;
	}
}

/**
 * Coarse asset classification used for icons and filters.
 * @param {string} url
 * @param {string} [tag]
 * @returns {"img"|"css"|"js"|"font"|"media"|"other"}
 */
export function classifyAsset(url, tag = "") {
	const ext = String(url.split("?")[0].split("#")[0])
		.split(".")
		.pop()
		?.toLowerCase();
	if (
		tag === "img" ||
		["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "avif", "bmp"].includes(
			ext,
		)
	) {
		return "img";
	}
	if (tag === "css" || ext === "css" || ext === "scss" || ext === "less")
		return "css";
	if (
		tag === "js" ||
		ext === "js" ||
		ext === "mjs" ||
		ext === "jsx" ||
		ext === "ts"
	)
		return "js";
	if (["woff", "woff2", "ttf", "otf", "eot"].includes(ext)) return "font";
	if (
		tag === "media" ||
		["mp4", "webm", "mp3", "ogg", "wav", "m4a", "mov"].includes(ext)
	) {
		return "media";
	}
	return "other";
}

/** Last path segment, decoded, for file names. @param {string} url */
export function assetName(url) {
	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		const last = segments[segments.length - 1] || parsed.host;
		const name = decodeURIComponent(last).slice(0, 120);
		return name || "asset";
	} catch {
		return "asset";
	}
}

/**
 * Extracts and classifies every referenced asset from HTML source.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {{images: Asset[], scripts: Asset[], styles: Asset[], fonts: Asset[], media: Asset[], other: Asset[], all: Asset[]}}
 *
 * @typedef {{url: string, name: string, type: string, source: string}} Asset
 */
export function extractAssets(html, baseUrl) {
	/** @type {Map<string, Asset>} */
	const found = new Map();
	const source = String(html || "");

	const add = (rawUrl, type, from) => {
		const url = resolveUrl(rawUrl, baseUrl);
		if (!url) return;
		if (found.has(url)) {
			const existing = found.get(url);
			existing.source = `${existing.source},${from}`;
			return;
		}
		found.set(url, {
			url,
			name: assetName(url),
			type: classifyAsset(url, type),
			source: from,
		});
	};

	// <img src> + srcset candidates
	for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
		const tagHtml = match[0];
		const src = tagHtml.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
		if (src) add(src, "img", "img");
		const srcset = tagHtml.match(/\bsrcset\s*=\s*["']([^"']+)["']/i)?.[1];
		if (srcset) {
			for (const candidate of srcset.split(",")) {
				const url = candidate.trim().split(/\s+/)[0];
				if (url) add(url, "img", "srcset");
			}
		}
	}

	// <script src>
	for (const match of source.matchAll(
		/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
	)) {
		add(match[1], "js", "script");
	}

	// <link href> — stylesheets, icons, preloaded assets
	for (const match of source.matchAll(/<link\b[^>]*>/gi)) {
		const tagHtml = match[0];
		const rel = (
			tagHtml.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || ""
		).toLowerCase();
		const href = tagHtml.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
		if (!href) continue;
		if (rel.includes("stylesheet")) add(href, "css", "link");
		else if (rel.includes("icon")) add(href, "img", "icon");
		else if (rel.includes("preload") || rel.includes("modulepreload"))
			add(href, "", "preload");
	}

	// url(...) inside inline <style> blocks
	for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		for (const urlMatch of match[1].matchAll(
			/url\(\s*["']?([^"')]+)["']?\s*\)/gi,
		)) {
			add(urlMatch[1], "", "style");
		}
	}

	// media elements
	for (const match of source.matchAll(
		/<(video|audio|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
	)) {
		add(match[2], "media", match[1].toLowerCase());
	}

	const all = Array.from(found.values());
	return {
		all,
		images: all.filter((a) => a.type === "img"),
		scripts: all.filter((a) => a.type === "js"),
		styles: all.filter((a) => a.type === "css"),
		fonts: all.filter((a) => a.type === "font"),
		media: all.filter((a) => a.type === "media"),
		other: all.filter((a) => a.type === "other"),
	};
}

/** @typedef {{kind: string, value: string, masked: string, line: number, context: string}} Secret */

/**
 * Masks a secret for display — keeps a 6-char head and 3-char tail.
 * @param {string} value
 * @returns {string}
 */
export function maskSecret(value) {
	const text = String(value || "");
	if (text.length <= 10) return `${text.slice(0, 2)}…`;
	return `${text.slice(0, 6)}…${text.slice(-3)}`;
}

/**
 * Scans source code for likely credentials/tokens.
 * @param {string} code
 * @returns {Secret[]}
 */
export function findSecrets(code) {
	const text = String(code || "");
	/** @type {Secret[]} */
	const results = [];
	const seen = new Set();

	const add = (kind, value, index) => {
		if (!value || seen.has(`${kind}:${value}`)) return;
		seen.add(`${kind}:${value}`);
		const before = text.slice(0, index);
		const line = before.split("\n").length;
		const context = text
			.slice(Math.max(0, index - 40), index + value.length + 40)
			.replace(/\s+/g, " ");
		results.push({
			kind,
			value,
			masked: maskSecret(value),
			line,
			context,
		});
	};

	const patterns = [
		[/AKIA[0-9A-Z]{16}/g, "aws-key"],
		[/AIza[0-9A-Za-z_-]{35}/g, "google-key"],
		[/sk-[A-Za-z0-9]{20,}/g, "openai-key"],
		[/gh[pousr]_[A-Za-z0-9]{20,}/g, "github-token"],
		[/xox[baprs]-[A-Za-z0-9-]{10,}/g, "slack-token"],
		[/glpat-[A-Za-z0-9_-]{15,}/g, "gitlab-token"],
		[
			/eyJ[A-Za-z0-9_-]{10,}\.[eyJA-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
			"jwt",
		],
		[/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, "private-key"],
	];
	for (const [regex, kind] of patterns) {
		for (const match of text.matchAll(regex)) {
			add(kind, match[0], match.index || 0);
		}
	}

	// generic key = "value" assignments (api keys, tokens, secrets)
	for (const match of text.matchAll(
		/['"]?(?:api[_-]?key|apikey|auth[_-]?token|access[_-]?token|secret[_-]?key|client[_-]?secret|app[_-]?secret|password)['"]?\s*[:=]\s*['"]([^'"\s]{8,})['"]/gi,
	)) {
		add("assignment", match[1], match.index || 0);
	}

	return results;
}

/** @typedef {{value: string, line: number}} Endpoint */

/**
 * Lists endpoints referenced by a page: absolute URLs and API paths.
 * @param {string} code
 * @returns {{urls: Endpoint[], apiPaths: Endpoint[]}}
 */
export function findEndpoints(code) {
	const text = String(code || "");
	const urls = new Map();
	const apiPaths = new Map();

	const lineAt = (index) => text.slice(0, index || 0).split("\n").length;

	for (const match of text.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)) {
		const value = match[0].replace(/[.,;]+$/, "");
		if (!urls.has(value)) {
			urls.set(value, lineAt(match.index));
		}
	}
	for (const match of text.matchAll(
		/["'`](\/(?:api|v[0-9]+|rest|graphql|ws)\/[^\s"'`<>\\)]{2,})["'`]/g,
	)) {
		const value = match[1];
		if (!apiPaths.has(value)) {
			apiPaths.set(value, lineAt(match.index));
		}
	}

	return {
		urls: Array.from(urls, ([value, line]) => ({ value, line })).slice(0, 300),
		apiPaths: Array.from(apiPaths, ([value, line]) => ({ value, line })).slice(
			0,
			200,
		),
	};
}

/**
 * Page metadata summary (title/description/og/viewport/generator).
 * @param {string} html
 * @returns {{title: string, description: string, generator: string, viewport: string, lang: string, canonical: string, openGraph: Array<[string, string]>}}
 */
export function extractMeta(html) {
	const source = String(html || "");
	const attr = (regex) => source.match(regex)?.[1] || "";
	const content = (name) =>
		source.match(
			new RegExp(
				`<meta[^>]+(?:name|property)=["']${name}["'][^>]*\\bcontent=["']([^"']*)["']`,
				"i",
			),
		)?.[1] ||
		source.match(
			new RegExp(
				`<meta[^>]+\\bcontent=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
				"i",
			),
		)?.[1] ||
		"";

	const openGraph = [];
	for (const match of source.matchAll(
		/<meta[^>]+property=["'](og:[^"']+)["'][^>]*\bcontent=["']([^"']*)["']/gi,
	)) {
		openGraph.push([match[1], match[2]]);
	}

	return {
		title: attr(/<title[^>]*>([\s\S]*?)<\/title>/i)
			.replace(/<[^>]+>/g, "")
			.trim()
			.slice(0, 200),
		description: content("description"),
		generator: content("generator"),
		viewport: content("viewport"),
		lang: attr(/<html[^>]*\blang=["']([^"']+)["']/i),
		canonical: attr(
			/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
		),
		openGraph,
	};
}

/**
 * Count lines of a code string.
 * @param {string} code
 * @returns {number}
 */
export function countLines(code) {
	return String(code || "").split("\n").length;
}

/**
 * Prettier-based beautifier (js/css/html/json). Loaded lazily so the
 * scraper app does not pull the formatter into the main bundle.
 * @param {string} code
 * @param {"js"|"css"|"html"|"json"} lang
 * @returns {Promise<string>}
 */
export async function beautifyCode(code, lang) {
	const [{ format }, parserBabel, parserEstree, parserHtml, parserPostcss] =
		await Promise.all([
			import("prettier/standalone"),
			import("prettier/plugins/babel"),
			import("prettier/plugins/estree"),
			import("prettier/plugins/html"),
			import("prettier/plugins/postcss"),
		]);

	const plugins = [parserBabel, parserEstree, parserHtml, parserPostcss];
	const parsers = {
		js: { parser: "babel", plugins: [parserBabel, parserEstree] },
		json: { parser: "json", plugins: [parserBabel, parserEstree] },
		css: { parser: "css", plugins: [parserPostcss] },
		html: {
			parser: "html",
			plugins: [parserHtml, parserPostcss, parserBabel, parserEstree],
		},
	};
	const config = parsers[lang] || parsers.js;
	return format(String(code ?? ""), {
		parser: config.parser,
		plugins: config.plugins,
		tabWidth: 2,
		printWidth: 100,
	});
}

/**
 * Guesses the language of a fetched source file from the URL/content.
 * @param {string} url
 * @param {string} code
 * @returns {"js"|"css"|"html"|"json"}
 */
export function guessLanguage(url, code) {
	const lower = String(url || "").toLowerCase();
	const text = String(code || "").trimStart();
	if (lower.endsWith(".css") || lower.includes(".css?")) return "css";
	if (lower.endsWith(".json") || lower.includes(".json?")) return "json";
	if (lower.endsWith(".js") || lower.includes(".js?")) return "js";
	if (/^</.test(text)) return "html";
	if (/^[{[]/.test(text)) return "json";
	if (/\bfunction\b|=>|\bconst\b|\bvar\b/.test(text)) return "js";
	return "html";
}
