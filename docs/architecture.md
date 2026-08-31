# Architecture

XCoder is a mobile-first IDE that runs entirely in a WebView (browser or Cordova Android).
Everything is TypeScript, bundled by Rspack into `www/` with lazy-loaded chunks.

## Layered overview

```
┌────────────────────────────────────────────────────────────┐
│ src/ui        IDE shell, file tree, palettes, terminal,    │
│               agent drawer, settings, plugin manager       │
├────────────────────────────────────────────────────────────┤
│ src/api       commands · settings · toast · dialog ·       │
│               cache · plugins · registry (xcoder.require)  │
├────────────────────────────────────────────────────────────┤
│ src/core                                                   │
│   file/    FileSystemBackend + workspace (multi-root)      │
│   editor/  CodeMirror 6 sessions, themes, languages        │
│   terminal/ virtual shell + git state machine              │
│   lsp/     JSON-RPC 2.0 client + transports                │
│   ai/      provider presets + OpenAI/Anthropic/Gemini      │
│   agent/   orchestrator + tools + subagents + permissions  │
├────────────────────────────────────────────────────────────┤
│ src/lib       path (scheme-aware) · events · storage ·     │
│               i18n · dom · helpers                         │
└────────────────────────────────────────────────────────────┘
```

Dependencies flow strictly downward: `ui → api → core → lib`. There are no import cycles;
cross-cutting communication uses the shared `EventBus` (`src/lib/events.ts`) with
`domain:action` event names such as `editor:open`, `settings:change`, `workspace:changed`,
`agent:permission`.

## Scheme-aware path library

Every path in XCoder can carry a scheme: `file:///src/main.ts`, `mem://notes/a.md`,
`webdav://server/dav/x.txt`. `src/lib/path.ts` implements `join/resolve/dirname/basename/…`
with these rules:

- a fragment with a scheme replaces the accumulated base entirely;
- a fragment starting with `/` restarts the path **but keeps the active scheme**
  (device-relative absolute);
- relative fragments join the accumulator (node `path.resolve` semantics).

The workspace (`src/core/file/index.ts`) maps each scheme to a backend:

| Backend | Scheme | Persistence | Notes |
| --- | --- | --- | --- |
| `BrowserBackend` | `file` | IndexedDB (KV emulation) | default on the web |
| `MemoryBackend` | `file`/`mem` | in-process | tests, private mode fallback |
| `CordovaBackend` | `file` | device storage | active inside the Android app |
| `WebDavBackend` | `webdav` | remote server | Nextcloud/rclone/Apache |

The `Workspace` routes every operation through `resolve(url)`, so the editor, the shell and
the agent never care which backend serves a file. It also offers `ensureDir`, `search`
(content grep) and multi-root bookkeeping.

## Editor

`src/core/editor/editorManager.ts` owns one CodeMirror 6 `EditorView` and a map of sessions
(one per open file). Language, theme, wrap and indent settings live in `Compartment`s so
they can change at runtime without rebuilding the state. Languages come from
`@codemirror/language-data` (100+ grammars loaded lazily by file extension). Themes are
pure `EditorView.theme` + `HighlightStyle` definitions (dark/light/ocean).

Document formatting calls Prettier's standalone API with lazy per-parser plugins
(`prettier/plugins/typescript`, …) kept out of the initial bundle.

## Virtual terminal & git

`src/core/terminal/shell.ts` implements:

- **tokenizer** with quotes, pipes (`|`) and redirection (`>`, `>>`);
- 25+ builtins; the pipeline passes the previous stage's stdout as the `input` argument;
- short flags stay in `args` (getopt-style), long flags go to the `flags` map — which is how
  `git commit -m "…"` keeps its message;
- **`GitStore`** — a complete git model persisted in storage under `git:<root>`:
  commits carry full trees (path → content), enabling real `checkout`/`merge` semantics
  (fast-forward materializes the target tree into the workspace; three-way merges union
  trees and keep HEAD on conflict). The `node`/`python` builtins execute JS through a
  sandboxed `Function` with captured console, and Python through lazily-loaded Pyodide.

## AI providers

`src/core/ai/types.ts` defines the provider-agnostic `ChatMessage`/`ToolDef` contract.
Three clients map it to vendor dialects:

| Client | Endpoint | Notes |
| --- | --- | --- |
| `OpenAIClient` | `POST {base}/chat/completions` | works for ~15 presets; SSE streaming |
| `AnthropicClient` | `POST {base}/v1/messages` | groups consecutive tool results into `tool_result` blocks; tolerant to base URLs with/without `/v1` |
| `GeminiClient` | `POST {base}/models/{model}:generateContent` | `functionCall`/`functionResponse` parts |

`presets.ts` ships the 3-group catalog (free / freemium / premium). `ProviderManager`
stores user profiles in settings and instantiates clients.

## Agent system

`src/core/agent/orchestrator.ts` runs the loop:

```
user task ─▶ system prompt ─▶ LLM(chat, tools) ─▶ tool_calls? ─▶ execute ─▶ append results ─┐
                                ▲                                                          │
                                └──────────────────── until final text / maxSteps ◀────────┘
```

- **Tools** (`tools.ts`) declare JSON-schema parameters plus `danger`/`readOnly` flags.
- **Permissions** — dangerous tools route through `PermissionManager`, which either
  auto-allows (`agent.permissionMode: 'auto'`), replays a remembered *always allow*, or
  raises `bus` event `agent:permission` that the UI answers (Allow / Always allow / Deny).
- **Subagents** (`subagents.ts`) restrict the toolset: `coder` (write access), `analyzer`
  (read-only), `ops` (command runner). `agent.spawn` delegates with the subagent's system
  prompt and maxSteps.
- Events (`run-start`, `tool-call`, `tool-result`, `permission`, `message`, `error`,
  `run-end`) stream to the UI panel for live tool cards.

## LSP

`src/core/lsp` implements JSON-RPC 2.0 (Content-Length framing for WebSocket, newline
framing for workers), a `LSPClient` with lifecycle/document-sync/feature requests and
`WebSocketTransport` / `WorkerTransport` / loopback pair (tests).

## Plugins

Plugins are zip packages (`plugin.json` + `main.js`) installed through JSZip, stored in the
KV store and evaluated with `new Function` against the `xcoder` facade — the same object
exposed on `window.xcoder`. They can register commands, listen to the bus and register
full-screen pages. Enable/disable cycles call `onLoad`/`onUnload`.

## Boot sequence

`src/main.ts`:

1. `settings.whenReady()` (storage → settings),
2. register generated locales, detect/set locale,
3. create the shell (workspace + git), bind it to the agent module,
4. `initRegistry` → exposes `window.xcoder`,
5. load provider profiles, build the UI chrome (header, sidebar, tabs, terminal, agent drawer),
6. register ~17 commands, keyboard shortcuts, settings side-effects,
7. load installed plugins, restore the last editor session.
