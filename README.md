<div align="center">

# XCoder

**A mobile-first code editor and IDE for Android — CodeMirror 6 powered, plugin extensible.**

*Original project · own architecture and API surface (`xcoder.*`)*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Engine](https://img.shields.io/badge/editor-CodeMirror%206-7c5cff)](https://codemirror.net/)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web-3fb950)](./docs/build.md)
[![Build](https://img.shields.io/badge/bundler-Rspack%202-0969da)](https://rspack.dev/)
[![Tests](https://img.shields.io/badge/tests-Vitest%204-success)](./tests)
[![Locales](https://img.shields.io/badge/locales-43%20scaffolded-f0883e)](./docs/i18n.md)

[Features](#-features) · [Quickstart](#-quickstart) · [Architecture](#-architecture) · [Plugins](#-plugins) · [Docs](#-documentation) · [Roadmap](#-roadmap)

**🇵🇹 🇧🇷 [Leia-me em português](./README.pt.md)**

</div>

---

## Why XCoder?

Edit real code on your phone: a VS Code–flavoured editor, a real file system
layer (device storage, browser storage, WebDAV), an integrated terminal with
a virtual shell, LSP-powered intelligence, and a plugin system designed for
the whole experience — not bolted on.

XCoder is written from the ground up for Android, with an independently named,
fully documented API so plugins stay clean and evolve without legacy constraints.

## ✨ Features

**Editor** — CodeMirror 6 engine
Syntax highlighting for **23 languages** (21 `@codemirror/lang-*` bundles +
TypeScript/SCSS variants) · multi-cursor · search & replace with regex · code
folding · bracket matching & auto-close · snippets · fuzzy command palette ·
quick open (`Ctrl+P`).

**Files** — URL-based abstraction (`scheme://path`)
Device storage via Cordova · browser storage (IndexedDB) · **WebDAV** remote
· in-memory FS · multi-root workspaces (`.xcoder-workspace`) · recursive
filename + content search · SFTP/FTP interfaces defined (native bridge on
the roadmap).

**Terminal** — xterm.js + virtual shell (xsh)
POSIX-flavoured shell over the FS abstraction: `ls cd cat echo mkdir touch rm
mv cp grep wc head find open …` · **git** with real state
(init/add/commit/log/branch/checkout/diff) · **npm** mock wired to
`package.json` · **apk** catalog · `node -e` · history, tab completion ·
Proot/Alpine userland manager for Android (real Linux, no root).

**LSP** — Language Server Protocol client
JSON-RPC 2.0 over WebSocket or Web Worker · completion, hover, definition,
references, diagnostics · per-language servers configured in settings ·
CodeMirror bridges for autocomplete, tooltips and squiggles.

**Plugins** — first-class extension host
`xcoder.setPluginInit(id, init)` / `xcoder.setPluginUnmount(id, unmount)` ·
per-plugin page UI (`$page`) · persistent per-plugin cache · zip or
directory install · ship commands, themes, languages, FS backends, shell
commands, LSP servers.

**And** — 3 themes (Dark+ / Light / Solarized) · 43-locale i18n scaffold
(pt/en/es complete) · settings drawer · session restore · auto-save ·
responsive mobile UI.

## 🚀 Quickstart

### Run in a browser (no Android required)

```bash
git clone https://github.com/xcoder-app/xcoder.git
cd xcoder
pnpm install
pnpm run build:dev
npx serve www            # → http://localhost:3000
```

You get the full IDE: open files, edit, `Ctrl+S`, `` Ctrl+` `` for the
terminal, `Ctrl+Shift+P` for commands.

### Build for Android

```bash
cordova platform add android
pnpm run build:prod
cordova build android
# → platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Full prerequisites, release signing and troubleshooting:
**[docs/build.md](./docs/build.md)**.

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     XCoder Application                      │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  UI Layer    │  Editor Core │  Terminal    │  LSP Client    │
│  (HTML/CSS,  │  (CodeMirror │  (xterm.js + │  (JSON-RPC 2.0 │
│  Components) │   6 views)   │   xsh shell) │   WS / Worker) │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                Public API — window.xcoder                   │
│      require() · setPluginInit() · setPluginUnmount()       │
├──────────────┬──────────────┬───────────────────────────────┤
│ Plugin System│ Commands     │ Events · Settings · Cache     │
├──────────────┴──────────────┴───────────────────────────────┤
│        File System Abstraction (backend registry)           │
│   memory:// · browser:// · file:// · webdav://  (+sftp/ftp) │
├─────────────────────────────────────────────────────────────┤
│               Apache Cordova Bridge Layer                   │
└─────────────────────────────────────────────────────────────┘
```

Layer rules: everything above the FS abstraction speaks **file URLs**, never
`cordova.*`; the public surface is only what `src/api/` facades export;
core modules never import UI. Deep dive: **[docs/architecture.md](./docs/architecture.md)**.

**Stack**: TypeScript 5.9 (strict) · Rspack 2 (SWC loader) · CodeMirror 6 +
Lezer · xterm.js 6 · Cordova 13 · Vitest 4 · Biome.

## 🔌 Plugins

```js
// main.js — classic script, no bundler needed
function init(baseUrl, $page, cache) {
  const commands = xcoder.require('commands');
  const editorManager = xcoder.require('editorManager');
  const toast = xcoder.require('toast');

  commands.addCommand({
    name: 'my-plugin.wordcount',
    description: 'Count words in the active file',
    bindKey: { win: 'Ctrl-Alt-W', mac: 'Command-Alt-W' },
    exec: () => {
      const ed = editorManager.activeEditor;
      if (!ed) return toast.warning('No file is open');
      const words = (ed.view.state.doc.toString().match(/\S+/g) || []).length;
      $page.innerHTML = `<h2>${ed.title}</h2><p>Words: <b>${words}</b></p>`;
      $page.show();
    }
  });
}

function unmount() {
  xcoder.require('commands').removeCommand('my-plugin.wordcount');
}

xcoder.setPluginInit('my-plugin', init);
xcoder.setPluginUnmount('my-plugin', unmount);
```

Scaffold, pack and validate with:

```bash
pnpm run plugin -- new "My Plugin"
pnpm run plugin -- pack ./my-plugin
```

Guide: **[docs/plugin-development.md](./docs/plugin-development.md)** · API
reference: **[docs/api-reference.md](./docs/api-reference.md)** · typings:
[`src/types/xcoder.d.ts`](./src/types/xcoder.d.ts).

## 🧪 Development

```bash
pnpm run typecheck     # strict tsc
pnpm run test          # 34 vitest tests (shell, git mock, commands, i18n…)
pnpm run lint          # biome
pnpm run lang -- stats # translation coverage
```

Contribution guide: **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

## 🗺 Roadmap

- [x] Core editor, FS backends, virtual shell, git/npm/apk mocks
- [x] Plugin host + template + CLI
- [x] LSP client (completion, hover, definition, references, diagnostics)
- [x] i18n scaffold (43 locales)
- [ ] SFTP/FTP backends (native socket bridge)
- [ ] Real Proot userland on Android (`cordova-plugin-xcoder-proot`)
- [ ] Split editor panels
- [ ] In-app plugin marketplace browser
- [ ] AI coding agents via terminal (Claude Code / Codex / OpenCode)

## 📚 Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | Layers, modules, bootstrap, design rules |
| [docs/api-reference.md](./docs/api-reference.md) | Every `xcoder.require()` module + events |
| [docs/plugin-development.md](./docs/plugin-development.md) | Plugin lifecycle, manifest, packaging |
| [docs/build.md](./docs/build.md) | Build, Android, release signing |
| [docs/i18n.md](./docs/i18n.md) | Locale system + CLI |
| [docs/glossary.pt.md](./docs/glossary.pt.md) | Glossário PT dos termos técnicos |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |

## License

[MIT](./LICENSE) — © XCoder Contributors.

Built on the shoulders of [CodeMirror 6](https://codemirror.net/),
[xterm.js](https://xtermjs.org/), [Rspack](https://rspack.dev/),
[Vitest](https://vitest.dev/) and [Apache Cordova](https://cordova.apache.org/).
