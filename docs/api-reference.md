# API reference — the `xcoder` facade

Every module is available to plugins and power users through `xcoder.require(name)`
(also mounted on `window.xcoder`). Unknown names throw with the list of valid modules.

```js
const { path, fs, editor, shell, agents, ai } = {
  path: window.xcoder.require('path'),
  fs: window.xcoder.require('fs'),
  editor: window.xcoder.require('editor'),
  shell: window.xcoder.require('shell'),
  agents: window.xcoder.require('agents'),
  ai: window.xcoder.require('ai'),
};
```

Available modules: `path`, `bus`, `EventBus`, `storage`, `createStore`, `helpers`, `i18n`,
`commands`, `settings`, `toast`, `dialog`, `cache`, `plugins`, `fs`, `editor`, `shell`,
`agents`, `ai`, `lsp`, `version`.

---

## path

Scheme-aware POSIX operations. Schemes look like `file:///a/b.ts`, `mem://x/y.md`,
`webdav://host/dav/z`.

| Member | Signature | Notes |
| --- | --- | --- |
| `parse` | `(url) => {scheme, path}` | split `scheme://rest` |
| `format` | `(scheme, path) => url` | inverse of parse |
| `isAbsolute` | `(url) => boolean` | true for `/a` and `file:///a` |
| `normalize` | `(p) => string` | collapses `.`/`..` and duplicate slashes |
| `join` | `(...parts) => string` | a fragment with a scheme replaces the base |
| `resolve` | `(...parts) => string` | like node: scheme fragments restart; `/x` keeps the active scheme |
| `dirname` / `basename` / `extname` | standard | scheme-aware |
| `relative` | `(from, to) => string` | returns `to` unchanged across schemes |
| `contains` | `(parent, child) => boolean` | nesting check |
| `fuzzyMatch` | `(query, target) => number` | -1 when rejected; used by Quick Open |

## bus / EventBus

`on(event, fn) → unsubscribe`, `once`, `off`, `emit(event, data?)`, `clear(event?)`.
Handler exceptions are isolated and logged.

Frequently used events: `editor:open|active|change|save|close`, `workspace:roots`,
`workspace:changed`, `settings:change`, `commands:changed`, `plugins:changed`,
`shell:open|theme|locale`, `agent:requested`, `agent:permission`, `locale:changed`,
`lsp:diagnostics`, `plugin:activated|deactivated`.

## storage

Async KV store over IndexedDB with an in-memory fallback:
`get(key)`, `set(key, value)`, `delete(key)`, `keys()`, `clear()`.
`createStore(namespace)` returns an isolated store (keys are prefixed).

## i18n

`t(key, vars?)` translates with `{var}` interpolation and falls back to English;
`setLocale(code)`, `getLocale()`, `listLocales()`, `registerLocale(code, dict)`,
`registerGeneratedLocales()` (stubs), `detectLocale()`.

## commands

```js
commands.register({
  id: 'myPlugin.hello',        // reverse-DNS style, unique
  label: 'myPlugin.greet',     // i18n key or literal
  icon: 'sparkles',            // optional inline icon name
  keybinding: 'Ctrl+Alt+H',    // shown as a hint
  when: () => true,            // optional visibility predicate
  run: async () => { /* … */ },
});
await commands.execute('myPlugin.hello');
commands.list(); // visible commands (palette feed)
```

## settings

`get(key)` / `set(key, value)` / `patch(partial)` / `reset()` / `whenReady()` / `getAll()`.
Shape: `theme`, `locale`, `fontSize`, `tabSize`, `wordWrap`, `lineNumbers`, `autoSave`,
`autoSaveDelay`, `agent {permissionMode, maxSteps, activeProfileId}`, `providers[]`.
Every mutation persists and emits `settings:change`.

## toast / dialog

`toast(message, type='info'|'success'|'error'|'warn', duration?)`.
Dialogs are promise-based: `alert(msg, title?)`, `confirm(msg, title?) → boolean`,
`prompt(msg, def?, title?) → string|null`, `select(msg, options, title?) → string|null`,
`action(title, msg, buttons[]) → value`.

## fs (workspace)

Backend-agnostic operations (auto-route by scheme):
`stat`, `listdir`, `readFile`, `readText`, `writeFile(url, data, {append, mkdirs})`,
`delete(url, recursive)`, `mkdir`, `rename`, `exists`, `ensureDir`,
`search(root, query, {maxResults})`, plus workspace management:
`mount(backend, {root, label})`, `unmount(scheme)`, `addRoot`, `removeRoot`, `listRoots`, `cwd()`.

The `FsError` class carries codes: `ENOENT`, `EEXIST`, `ENOTDIR`, `EISDIR`, `ENOTEMPTY`, `EINVAL`, `ENOSYS`.

Backends to mount: `MemoryBackend(scheme?)`, `BrowserBackend(rootKey?, scheme?, label?)`,
`CordovaBackend(rootDirName?, scheme?, label?)` (`CordovaBackend.available()`),
`WebDavBackend({baseUrl, username, password, headers})`.

## editor (editorManager)

`open(path)` → session (cached), `save(path?)`, `close(id)`, `closeAll()`,
`setActive(id)`, `active`, `activePath()`, `attach(container)`, `restoreSession()`,
`applyTheme(name)`, `applySettings()`, `setSyntax(name)`, `formatActive()`.
Static: `EditorManager.format(path, code)` (Prettier), `EditorManager.FORMATTERS` (ext → parser map).

Sessions expose `{id, path, dirty, savedAt, state}` and emit
`editor:open|active|change|save|close|rename`.

## shell (virtual terminal)

`run(line) → {stdout, stderr, code}`, `runScript(multiLine)`, `resolveTarget(p)`,
`git(root?) → GitStore`, `registerCommand(name, handler)`, `listCommands()`, `history`.

Pipelines split on `|`; short flags stay in `args`, `--long[=value]` populate `flags`,
redirects (`>` `>>`) write the final stage's output. `run('clear')` returns the sentinel
`__CLEAR__` (the UI clears the buffer).

GitStore: `init`, `status`, `add(paths|['.'])`, `rm(paths)`, `commit({message|flags.m})`,
`log(args)`, `diff`, `branch(name?)`, `checkout(name, create?)`, `merge(name)`,
`remote(['add', name, url])`, `push`, `pull`, `clone(url)`, `config([key, value?])`.

## agents

```js
const agents = window.xcoder.require('agents');
await agents.run('create utils/date.ts with formatDate', {
  subagent: undefined,      // or 'coder' | 'analyzer' | 'ops'
  maxSteps: 25,
  onEvent: (evt) => console.log(evt.type, evt.data),
  signal: controller.signal,
});
agents.listTools();     // 17 tool descriptors
agents.listSubagents(); // coder/analyzer/ops
agents.permissions;     // .request(req) / .forget()
agents.newAbort();      // AbortController for the next run
```

Tool set: `fs.read`, `fs.list`, `fs.write`, `fs.append`, `fs.delete`, `fs.mkdir`,
`fs.search`, `code.analyze`, `code.edit`, `git.status`, `git.add`, `git.commit`, `git.log`,
`git.diff`, `git.branch`, `git.checkout`, `exec.run` (`bash` | `js` | `python`),
`agent.spawn`, `app.info`.

Dangerous tools (all writes, git mutations, exec) request permission first — see
[agents.md](agents.md) for the event contract.

## ai

```js
const ai = window.xcoder.require('ai');
ai.presets;                    // 17 presets, .group = 'free' | 'freemium' | 'premium'
ai.getPreset('groq');
ai.presetsByGroup('free');
ai.providers;                  // ProviderManager
ai.providers.addProfile({presetId: 'groq', apiKey: '…'});
ai.providers.setActive(profileId);
ai.providers.list();
ai.createClient(profile);      // LLMClient: chat(opts), stream?(opts, onDelta), testConnection()
```

`ChatOptions`: `{messages: ChatMessage[], tools?: ToolDef[], temperature?, maxTokens?, signal?}`.
`ChatMessage`: `{role: 'system'|'user'|'assistant'|'tool', content, toolCalls?, toolCallId?, name?}`.
`ToolCallReq`: `{id, name, arguments}` (arguments is a JSON string).

## lsp

`LSPClient` — `new LSPClient(transport, name)`, `start(rootUri, capabilities?)`,
`request(method, params)` (15s timeout), `notify(method, params)`, `didOpen/didChange/didClose`,
`hover`, `completion`, `definition`, `formatting`, `stop()`.
Transports: `WebSocketTransport(url)`, `WorkerTransport(worker)`, `createLoopbackPair()`.

## plugins

`installFromZip(ArrayBuffer|Blob)`, `installFromSource(manifest, code)` (dev/tests),
`list()`, `setEnabled(id, enabled)`, `uninstall(id)`, `getPageHtml(key)`, `loadInstalled()`.

## version

`version` — the running XCoder version string (kept in sync with `package.json`/`config.xml`).
