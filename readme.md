# XCoder

<div align="center">

**Fast, offline-first code editor and web IDE for Android**

Built-in AI agent • Real Linux terminal • LSP support • No ads • No account

</div>

---

XCoder is a mobile-first code editor for Android focused on privacy and offline
usage. It ships a complete editing experience — syntax highlighting for 100+
languages, LSP integrations, Git-friendly file management, an Alpine Linux
terminal (proot) and a local live preview server — **without** requiring an
account, showing ads or sending telemetry.

## Highlights

- **AI assistant with agents & subagents** — bring your own key. The agent can
  read and analyze your project, create/edit/delete files, run JavaScript in an
  isolated sandbox, use a virtual shell (with a local snapshot VCS) and spawn
  read-only subagents for research tasks. You approve every sensitive action.
- **AI provider manager** — presets in three groups:
  - *Free*: Groq, OpenRouter (free models), Cerebras, Hugging Face, Cloudflare Workers AI
  - *Paid with free tier*: Google Gemini, OpenAI, Mistral, DeepSeek, Together, Cohere, GitHub Models, Fireworks
  - *Premium*: Anthropic, xAI, Perplexity, Azure OpenAI, NVIDIA NIM, OpenRouter
  - Or point to **any OpenAI-compatible endpoint** (Ollama, LM Studio, vLLM, LiteLLM).
- **Editor**: CodeMirror 6 core, 100+ languages, autocompletion, folding,
  multi-cursor, quick tools, 20+ editor themes, customizable fonts.
- **LSP**: TypeScript, JavaScript, Python, HTML, CSS, JSON, Tailwind and more —
  diagnostics, completions, hover, go-to-definition, rename, formatting.
- **Terminal**: real Alpine Linux shell via proot with background executors.
- **Files**: local storage, SD card, SFTP and FTP backends, multi-root
  workspaces, powerful search & replace across files.
- **Live preview**: built-in HTTP server + in-app browser preview and console.
- **100% offline core**: no account, no ads, no in-app purchases, no tracking.
- **40+ UI languages.**

## Build

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

## AI agent quick start

1. Open a project folder.
2. Tap the **AI** tab in the sidebar.
3. Open *Settings → AI assistant*, pick a provider (e.g. **Groq** — free), paste
   your API key and pick a model.
4. Ask anything: "explain this project", "add a dark mode toggle", "find all
   uses of X and refactor".

The agent asks before modifying anything unless you raise its autonomy level.

## Project structure

```
src/                 application source (editor, fs, terminal, LSP, AI)
  lib/ai/            AI agent, tools, provider client, virtual shell
  cm/                CodeMirror 6 integration
  plugins/           vendored Cordova plugins (terminal, server, sftp, ...)
  lang/              UI translations
utils/               build/dev scripts
res/                 Android icons and resources
```

## Privacy

XCoder has **no** telemetry. The only network requests are the ones you make:
AI provider calls you configure, FTP/SFTP servers you add, plugin zips you
install from URLs, and the update check against the project's GitHub releases
(can be disabled in settings).

## License

[MIT](license.txt) — based on the excellent open-source work of the Acode
project (© Foxdebug / Ajit Kumar).
