/**
 * SVG icon pack — Lucide-flavored vectors for the Xcoder UI.
 *
 * Tier 1 (Sidebar / activities) of the hybrid icon convention
 * (docs/ICONS.md): thin-stroke, 24x24, `currentColor`, no fill. These
 * complements the bundled icon font (`src/res/icons/`): glyphs registered
 * here are sharper and always available, independent of font coverage.
 *
 * Usage:
 *   - Sidebar apps: register the icon as `svg:<name>` (see sidebarApp.js)
 *   - Anywhere else: `import svgIcon from "utils/svgIcons"; svgIcon("search")`
 *
 * Pack files (design reuse): src/res/icons/svg/*.svg — regenerated from
 * this module by scripts/export_svg_pack.cjs. Keep both in sync there.
 *
 * Path data © Lucide Contributors, ISC license (https://lucide.dev).
 */

const ICONS = {
	files: [
		["path", { d: "M20 7h-3a2 2 0 0 1-2-2V2" }],
		[
			"path",
			{ d: "M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" },
		],
		["path", { d: "M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" }],
	],
	search: [
		["path", { d: "m21 21-4.34-4.34" }],
		["circle", { cx: "11", cy: "11", r: "8" }],
	],
	puzzle: [
		[
			"path",
			{
				d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z",
			},
		],
	],
	brain: [
		[
			"path",
			{
				d: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",
			},
		],
		[
			"path",
			{
				d: "M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",
			},
		],
		["path", { d: "M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" }],
		["path", { d: "M17.599 6.5a3 3 0 0 0 .399-1.375" }],
		["path", { d: "M6.003 5.125A3 3 0 0 0 6.401 6.5" }],
		["path", { d: "M3.477 10.896a4 4 0 0 1 .585-.396" }],
		["path", { d: "M19.938 10.5a4 4 0 0 1 .585.396" }],
		["path", { d: "M6 18a4 4 0 0 1-1.967-.516" }],
		["path", { d: "M19.967 17.484A4 4 0 0 1 18 18" }],
	],
	"git-branch": [
		["line", { x1: "6", x2: "6", y1: "3", y2: "15" }],
		["circle", { cx: "18", cy: "6", r: "3" }],
		["circle", { cx: "6", cy: "18", r: "3" }],
		["path", { d: "M18 9a9 9 0 0 1-9 9" }],
	],
	bell: [
		["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
		[
			"path",
			{
				d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
			},
		],
	],
	settings: [
		[
			"path",
			{
				d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
			},
		],
		["circle", { cx: "12", cy: "12", r: "3" }],
	],
	terminal: [
		["path", { d: "M12 19h8" }],
		["path", { d: "m4 17 6-6-6-6" }],
	],
	"square-terminal": [
		["path", { d: "m7 11 2-2-2-2" }],
		["path", { d: "M11 13h4" }],
		["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
	],
	history: [
		["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
		["path", { d: "M3 3v5h5" }],
		["path", { d: "M12 7v5l4 2" }],
	],
	"sliders-horizontal": [
		["line", { x1: "21", x2: "14", y1: "4", y2: "4" }],
		["line", { x1: "10", x2: "3", y1: "4", y2: "4" }],
		["line", { x1: "21", x2: "12", y1: "12", y2: "12" }],
		["line", { x1: "8", x2: "3", y1: "12", y2: "12" }],
		["line", { x1: "21", x2: "16", y1: "20", y2: "20" }],
		["line", { x1: "12", x2: "3", y1: "20", y2: "20" }],
		["line", { x1: "14", x2: "14", y1: "2", y2: "6" }],
		["line", { x1: "8", x2: "8", y1: "10", y2: "14" }],
		["line", { x1: "16", x2: "16", y1: "18", y2: "22" }],
	],
	save: [
		[
			"path",
			{
				d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
			},
		],
		["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }],
		["path", { d: "M7 3v4a1 1 0 0 0 1 1h7" }],
	],
	play: [["polygon", { points: "6 3 20 12 6 21 6 3" }]],
	"message-square": [
		[
			"path",
			{ d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
		],
	],
	sparkles: [
		[
			"path",
			{
				d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
			},
		],
		["path", { d: "M20 3v4" }],
		["path", { d: "M22 5h-4" }],
		["path", { d: "M4 17v2" }],
		["path", { d: "M5 18H3" }],
	],
	folder: [
		[
			"path",
			{
				d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
			},
		],
	],
};

/**
 * Builds an inline SVG element for the given pack icon.
 * @param {string} name icon name in the pack (without the "svg:" prefix)
 * @param {{strokeWidth?: number}} [opts]
 * @returns {SVGSVGElement | null} null when the name is not registered —
 * callers should fall back to the icon font glyph.
 */
export default function svgIcon(name, opts = {}) {
	const node = ICONS[name];
	if (!node) return null;
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("xmlns", NS);
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", String(opts.strokeWidth ?? 1.75));
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");
	svg.classList.add("xc-svg");
	for (const [tag, attrs] of node) {
		const el = document.createElementNS(NS, tag);
		for (const [key, value] of Object.entries(attrs)) {
			el.setAttribute(key, String(value));
		}
		svg.append(el);
	}
	return svg;
}

/**
 * Whether an icon exists in the pack.
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
	return Boolean(ICONS[name]);
}

/** Names available in the pack (useful for tooling/debugging). */
export const iconNames = Object.keys(ICONS);
