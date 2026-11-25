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
				(response) => {
					// advanced-http auto-parses JSON bodies into objects — the
					// callers treat this as text, so stringify non-strings.
					const data = response?.data ?? "";
					resolve(
						typeof data === "string" ? data : JSON.stringify(data, null, 2),
					);
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
	if (!response.ok)
		throw new Error(`${response.status}: ${response.statusText}`);
	if (responseType === "arraybuffer") return response.arrayBuffer();
	const text = await response.text();
	try {
		// application/json responses arrive as objects through the native
		// client; keep both transports consistent for the callers.
		const parsed = JSON.parse(text);
		if (parsed && typeof parsed === "object")
			return JSON.stringify(parsed, null, 2);
	} catch {
		/* plain text — keep as is */
	}
	return text;
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
 * Source-based SEO audit with weighted, scored categories (mirror of the
 * DOM-level audit the native preview runs; works on raw HTML so the
 * scraper's Análise tab can show it). Statuses: pass / warn / fail.
 * @param {string} html
 * @param {string} [url]
 * @returns {{overall: number, categories: Array<{id: string, name: string, weight: number, score: number, checks: Array<{status: "pass"|"warn"|"fail", title: string, detail: string, tip: string}>}>}}
 */
export function seoAudit(html, url = "") {
	const source = String(html || "");
	const lowerUrl = String(url || "");
	const metaInfo = extractMeta(source);
	const attr = (regex) => source.match(regex)?.[1] || "";
	const robots = attr(
		/<meta[^>]+name=["']robots["'][^>]*\bcontent=["']([^"']*)["']/i,
	);
	const charset =
		/<meta[^>]+charset=["']?utf-?8["']?/i.test(source) ||
		/<meta[^>]+http-equiv=["']content-type["'][^>]+charset/i.test(source);
	const imageTags = source.match(/<img\b[^>]*>/gi) || [];
	const withAlt = imageTags.filter((tag) =>
		/\balt\s*=\s*["'][^"']+["']/i.test(tag),
	).length;
	const altRatio = imageTags.length
		? Math.round((withAlt / imageTags.length) * 100)
		: 100;
	const text = source
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	const wordCount = text ? text.split(" ").length : 0;
	const headings = {
		h1: (source.match(/<h1\b/gi) || []).length,
		h2: (source.match(/<h2\b/gi) || []).length,
	};
	const scripts = source.match(/<script\b[^>]*>/gi) || [];
	const blocking = scripts.filter(
		(tag) => /\bsrc\s*=/i.test(tag) && !/\b(defer|async)\b/i.test(tag),
	).length;
	const externalAssets =
		(source.match(/<link\b[^>]+rel=["']stylesheet["']/gi) || []).length +
		(source.match(/<script\b[^>]+src\s*=/gi) || []).length +
		imageTags.length;
	const jsonld = (
		source.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []
	).length;
	const favicon =
		/<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(source) ||
		/<link[^>]+rel=["']shortcut["']/i.test(source);
	const https = /^https:/i.test(lowerUrl);
	const htmlKb = Math.round((source.length / 1024) * 10) / 10;
	const twitterCard = attr(
		/<meta[^>]+name=["']twitter:card["'][^>]*\bcontent=["']([^"']*)["']/i,
	);
	const ogMissing = ["og:title", "og:description", "og:image"].filter(
		(name) => !metaInfo.openGraph.some(([key]) => key.toLowerCase() === name),
	);

	/** @type {Record<string, Array<{status:string,title:string,detail:string,tip:string}>>} */
	const checks = {
		meta: [],
		content: [],
		social: [],
		tech: [],
		perf: [],
	};
	const add = (cat, status, title, detail, tip = "") => {
		checks[cat].push({ status, title, detail, tip });
	};

	const tl = metaInfo.title.length;
	add(
		"meta",
		!tl
			? "fail"
			: tl >= 15 && tl <= 60
				? "pass"
				: tl >= 5 && tl <= 70
					? "warn"
					: "fail",
		"Título da página",
		tl
			? `"${metaInfo.title.slice(0, 120)}" (${tl} caracteres)`
			: "Sem <title>.",
		!tl
			? "Adicione um <title> único e descritivo."
			: "Ideal entre 15 e 60 caracteres.",
	);
	const dl = metaInfo.description.length;
	add(
		"meta",
		!dl ? "fail" : dl >= 50 && dl <= 160 ? "pass" : "warn",
		"Meta description",
		dl ? `${dl} caracteres` : 'Sem <meta name="description">.',
		!dl
			? "Adicione uma descrição de 50–160 caracteres."
			: "Ideal entre 50 e 160 caracteres.",
	);
	add(
		"meta",
		metaInfo.canonical ? "pass" : "warn",
		"URL canónico",
		metaInfo.canonical || 'Sem <link rel="canonical">.',
		metaInfo.canonical ? "" : "Evita conteúdo duplicado com parâmetros de URL.",
	);
	const noindex = /noindex/i.test(robots);
	const nofollow = /nofollow/i.test(robots);
	add(
		"meta",
		noindex || nofollow ? "fail" : "pass",
		"Meta robots",
		robots || "Sem meta robots (indexado por defeito).",
		noindex || nofollow
			? "noindex/nofollow impede a indexação — remova se a página deve aparecer no Google."
			: "",
	);
	add(
		"meta",
		metaInfo.lang ? "pass" : "warn",
		"Idioma (lang)",
		metaInfo.lang ? `lang="${metaInfo.lang}"` : "<html> sem atributo lang.",
		metaInfo.lang ? "" : 'Ex.: <html lang="pt-BR">.',
	);
	add(
		"meta",
		charset ? "pass" : "warn",
		"Charset declarado",
		charset ? "UTF-8 declarado" : "Sem <meta charset>.",
		charset ? "" : 'Adicione <meta charset="utf-8"> no <head>.',
	);

	add(
		"content",
		headings.h1 === 1 ? "pass" : headings.h1 === 0 ? "fail" : "warn",
		"Estrutura de títulos (h1)",
		`${headings.h1} <h1> · ${headings.h2} <h2>.`,
		headings.h1 === 0
			? "Toda página precisa de um <h1>."
			: headings.h1 > 1
				? "Use apenas um <h1> por página."
				: "",
	);
	add(
		"content",
		wordCount >= 300 ? "pass" : wordCount >= 100 ? "warn" : "fail",
		"Volume de texto",
		`${wordCount} palavras visíveis (sem scripts/estilos).`,
		wordCount < 300
			? "Conteúdo com 300+ palavras costuma posicionar melhor."
			: "",
	);
	add(
		"content",
		imageTags.length === 0
			? "pass"
			: altRatio >= 95
				? "pass"
				: altRatio >= 60
					? "warn"
					: "fail",
		"Imagens com alt",
		imageTags.length === 0
			? "A página não usa <img>."
			: `${altRatio}% com alt (${imageTags.length - withAlt} de ${imageTags.length} sem alt).`,
		imageTags.length - withAlt > 0 ? "Todo <img> deve ter alt descritivo." : "",
	);
	const externalLinks = (source.match(/<a\b[^>]+href=["']https?:\/\//gi) || [])
		.length;
	add(
		"content",
		externalLinks ? "pass" : "warn",
		"Ligações externas",
		externalLinks
			? `${externalLinks} ligações externas detetadas.`
			: "Nenhuma ligação externa.",
		externalLinks
			? ""
			: "Ligações externas relevantes dão contexto ao conteúdo.",
	);

	add(
		"social",
		ogMissing.length === 0 ? "pass" : ogMissing.length <= 2 ? "warn" : "fail",
		"Open Graph",
		ogMissing.length
			? `Faltam: ${ogMissing.join(", ")}`
			: "og:title, og:description e og:image presentes.",
		ogMissing.length
			? "Definem o cartão de partilha em WhatsApp/Facebook."
			: "",
	);
	add(
		"social",
		twitterCard ? "pass" : "warn",
		"Twitter Card",
		twitterCard
			? `twitter:card=${twitterCard}`
			: 'Sem <meta name="twitter:card">.',
		twitterCard
			? ""
			: 'Adicione <meta name="twitter:card" content="summary_large_image">.',
	);

	add(
		"tech",
		https ? "pass" : "fail",
		"HTTPS",
		https ? "URL em HTTPS." : "URL em HTTP inseguro.",
		https ? "" : "HTTPS é factor de posicionamento.",
	);
	add(
		"tech",
		metaInfo.viewport ? "pass" : "fail",
		"Viewport móvel",
		metaInfo.viewport || 'Sem <meta name="viewport">.',
		metaInfo.viewport ? "" : "Sem viewport o site não se adapta ao telemóvel.",
	);
	add(
		"tech",
		favicon ? "pass" : "warn",
		"Favicon",
		favicon ? "Declarado." : 'Sem <link rel="icon">.',
		favicon ? "" : "Aparece nos resultados de busca.",
	);
	add(
		"tech",
		jsonld ? "pass" : "warn",
		"Dados estruturados (JSON-LD)",
		`${jsonld} bloco(s) ld+json.`,
		jsonld ? "" : "Schema.org enriquece o resultado na busca.",
	);
	add(
		"tech",
		htmlKb <= 100 ? "pass" : htmlKb <= 500 ? "warn" : "fail",
		"Tamanho do HTML",
		`${htmlKb} KB.`,
		htmlKb > 100 ? "HTML pesado dificulta a indexação." : "",
	);
	add(
		"tech",
		blocking === 0 ? "pass" : blocking <= 2 ? "warn" : "fail",
		"Scripts bloqueantes",
		`${blocking} script(s) com src sem defer/async.`,
		blocking ? "Use defer/async para não bloquear a renderização." : "",
	);

	add(
		"perf",
		externalAssets <= 50 ? "pass" : externalAssets <= 100 ? "warn" : "fail",
		"Pedidos de recursos",
		`${externalAssets} recursos referenciados (imagens + scripts + estilos).`,
		externalAssets > 50
			? "Reduza/combine recursos para acelerar o carregamento."
			: "",
	);

	const categories = [
		{ id: "meta", name: "Meta & tags", weight: 25, checks: checks.meta },
		{ id: "content", name: "Conteúdo", weight: 20, checks: checks.content },
		{
			id: "social",
			name: "Social & partilha",
			weight: 15,
			checks: checks.social,
		},
		{ id: "tech", name: "Técnico", weight: 25, checks: checks.tech },
		{ id: "perf", name: "Performance", weight: 15, checks: checks.perf },
	];
	let overall = 0;
	for (const category of categories) {
		const total = category.checks.length || 1;
		const sum = category.checks.reduce(
			(acc, check) =>
				acc + (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0),
			0,
		);
		category.score = Math.round((sum / total) * 100);
		overall += category.score * category.weight;
	}
	return { overall: Math.round(overall / 100), categories };
}

/**
 * Heuristic: does this source look minified/obfuscated (one or very few
 * very long lines — the "código criptografado" users see when a site ships
 * a bundled build)? Used to auto-format captured pages before display.
 * @param {string} code
 * @returns {boolean}
 */
export function looksMinified(code) {
	const text = String(code || "");
	if (text.length < 2000) return false;
	const lines = text.split("\n");
	if (lines.length <= 5) return true;
	let longest = 0;
	for (const line of lines) {
		if (line.length > longest) longest = line.length;
		if (longest > 5000) return true;
	}
	return false;
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
