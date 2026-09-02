# Icon System — Hybrid Convention

The Xcoder UI mixes curated icon sets, each with a clear role. This keeps the
interface expressive without becoming noisy, and moves the visual identity
away from the default Acode blue towards the brand palette: **deep indigo +
orange accent**.

## The four tiers

| Tier                  | Set              | Usage                                                            | Examples                             |
| --------------------- | ---------------- | ---------------------------------------------------------------- | ------------------------------------ |
| Sidebar / activities  | **Lucide**       | Thin-stroke, modern outline icons for navigation and panels       | files, search, git branch, brain, puzzle |
| Primary actions       | **Material (Filled)** | Filled glyphs for the actions that matter (save, run, send, mode toggle) | send, play_arrow, add, check |
| Status / indicators   | **FontAwesome 6 (solid)** | State chips, badges and connection indicators              | circle, plug, wifi, triangle-exclamation |
| Navigation / tabs     | **Bootstrap Icons** | Tab bars, steppers and wayfinding                               | house, journal-code, grid            |

## How this maps to the codebase

The app is a WebView (Cordova) project, so the runtime icon source is the
bundled icon font in `src/res/icons/` (`icons.ttf` + `style.css`, class names
like `icon edit`). The convention governs **which glyph we pick** for new UI:

1. New sidebar/panel icons → add the Lucide-style outline glyph to the font
   (the build pipeline in `scripts/xcoder_icon.py` renders SVG contours into
   `icons.ttf`).
2. Action buttons (send, save, test, new chat) → filled Material-style glyphs
   that already exist in the font (`send`, `play_arrow`, `add`, `check`,
   `tune`).
3. Status chips (Connected / Offline / badges) → solid glyphs or the colored
   pill components (`.ai-pchip`, provider badges) — color carries the state:
   `#4CAF50` green, `#FFC107` amber, `#F44336` red, orange `#FF8A3D` for
   brand accents.
4. Tabs/navigation reuse the existing navigation glyphs; Bootstrap-style
   outline tabs are a styling concern (stroke width), not a new font.

On the **web side** (`xcoder-web`), Lucide ships as `lucide-react` and is the
single source for site navigation — matching tier 1 of this convention.

## The SVG icon pack (tier 1 + 2, shipped)

The navigation tiers are backed by a real, versioned pack — no longer a
convention on paper:

- **Runtime module**: `src/utils/svgIcons.js` — 32 Lucide-flavored icons
  (24×24, stroke `currentColor`, width 1.75) as inline SVG, with
  `svgIcon(name)` / `hasIcon(name)`.
- **Pack files**: `src/res/icons/svg/*.svg` — standalone vectors regenerated
  from the module with `node scripts/export_svg_pack.cjs` (source of truth =
  the module).
- **Integration**: `SidebarApp` icons registered as `svg:<name>` render the
  inline vector (`.icon.xc-svgicon`); the settings kit accepts the same
  `svg:<name>` prefix on any `item.icon` (`components/settingsPage.js`),
  falling back silently to the icon font glyph when the name is not
  registered, so plugins using font names keep working.

Current registrations:

- Sidebar rail: files→`svg:files`, search→`svg:search`, plugins→`svg:puzzle`,
  AI→`svg:brain`, Git→`svg:git-branch`, notifications→`svg:bell`,
  settings→`svg:settings`.
- Main settings (tier 2 — navigation): app→`svg:sliders-horizontal`,
  editor→`svg:file-code`, terminal→`svg:square-terminal`,
  preview→`svg:globe`, formatter→`svg:braces`, theme→`svg:palette`,
  plugins→`svg:puzzle`, language servers→`svg:zap`, AI→`svg:brain`,
  cloud→`svg:cloud`, settings.json→`svg:file-cog`,
  reset→`svg:rotate-ccw`, about→`svg:info`, changelog→`svg:history`.

Tier 3 — menus and static pages (shipped): the icon enhancer
(`utils/iconEnhancer.js`) upgrades rendered font glyphs to the SVG pack at
runtime. Wired into:

- `components/contextmenu/index.js` — every context menu, which covers the
  main editor menu (`views/menu.hbs`) and the file menu
  (`views/file-menu.hbs`): new file→`file-plus`, save→`save`,
  open folder→`folder`, close→`x`, history→`history`, search→`search`,
  AI chat→`message-square`, insight→`lightbulb`, actions→`sparkles`,
  code→`code`, terminal→`terminal`, apps→`layout-grid`,
  settings→`settings`, help→`circle-help`, exit→`log-out`,
  share→`share-2`, in browser→`external-link`, rename→`pencil`,
  home→`house`, pin/pin-off, jump tabs→`chevrons-left/right`,
  compare→`arrow-right-left`, encoding→`corner-up-left`,
  theme→`palette`, and more.
- `pages/about/about.js` — update→`refresh-cw`, offline→`smartphone`,
  GitHub→`github`, issues→`circle-alert`, license→`history`,
  contributors→`user`, community→`heart`. Brand glyphs (`xcoder`,
  `javascript`) intentionally stay on the icon font.

Extra glyphs ready for future UI: download, book-open, bug, shield,
git-pull-request, refresh-cw, external-link, save, play, message-square,
sparkles, folder, plus, x, file-plus, lightbulb, code, layout-grid,
circle-help, log-out, share-2, pencil, house, pin, pin-off,
chevrons-left/right, arrow-right-left, corner-up-left, github, user,
heart, smartphone, circle-alert.

Path data © Lucide Contributors, ISC license.

## Palette rules

- Primary surfaces/text: theme driven (default theme **Xcoder**: deep plum
  `rgb(35,33,51)` + violet `rgb(133,108,250)`).
- Buttons/CTAs: orange accent `rgb(255,138,61)` → `rgb(224,104,34)` on press.
- Status: green/amber/red chips as above; never use the old Acode blue as an
  accent in new UI.
