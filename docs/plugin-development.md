# XCoder — Plugin Development Guide

XCoder's plugin system is a full extension host: plugins can register commands, add UI pages, hook editor events, add shell commands and persist data. This guide walks through building one end-to-end.

> Plugin authors: reference the bundled typings with
> `/// <reference path="XCoder/src/types/xcoder.d.ts" />` — every API below is typed there.

---

## 1. Anatomy of a plugin

```
meu-plugin/
├── plugin.json          # Manifest (required)
├── main.js              # Entry point — classic script (required)
├── icon.png             # 512×512 recommended (optional)
└── README.md            # Marketplace listing (optional)
```

No bundler is required. A plugin is a plain folder; anything you can do in the browser you can do here (if you need a build step, commit the compiled `main.js`).

### `plugin.json` — manifest reference

```json
{
  "id": "com.xcoder.meu-plugin",
  "name": "Meu Plugin",
  "version": "1.0.0",
  "main": "main.js",
  "icon": "icon.png",
  "author": {
    "name": "Seu Nome",
    "email": "email@exemplo.com",
    "github": "usuario"
  },
  "files": ["main.js", "icon.png"],
  "minAppVersion": "1.0.0",
  "keywords": ["utility"]
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | ✔ | Reverse-DNS, unique, `^[a-z0-9.-]+$`. **Never changes** after publishing. |
| `name` | ✔ | Human-readable display name. |
| `version` | ✔ | Semver. |
| `main` | ✔ | Path relative to the manifest, default `main.js`. |
| `icon` | — | Path relative to the manifest. |
| `author` | ✔ | `name` required; `email`, `github`, `url` optional. |
| `files` | ✔ | Every file to install. The ZIP must contain exactly these plus the manifest. |
| `minAppVersion` | — | XCoder semver gate. |

---

## 2. Lifecycle

```js
// main.js — runs as a classic script when the plugin is enabled

function init(baseUrl, $page, cache) {
  // baseUrl  — absolute URL of this plugin's folder (ends with '/')
  // $page    — a Page object reserved for this plugin
  // cache    — { cacheFileUrl, cacheFile, firstInit }
}

function unmount() {
  // Reverse EVERYTHING init() did:
  // remove commands, close listeners, release DOM, abort requests.
}

xcoder.setPluginInit('com.xcoder.meu-plugin', init);
xcoder.setPluginUnmount('com.xcoder.meu-plugin', unmount);
```

| Argument | Type | Notes |
|---|---|---|
| `baseUrl` | `string` | e.g. `file:///data/…/plugins/com.xcoder.meu-plugin/`. Prefix asset URLs with it. |
| `$page` | `Page` | `el: HTMLElement`, `innerHTML`, `show()`, `hide()`, `setTitle(t)`, `on('close', cb)`. One per plugin — never touch another plugin's page. |
| `cache.cacheFileUrl` | `string` | URL of a JSON file dedicated to this plugin. |
| `cache.cacheFile` | `FileHandle` | `{ url, read(): Promise<string>, write(str): Promise<void>, exists(): Promise<boolean> }` |
| `cache.firstInit` | `boolean` | `true` only the first time the plugin ever runs — run migrations here. |

**Lifecycle rules**

1. `init` may be called again after an `unmount` (user re-enables). Treat it as a fresh start.
2. `unmount` must be complete and synchronous-safe: dangling intervals/listeners after unmount are a release blocker.
3. Resolve all APIs **inside** `init` (or lazily), not at top level — module order is not guaranteed at script parse time.

---

## 3. Using the API — `xcoder.require()`

| Module | Typical plugin use |
|---|---|
| `commands` | Palette entries + keybindings |
| `editorManager` | Read/write the open file, listen for switches |
| `editorThemes` | Ship a custom theme |
| `editorLanguages` | Ship a new grammar |
| `fileSystem` | Read/save files, add backends |
| `terminal` | Add shell commands, open panels |
| `lsp` | Attach language servers |
| `settings` | Read app config |
| `dialog` / `toast` | User interaction |
| `events` | React to anything in the catalogue |
| `cache` | Persistent key-value storage |
| `xcoder.codemirror` | Extend the editor itself |

---

## 4. Complete worked example

A tiny plugin that adds a **word counter** command and a page:

```js
// main.js
function init(baseUrl, $page, cache) {
  const commands = xcoder.require('commands');
  const editorManager = xcoder.require('editorManager');
  const toast = xcoder.require('toast');

  $page.setTitle('Word Count');

  commands.addCommand({
    name: 'meu-plugin.wordcount',
    description: 'Count words in the active file',
    bindKey: { win: 'Ctrl-Alt-W', mac: 'Command-Alt-W' },
    exec: () => {
      const ed = editorManager.activeEditor;
      if (!ed) {
        toast.warning('No file is open');
        return;
      }
      const text = ed.view.state.doc.toString();
      const words = (text.match(/\S+/g) || []).length;
      $page.innerHTML = `
        <h2>${ed.title}</h2>
        <p>Words: <strong>${words}</strong></p>
        <p>Characters: ${text.length}</p>`;
      $page.show();
    }
  });

  // persist something on first run
  if (cache.firstInit) {
    cache.cacheFile.write(JSON.stringify({ openedAt: Date.now() }));
  }
}

function unmount() {
  xcoder.require('commands').removeCommand('meu-plugin.wordcount');
}

xcoder.setPluginInit('com.xcoder.meu-plugin', init);
xcoder.setPluginUnmount('com.xcoder.meu-plugin', unmount);
```

> The `plugin-template/` folder in the repository root contains this skeleton, pre-filled and commented. Copy it, rename the id, and start coding.

---

## 5. Packaging & installing

```bash
# from the plugin folder — produces meu-plugin.zip
pnpm --dir /path/to/XCoder run plugin pack /path/to/meu-plugin
```

Install in the app: **Settings → Plugins → Install** and pick the ZIP (or a directory URL during development). The manifest must sit at the ZIP root.

For development you can also install straight from a directory URL (`file://` on Android, any HTTP directory listing with `plugin.json` exposed).

---

## 6. Quality checklist before publishing

- [ ] `unmount()` removes every command, listener, DOM node, timer.
- [ ] No legacy editor prefixes — use `xcoder.require()` only.
- [ ] Works after disable → enable cycle, and after app restart.
- [ ] `firstInit` used for one-time setup only.
- [ ] Manifest `files` array matches the ZIP contents exactly.
- [ ] UI respects the active theme (use CSS variables from `styles/main.css`, not hard-coded colors).
- [ ] Licensed (MIT recommended) and attributed if derived from other work.

---

## 7. Publishing

1. Fork `xcoder-plugins-index`, add an entry to `plugins.json` (id, repo, zip URL, version).
2. Open a PR — CI validates the manifest and semver monotonicity.
3. Once merged, the plugin appears in the in-app browser.
