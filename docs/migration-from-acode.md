# Migrating from Acode

XCoder started as a fork of [Acode](https://github.com/Acode-Foundation/acode). If you are
coming from Acode (or from an older XCoder build), this page maps the concepts.

## What changed

| Area | Acode | XCoder |
| --- | --- | --- |
| Language | JavaScript (ES modules) | **strict TypeScript** (`tsc --noEmit` gates CI) |
| Bundler | ACBuild/webpack mix | **Rspack** (fast, swc-loader) — `npm run build` |
| Tests | none in repo | **Vitest**, 88 headless cases (path, fs, shell/git, agent, AI clients) |
| Editor API | ACE editor sessions | **CodeMirror 6** compartments (language/theme/wrap/indent) |
| File URLs | `file://…` strings, ad-hoc | **scheme-aware `path` library** with pinned semantics |
| Storage | fragmented localStorage | **IndexedDB KV** with memory fallback (`lib/storage`) |
| Terminal | plugin-based | **built-in virtual shell** with pipes, redirects and a real git state machine |
| Git | limited plugin | init/add/commit/log/diff/branch/checkout/merge/remote/push/pull/clone |
| AI | none | agent + subagents + 17 provider presets (free / freemium / premium) |
| i18n | ~30 locales, partial | 43 locales, 3 complete + key-parity CI check |
| Plugins | Acode plugin format | **new zip format** (`plugin.json` + `main.js`, xcoder facade) |

## File URL semantics

XCoder's `path` module is the single source of truth:

```js
import('xcoder/path');
path.resolve('file:///a/b', '/c');   // 'file:///c'  (keeps active scheme!)
path.join('file:///a', 'b', 'c.ts'); // 'file:///a/b/c.ts'
path.join('file:///a', 'mem:///x');  // 'mem:///x'   (foreign scheme replaces base)
```

If your Acode plugin manipulated raw strings, switch to `path.join/resolve` — the historic
bugs around scheme handling are pinned by tests.

## Plugin migration

Acode plugins register through `editorManager`/`acode` globals. The port is usually small:

| Acode | XCoder |
| --- | --- |
| `acode.execCommand(...)` / command list | `commands.register({id, label, run})` + palette |
| `editorManager.activeEditor` | `editor.active` (session with `path`, `dirty`) |
| `fs(operation)` module | `fs.readText/writeFile/delete/…` (promise per operation) |
| `acode.alert/confirm` | `dialog.alert/confirm/prompt/select` (promise-based) |
| `toast(msg, type)` | `toast(msg, type)` (same shape) |
| localStorage | `storage.get/set` (async, IndexedDB) |

See [plugin-development.md](plugin-development.md) for the full facade and a scaffold
generator (`npm run gen:plugin`).

## Settings mapping

| Acode | XCoder setting |
| --- | --- |
| editor font size | `fontSize` |
| tab size / soft tabs | `tabSize` (spaces) |
| text wrapping | `wordWrap` |
| auto-save | `autoSave` + `autoSaveDelay` (ms) |
| app theme | `theme`: `dark` / `light` / `ocean` |
| language | `locale` (43 codes) |

## Data import

Acode's file storage is not read directly. Recommended paths:

1. zip your Acode workspace and install a tiny importer plugin using
   `fs.writeFile` per entry (JSZip is already bundled),
2. or use the WebDAV backend — serve your files with `rclone serve webdav` and mount via
   the `Workspace: add WebDAV mount…` command.

## Why fork?

XCoder keeps Acode's spirit (mobile-first, lightweight, open) but rebuilds on strict
TypeScript with a modern test/bundle toolchain and first-class AI — while staying MIT and
crediting the original authors in [LICENSE](../LICENSE).
