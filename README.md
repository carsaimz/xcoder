# XCoder

**A mobile-first code editor & IDE for the web and Android — built on CodeMirror 6.**

XCoder is a community fork of [Acode](https://github.com/Acode-Foundation/acode), rewritten in
strict TypeScript with a modern toolchain (Rspack + Vitest) and extended with an
AI agent system, a virtual terminal with git, and a plugin platform.

[![CI](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml)
[![Release](https://github.com/carsaimz/xcoder/actions/workflows/release.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Locales](https://img.shields.io/badge/locales-43-green)

---

## ✨ Highlights

- **📝 CodeMirror 6 editor** — 100+ languages loaded on demand, 3 themes (dark / light / ocean),
  bracket matching, autocomplete, search & replace, fold gutter, selection match highlight.
- **📁 Multi-root workspace** — pluggable backends: browser storage (IndexedDB), in-memory,
  WebDAV, and device storage through Cordova on Android.
- **⌨️ Virtual terminal** — 25+ commands (`ls`, `cat`, `grep`, `wc`, `cp`…), pipes and output
  redirection, `node -e`, `python` (Pyodide), npm/apk mocks and a **full git state machine**
  (init / add / commit / log / diff / branch / checkout / merge / remote / push / pull / clone)
  persisted per repository.
- **🤖 AI Agent** — an autonomous agent that can read, write and edit your files, run git
  commands and execute bash/JS/Python locally. Subagents (`coder`, `analyzer`, `ops`) can be
  spawned for focused subtasks. Every dangerous action asks for permission.
- **🔌 Bring your own AI** — 17 provider presets in 3 groups (*free*, *paid with free tier*,
  *premium enterprise*) speaking OpenAI, Anthropic and Gemini dialects, plus any custom
  OpenAI-compatible endpoint.
- **🧩 Plugins** — install `.zip` packages built with `npm run gen:plugin`; plugins get the
  same `xcoder.require()` facade as the core (commands, fs, editor, agents, ai, …).
- **🌍 43 locales** — complete English, Portuguese and Spanish dictionaries plus generated
  stubs for 40 more languages (`npm run gen:locales`).
- **⚡ Command palette & Quick Open** — `Ctrl+K` commands, `Ctrl+P` fuzzy file switcher.
- **📐 Format on demand** — Prettier (lazy-loaded) for JS/TS/JSON/CSS/HTML/Markdown/YAML.

## 🚀 Quick start (web)

```bash
git clone https://github.com/carsaimz/xcoder.git
cd xcoder
npm install
npm run dev          # dev server on http://localhost:8080
```

Production build:

```bash
npm test             # typecheck + 88 unit tests
npm run build        # emits www/ (bundle.js + lazy chunks)
npm run serve        # static server for www/
```

Open the app and try:

| Action | How |
| --- | --- |
| Command palette | `Ctrl+K` or the ⌕ toolbar button |
| Quick open file | `Ctrl+P` |
| Terminal | toolbar `>_` button, then `help` |
| AI agent | robot button (configure a provider first: Settings → AI providers) |
| Format document | `editor.format` command in the palette |

## 🤖 AI agent in 30 seconds

1. **Settings → AI providers → Add provider** and pick a preset:
   - *Free*: Groq, Cerebras, OpenRouter (`:free` models), Hugging Face, GitHub Models, Ollama (local)
   - *Paid with free tier*: OpenAI, Anthropic, Gemini, Mistral, DeepSeek, Together, Cohere
   - *Premium*: Azure OpenAI, AWS Bedrock, Google Vertex, IBM watsonx
2. Paste your **API key** (Ollama needs none) and press **Test connection**.
3. Open the **AI agent** panel and describe a task:

> *“create utils/date.ts with a formatDate helper, then commit it”*

The agent plans, calls tools (`fs.read`, `fs.write`, `code.edit`, `git.commit`, `exec.run`…),
asks before every write, and reports back. Read-only subagent (`analyzer`) and command-runner
subagent (`ops`) are one tap away.

Full details: [docs/agents.md](docs/agents.md) · API contract: [docs/api-reference.md](docs/api-reference.md)

## 📱 Android builds (CI)

| Build | Trigger | Output |
| --- | --- | --- |
| Debug APK | every push to `main` | rolling [`dev-build` pre-release](https://github.com/carsaimz/xcoder/releases/tag/dev-build) |
| Signed APK + AAB | tag `v*` (or *Release* workflow dispatch) | attached to the versioned GitHub release |

Signing uses repository secrets — see [docs/build.md](docs/build.md):

| Secret | Description |
| --- | --- |
| `KEYSTORE_BASE64` | base64 of your `.keystore` file |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias |
| `KEY_PASSWORD` | key password |

Without secrets the release pipeline still publishes **unsigned** artifacts.

## 🗂 Project layout

```
├── src/
│   ├── lib/          # path (scheme-aware), events, storage, i18n, dom, helpers
│   ├── api/          # commands, settings, toast, dialog, plugins, registry (xcoder.require)
│   ├── core/
│   │   ├── file/     # FileSystemBackend + memory/browser/cordova/webdav + workspace
│   │   ├── editor/   # CodeMirror 6 manager, themes, languages, prettier format
│   │   ├── terminal/ # virtual shell + git state machine
│   │   ├── lsp/      # JSON-RPC 2.0 client, WebSocket/Worker transports
│   │   ├── ai/       # provider presets (3 groups) + OpenAI/Anthropic/Gemini clients
│   │   └── agent/    # agent loop, 17 tools, subagents, permission manager
│   ├── ui/           # IDE shell, file tree, palettes, terminal panel, agent panel, settings
│   ├── lang/         # en/pt/es dictionaries + 40 generated locales
│   └── main.ts       # bootstrap
├── utils/            # lang-cli, plugin-cli + plugin template
├── tests/            # 88 vitest cases
├── docs/             # architecture, api-reference, agents, build, i18n, plugins, migration
└── .github/          # workflows (ci/release/android-*), dependabot, labeler, greetings, stale
```

## 🛠 Development

```bash
npm run typecheck    # tsc --noEmit (strict)
npm test             # vitest run
npm run test:watch   # vitest watch
npm run build        # production bundle
npm run build:dev    # development bundle with sourcemaps
npm run gen:locales  # regenerate locale stubs (43 locales)
npm run gen:plugin   # scaffold a new plugin project
```

### Conventional commits

This repo follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add ops subagent
fix(path): keep scheme when resolving absolute fragments
chore(release): v1.2.0
```

The release workflow groups commits (`feat` → *Features*, `fix` → *Bug fixes*, …) into the
release notes and keeps `CHANGELOG.md` up to date.

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) — especially the sections on
conventional commits, locale translation and plugin authoring.

## 📄 License

MIT — see [LICENSE](LICENSE). XCoder is a fork of
[Acode](https://github.com/Acode-Foundation/acode); the original copyright is preserved in the
license file.

Português: [README.pt.md](README.pt.md)
