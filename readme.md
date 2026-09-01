<div align="center">

<!-- TODO: replace with the new app icon once it is ready (currently res/logo.png) -->
<img src="https://raw.githubusercontent.com/carsaimz/xcoder/main/res/logo.png" alt="XCoder logo" width="140"/>

# XCoder

**Fast, offline-first code editor and web IDE for Android**

🤖 Built-in AI agent • 🐧 Real Linux terminal • 🧠 LSP support • 🚫 No ads • 🔒 No account

[🇺🇸 English](readme.md) | [🇧🇷 Português (Brasil)](readme.pt-br.md)

### Build status

[![CI](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/ci.yml)
[![Debug APK](https://github.com/carsaimz/xcoder/actions/workflows/debug.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/debug.yml)
[![Release](https://github.com/carsaimz/xcoder/actions/workflows/release.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/release.yml)
[![CodeQL](https://github.com/carsaimz/xcoder/actions/workflows/codeql.yml/badge.svg)](https://github.com/carsaimz/xcoder/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/carsaimz/xcoder/badge)](https://api.scorecard.dev/projects/github.com/carsaimz/xcoder)

### Repository

[![Latest release](https://img.shields.io/github/v/release/carsaimz/xcoder?include_prereleases&sort=semver&display_name=tag&logo=github)](https://github.com/carsaimz/xcoder/releases)
[![License](https://img.shields.io/github/license/carsaimz/xcoder?logo=open-source-initiative)](license.txt)
[![Stars](https://img.shields.io/github/stars/carsaimz/xcoder?style=social)](https://github.com/carsaimz/xcoder/stargazers)
[![Forks](https://img.shields.io/github/forks/carsaimz/xcoder?style=social)](https://github.com/carsaimz/xcoder/network/members)
[![Contributors](https://img.shields.io/github/contributors/carsaimz/xcoder?logo=people)](https://github.com/carsaimz/xcoder/graphs/contributors)

[![Issues](https://img.shields.io/github/issues/carsaimz/xcoder?logo=github)](https://github.com/carsaimz/xcoder/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/carsaimz/xcoder?logo=github)](https://github.com/carsaimz/xcoder/pulls)
[![Last commit](https://img.shields.io/github/last-commit/carsaimz/xcoder/main?logo=git&logoColor=white)](https://github.com/carsaimz/xcoder/commits/main)
[![Commit activity](https://img.shields.io/github/commit-activity/m/carsaimz/xcoder?logo=git&logoColor=white)](https://github.com/carsaimz/xcoder/graphs/commit-activity)
[![Languages](https://img.shields.io/github/languages/count/carsaimz/xcoder?logo=codacy)](https://github.com/carsaimz/xcoder/search?l=javascript)
[![Repo size](https://img.shields.io/github/repo-size/carsaimz/xcoder?logo=databricks)](https://github.com/carsaimz/xcoder)

</div>

---

XCoder is a mobile-first code editor for Android focused on privacy and offline
usage. It ships a complete editing experience — syntax highlighting for 100+
languages, LSP integrations, Git-friendly file management, an Alpine Linux
terminal (proot) and a local live preview server — **without** requiring an
account, showing ads or sending telemetry.

## ✨ Highlights

- 🤖 **AI assistant with agents & subagents** — bring your own key. The agent
  can read and analyze your project, create/edit/delete files, run JavaScript
  in an isolated sandbox, use a virtual shell (with a local snapshot VCS) and
  spawn read-only subagents for research tasks. You approve every sensitive
  action.
- 🔌 **AI provider manager** — presets in three groups:
  - *Free*: Groq, OpenRouter (free models), Cerebras, Hugging Face, Cloudflare Workers AI
  - *Paid with free tier*: Google Gemini, OpenAI, Mistral, DeepSeek, Together, Cohere, GitHub Models, Fireworks
  - *Premium*: Anthropic, xAI, Perplexity, Azure OpenAI, NVIDIA NIM, OpenRouter
  - Or point to **any OpenAI-compatible endpoint** (Ollama, LM Studio, vLLM, LiteLLM).
- ✍️ **Editor**: CodeMirror 6 core, 100+ languages, autocompletion, folding,
  multi-cursor, quick tools, 20+ editor themes, customizable fonts.
- 🧠 **LSP**: TypeScript, JavaScript, Python, HTML, CSS, JSON, Tailwind and
  more — diagnostics, completions, hover, go-to-definition, rename, formatting.
- 🐧 **Terminal**: real Alpine Linux shell via proot with background executors
  and a Termux-style package manager.
- 📂 **Files**: local storage, SD card, SFTP and FTP backends, multi-root
  workspaces, powerful search & replace across files.
- 🌐 **Live preview**: built-in HTTP server + in-app browser preview and
  console.
- ☁️ **Optional cloud sync**: GitHub backend or Firebase for settings & AI
  chat backups.
- 🔄 **Update checker**: optional checks against GitHub Releases (asked on
  first run, can also be triggered from *About → Check for updates*).
- 🔌 **Plugins**: install community plugins from URLs or local files, with a
  development template.
- 🔒 **100% offline core**: no account, no ads, no in-app purchases, no
  tracking.
- 🌍 **30 UI languages** — defaults to your device language (Portuguese as
  fallback).

## 📲 Download

Grab the latest signed **APK/AAB** from the
[Releases page](https://github.com/carsaimz/xcoder/releases). Beta builds
(`-beta.*` / `-rc.*`) are published as pre-releases.

Nightly-style debug builds (`v1.x.x-debug`) are produced automatically on
every push — open the
[Debug APK workflow](https://github.com/carsaimz/xcoder/actions/workflows/debug.yml),
pick the latest run and download the artifact.

<!-- TODO: add real app screenshots here once new ones are captured -->

## 📸 Screenshots

| Editor + AI | Terminal | Git |
| :---: | :---: | :---: |
| ![Editor](docs/screenshots/editor.png) | ![Terminal](docs/screenshots/terminal.png) | ![Git](docs/screenshots/git.png) |

> Screenshots live in [`docs/screenshots/`](docs/screenshots) — PRs adding
> fresh captures are welcome!

## 🛠️ Build

Requirements: Node 18+, Java 17, Android SDK (API 36).

```bash
npm install          # install dependencies
npm run setup        # add android platform + plugins
npm run build        # debug APK
npm run build p      # release APK
npm run build p bundle  # release AAB
```

The web bundle alone (useful for PWA development):

```bash
npx rspack --mode development
```

Run the test suite:

```bash
npm test
```

## 🤖 AI agent quick start

1. Open a project folder.
2. Tap the **AI** tab in the sidebar.
3. Open *Settings → AI assistant*, pick a provider (e.g. **Groq** — free),
   paste your API key and pick a model.
4. Ask anything: "explain this project", "add a dark mode toggle", "find all
   uses of X and refactor".

The agent asks before modifying anything unless you raise its autonomy level.

## 🌍 Languages & translations

XCoder ships 30 UI languages. On first launch it follows your **device
language** when a translation is available, falling back to **Portuguese
(Brazil)**. You can switch anytime in *Settings → App → Language*.

Missing or improved translations are welcome: edit the matching
`src/lang/<locale>.json` file (use `en-us.json` as the key reference) and open
a pull request.

## 📁 Project structure

```
src/                 application source (editor, fs, terminal, LSP, AI)
  lib/ai/            AI agent, tools, provider client, virtual shell
  cm/                CodeMirror 6 integration
  lang/              UI translations (30 locales)
  plugins/           vendored Cordova plugins (terminal, server, sftp, ...)
utils/               build/dev scripts
res/                 Android icons and resources
.github/             CI, release automation and bot configs
```

## 🔒 Privacy

XCoder has **no** telemetry. The only network requests are the ones you make:
AI provider calls you configure, FTP/SFTP servers you add, plugin zips you
install from URLs, and the optional update check against the project's GitHub
releases (can be disabled in settings).

## 🤝 Contributing

Issues, pull requests and translations are welcome! Read
[CONTRIBUTING.md](CONTRIBUTING.md) to get started. The project keeps CI green
(typecheck, tests, build) — please run `npm test` before pushing.

## 📈 Repository stats

[![Contributors](https://contrib.rocks/image?repo=carsaimz/xcoder)](https://github.com/carsaimz/xcoder/graphs/contributors)

[![Star History Chart](https://api.star-history.com/svg?repos=carsaimz/xcoder&type=Date)](https://star-history.com/#carsaimz/xcoder&Date)

## 🙏 Acknowledgments

XCoder stands on the shoulders of giants:

- **[Acode](https://github.com/deewarz/acodeapp)** (© Foxdebug / Ajit Kumar) —
  the awesome editor this project forked from.
- **Open-source libraries** — CodeMirror 6, xterm.js, markdown-it, KaTeX,
  Mermaid, DOMPurify, Emmet, motion, html-tag-js, JSZip and every dependency
  in [`package.json`](package.json).
- **[Contributors](https://github.com/carsaimz/xcoder/graphs/contributors)** —
  everyone who ships code, docs and translations.
- **Community** — testers, translators and bug reporters. Thank you!

## 📄 License

[MIT](license.txt) — based on the excellent open-source work of the Acode
project (© Foxdebug / Ajit Kumar).

<div align="center">

[🇺🇸 English](readme.md) | [🇧🇷 Português (Brasil)](readme.pt-br.md)

</div>
