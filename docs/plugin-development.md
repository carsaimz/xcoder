# Plugin development

XCoder plugins are zip packages that run against the same `xcoder` facade as the core —
they can register commands, touch the filesystem, drive the editor, call the AI agent and
more.

## Scaffold

```bash
npm run gen:plugin my-plugin
```

generates:

```
my-plugin/
├── plugin.json     # manifest
├── main.js         # entry executed on activation
├── README.md
└── xcoder.d.ts     # minimal facade typings
```

**plugin.json**

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "What it does",
  "main": "main.js",
  "activationEvents": ["onLoad"]
}
```

`id` must be unique and stable — it keys the stored code and lifecycle events.

## Entry contract

`main.js` runs inside the webview. The facade is on `globalThis.xcoder`:

```js
const xcoder = globalThis.xcoder;
const commands = xcoder.require('commands');
const toast = xcoder.require('toast');
const editor = xcoder.require('editor');

function activate() {
  commands.register({
    id: 'myPlugin.timestamp',
    label: 'My Plugin: insert timestamp',
    icon: 'sparkles',
    run() {
      const session = editor.active;
      if (!session) return toast('No open file', 'warn');
      toast(new Date().toISOString(), 'success');
    },
  });
}

function deactivate() {
  // remove listeners, close pages…
}

globalThis.plugin = { onLoad: activate, onUnload: deactivate };
activate();
```

Lifecycle: `onLoad(ctx)` runs on install and on every enable; `onUnload()`/`dispose()` on
disable/uninstall. Always undo what you register in `activate` (commands, bus listeners).

## Facade modules

`path`, `bus`, `storage`, `createStore`, `helpers`, `i18n`, `commands`, `settings`, `toast`,
`dialog`, `cache`, `plugins`, `fs`, `editor`, `shell`, `agents`, `ai`, `lsp`, `version` —
full signatures in [api-reference.md](api-reference.md).

Highlights for plugin authors:

- `xcoder.require('fs')` — workspace file operations (scheme-aware URLs).
- `xcoder.require('agents').run('task', {subagent: 'ops'})` — delegate work to the AI agent.
- `xcoder.require('ai')` — provider presets and clients for direct LLM calls.
- `xcoder.require('storage')` — namespaced persistent KV (survives reloads).

## Pages

A plugin can register a full-area HTML page (rendered in a sandboxed iframe):

```js
function activate(ctx) {
  ctx.registerPage('dashboard', '<h1>Hello from My Plugin</h1>');
}
```

The page key is `<pluginId>:<pageId>`; navigation UI integration is on the roadmap —
for now pages are accessible via `plugins.getPageHtml('<pluginId>:dashboard')`.

## Install & test locally

```bash
zip -r my-plugin.zip my-plugin/      # plugin.json must be at the zip ROOT
# XCoder → Plugins → Install from .zip
```

During development use `plugins.installFromSource(manifest, code)` from the console for a
fast loop, or keep the zip updated and reinstall.

## Publishing

Commit your plugin (or a separate repo) and share the zip. Recommended tags: `xcoder-plugin`.
For inclusion in the README's plugin list, open a PR editing README.md with a one-liner
describing the plugin and its zip URL.

## Security notes

Plugins execute with full facade access by design (they are code, like any extension
system). Only install zips you trust. Reviewing `main.js` before installing is cheap —
it is the whole program.
