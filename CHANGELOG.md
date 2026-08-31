# Changelog

All notable changes to XCoder are documented here. From v1.1.0 the release workflow
generates these sections automatically from [Conventional Commits](https://www.conventionalcommits.org/).

## v1.1.0 (2026-08-31)

### Features

- **AI Agent system** (`src/core/agent/`): autonomous main agent with 17 tools —
  `fs.read/list/write/append/delete/mkdir/search`, `code.analyze/edit`, `git.status/add/commit/log/diff/branch/checkout`,
  `exec.run` (bash via the virtual shell, JavaScript sandbox, Python via Pyodide) and `agent.spawn`.
  Permission prompts guard every dangerous action; the tool loop works with any configured provider.
- **Subagents**: `coder` (full read/write dev agent), `analyzer` (read-only analysis),
  `ops` (command runner) — spawned by the main agent or run directly from the UI.
- **AI provider manager** (`src/core/ai/`): 17 presets in 3 groups — *free*
  (Groq, Cerebras, OpenRouter free, Hugging Face, GitHub Models, Ollama), *paid with free tier*
  (OpenAI, Anthropic, Gemini, Mistral, DeepSeek, Together, Cohere) and *premium*
  (Azure OpenAI, AWS Bedrock, Google Vertex, IBM watsonx) — plus custom OpenAI-compatible
  endpoints. Native clients for the OpenAI, Anthropic and Gemini dialects with full
  tool-calling mapping, streaming for OpenAI-style APIs, and connection testing.
- **Quick Open** (`Ctrl+P`): fuzzy file switcher over the whole workspace.
- **Format Document**: Prettier (lazy loaded) for JS/TS/JSON/CSS/SCSS/LESS/HTML/Vue/Markdown/YAML.
- **Auto-save**: configurable delay, runs on document change.
- **Editor polish**: selection-match highlighting, fold gutter, search panel, active-line
  highlight and three curated themes.
- **WebDAV backend** and multi-root workspace mounts (`workspace.addWebdav` command).
- **CI/CD**: GitHub Actions for CI (typecheck + tests + build), conventional-commit driven
  releases, debug APK on every push to `main` (rolling pre-release) and signed release
  APK + AAB attached to versioned releases; Dependabot (npm + actions), PR labeler,
  first-interaction greetings and stale bot.
- **43 locales**: complete en/pt/es plus generated stubs, `gen:locales` tooling with key-parity checks.

### Fixes

- `path.resolve` now keeps the active scheme when a device-absolute fragment (`/c`) restarts
  resolution, and restarts correctly on foreign schemes.
- `git commit -m "message"` parses its flag correctly in the virtual shell; short flags no
  longer disappear into the generic flag table.
- Command history is registered inside `execute()` for every invocation (pipes included).
- `xcoder.require()` returns the module facade itself, not a namespace object.
- Browser (IndexedDB) filesystem treats `/` as an always-existing root, so `listdir('/')`
  and git scans work on a fresh install.

## v1.0.0 (2026-08-30)

- Initial public version: CodeMirror 6 editor with 23 languages and 3 themes, multi-backend
  virtual filesystem, virtual terminal with git state machine, LSP client (JSON-RPC 2.0 over
  WebSocket/Worker), plugin system with JSZip installs, command palette, settings screen,
  43 locales, Cordova packaging and bilingual documentation.
