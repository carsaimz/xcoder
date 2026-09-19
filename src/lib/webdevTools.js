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

export default {
	shadowCSS,
	gradientCSS,
	cardSnippet,
	placeholderSnippet,
	CARD_SHADOWS,
};
