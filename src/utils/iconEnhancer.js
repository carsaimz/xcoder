import svgIcon from "utils/svgIcons";

/**
 * Icon enhancer — applies the SVG icon pack (Lucide tier) to rendered
 * icon-font glyphs, per the hybrid convention (docs/ICONS.md).
 *
 * The editor menus, file menu and about page are rendered from static
 * Handlebars/JSX templates that reference the bundled icon font
 * (`<span class="icon save">`). This utility upgrades those spans to
 * inline SVG vectors when a matching pack icon exists — sharper at any
 * density and consistent with the sidebar/settings navigation.
 *
 * Only glyphs listed in the map are upgraded; everything else keeps
 * rendering with the icon font (Material filled tier for primary
 * actions, brand glyphs, etc.), so nothing breaks silently.
 */

const GLYPHS = {
	// main editor menu (views/menu.hbs)
	"document-add": "file-plus",
	save: "save",
	folder: "folder",
	clearclose: "x",
	historyrestore: "history",
	search: "search",
	chat_bubble: "message-square",
	lightbulb: "lightbulb",
	wand: "sparkles",
	code: "code",
	terminal: "terminal",
	apps: "layout-grid",
	settings: "settings",
	help: "circle-help",
	logout: "log-out",
	// file menu (views/file-menu.hbs)
	info: "info",
	zap: "zap",
	share: "share-2",
	open_in_browser: "external-link",
	edit: "pencil",
	home: "house",
	pin: "pin",
	"pin-off": "pin-off",
	last_page: "chevrons-right",
	first_page: "chevrons-left",
	compare_arrows: "arrow-right-left",
	subdirectory_arrow_left: "corner-up-left",
	color_lenspalette: "palette",
	// about page (src/pages/about/about.js)
	update: "refresh-cw",
	phone_android: "smartphone",
	github: "github",
	error_outline: "circle-alert",
	person: "user",
	favorite: "heart",
};

/**
 * Upgrades matching `.icon` spans inside the given root to inline SVG.
 * The span element itself is kept (classes/layout untouched) and gains
 * the `xc-svgicon` class, with the SVG sized to the glyph's font-size so
 * existing layouts keep their proportions.
 * @param {HTMLElement|Element|undefined} $root container to scan
 * @returns {HTMLElement|Element|undefined} the same root, for chaining
 */
export function enhanceIcons($root) {
	if (!$root || typeof $root.querySelectorAll !== "function") return $root;

	for (const $el of $root.querySelectorAll("span.icon, i.icon")) {
		if ($el.classList.contains("xc-svgicon")) continue;

		const glyph = [...$el.classList].find(
			(cls) => cls !== "icon" && GLYPHS[cls],
		);
		if (!glyph) continue;

		const $svg = svgIcon(GLYPHS[glyph]);
		if (!$svg) continue;

		// size to the font glyph's box; keep any inline filter/transform
		const size = getComputedStyle($el).fontSize || "20px";
		const style = $el.getAttribute("style");
		$svg.setAttribute(
			"style",
			`width:${size};height:${size}${style ? `;${style}` : ""}`,
		);

		$el.classList.add("xc-svgicon");
		$el.replaceChildren($svg);
	}

	return $root;
}

export default enhanceIcons;
