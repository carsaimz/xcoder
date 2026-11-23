/**
 * Icon enhancer — applies the VS Code codicon pack to rendered icon-font
 * glyphs, per the hybrid convention (docs/ICONS.md).
 *
 * The editor menus, file menu and about page are rendered from static
 * Handlebars/JSX templates that reference the bundled icon font
 * (`<span class="icon save">`). Since v1.8.32 the app skins the entire
 * chrome with the real VS Code codicons (styles/codicons.scss, generated
 * by scripts/gen_codicon_skin.py). This utility upgrades matching spans to
 * the `.codicon-<name>` classes; glyphs without a codicon equivalent keep
 * rendering with the legacy icon font, so nothing breaks silently.
 */

const GLYPHS = {
	// main editor menu (views/menu.hbs)
	"document-add": "new-file",
	save: "save",
	folder: "folder",
	clearclose: "close",
	historyrestore: "history",
	search: "search",
	chat_bubble: "comment",
	lightbulb: "light-bulb",
	wand: "wand",
	code: "code",
	terminal: "terminal",
	apps: "layout-sidebar-left",
	settings: "settings-gear",
	help: "question",
	logout: "sign-out",
	// file menu (views/file-menu.hbs)
	info: "info",
	zap: "sparkle",
	share: "link-external",
	open_in_browser: "link-external",
	edit: "edit",
	home: "home",
	pin: "pin",
	"pin-off": "pin",
	last_page: "chevron-right",
	first_page: "chevron-left",
	compare_arrows: "arrow-swap",
	subdirectory_arrow_left: "arrow-left",
	color_lenspalette: "symbol-color",
	// about page (src/pages/about/about.js)
	update: "sync",
	language: "globe",
	menu_book: "book",
	tune: "sparkle",
	phone_android: "device-mobile",
	github: "github",
	error_outline: "error",
	person: "account",
	favorite: "star-full",
};

/**
 * Upgrades matching `.icon` spans inside the given root to codicons.
 * The generated skin (styles/codicons.scss) already re-skins the legacy
 * glyph names app-wide; this helper adds the explicit `.codicon-<name>`
 * class for dynamic templates rendered before/without the skin mapping.
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

		$el.classList.add(`codicon-${GLYPHS[glyph]}`);
	}

	return $root;
}

export default enhanceIcons;
