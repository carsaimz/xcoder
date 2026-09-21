/**
 * Pure code generators for the Dev Tools sidebar app (webdev utilities):
 * box-shadow, gradients, cards and placeholder images.
 *
 * Every generator takes a plain state object and returns the generated
 * code as strings — no DOM, no side effects — so the outputs are
 * unit-testable and the sidebar app stays a thin UI layer.
 *
 * NOTE: not to be confused with lib/devTools.js (the Eruda-based debug
 * inspector for the developer menu) — this module generates CSS/HTML.
 */

/** @typedef {{x: number, y: number, blur: number, spread: number, color: string, inset: boolean}} ShadowState */

/** Clamps a number into [min, max]. */
function clamp(value, min, max) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.min(max, Math.max(min, n));
}

/**
 * Builds a CSS box-shadow declaration from the generator state.
 * @param {ShadowState} state
 * @param {string} [selector] selector used in the rule (default ".element")
 * @returns {string}
 */
export function shadowCSS(state, selector = ".element") {
	const x = Math.round(clamp(state?.x, -100, 100));
	const y = Math.round(clamp(state?.y, -100, 100));
	const blur = Math.round(clamp(state?.blur, 0, 200));
	const spread = Math.round(clamp(state?.spread, -50, 100));
	const color = state?.color || "rgba(0, 0, 0, 0.4)";
	const inset = state?.inset ? " inset" : "";
	const parts = [`${x}px`, `${y}px`, `${blur}px`, `${spread}px`, color];
	return `.${String(selector).replace(/^\./, "")} {\n\tbox-shadow: ${parts.join(" ")}${inset};\n}`;
}

/** @typedef {{type: "linear"|"radial"|"conic", angle: number, stops: Array<{color: string, at: number}>}} GradientState */

/** Sanitizes gradient stops (2+ stops, positions 0-100, sorted). */
function gradientStops(state) {
	const stops = Array.isArray(state?.stops) ? state.stops : [];
	const clean = stops
		.map((stop) => ({
			color: stop?.color || "#000000",
			at: Math.round(clamp(stop?.at, 0, 100)),
		}))
		.sort((a, b) => a.at - b.at);
	while (clean.length < 2) {
		clean.push({ color: "#000000", at: clean.length === 1 ? 100 : 0 });
	}
	return clean.slice(0, 5);
}

/**
 * Builds a CSS background declaration for a gradient.
 * @param {GradientState} state
 * @param {string} [selector] selector used in the rule
 * @returns {string}
 */
export function gradientCSS(state, selector = ".element") {
	const type = ["linear", "radial", "conic"].includes(state?.type)
		? state.type
		: "linear";
	const angle = Math.round(clamp(state?.angle, 0, 360));
	const stops = gradientStops(state)
		.map((stop) => `${stop.color} ${stop.at}%`)
		.join(", ");
	if (type === "linear") {
		return `.${String(selector).replace(/^\./, "")} {\n\tbackground: linear-gradient(${angle}deg, ${stops});\n}`;
	}
	if (type === "radial") {
		return `.${String(selector).replace(/^\./, "")} {\n\tbackground: radial-gradient(circle, ${stops});\n}`;
	}
	return `.${String(selector).replace(/^\./, "")} {\n\tbackground: conic-gradient(from ${angle}deg, ${stops});\n}`;
}

/** @typedef {{background: string, color: string, radius: number, padding: number, borderWidth: number, borderColor: string, shadow: string, title: string, subtitle: string}} CardState */

/** Shadow presets available in the card tool. */
export const CARD_SHADOWS = {
	none: "none",
	soft: "0 2px 8px rgba(0, 0, 0, 0.12)",
	medium: "0 6px 18px rgba(0, 0, 0, 0.18)",
	hard: "0 12px 32px rgba(0, 0, 0, 0.30)",
};

/**
 * Builds an HTML card snippet + its CSS rule.
 * @param {CardState} state
 * @returns {{html: string, css: string}}
 */
export function cardSnippet(state) {
	const bg = state?.background || "#ffffff";
	const fg = state?.color || "#1f1f1f";
	const radius = Math.round(clamp(state?.radius, 0, 40));
	const padding = Math.round(clamp(state?.padding, 0, 64));
	const borderWidth = Math.round(clamp(state?.borderWidth, 0, 12));
	const borderColor = state?.borderColor || "#e0e0e0";
	const shadow = CARD_SHADOWS[state?.shadow] ? state.shadow : "medium";

	const css =
		`.card {\n` +
		`\tbackground: ${bg};\n` +
		`\tcolor: ${fg};\n` +
		`\tborder-radius: ${radius}px;\n` +
		`\tpadding: ${padding}px;\n` +
		(borderWidth > 0
			? `\tborder: ${borderWidth}px solid ${borderColor};\n`
			: "") +
		`\tbox-shadow: ${CARD_SHADOWS[shadow]};\n` +
		`}`;
	const title = String(state?.title ?? "Card title");
	const subtitle = String(state?.subtitle ?? "Card subtitle");
	const html =
		`<div class="card">\n` +
		`\t<h2>${escapeHTML(title)}</h2>\n` +
		`\t<p>${escapeHTML(subtitle)}</p>\n` +
		`</div>`;
	return { html, css };
}

/** Escapes &, < and > for inline HTML snippets. */
function escapeHTML(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** @typedef {{width: number, height: number, background: string, color: string, text: string}} PlaceholderState */

/**
 * Builds an SVG placeholder image and returns it as a data URI plus the
 * raw SVG markup. Deterministic and dependency-free (no canvas needed).
 * @param {PlaceholderState} state
 * @returns {{svg: string, dataUri: string, imgTag: string}}
 */
export function placeholderSnippet(state) {
	const width = Math.round(clamp(state?.width, 16, 4096));
	const height = Math.round(clamp(state?.height, 16, 4096));
	const bg = state?.background || "#e0e0e0";
	const fg = state?.color || "#757575";
	const label = String(state?.text || "").trim() || `${width} × ${height}`;
	const fontSize = Math.max(10, Math.round(Math.min(width, height) / 8));

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		`<rect width="100%" height="100%" fill="${bg}"/>` +
		`<text x="50%" y="50%" fill="${fg}" font-family="sans-serif" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${escapeHTML(label)}</text>` +
		`</svg>`;
	const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
	const imgTag = `<img src="${dataUri}" alt="${escapeHTML(label)}" width="${width}" height="${height}">`;
	return { svg, dataUri, imgTag };
}

/** @typedef {{text: string, url: string, background: string, color: string, radius: number, paddingX: number, paddingY: number, fontSize: number, block: boolean}} CtaState */

/**
 * Builds a call-to-action button (HTML + CSS).
 * @param {CtaState} state
 * @returns {{html: string, css: string}}
 */
export function ctaSnippet(state) {
	const text = String(state?.text ?? "Get started");
	const url = String(state?.url || "#");
	const bg = state?.background || "#7c3aed";
	const fg = state?.color || "#ffffff";
	const radius = Math.round(clamp(state?.radius, 0, 40));
	const px = Math.round(clamp(state?.paddingX, 4, 64));
	const py = Math.round(clamp(state?.paddingY, 2, 40));
	const size = Math.round(clamp(state?.fontSize, 10, 32));
	const block = Boolean(state?.block);
	const css =
		`.cta {\n` +
		`\tdisplay: ${block ? "block" : "inline-block"};\n` +
		(block ? `\ttext-align: center;\n` : "") +
		`\tbackground: ${bg};\n` +
		`\tcolor: ${fg};\n` +
		`\tpadding: ${py}px ${px}px;\n` +
		`\tborder-radius: ${radius}px;\n` +
		`\tfont-size: ${size}px;\n` +
		`\tfont-weight: 600;\n` +
		`\ttext-decoration: none;\n` +
		`\ttransition: filter 0.2s;\n` +
		`}\n\n` +
		`.cta:hover {\n\tfilter: brightness(1.1);\n}`;
	const html = `<a class="cta" href="${escapeHTML(url)}">${escapeHTML(text)}</a>`;
	return { html, css };
}

/** @typedef {{title: string, subtitle: string, buttonText: string, buttonUrl: string, background: string, background2: string, gradient: boolean, color: string, align: string, padding: number}} SectionState */

/**
 * Builds a hero/section block with optional gradient background and button.
 * @param {SectionState} state
 * @returns {{html: string, css: string}}
 */
export function sectionSnippet(state) {
	const title = String(state?.title ?? "Hero title");
	const subtitle = String(
		state?.subtitle ?? "A short description of your product or service.",
	);
	const buttonText = String(state?.buttonText || "");
	const buttonUrl = String(state?.buttonUrl || "#");
	const bg = state?.background || "#1e293b";
	const bg2 = state?.background2 || "#4c1d95";
	const gradient = Boolean(state?.gradient);
	const fg = state?.color || "#f8fafc";
	const align = state?.align === "left" ? "left" : "center";
	const padding = Math.round(clamp(state?.padding, 16, 160));
	const background = gradient ? `linear-gradient(135deg, ${bg}, ${bg2})` : bg;

	const lines = [
		`<section class="hero">`,
		`\t<div class="hero-inner">`,
		`\t\t<h1>${escapeHTML(title)}</h1>`,
		`\t\t<p>${escapeHTML(subtitle)}</p>`,
	];
	if (buttonText) {
		lines.push(
			`\t\t<a class="hero-btn" href="${escapeHTML(buttonUrl)}">${escapeHTML(buttonText)}</a>`,
		);
	}
	lines.push(`\t</div>`, `</section>`);
	const html = lines.join("\n");

	const css =
		`.hero {\n` +
		`\tbackground: ${background};\n` +
		`\tcolor: ${fg};\n` +
		`\tpadding: ${padding}px 24px;\n` +
		`\ttext-align: ${align};\n` +
		`}\n\n` +
		`.hero-inner {\n\tmax-width: 960px;\n\tmargin: 0 auto;\n}\n\n` +
		`.hero h1 {\n\tmargin: 0 0 12px;\n\tfont-size: 40px;\n}\n\n` +
		`.hero p {\n\tmargin: 0 0 24px;\n\tfont-size: 18px;\n\topacity: 0.85;\n}` +
		(buttonText
			? `\n\n.hero-btn {\n\tdisplay: inline-block;\n\tbackground: ${fg};\n\tcolor: ${bg};\n\tpadding: 12px 32px;\n\tborder-radius: 8px;\n\ttext-decoration: none;\n\tfont-weight: 600;\n}`
			: "");
	return { html, css };
}

/** @typedef {{title: string, buttonText: string, includePhone: boolean, includeSubject: boolean, includeMessage: boolean}} FormState */

/**
 * Builds a contact form (HTML + CSS) from toggled fields.
 * @param {FormState} state
 * @returns {{html: string, css: string}}
 */
export function formSnippet(state) {
	const title = String(state?.title ?? "Contact us");
	const buttonText = String(state?.buttonText ?? "Send");
	const fields = [
		{ id: "name", label: "Name", type: "text", required: true },
		{ id: "email", label: "Email", type: "email", required: true },
		...(state?.includePhone
			? [{ id: "phone", label: "Phone", type: "tel", required: false }]
			: []),
		...(state?.includeSubject
			? [{ id: "subject", label: "Subject", type: "text", required: false }]
			: []),
		...(state?.includeMessage !== false
			? [{ id: "message", label: "Message", type: "textarea", required: false }]
			: []),
	];
	const inputs = fields
		.map((field) => {
			const label = `<label for="${field.id}">${field.label}</label>`;
			if (field.type === "textarea") {
				return `${label}\n\t<textarea id="${field.id}" name="${field.id}" rows="5"></textarea>`;
			}
			const required = field.required ? " required" : "";
			return `${label}\n\t<input id="${field.id}" name="${field.id}" type="${field.type}"${required} />`;
		})
		.join("\n\t");
	const html =
		`<form class="contact-form" action="#" method="post">\n` +
		`\t<h2>${escapeHTML(title)}</h2>\n` +
		`\t${inputs}\n` +
		`\t<button type="submit">${escapeHTML(buttonText)}</button>\n` +
		`</form>`;
	const css =
		`.contact-form {\n\tdisplay: grid;\n\tgap: 16px;\n\tmax-width: 480px;\n}\n\n` +
		`.contact-form label {\n\tdisplay: block;\n\tmargin-bottom: 6px;\n\tfont-size: 14px;\n\tfont-weight: 600;\n}\n\n` +
		`.contact-form input,\n.contact-form textarea {\n\twidth: 100%;\n\tpadding: 10px 12px;\n\tborder: 1px solid #cbd5e1;\n\tborder-radius: 8px;\n\tfont: inherit;\n\tbox-sizing: border-box;\n}\n\n` +
		`.contact-form button {\n\tbackground: #7c3aed;\n\tcolor: #ffffff;\n\tpadding: 12px 24px;\n\tborder: 0;\n\tborder-radius: 8px;\n\tfont: inherit;\n\tfont-weight: 600;\n\tcursor: pointer;\n}`;
	return { html, css };
}

/** @typedef {{columns: number, rows: number, striped: boolean, bordered: boolean}} TableState */

/**
 * Builds a data table scaffold (HTML + CSS).
 * @param {TableState} state
 * @returns {{html: string, css: string}}
 */
export function tableSnippet(state) {
	const columns = Math.round(clamp(state?.columns, 1, 8));
	const rows = Math.round(clamp(state?.rows, 1, 20));
	const striped = state?.striped !== false;
	const bordered = Boolean(state?.bordered);
	const head = Array.from(
		{ length: columns },
		(_, index) => `<th>Column ${index + 1}</th>`,
	).join("");
	const body = Array.from(
		{ length: rows },
		(_, r) =>
			`<tr>${Array.from({ length: columns }, (_, c) => `<td>Item ${r + 1}.${c + 1}</td>`).join("")}</tr>`,
	).join("\n\t\t");
	const html =
		`<table class="data-table">\n` +
		`\t<thead>\n\t\t<tr>${head}</tr>\n\t</thead>\n` +
		`\t<tbody>\n\t\t${body}\n\t</tbody>\n` +
		`</table>`;
	const css =
		`.data-table {\n\tborder-collapse: collapse;\n\twidth: 100%;\n\tfont-size: 15px;\n}\n\n` +
		`.data-table th,\n.data-table td {\n\tpadding: 10px 14px;\n\ttext-align: left;${bordered ? "\n\tborder: 1px solid #cbd5e1;" : ""}\n}\n\n` +
		`.data-table thead th {\n\tbackground: #f1f5f9;\n\tfont-weight: 600;\n}` +
		(striped
			? `\n\n.data-table tbody tr:nth-child(even) {\n\tbackground: #f8fafc;\n}`
			: "");
	return { html, css };
}

/** @typedef {{title: string, lang: string, charset: boolean, viewport: boolean, reset: boolean}} BoilerplateState */

/**
 * Builds a complete HTML5 document scaffold.
 * @param {BoilerplateState} state
 * @returns {{html: string}}
 */
export function boilerplateSnippet(state) {
	const title = String(state?.title || "My page");
	const lang = state?.lang === "pt" ? "pt" : "en";
	const charset = state?.charset !== false;
	const viewport = state?.viewport !== false;
	const reset = state?.reset !== false;
	const head = [
		charset ? `\t<meta charset="UTF-8" />` : null,
		viewport
			? `\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
			: null,
		`\t<title>${escapeHTML(title)}</title>`,
	]
		.filter(Boolean)
		.join("\n");
	const style = reset
		? `\n\t<style>\n\t\t*, *::before, *::after { box-sizing: border-box; }\n\t\tbody { margin: 0; font-family: system-ui, sans-serif; color: #1f2937; background: #ffffff; }\n\t</style>`
		: "";
	const html = `<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n${head}${style}\n</head>\n<body>\n\t<h1>${escapeHTML(title)}</h1>\n</body>\n</html>`;
	return { html };
}

// ---------------------------------------------------------------------------
// Programmer utilities (v1.8.0): JSON, Base64, IDs, timestamps, colors,
// lorem ipsum and slugs. Same contract as the generators above — pure,
// no DOM, unit-testable.
// ---------------------------------------------------------------------------

/** @typedef {{ok: boolean, output: string, error: string}} ConvertResult */

/** Wraps a fallible conversion into {ok, output, error}. */
function convertResult(fn, input) {
	try {
		return { ok: true, output: fn(), error: "" };
	} catch (error) {
		return { ok: false, output: "", error: String(error?.message || error) };
	}
}

/**
 * Formats or minifies JSON. On parse failure the error message AND the
 * offending position (when the engine reports one) are returned so the
 * user can jump to the spot.
 * @param {string} text raw JSON
 * @param {"format"|"minify"} [mode]
 * @param {2|4|"tab"} [indent]
 * @returns {ConvertResult}
 */
export function formatJson(text, mode = "format", indent = 2) {
	return convertResult(() => {
		const parsed = JSON.parse(String(text || ""));
		if (mode === "minify") return JSON.stringify(parsed);
		const space = indent === "tab" ? "\t" : Number(indent) || 2;
		return JSON.stringify(parsed, null, space);
	}, text);
}

/**
 * UTF-8-safe Base64 encode/decode.
 * @param {string} text input text
 * @param {"encode"|"decode"} [mode]
 * @returns {ConvertResult}
 */
export function base64Convert(text, mode = "encode") {
	const value = String(text ?? "");
	if (mode === "decode") {
		return convertResult(() => {
			const clean = value.replace(/\s/g, "");
			const binary = atob(clean);
			const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
			return new TextDecoder().decode(bytes);
		}, value);
	}
	return convertResult(() => {
		const bytes = new TextEncoder().encode(value);
		let binary = "";
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary);
	}, value);
}

/** URL-safe short-id alphabet (NanoID style, no lookalikes removed). */
const SHORT_ID_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Generates RFC 4122 v4 UUIDs (crypto.randomUUID when available, hand
 * rolled fallback otherwise) plus a NanoID-style short companion.
 * @param {number} [count] how many ids (1-50)
 * @param {number} [shortLength] short-id length (6-32)
 * @returns {{uuids: string[], shortIds: string[]}}
 */
export function uuidIds(count = 5, shortLength = 10) {
	const total = Math.round(clamp(count, 1, 50));
	const length = Math.round(clamp(shortLength, 6, 32));
	const uuids = [];
	const shortIds = [];
	for (let index = 0; index < total; index += 1) {
		uuids.push(makeUuid());
		let short = "";
		const bytes = randomBytes(length);
		for (const byte of bytes) {
			short += SHORT_ID_ALPHABET[byte % SHORT_ID_ALPHABET.length];
		}
		shortIds.push(short);
	}
	return { uuids, shortIds };
}

/** RFC 4122 v4 UUID (crypto first, Math.random fallback). */
function makeUuid() {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	const bytes = randomBytes(16);
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
		.slice(6, 8)
		.join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/** Cryptographic random bytes with a Math.random fallback. */
function randomBytes(length) {
	const bytes = new Uint8Array(length);
	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		crypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	}
	return bytes;
}

/**
 * Converts between unix timestamps and ISO 8601. Accepts unix seconds,
 * unix milliseconds or any parseable date string; "auto" picks the
 * unit by magnitude (values below 1e11 are seconds).
 * @param {string} input raw input
 * @param {"auto"|"unix-s"|"unix-ms"|"iso"} [mode]
 * @returns {ConvertResult & {unixSec: number, unixMs: number, iso: string, local: string}}
 */
export function timestampConvert(input, mode = "auto") {
	const raw = String(input ?? "").trim();
	const value = Number(raw);
	let date = null;

	if (mode === "iso" || (!/^-?\d+$/.test(raw) && mode === "auto")) {
		date = new Date(raw);
	} else if (mode === "unix-ms") {
		date = new Date(value);
	} else if (mode === "unix-s") {
		date = new Date(value * 1000);
	} else {
		// auto with a pure integer: magnitude decides the unit
		date = new Date(Math.abs(value) < 1e11 ? value * 1000 : value);
	}

	if (!raw) {
		return {
			ok: false,
			output: "",
			error: "Empty input",
			unixSec: 0,
			unixMs: 0,
			iso: "",
			local: "",
		};
	}
	if (!date || Number.isNaN(date.getTime())) {
		return {
			ok: false,
			output: "",
			error: "Data inválida — use unix (s/ms) ou ISO 8601",
			unixSec: 0,
			unixMs: 0,
			iso: "",
			local: "",
		};
	}

	const unixMs = date.getTime();
	const iso = date.toISOString();
	let local = "";
	try {
		local = new Intl.DateTimeFormat(undefined, {
			dateStyle: "full",
			timeStyle: "medium",
		}).format(date);
	} catch {
		local = date.toString();
	}
	const output = [
		`Unix (s):  ${Math.floor(unixMs / 1000)}`,
		`Unix (ms): ${unixMs}`,
		`ISO 8601:  ${iso}`,
		`Local:     ${local}`,
	].join("\n");
	return {
		ok: true,
		output,
		error: "",
		unixSec: Math.floor(unixMs / 1000),
		unixMs,
		iso,
		local,
	};
}

/** Parses "#rgb", "#rrggbb", "rgb(r, g, b)" and "hsl(h, s%, l%)". */
function parseColor(input) {
	const value = String(input ?? "")
		.trim()
		.toLowerCase();
	let match = value.match(/^#?([0-9a-f]{3})$/);
	if (match) {
		const [r, g, b] = match[1]
			.split("")
			.map((char) => Number.parseInt(char + char, 16));
		return { r, g, b };
	}
	match = value.match(/^#?([0-9a-f]{6})$/);
	if (match) {
		const int = Number.parseInt(match[1], 16);
		return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
	}
	match = value.match(
		/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/,
	);
	if (match) {
		return {
			r: clamp(Number(match[1]), 0, 255),
			g: clamp(Number(match[2]), 0, 255),
			b: clamp(Number(match[3]), 0, 255),
		};
	}
	match = value.match(
		/^hsla?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})%?\s*[, ]\s*(\d{1,3})%?/,
	);
	if (match) {
		return hslToRgb(
			Number(match[1]) / 360,
			clamp(Number(match[2]), 0, 100) / 100,
			clamp(Number(match[3]), 0, 100) / 100,
		);
	}
	throw new Error("Cor inválida — use hex, rgb() ou hsl()");
}

/** Converts HSL (0-1 ranges) into RGB channels. */
function hslToRgb(h, s, l) {
	const hue = ((h % 1) + 1) % 1;
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const channel = (t) => {
		let x = t;
		if (x < 0) x += 1;
		if (x > 1) x -= 1;
		if (x < 1 / 6) return p + (q - p) * 6 * x;
		if (x < 1 / 2) return q;
		if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
		return p;
	};
	return {
		r: Math.round(channel(hue + 1 / 3) * 255),
		g: Math.round(channel(hue) * 255),
		b: Math.round(channel(hue - 1 / 3) * 255),
	};
}

/** Converts RGB channels into {h, s, l} (0-360 / 0-100 / 0-100). */
function rgbToHsl(r, g, b) {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
	else if (max === gn) h = ((bn - rn) / d + 2) / 6;
	else h = ((rn - gn) / d + 4) / 6;
	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100),
	};
}

/**
 * Converts a color between hex, rgb() and hsl() notations.
 * @param {string} input hex / rgb() / hsl() input
 * @returns {ConvertResult & {hex: string, rgb: string, hsl: string}}
 */
export function colorConvert(input) {
	try {
		const { r, g, b } = parseColor(input);
		const hex = `#${[r, g, b]
			.map((part) => part.toString(16).padStart(2, "0"))
			.join("")}`;
		const rgb = `rgb(${r}, ${g}, ${b})`;
		const { h, s, l } = rgbToHsl(r, g, b);
		const hsl = `hsl(${h}, ${s}%, ${l}%)`;
		const output = `Hex: ${hex}\nRGB: ${rgb}\nHSL: ${hsl}`;
		return { ok: true, output, error: "", hex, rgb, hsl };
	} catch (error) {
		return {
			ok: false,
			output: "",
			error: String(error?.message || error),
			hex: "",
			rgb: "",
			hsl: "",
		};
	}
}

/** Latin-ish word bank for the lorem generator. */
const LOREM_WORDS = [
	"lorem",
	"ipsum",
	"dolor",
	"sit",
	"amet",
	"consectetur",
	"adipiscing",
	"elit",
	"sed",
	"do",
	"eiusmod",
	"tempor",
	"incididunt",
	"ut",
	"labore",
	"et",
	"dolore",
	"magna",
	"aliqua",
	"enim",
	"ad",
	"minim",
	"veniam",
	"quis",
	"nostrud",
	"exercitation",
	"ullamco",
	"laboris",
	"nisi",
	"aliquip",
	"ex",
	"ea",
	"commodo",
	"consequat",
	"duis",
	"aute",
	"irure",
];

/** Deterministic mulberry32 PRNG (seeded — outputs are reproducible). */
function seededRandom(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Generates lorem ipsum filler text.
 * @param {number} [paragraphs] paragraph count (1-10)
 * @param {number} [sentences] sentences per paragraph (2-10)
 * @param {number} [seed] PRNG seed (deterministic output)
 * @returns {string}
 */
export function loremText(paragraphs = 3, sentences = 5, seed = 42) {
	const count = Math.round(clamp(paragraphs, 1, 10));
	const perParagraph = Math.round(clamp(sentences, 2, 10));
	const random = seededRandom(seed || 42);
	const paragraphsOut = [];
	for (let p = 0; p < count; p += 1) {
		const sentenceParts = [];
		for (let s = 0; s < perParagraph; s += 1) {
			const length = 6 + Math.floor(random() * 8);
			const words = [];
			for (let w = 0; w < length; w += 1) {
				words.push(LOREM_WORDS[Math.floor(random() * LOREM_WORDS.length)]);
			}
			const sentence = words.join(" ");
			sentenceParts.push(
				`${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`,
			);
		}
		paragraphsOut.push(sentenceParts.join(" "));
	}
	return paragraphsOut.join("\n\n");
}

/**
 * Slugifies arbitrary text for URLs: strips accents (NFD), lowercases
 * and collapses non-alphanumeric runs into single dashes.
 * @param {string} text
 * @returns {string}
 */
export function slugText(text) {
	return String(text ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Builds a CSS grid container declaration.
 * @param {{columns: number, rows: number, columnGap: number, rowGap: number, minmax: boolean}} state
 * @param {string} [selector] selector used in the rule (default ".grid")
 * @returns {string}
 */
export function gridCSS(state, selector = ".grid") {
	const columns = Math.round(clamp(state?.columns, 1, 12));
	const rows = Math.round(clamp(state?.rows, 0, 12));
	const columnGap = Math.round(clamp(state?.columnGap, 0, 96));
	const rowGap = Math.round(clamp(state?.rowGap, 0, 96));
	const name = String(selector).replace(/^\./, "");
	const template = state?.minmax
		? `repeat(auto-fill, minmax(140px, 1fr))`
		: `repeat(${columns}, 1fr)`;
	const lines = [`\tdisplay: grid;`, `\tgrid-template-columns: ${template};`];
	if (rows > 0) {
		lines.push(`\tgrid-template-rows: repeat(${rows}, auto);`);
	}
	if (columnGap === rowGap) {
		lines.push(`\tgap: ${columnGap}px;`);
	} else {
		lines.push(`\tcolumn-gap: ${columnGap}px;`);
		lines.push(`\trow-gap: ${rowGap}px;`);
	}
	return `.${name} {\n${lines.join("\n")}\n}`;
}

/** @typedef {{tl: number, tr: number, br: number, bl: number}} RadiusState */

/**
 * Builds a border-radius declaration from the four corners.
 * Collapses to a single value when all corners match.
 * @param {RadiusState} state
 * @param {string} [selector] selector used in the rule (default ".rounded")
 * @returns {string}
 */
export function radiusCSS(state, selector = ".rounded") {
	const tl = Math.round(clamp(state?.tl, 0, 100));
	const tr = Math.round(clamp(state?.tr, 0, 100));
	const br = Math.round(clamp(state?.br, 0, 100));
	const bl = Math.round(clamp(state?.bl, 0, 100));
	const name = String(selector).replace(/^\./, "");
	const value =
		tl === tr && tr === br && br === bl
			? `${tl}px`
			: `${tl}px ${tr}px ${br}px ${bl}px`;
	return `.${name} {\n\tborder-radius: ${value};\n}`;
}

export default {
	shadowCSS,
	gradientCSS,
	cardSnippet,
	placeholderSnippet,
	ctaSnippet,
	sectionSnippet,
	formSnippet,
	tableSnippet,
	boilerplateSnippet,
	formatJson,
	base64Convert,
	uuidIds,
	timestampConvert,
	colorConvert,
	loremText,
	slugText,
	gridCSS,
	radiusCSS,
	CARD_SHADOWS,
};
