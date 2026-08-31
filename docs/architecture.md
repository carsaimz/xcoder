# XCoder — Architecture

> Version 1.0.0 · Status: implementation spec (this document is the contract the code follows)

XCoder is a mobile-first code editor and IDE for Android. It is a hybrid application: an HTML/CSS/TypeScript front end runs inside the Android WebView, and native capabilities (filesystem, terminal userland, permissions) are reached through the Apache Cordova bridge. The editing experience is powered by CodeMirror 6.

XCoder is an original project: plugin hosts, an editor manager and a virtual terminal, all written for XCoder with an independently named public API (`xcoder.*`).

---

## 1. High-level view

```
┌─────────────────────────────────────────────────────────────┐
│                     XCoder Application                      │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  UI Layer    │  Editor Core │  Terminal    │  LSP Client    │
│  (HTML/CSS,  │  (CodeMirror │  (xterm.js + │  (JSON-RPC 2.0 │
│  Web         │   6 views)   │   virtual    │   over WS /    │
│  Components) │              │   shell)     │   Worker)      │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                  Public API  (window.xcoder)                │
│        require() · setPluginInit() · setPluginUnmount()     │
├──────────────┬──────────────┬───────────────────────────────┤
│ Plugin System│ Command      │  Event Bus · Settings · Cache │
│ (host +      │ Registry     │                               │
│  registry)   │ (palette +   │                               │
│              │  keymaps)    │                               │
├──────────────┴──────────────┴───────────────────────────────┤
│              File System Abstraction (URL-based)            │
│   backend:memory · backend:browser · backend:cordova ·      │
│   backend:webdav (SFTP/FTP via native bridge: planned)      │
├─────────────────────────────────────────────────────────────┤
│               Apache Cordova Bridge Layer                   │
├─────────────────────────────────────────────────────────────┤
│                    Android (WebView)                        │
└─────────────────────────────────────────────────────────────┘
```

Design rules that follow from this layout:

1. **Everything above the FS abstraction is platform-agnostic.** The editor, plugins and terminal only speak *file URLs* (`memory://`, `browser://`, `file://`, `webdav://`). They never call `cordova.*` directly.
2. **One global, lazily wired API.** Modules register themselves into a service registry at boot; `xcoder.require(name)` resolves them. There are no import cycles because cross-module calls go through the registry or the event bus.
3. **UI is data-driven.** Sidebar, tabs, palette and status bar re-render from events (`fs:update`, `editor:switch`, `settings:change`); no component reaches into another component's DOM.

---

## 2. Source layout and responsibilities

```
XCoder/
├── src/
│   ├── core/                  # Platform modules (registered services)
│   │   ├── editor/            # CodeMirror integration
│   │   │   ├── editor.ts      #   Editor class — wraps one EditorView per file
│   │   │   ├── editorManager.ts # Tab lifecycle: open/close/save/switch
│   │   │   ├── extensions.ts  #   Shared CM extension set (folding, search…)
│   │   │   ├── languages.ts   #   Language registry (21 @codemirror/lang-*)
│   │   │   └── themes.ts      #   Editor themes + syntax highlight styles
│   │   ├── file/              # Filesystem layer
│   │   │   ├── fs.ts          #   FileSystemBackend interface + registry
│   │   │   ├── backend-memory.ts    #   In-memory FS (tests, virtual home)
│   │   │   ├── backend-browser.ts   #   IndexedDB-backed FS (browser/dev)
│   │   │   ├── backend-cordova.ts   #   cordova-plugin-file (Android)
│   │   │   └── backend-webdav.ts    #   WebDAV over fetch (PROPFIND/PUT/…)
│   │   ├── terminal/
│   │   │   ├── terminal.ts    #   xterm.js host, tab management, panel UI
│   │   │   ├── shell.ts       #   Virtual shell: commands, parser, history
│   │   │   └── proot.ts       #   Proot/Alpine userland manager (Android)
│   │   └── lsp/
│   │       ├── jsonrpc.ts     #   JSON-RPC 2.0 codec
│   │       ├── transport.ts   #   WebSocket + Web Worker transports
│   │       ├── client.ts      #   LSP state machine (initialize/didOpen/…)
│   │       ├── providers.ts   #   LSP → CodeMirror bridges (completions…)
│   │       └── manager.ts     #   Server lifecycle per language
│   ├── api/                   # Public surface — what plugins see
│   │   ├── xcoder.ts          #   window.xcoder: require/setPluginInit/…
│   │   ├── registry.ts        #   Service registry behind xcoder.require
│   │   ├── commands.ts        #   Command registry + keybinding matcher
│   │   ├── editorManager.ts   #   Facade over core/editor
│   │   ├── editorLanguages.ts #   Facade over core/editor/languages
│   │   ├── editorThemes.ts    #   Facade over core/editor/themes
│   │   ├── fileSystem.ts      #   Facade over core/file
│   │   ├── terminal.ts        #   Facade over core/terminal
│   │   ├── lsp.ts             #   Facade over core/lsp
│   │   ├── settings.ts        #   Schema-validated persistent settings
│   │   ├── dialog.ts          #   alert/confirm/prompt/select
│   │   ├── toast.ts           #   Notifications
│   │   ├── events.ts          #   App-wide event bus
│   │   ├── cache.ts           #   Persistent key-value store
│   │   └── plugins/
│   │       ├── manager.ts     #   Install/load/enable/disable/uninstall
│   │       └── registry.ts    #   Installed-plugin metadata store
│   ├── plugins/               # Plugins bundled with the app (empty by default)
│   ├── ui/
│   │   ├── index.html         # App shell
│   │   ├── styles/            # main.css + themes (dark/light/solarized)
│   │   ├── icons/             # SVG icon set
│   │   └── components/        # TS widgets: tree, tabs, palette, status bar…
│   ├── lang/                  # en.json, pt.json, es.json + 40 locale skeletons
│   ├── lib/                   # Generic utilities (path, dom, events, i18n…)
│   ├── types/                 # .d.ts for plugin authors + ambient types
│   └── main.ts                # Bootstrap sequence
├── www/                       # Compiled output (served by Cordova)
├── utils/                     # CLI: lang-cli.js, plugin-cli.js
├── tests/                     # Vitest suites
├── plugin-template/           # Scaffold for new plugins
├── plugin.json                # App metadata
├── config.xml                 # Cordova configuration
├── rspack.config.js           # Bundler (single-file IIFE bundle)
└── package.json
```

### Facade pattern

`src/api/*` modules are thin facades. Core modules hold the logic and are *not* exported to plugins directly; the facade re-exports a curated, versioned API. This keeps the plugin-facing contract stable while internals evolve.

---

## 3. Bootstrap sequence

`src/main.ts` runs this order exactly once. Each step is defensive: a failure logs a toast and continues, so a broken plugin or backend cannot brick the editor.

```
1. storage        → open IndexedDB handles (settings, cache, browser FS)
2. settings       → load persisted settings, apply theme + UI language
3. i18n           → load locale JSON (requested → pt → en fallback chain)
4. fileSystem     → register backends (cordova + browser + memory), mount workspace
5. editorManager  → create editor container, restore open tabs from last session
6. commands       → register built-in commands (files, view, terminal, themes…)
7. UI components  → mount sidebar, tabs, status bar, palette, dialogs, toasts
8. terminal       → prepare xterm panel lazily (created on first open)
9. lsp manager    → read server configs; sessions start on file open
10. pluginManager → load enabled plugins → call plugin init(baseUrl, $page, cache)
11. emit 'app:ready' on the event bus
```

On Android, step 4 first requests storage permissions (`cordova-plugin-android-permissions`) and only then registers the `file://` backend.

---

## 4. File system abstraction

Every path in XCoder is a **URL**: `scheme://authority/path`. The registry in `core/file/fs.ts` dispatches operations to the backend that owns the scheme.

| Backend | Scheme | Where it runs | Persistence |
|---|---|---|---|
| memory | `memory://` | Anywhere (tests, virtual home for shell demos) | Session only |
| browser | `browser://` | Anywhere (fallback when Cordova is absent) | IndexedDB |
| cordova | `file://` | Android via `cordova-plugin-file` | On-device storage |
| webdav | `webdav://` | Anywhere via `fetch` + PROPFIND | Remote server |
| sftp / ftp | `sftp://`, `ftp://` | Planned — requires a native socket bridge | Remote server |

The backend interface (full signature list in [api-reference.md](./api-reference.md)) covers `stat/list/read/write/mkdir/delete/rename/copy`, plus a `capabilities` object so the UI can hide unsupported actions (e.g. *Copy* on a read-only share). Mutating operations emit `fs:update` on the event bus, which the sidebar tree and quick-open subscribe to.

**Multi-root workspace**: a `.xcoder-workspace` JSON file lists folder URLs:

```json
{ "folders": [{ "url": "file:///sdcard/Projects/site" }, { "url": "webdav://dev.example.com/api" }] }
```

The workspace module merges all roots into one logical tree for the sidebar.

---

## 5. Plugin system

Plugins are classic scripts loaded from a base URL. The lifecycle is:

```
install (zip/dir) → registry entry {enabled} → load <script src=baseUrl/main.js>
   └─ top level: xcoder.setPluginInit(id, init); xcoder.setPluginUnmount(id, unmount)
enable  → init(baseUrl, $page, { cacheFileUrl, cacheFile, firstInit })
disable → unmount() → script tag removed
```

Key invariants:

- **One `$page` per plugin** — a hidden page element the plugin fills and shows with `$page.show()` (see [plugin-development.md](./plugin-development.md)).
- **`cache` is stable across restarts.** `firstInit` is true only on the very first init, letting plugins run one-time migrations.
- **APIs are resolved at call time** via `xcoder.require()`, so plugins tolerate future internal refactors.

---

## 6. Terminal: xterm.js + virtual shell + Proot

The terminal module hosts xterm.js instances. Two shell modes exist:

1. **Virtual shell (default, everywhere).** A POSIX-flavoured shell implemented in TypeScript over the FS abstraction: `ls cd cat echo mkdir touch rm mv cp pwd grep wc head find date uname whoami open`, a `git` state machine, a mocked `npm`/`apk`, and a `node` REPL. Commands are plain objects registered in a registry — plugins can add commands with `require('terminal').shell.registerCommand()`.
2. **Proot userland (Android only).** `proot.ts` manages an Alpine Linux rootfs inside the app-private directory (`/data/data/com.xcoder.app/`), launched via the native `proot` binary through a Cordova plugin bridge. It is *transparent*: when available, the same shell grammar forwards to the real userland; when unavailable (browser builds), the module reports gracefully and the virtual shell remains.

---

## 7. LSP pipeline

```
Editor keystroke ─▶ CM6 source (providers.ts) ─▶ LspSession (client.ts)
                                                    │ JSON-RPC 2.0
                                                    ▼
                                        Transport (WebSocket | Web Worker)
                                                    │
                                                    ▼
                                        Language Server (external process)
publishDiagnostics ─▶ lint extension ─▶ Problems panel / squiggles
completionItem  ─▶ completion source ─▶ autocomplete popup
hover           ─▶ hover tooltip
definition/references ─▶ quick-open jump / results list
```

The client implements `initialize` capability negotiation, incremental `didChange` sync, and the request set: `textDocument/completion`, `hover`, `definition`, `references`, `publishDiagnostics`. Servers are configured per language in settings (`lsp.servers`), and sessions are started lazily on the first file of that language.

---

## 8. Build pipeline

- **Bundler**: Rspack with the built-in SWC loader; single IIFE bundle `www/js/xcoder.js` (runs from `file://`, no CORS issues inside WebView).
- **Static assets**: `CopyRspackPlugin` copies `index.html`, CSS, icons, and language JSON into `www/`.
- **Type checking** is separate (`tsc --noEmit`) — fast, strict, and run in CI alongside Vitest.
- **Android**: Cordova 13 consumes `www/` verbatim; `cordova build android` produces the APK.
- **Tests**: Vitest in `node` environment; the FS and shell layers run against `backend-memory`, so the suites need no browser.

---

## 9. Extension points (summary)

| Extension point | Used for |
|---|---|
| `commands.addCommand` | Palette entries, keybindings, menu actions |
| `editorLanguages.register` | New syntaxes beyond the 21 bundled ones |
| `editorThemes.register` | Editor + app themes |
| `fileSystem.registerBackend` | New remotes (S3, GitHub repos, …) |
| `terminal.shell.registerCommand` | New shell commands |
| `lsp.registerServer` | Language servers per language id |
| Plugins (`init`/`unmount`) | Whole features with pages and persistence |
