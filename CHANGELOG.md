# Changelog

All notable changes to XCoder are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

## [1.1.0] — 2026-08-31

### Changed — Acode-inspired UI overhaul (own implementation)

- App chrome rebuilt around the classic mobile editor layout: 45px header
  (sidebar toggle · file title · run · kebab menu), 30px open-file tab strip
  with active top-border and yellow dirty bullet, quicktools footer.
- Sidebar became a full-height drawer with an app rail (Files, Search in
  files, AI, Settings) and slide-in animation.
- New quicktools bar: sticky ctrl/shift/alt/meta keys, undo/redo, save
  (unsaved badge), find row with match count and wrap-around navigation,
  bracket/symbol inserts, hold-to-repeat arrows, move/copy line, palette.
- Kebab main menu and per-file tab menu (properties, rename, syntax picker,
  go to line, search in file, close others/left/right, copy path).
- File properties dialog replaces the desktop statusbar; colored file-type
  badges in tree and tabs; welcome screen with recent files.
- Theme palettes retuned to the Acode-style dark/light plus a new OLED theme
  (editor + chrome); 4px scrollbars, 320px centered dialogs, bottom toasts.

### Added

- `file.run` (node/python/bash via the virtual shell), `file.saveAs`,
  `search.inFile`, `view.plugins` commands; run button in the header.
- Search-in-files sidebar app over `fs.search`.
- Plugin system (`xcoder.require('plugins')`): ZIP/directory install,
  enable/disable/uninstall, classic-script lifecycle, plugin pages, events.

### Fixed

- Context-menu dismissal no longer swallows the next interaction.
- SSE streaming parser: newline-terminated frames + trailing-frame flush.
- `read_file` tool no longer reports a phantom line for trailing newlines.
- Locale files pt/es completed to full parity (136 keys).

### Removed

- All third-editor names/attribution from code, docs and LICENSE — the
  project is fully self-owned.

## [1.0.0] — 2026-08-31

First public release — original project with an independently named API
surface (`xcoder.*`), mobile-first architecture and build pipeline.

### Added

**Core**

- CodeMirror 6 editor core: syntax highlighting, multi-cursor, search &
  replace (regex), code folding, bracket matching/auto-close, snippets.
- 23 language registrations from 21 `@codemirror/lang-*` packages
  (angular, cpp, css, go, html, java, javascript/typescript, jinja, json,
  less, liquid, markdown, php, python, rust, sass/scss, sql, vue, wast,
  xml, yaml).
- Editor manager: tabs, dirty tracking, session restore, auto-save.
- Three bundled themes: **XCoder Dark+**, **XCoder Light**, **Solarized
  Dark** — applied to editor and app chrome (`data-theme`).

**File system**

- URL-based FS abstraction with backend registry.
- Backends: `memory://` (tests/virtual home), `browser://` (IndexedDB),
  `file://` (cordova-plugin-file), `webdav://` (PROPFIND/PUT/MOVE/COPY).
- Multi-root workspace (`.xcoder-workspace`), recursive search, quick-open.

**Terminal**

- xterm.js host with tabbed terminal panel.
- Virtual shell (xsh): `ls cd pwd cat echo mkdir touch rm mv cp grep wc head
  find open date whoami uname history help clear exit`.
- `git` state machine (init/status/add/commit/log/branch/checkout/diff)
  persisted as `.git/xcoder-git.json`.
- `npm` mock (init/install/run/test/ls over package.json), `apk` catalog
  mock, `node -e` evaluator, `python` status reporter.
- Proot/Alpine userland manager with graceful degradation outside Android.

**LSP**

- JSON-RPC 2.0 codec, WebSocket + Web Worker transports.
- Client: initialize/didOpen/didChange/didClose, completion, hover,
  definition, references, publishDiagnostics.
- CodeMirror bridges: completion source, hover tooltip, lint source.
- Per-language server manager driven by `lsp.servers` settings.

**Plugins**

- Plugin host: `xcoder.setPluginInit/Unmount`, zip + directory install,
  per-plugin page (`$page`), persistent per-plugin cache
  (`cache.cacheFile`, `firstInit`).
- `plugin-template/` scaffold + `pnpm run plugin` CLI
  (new/pack/validate).

**API**

- `xcoder.require()` modules: `commands`, `editorManager`,
  `editorLanguages`, `editorThemes`, `xcoder.codemirror`, `fileSystem`,
  `terminal`, `lsp`, `settings`, `dialog`, `toast`, `events`, `cache`,
  `plugins`.
- Typed event bus (13 events), schema-validated settings, promise-based
  dialogs, toasts, persistent KV cache.
- Public typings for plugin authors: `src/types/xcoder.d.ts`.

**UI**

- VS Code-inspired shell: titlebar, explorer tree (context menu, long-press),
  tab strip, command palette (fuzzy), quick open, settings drawer,
  status bar (branch/cursor/language/theme), mobile bottom bar + drawer.
- Responsive layout for phones; keyboard-first on desktop.

**Tooling**

- Rspack build (single IIFE bundle, static asset copy), TypeScript strict,
  Biome + Prettier, Vitest (34 tests), lang CLI, 43-locale scaffold.
- Documentation suite: architecture, API reference, plugin guide,
  Build guide, i18n guide, PT glossary.

### Notes

- SFTP/FTP backends and real Proot execution require native Cordova plugin
  bridges — interfaces are defined and documented; implementations are
  roadmap items.
- Split editor panels are on the roadmap (CodeMirror compartments ready).
