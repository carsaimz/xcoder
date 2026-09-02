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

## Palette rules

- Primary surfaces/text: theme driven (default theme **Xcoder**: deep plum
  `rgb(35,33,51)` + violet `rgb(133,108,250)`).
- Buttons/CTAs: orange accent `rgb(255,138,61)` → `rgb(224,104,34)` on press.
- Status: green/amber/red chips as above; never use the old Acode blue as an
  accent in new UI.
