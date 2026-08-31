# XCoder — API Reference

The global object **`xcoder`** (attached to `window`) is the single entry point for plugins and automation. This document lists every module returned by `xcoder.require()`, all public methods, and the event catalogue.

- Naming rule: **`xcoder.*` is the only public prefix.**
- Type definitions live in [`src/types/xcoder.d.ts`](../src/types/xcoder.d.ts) and ship with the project — reference them with `/// <reference types="xcoder" />` or copy the file into your plugin.

---

## `xcoder` — global object

| Member | Signature | Description |
|---|---|---|
| `require` | `require(name: string): any` | Resolves a public module by name. Throws on unknown names. |
| `setPluginInit` | `setPluginInit(id: string, init: PluginInitFn): void` | Registers the init hook called when plugin `id` is enabled. |
| `setPluginUnmount` | `setPluginUnmount(id: string, unmount: () => void): void` | Registers the unmount hook called when plugin `id` is disabled. |
| `version` | `readonly string` | App version, e.g. `"1.0.0"`. |
| `isAndroid` | `readonly boolean` | `true` when running under Cordova. |

```js
const commands = xcoder.require('commands');
xcoder.setPluginInit('com.xcoder.meu-plugin', init);
```

### Module names

| Name | Module | Since |
|---|---|---|
| `'commands'` | Command registry | 1.0 |
| `'editorManager'` | Open editors & tabs | 1.0 |
| `'editorLanguages'` | Language registry | 1.0 |
| `'editorThemes'` | Theme registry | 1.0 |
| `'xcoder.codemirror'` | CodeMirror 6 + Lezer namespace | 1.0 |
| `'fileSystem'` | File operations & backends | 1.0 |
| `'terminal'` | Terminal host + virtual shell | 1.0 |
| `'lsp'` | Language Server Protocol client | 1.0 |
| `'settings'` | App settings | 1.0 |
| `'dialog'` | Native-feeling dialogs | 1.0 |
| `'toast'` | Notifications | 1.0 |
| `'events'` | Event bus | 1.0 |
| `'cache'` | Persistent key-value store | 1.0 |
| `'plugins'` | Plugin management | 1.0 |

---

## `commands`

Registry consumed by the Command Palette, keymap and context menus.

| Method | Signature | Description |
|---|---|---|
| `addCommand` | `addCommand(cmd: Command): void` | Registers a command. `name` must be namespaced (`'plugin.action'`). Re-registering the same name replaces the old one. |
| `removeCommand` | `removeCommand(name: string): void` | Removes a command. |
| `exec` | `exec(name: string, ...args: unknown[]): Promise<unknown>` | Runs a command; rejects if missing. |
| `list` | `list(): Command[]` | All registered commands (palette order). |
| `has` | `has(name: string): boolean` | Existence check. |
| `matchKeybinding` | `matchKeybinding(e: KeyboardEvent): Command \| undefined` | Internal — resolves keymap chords like `Ctrl-Shift-P`. |

**`Command` shape**

```ts
interface Command {
  name: string;                 // 'file.save', 'meu-plugin.ping'
  description: string;
  icon?: string;                // icon id from the built-in set
  bindKey?: { win?: string; mac?: string }; // CodeMirror chord syntax
  exec(...args: unknown[]): unknown | Promise<unknown>;
}
```

**Built-in commands** (excerpt): `file.new`, `file.save`, `file.saveAll`, `file.close`, `view.commandPalette`, `view.quickOpen`, `view.toggleSidebar`, `view.settings`, `terminal.toggle`, `terminal.clear`, `theme.setDark`, `theme.setLight`, `theme.setSolarized`.

---

## `editorManager`

| Method / property | Signature | Description |
|---|---|---|
| `openFile` | `openFile(url: string, opts?: { line?: number; column?: number; preview?: boolean }): Promise<Editor>` | Loads the file (via `fileSystem`), creates/reuses a tab and focuses it. |
| `closeEditor` | `closeEditor(editor: Editor \| string): Promise<boolean>` | Closes a tab; prompts before discarding unsaved changes. |
| `saveActive` | `saveActive(): Promise<void>` | Saves the focused editor. |
| `saveAll` | `saveAll(): Promise<void>` | Saves every dirty editor. |
| `activeEditor` | `Editor \| null` | Currently focused editor. |
| `editors` | `Editor[]` | All open editors, tab order. |
| `reloadSettings` | `reloadSettings(): void` | Applies font size / wrap / indent changes. |

**`Editor` shape**

```ts
interface Editor {
  id: string;
  url: string;
  title: string;
  isDirty: boolean;
  view: EditorView;             // CodeMirror 6 view — full access
  setCursor(line: number, column?: number): void;
  focus(): void;
  save(): Promise<void>;
}
```

---

## `editorLanguages`

| Method | Signature | Description |
|---|---|---|
| `register` | `register(lang: LanguageInfo): void` | Adds a language. Later registrations for the same id win. |
| `get` | `get(url: string): LanguageInfo \| undefined` | Resolves by file extension. |
| `list` | `list(): LanguageInfo[]` | All known languages. |

```ts
interface LanguageInfo {
  id: string;                   // 'javascript'
  name: string;                 // 'JavaScript'
  extensions: string[];         // ['js', 'mjs', 'cjs']
  support: LanguageSupport | (() => LanguageSupport); // lazy loader allowed
  snippets?: Completion[];      // optional static snippets
}
```

Bundled ids: `angular`, `cpp`, `css`, `go`, `html`, `java`, `javascript`, `jinja`, `json`, `less`, `liquid`, `markdown`, `php`, `python`, `rust`, `sass`, `sql`, `vue`, `wast`, `xml`, `yaml`.

---

## `editorThemes`

| Method | Signature | Description |
|---|---|---|
| `register` | `register(theme: EditorTheme): void` | Adds a theme. |
| `set` | `set(id: string): void` | Activates a theme (editor + app CSS via `data-theme`). Emits `settings:change`. |
| `getActive` | `getActive(): EditorTheme` | Current theme. |
| `list` | `list(): EditorTheme[]` | Known themes. |

```ts
interface EditorTheme {
  id: string;                   // 'dark' | 'light' | 'solarized' | custom
  name: string;
  type: 'dark' | 'light';
  cmTheme: Extension;           // EditorView.theme(...) output
  highlight: HighlightStyle;    // syntax colors
}
```

Bundled: **XCoder Dark+** (`dark`), **XCoder Light** (`light`), **Solarized Dark** (`solarized`).

---

## `xcoder.codemirror`

Re-exports the full CodeMirror 6 and Lezer surface so plugins never add their own copy:

```js
const { EditorView, EditorState, Compartment, keymap } = xcoder.require('xcoder.codemirror');
const { Tag, styleTags } = xcoder.require('xcoder.codemirror').lezer;
```

Includes: `@codemirror/view`, `@codemirror/state`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/search`, `@codemirror/autocomplete`, `@codemirror/lint`, `@lezer/common`, `@lezer/highlight`, `@lezer/lr`.

---

## `fileSystem`

All functions operate on **URLs** (`scheme://path`). Unknown schemes throw `FsError('EUNKNOWN_SCHEME')`.

| Method | Signature | Description |
|---|---|---|
| `read` | `read(url: string): Promise<string>` | Reads a text file. |
| `write` | `write(url: string, content: string): Promise<void>` | Creates or overwrites (parents auto-created on most backends). |
| `createFile` | `createFile(url: string, content?: string): Promise<FileEntry>` | Fails with `EEXIST` if present. |
| `createDir` | `createDir(url: string): Promise<FileEntry>` | Recursive `mkdir -p` semantics. |
| `list` | `list(url: string): Promise<FileEntry[]>` | Directory listing, sorted dirs-first. |
| `stat` | `stat(url: string): Promise<FileEntry>` | `ENOENT` when missing. |
| `exists` | `exists(url: string): Promise<boolean>` | — |
| `delete` | `delete(url: string): Promise<void>` | Recursive for directories. |
| `rename` | `rename(oldUrl: string, newUrl: string): Promise<void>` | Move within/across same backend. |
| `copy` | `copy(src: string, dest: string): Promise<void>` | — |
| `search` | `search(rootUrl: string, pattern: string, opts?: { maxResults?: number }): Promise<SearchHit[]>` | Filename + content grep. |
| `registerBackend` | `registerBackend(backend: FileSystemBackend): void` | Adds a custom scheme. |
| `listBackends` | `listBackends(): FileSystemBackend[]` | — |
| `openFile` | `openFile(url: string): Promise<Editor>` | Convenience → `editorManager.openFile`. |

```ts
interface FileEntry {
  name: string;
  url: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
}
interface FileSystemBackend {
  id: string;
  scheme: string;               // 'file', 'webdav', …
  displayName: string;
  capabilities: { write: boolean; watch: boolean };
  stat(url: string): Promise<FileEntry>;
  list(url: string): Promise<FileEntry[]>;
  read(url: string): Promise<string>;
  write(url: string, content: string): Promise<void>;
  mkdir(url: string): Promise<void>;
  delete(url: string): Promise<void>;
  rename(oldUrl: string, newUrl: string): Promise<void>;
  copy?(src: string, dest: string): Promise<void>;
}
```

---

## `terminal`

| Method | Signature | Description |
|---|---|---|
| `open` | `open(): void` | Shows the terminal panel (creates the first tab on demand). |
| `close` | `close(): void` | Hides the panel. |
| `toggle` | `toggle(): void` | — |
| `createTab` | `createTab(title?: string): TerminalTab` | New xterm instance in the panel. |
| `closeTab` | `closeTab(id: string): void` | — |
| `tabs` | `TerminalTab[]` | Open terminal tabs. |
| `shell` | `VirtualShell` | The shell engine (below). |
| `exec` | `exec(line: string, opts?: { cwdUrl?: string }): Promise<{ code: number; output: string }>` | Runs one command line through the virtual shell headlessly. |

**`VirtualShell`**

| Method | Signature | Description |
|---|---|---|
| `registerCommand` | `registerCommand(cmd: ShellCommand): void` | Adds a command to the shell. |
| `commands` | `ShellCommand[]` | Registered commands. |
| `cwd` | `string` | Current working directory URL. |
| `setCwd` | `setCwd(url: string): void` | — |

Built-in shell commands: `help ls cd pwd cat echo mkdir touch rm mv cp grep wc head find date uname whoami open git npm apk node python clear history exit`.

**`ShellCommand`**

```ts
interface ShellCommand {
  name: string;
  description: string;
  usage?: string;
  run(ctx: ShellContext, args: string[], flags: Record<string, boolean | string>): Promise<number> | number;
}
interface ShellContext {
  fs: typeof fileSystem;        // fileSystem module
  cwd(): string;
  setCwd(url: string): void;
  print(text: string): void;    // writes to the active xterm
  printErr(text: string): void;
  env: Record<string, string>;
}
```

---

## `lsp`

| Method | Signature | Description |
|---|---|---|
| `registerServer` | `registerServer(languageId: string, config: LspServerConfig): void` | Configures a server per language. |
| `getSession` | `getSession(languageId: string): Promise<LspSession \| null>` | Starts (or reuses) a session. |
| `status` | `status(): Record<string, LspStatus>` | Map of language id → `starting \| ready \| error \| stopped`. |

```ts
interface LspServerConfig {
  transport: 'websocket' | 'worker';
  url?: string;                 // ws://… for websocket transport
  workerUrl?: string;           // bundle URL for worker transport
  rootUrl?: string;             // workspace root sent on initialize
}
interface LspSession {
  languageId: string;
  capabilities: ServerCapabilities;
  documentOpen(doc: { uri: string; languageId: string; text: string }): void;
  documentChange(uri: string, text: string): void;
  documentClose(uri: string): void;
  completion(uri: string, line: number, column: number): Promise<CompletionItem[]>;
  hover(uri: string, line: number, column: number): Promise<Hover | null>;
  definition(uri: string, line: number, column: number): Promise<Location[]>;
  references(uri: string, line: number, column: number): Promise<Location[]>;
  onDiagnostics(cb: (uri: string, diags: Diagnostic[]) => void): () => void;
  dispose(): Promise<void>;
}
```

---

## `settings`

Schema-driven, persisted to IndexedDB. Values are validated on `set` (type + enum checks); invalid values are rejected.

| Method | Signature | Description |
|---|---|---|
| `get` | `get<K extends SettingKey>(key: K): Settings[K]` | Current value (default when unset). |
| `set` | `set<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>` | Persists, applies and emits `settings:change`. |
| `all` | `all(): Readonly<Settings>` | Snapshot. |
| `reset` | `reset(): Promise<void>` | Restores defaults. |

| Key | Type | Default | Description |
|---|---|---|---|
| `theme` | `'dark' \| 'light' \| 'solarized'` | `'dark'` | Active theme id. |
| `fontSize` | `number` | `16` | Editor font size (px). |
| `tabSize` | `2 \| 4 \| 8` | `4` | Indent width. |
| `wordWrap` | `boolean` | `true` | Soft wrap. |
| `autoSave` | `boolean` | `false` | Save after 1.5 s idle. |
| `lang` | `string` | `navigator` locale | UI language (`en`, `pt`, `es`, …). |
| `terminal.fontSize` | `number` | `13` | Terminal font size. |
| `lsp.servers` | `Record<string, LspServerConfig>` | `{}` | Server configs per language. |

---

## `dialog`

All dialogs are promise-based, keyboard-navigable and theme-aware.

| Method | Signature | Returns |
|---|---|---|
| `alert` | `alert(title: string, message: string): Promise<void>` | resolves on dismiss |
| `confirm` | `confirm(title: string, message: string): Promise<boolean>` | OK/Cancel |
| `prompt` | `prompt(title: string, message: string, opts?: { value?: string; placeholder?: string; type?: string; required?: boolean }): Promise<string \| null>` | text or `null` |
| `select` | `select(title: string, message: string, options: string[], selectedIndex?: number): Promise<number \| null>` | chosen index or `null` |

---

## `toast`

| Method | Signature | Description |
|---|---|---|
| `show` | `show(message: string, type?: ToastType, duration?: number): void` | `type`: `'info' \| 'success' \| 'warning' \| 'error'`; default duration 3000 ms. |
| `info` / `success` / `warning` / `error` | `(message: string, duration?: number): void` | Shorthand helpers. |
| `clear` | `clear(): void` | Dismisses all toasts. |

---

## `events`

Typed pub/sub bus. `on` returns an unsubscribe function.

| Method | Signature |
|---|---|
| `on` | `on<E extends EventName>(event: E, cb: (payload: EventPayloads[E]) => void): () => void` |
| `once` | `once<E extends EventName>(event: E, cb: (payload: EventPayloads[E]) => void): () => void` |
| `off` | `off<E extends EventName>(event: E, cb: (payload: EventPayloads[E]) => void): void` |
| `emit` | `emit<E extends EventName>(event: E, payload: EventPayloads[E]): void` |

### Event catalogue

| Event | Payload | Emitted when |
|---|---|---|
| `app:ready` | `{}` | Bootstrap finished. |
| `editor:open` | `{ url }` | Tab opened. |
| `editor:switch` | `{ url }` | Active tab changed. |
| `editor:close` | `{ url }` | Tab closed. |
| `editor:save` | `{ url }` | File saved. |
| `editor:dirty` | `{ url, isDirty }` | Dirty flag flipped. |
| `fs:update` | `{ url, type: 'create' \| 'write' \| 'delete' \| 'rename' }` | Any FS mutation. |
| `settings:change` | `{ key, value }` | A setting changed. |
| `terminal:open` / `terminal:close` | `{}` | Panel visibility. |
| `lsp:status` | `{ languageId, status }` | Server lifecycle. |
| `plugins:change` | `{ id, action }` | Install/enable/disable/uninstall. |
| `workspace:change` | `{ folders: string[] }` | Workspace roots changed. |

---

## `cache`

Persistent (IndexedDB) key-value store for plugins and app state. Values must be JSON-serialisable.

| Method | Signature |
|---|---|
| `get` | `get<T>(key: string, fallback?: T): Promise<T>` |
| `set` | `set(key: string, value: unknown): Promise<void>` |
| `remove` | `remove(key: string): Promise<void>` |
| `clear` | `clear(prefix?: string): Promise<void>` — deletes all, or all keys starting with `prefix`. |

---

## `plugins`

| Method | Signature | Description |
|---|---|---|
| `list` | `list(): PluginRecord[]` | Installed plugins with `enabled` flag. |
| `install` | `install(source: { zipUrl?: string; dirUrl?: string }): Promise<PluginRecord>` | Installs from a ZIP (`plugin.json` at root) or directory. |
| `enable` | `enable(id: string): Promise<void>` | Loads and inits the plugin. |
| `disable` | `disable(id: string): Promise<void>` | Calls `unmount()`, unloads. |
| `uninstall` | `uninstall(id: string): Promise<void>` | Disables and deletes files. |
| `get` | `get(id: string): PluginRecord \| undefined` | — |

```ts
interface PluginRecord {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  baseUrl: string;
  manifest: PluginManifest;     // plugin.json contents
}
```
