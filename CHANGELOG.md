# Changelog

All notable changes to **XCoder** are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).


## [1.5.0] - 2026-09-06

### Added
- V1.4.24 — sidebar globals (fix 'sidebar is not defined') + persistent tab history

### Fixed
- Expose window.sidebar / $sidebar / sidebarApps — user code no longer throws 'sidebar is not defined'


## [1.4.24] - 2026-09-07

### Fixed
- **"sidebar is not defined"** — o elemento da sidebar era uma const local
  dentro do main.js, então qualquer código de usuário (console no contexto
  da página, plugins, scripts) que referenciasse `sidebar` ou `$sidebar`
  explodia com ReferenceError. Agora o app expõe `window.sidebar` (API
  estática: show/hide/toggle/on/off/el), `window.$sidebar` (elemento vivo)
  e `window.sidebarApps` — mesma convenção do `editorManager`

### Added
- **Histórico de abas persistente** (roadmap v1.5.x item 3) — a navegação
  voltar/avançar sobrevive ao reinício do app: o `saveState` grava o
  histórico como ids em `localStorage.tabHistory` e o boot o restaura
  ANTES do primeiro save-state; ids cujos arquivos não existem mais são
  ignorados e o cursor recai no registro mais recente sobrevivente

### Tests
- +12 testes (529 → 541): sidebarGlobalApi (5) e tabHistoryPersist (7)


## [1.4.23] - 2026-09-06

### Fixed
- Typos step — exclude generated icon/registry files and pt-br content, whitelist legitimate Portuguese words

### Documentation
- V1.5.x item 5 done — preview build mirrored in xcoder-web; CodeQL gated while private; renumber v1.6+ list


## [1.4.22] - 2026-09-06

### Added
- **`acode` CLI in the terminal** 💡 (Acode v1.11.8 parity): `acode open <file>` (and `acode <file>`, `acode --version`, `acode --help`) opens files/folders in the editor through the same OSC 7777 bridge the `xcoder` CLI uses. Both scripts now ship as version v2 with a version marker, so installs that already extracted the old CLI are upgraded automatically on the next terminal start. Covered by functional tests that extract the shipped heredocs and run them with real bash
- **Tab history navigation** 💡 (Acode v1.12.7 parity): browser-style back/forward through recently used tabs — new header buttons (`arrow_back`/`arrow_forward`, disabled at both ends of the history) and default shortcuts `Alt-←`/`Alt-→`. The keybindings back-fill in `commandRegistry.js` now adopts a newly shipped default when the stored binding still has `key: null`, so existing installs get the new shortcuts without resetting their customizations
- **Preview build on demand** (preview-build.yml): labeling a pull request `build` triggers a debug-APK build (unsigned, installable for testing) uploaded as a run artifact, with a sticky bilingual comment on the PR; rebuilds automatically on new pushes while the label is on, concurrency-canceled per PR

### Improved
- **Indent guides are now ON by default** (VSCode-style, roadmap item 💡 Acode v1.11.5); the configurable scroll-past-end already existed — no code change needed there
- **Website fully bilingual pt/en** (xcoder-web): every internal page converted to the dictionary i18n — download, sponsor (+checkout), marketplace, about, changelog, blog, docs index, forum, chat, stats, setup wizard, user, admin and 404; data-fetching pages keep their server components and render through new client view components. 348 translated strings, zero keys missing
- Terminal CLI open/close toasts are now translated ("Pasta aberta: …" / "Falha ao abrir: …") instead of hardcoded English

### Fixed
- Flaky `supportAndProfile` test: the heavy `pages/profile/profile` import chain could exceed the 5s default timeout when 65+ test files run in parallel — the import is hoisted to file level (mocks still apply) and the first render got an explicit 20s timeout (Vitest 4 signature)

## [1.4.21] - 2026-09-06

### Fixed
- Plugins sidebar could not scroll: the JS-injected max-height fought the flexbox layout and the infinite-scroll handler crashed on every scroll event — pure flexbox now, handler fixed, search results scroll inside the panel
- "Continuar com Google/GitHub" appeared even with the providers off: the app now defaults to HIDE when the project settings are unreachable, renders the buttons only after the check (no flash) and shows the real Google/GitHub brand marks
- Pollinations hardening on top of the gen-API migration: a stale/expired key that still answers "403: invalid API key requested" is ignored automatically (anonymous retry) and the error explains how to remove/renew it
- Native cookie-jar crashes ("cannot read properties of null (reading 'hostOnly')"): the advanced-http cookie store is now null-safe and the AI client self-heals (clearCookies + retry); duck.ai keeps its new protocol headers

### Added
- Quick pills in the chat composer: "Pensar" (reasoning display) and "Buscar" (web search) — persisted settings; web search also unlocks web_search/read_url in chat mode (toolToggle.js, shared rule with the agent)
- While the model thinks, the chat shows only "Pensando..." — the full reasoning stays collapsed in "Processo de pensamento" after the answer
- Provider logos: the chat strip shows the brand glyph + selected model (name in the tooltip); logos in the model picker too; custom providers use 🤖
- Auto-scroll to the latest message whenever the chat is opened (robust double-rAF + sidebar "show" hook)

### Improved
- i18n: LSP install/update notifications and toasts translated, plugins panel dialogs translated, plus all new chat strings (pt-br 100%)
- Release automation: auto-release.yml tags and publishes the signed release when a push to main bumps the version; self-contained weekly deps bot (deps-update.yml) independent of Dependabot settings; auto-merge extended to Dependabot/deps-bot PRs

## [1.4.20] - 2026-09-06

### Fixed
- **Account icon (3rd report — root cause found):** `pages/profile/profile.js` called `$page.show()`, a method that does not exist on WCPage, so the account page threw a TypeError on every tap and never opened. Pages become visible via `app.append()` (About/Plugins pattern) — plus a happy-dom regression test that renders the real page so this can never silently break again
- **"Apoie o projeto" did nothing:** every failure inside the support dialog was swallowed (`.catch(() => {})`). The support surface is now a proper FULL PAGE (`pages/support`) — no modal — and `openSupportPage()` logs + toasts any failure visibly. The support page shows the FULL PayPal e-mail (no masking) and re-renders after sign in/sign up/redeem
- proot terminal: `can't sanitize binding "/proc/self/fd/{0,1,2}"` warnings during install — stdio bindings are now only added when the fds resolve to a real path (pipes skip them; the guest still reaches fds through the bound /proc and /dev)
- DuckDuckGo AI 503 (x-vqd-4 missing): the adapter now speaks the current duck.ai protocol — `x-vqd-hash-1` + `x-fe-signals` + `x-fe-version` headers, browser client-hints and the essential cookies (`5`, `dcm`, `dcs`), accepting the session from either `x-vqd-4` or `x-vqd-hash-1`; clearer 418/429 messages
- legacy `keyboardEvent.js` TDZ crash on environments where `initKeyboardEvent` is absent

### Changed
- Chat composer redesigned (Claude/DeepSeek style): the textarea gets the FULL width and attach/send buttons sit on a separate fixed row BELOW it — more typing space, no reflow when attachments appear
- User messages now have an avatar (mirrored person icon); assistant messages keep the bot avatar
- Long-press (or right-click) any chat message for actions: Copiar, Regenerar, Detalhar, Resumir, Continuar and Inserir no editor (assistant messages get all; user messages get copy/insert). Regenerate rewinds the conversation to the source question and runs it again
- Dev menu: version-number tap requirement reduced from 7 to 2 taps (1.5 s window)
- GitHub settings page: sign in/logout buttons are now compact pills instead of full-width bars
- vitest now transforms JSX modules through the production html-tag-js loader (tests can render real pages/dialogs)

### Docs
- `readme.pt-br.md` → **README.md** (Portuguese is the standard), English version → `README.en.md`, `license.txt` → **LICENSE**; both READMEs rewritten to the current reality (keyless AI, image generation, chat actions, embedded website, plugins marketplace, free-for-all features)
- New `ROADMAP.md` (Acode upstream sweep: split panes, SSH terminal, REPL, `acode` CLI, font manager, rewarded ads…)
- Illustrative UI mockups added to `docs/screenshots/` (editor-ai, terminal, chat-ia)
- CI now runs `lang:check` (pt-br 100%) and spell check (typos)

### Site (xcoder-web)
- Sponsor tiers lowered: Apoiador 2 USD/mês, Patrocinador 5 USD/mês, Parceiro 10 USD/mês
- Language menu (🌐) on the site header: pt-BR is the original; other languages fall back to instant Google Translate — exactly as requested (fallback for languages the site does not ship)

## [1.4.19] - 2026-09-05

### Added
- Proper Support PAGE (no more modal): premium status, payment methods from the project database (URL/account/QR), sponsor link and the unlock code live in a real page reachable from Settings, Profile, and the agent daily-limit notice
- Account creation is now fully independent: sign in/sign up (e-mail + Google/GitHub OAuth) live exclusively in the Profile page — the support page links to it instead of embedding login forms
- User avatars in the AI chat: user messages show a person avatar (right side) and the assistant keeps its accent bot avatar (left) — Claude/DeepSeek-style
- Marketplace submissions carry the login token (site): the author's e-mail is attached via `Authorization: Bearer`, CORS now allows it, and /user/plugins gained an EDIT form (version/contact/description) for pending submissions

### Changed
- AI chat composer redesigned (Claude/DeepSeek/GPT-inspired): the message field is a rounded card with the send button IN FRONT of it (bottom-right inside), attach (+) and the Chat/Agent switch moved BELOW the field, header/provider/artifacts stay ABOVE
- GitHub settings page now follows the app theme strictly: flat card surface + status chips blended with the theme text color (readable on all 30 themes, light included)
- Built-in AI (Pollinations) migrated to the new gen.pollinations.ai API: keyed requests go straight to the new API (the legacy text API answers 402 "deprecated" to authenticated users), keyless requests stay on the legacy endpoint and AUTOMATICALLY fall back to the new API (non-streaming, single-delta) when it returns 402/404/deprecation — the "AI request failed: 500 402 Payment required" error is gone; fail-fast skips useless retries on deprecation
- 402/deprecation errors now explain the migration in plain pt-br instead of "saldo insuficiente"

### Fixed
- Sidebar icons can no longer die silently: `pulseApp` wraps launch/pulse/activate in a guard that logs and toasts on any synchronous error ("Ícone de conta não funciona")
- Profile page render is fully guarded: a synchronous error inside the page body shows a visible toast instead of a blank screen
## [1.4.18] - 2026-09-05

### Added
- DuckDuckGo AI (experimental, keyless): GPT-4o-mini, Claude Haiku, Llama 3.3 70B and Mistral via duck.ai — dedicated adapter with x-vqd-4 handshake, system-prompt merging and one free retry; auto-fallback to the plain request path (no streaming)
- AI image generation in chat: `/image <descrição>` uses the keyless Pollinations image API (verified live), saves the JPG next to the active file (or workspace root) and posts an inline preview bubble; accepts size hints (`768x512`, `w=`/`h=`) and `--turbo`
- Embedded website: new "Website" sidebar app (globe icon) — an in-app webview of the official site with back/reload/open-in-browser; docs, marketplace, sponsor and account stay inside the app
- 9 new marketplace plugins (inspired by open-source Acode plugins, rewritten for the Xcoder API): Toggle Comment (language-aware, Ctrl-/), JSON Tools (pretty/minify/escape/validate), UUID Generator, Emoji Picker, Color Insert (hex/rgb/hsl), Markdown TOC, Indent Switch, Remove Duplicates, Hash Generator (SHA-1/256/384/512) — marketplace and offline bundle now hold 16 plugins

### Changed
- Premium is now ONLY about ads and AI limits: every theme is free (neon/sunset/obsidian included) and every feature is unlocked; Premium still removes ads and raises the AI caps (25 agent runs/day → unlimited, 4096 → 8192 tokens, autonomy "auto")
- Support dialog copy updated accordingly (pt-br first)

## [1.4.17] - 2026-09-05

### Added
- Full Acode CHANGELOG sweep (all 43 versions) — the only missing improvement was PR 2258: CodeMirror's Android EditContext input path now stays OFF by default (`useEditContext: false`), fixing scroll jumps when tapping empty lines; opt-in setting + live recreation included

### Fixed
- Account icon felt dead: the Profile launcher chain now imports the page chunk directly and any failure shows a visible toast + log entry ("Ícone de conta não funciona")

### Improved
- Built-in AI (Pollinations) hardening: automatic retry with backoff on 429/5xx for keyless requests, `referrer` etiquette field, and an actionable 429 message that points to free Groq/Cerebras keys for better quality
- Stale package-lock version aligned with package.json

## [1.4.16] - 2026-09-05

### Added
- /sponsor links, provider-gated OAuth sign-in, Acode ports (v1.4.16)

## [1.4.15] - 2026-09-05

### Added
- OAuth (Google/GitHub), profile page, skills system, AI polish, v1.4.14
- Token/autonomy gates + e-mail grant lookup
- Per-provider model picker, SweetAlert2, mandatory notifications, word-wrap everywhere

### Fixed
- V1.4.14 baseline, Built-in providers, PayPal e-mail, Dependabot daily

### Maintenance
- Config.xml author = Carsai Mozambique (carsaimz stays the GitHub handle)
- Updating the version


## [1.4.14] - 2026-09-03

### Added
- Live streaming, markdown answers, parallel subagents, UX fixes
- Payment methods from the database, Supabase account + cloud premium sync

## [1.4.13] - 2026-09-03

### Added
- Keyless AI (Pollinations default), premium/support system, ads decision, GitHub hero, hardened 401 diagnostics, site links, icon updates

### Fixed
- Base32 alphabet had 31 chars — index 31 resolved to undefined inside codes


## [1.4.12] - 2026-09-03

### Added
- Site notifications, house ads, Supabase hooks, Firebase -> analytics+crashlytics
- Dedicated GitHub settings — account, token, repositories, branch

### Fixed
- Purge old icon leftovers — orphan about wordmark, fastlane icon, preview favicon
- Native JSON serializer (400/401 root cause), strict connection test, key-shape diagnostics, artifacts panel, attachments


## [1.4.11] - 2026-09-03

### Added
- Provider enable/disable, per-provider models with type labels, capability strip, self-reading agent


## [1.4.10] - 2026-09-02

### Fixed
- Single menu icons, on-screen context menus, tappable info buttons, no row chevrons


## [1.4.9] - 2026-09-02

### Fixed
- Native Firebase off by default — v1.4.8 failed to boot on devices


## [1.4.8] - 2026-09-02

### Added
- New artwork icon + logo, drop backup UI, roll back to v1.4.7
- Native Firebase wired, icon pack tier 3, changelog fix

### Fixed
- Resolve google-services plugin via cordova-android 15 native flag
- Sidebar tap reliability, wider panels, header terminal/palette, icon glyph aliases, AI/git scroll, icon-lib autocomplete


## [1.4.7] - 2026-09-02

### Added
- Settings navigation joins the SVG pack (Lucide tier 2)
- Backfill 1.4.0-1.4.6, auto-update on release, site API source
- Provider page refinements — search, footer actions, docs link, key/test states
- Bundled SVG icon pack on the sidebar rail + official site URL
- Provider cards page, chat header/footer rework, site APIs, Firebase cleanup

## [Unreleased]

### Added
- **Provider management page**: one flexible card per AI provider — status chip (Connected/Offline/Testing), per-provider API key, base URL, max tokens slider (256–8192) and autonomy level (Baixa/Média/Alta), connection test with spinner and a link to get the API key; searchable list.
- **AI chat quick header**: compact 24dp actions (model picker, new chat, history, settings) and a footer switch to toggle between **Chat** and **Agente** modes.
- **Site integration**: the app now consumes the community site APIs (`/api/config`, `/api/feedback`) with anonymous `X-Device-ID` headers; the official site URL is `https://xcoderapp.vercel.app`.
- **SVG icon pack**: Lucide-style vector icons on the sidebar rail, sharper at any density and independent of the icon font.
- **Native Firebase**: `google-services.json` (project `carsai-mozambique-d5983`, app `com.carsaimz.xcoder`) ships with the repository — Analytics, Crashlytics, Remote Config and FCM initialize automatically in release builds; F-Droid flavours and self-hosters without the file build without any Firebase dependency.
- **Icon pack tier 3**: the main editor menu, file menu and About page now render Lucide SVG vectors via a runtime icon enhancer (22 new glyphs; pack grown to 54 icons).

### Changed
- **Firebase minimized**: only Analytics, Crashlytics, Remote Config and FCM remain; the in-app Backup/Backend UI was removed and preferences moved to SharedPreferences/DataStore.

### Fixed
- **Changelog generator**: re-running `update-changelog.mjs` for the same version no longer inserts a duplicate section — the existing section is replaced (Keep a Changelog format preserved).

## [1.4.6] - 2026-09-02

### Added
- **Community wiki sources**: 15 PT-BR pages (installation, first steps, interface, shortcuts, AI, Git, themes, plugins, build, FAQ, contributing…) ready to publish on GitHub.
- **Documentation hub** linking the site, wiki and repositories.

## [1.4.5] - 2026-09-02

### Added
- **Command palette polish**: fuzzy search (subsequence matching with word-boundary bonuses) and 117 localized command names in pt-br.
- **About page credits**: section thanking open-source libraries, contributors and the community.
- **Hidden developer menu**: 7 taps on the version number open dev actions (clear cache, restart, devtools, copy build info, console).

### Fixed
- **Startup crash** `Cannot read properties of undefined (reading 'bind')` — the Cordova bridge is now resolved lazily; plugins fail gracefully instead of breaking the boot.

### Improved
- Motion and feedback: material ripple on taps, page transition animations and optional haptics (all respecting `prefers-reduced-motion`).

## [1.4.4] - 2026-09-01

### Changed
- Release/maintenance sync — no app changes in this cycle.

## [1.4.3] - 2026-09-01

### Added
- **Settings control kit** shared by every settings screen: 30%/70% label-control grid, touchable "?" info buttons, segmented autonomy control (Baixo/Médio/Alto), primary full-width buttons with spinner, and slider + numeric input controls.
- **Provider badges**: Grátis / Free tier / Premium chips on the provider row and chat header (replacing the truncated "Free — …" text).

### Fixed
- AI and Git panels returned to the sidebar apps (no longer opened as editor tabs), with external calls re-opening and focusing them properly.

## [1.4.2] - 2026-09-01

### Added
- **Own plugin marketplace**: remote registry (`carsaimz/xcoder-plugins`) with jsDelivr → raw fallback, stale-while-revalidate caching, custom marketplace URLs in settings and 7 built-in plugins (word-count, case-toggle, sort-lines, insert-date, lorem-ipsum, base64-tool, line-tools).
- Installing by plugin id now resolves through the registry with dependency support and automatic fallback source retry.

## [1.4.1] - 2026-09-01

### Added
- 6 new editor themes.

### Changed
- **New Xcoder brand**: icon with the X layered over the < > chevrons everywhere (app, header, about).
- Xcoder panel design refresh across settings screens.

### Fixed
- Language switch now applies instantly (no reload needed).
- Changelog loading failed on fresh installs.

## [1.4.0] - 2026-09-01

### Added
- **AI chat & Git as editor tabs** with tab renaming and quick tools.
- **GitHub device-flow sign-in**: sign in from the app (also works on devices without a browser handshake), enabling Git operations over HTTPS.
- Manual update check on the About page; Portuguese-first language detection on first run.

### Fixed
- axs and proot downloads now point to the real upstream repositories.

### Changed
- Completed all 30 locale files and polished pt-br; replaced Dependabot with Renovate and added Stale + CodeRabbit configs.
- CI/security: CodeQL, Dependency Review and OSSF Scorecard workflows; bilingual EN/PT-BR README with badges.

## [1.3.0] - 2026-09-01

### Added
- **AI code actions on selection**: from the file tab menu or main menu, run *AI: explain / fix / refactor / add comments / ask about selection* on the current selection (or whole file). Fix/refactor/comments route through the full agent, so it can actually patch the file with its editing tools under the configured permission mode.
- **Code block actions in the AI chat**: tap any code block returned by the model to *copy*, *insert at cursor*, *replace selection* or *save it to a workspace file*.
- **`open <file>` command in the virtual shell** (also available to the agent): opens a workspace file directly in the editor.
- **AI chat command**: open the assistant instantly via the main menu (`ai-chat`).

### Improved
- AI selection prompts now carry the file name, start line and a truncation notice, giving the model precise context.
- Sidebar registry exposes `setActiveApp`, letting commands jump straight to the AI section.
- 16 new localized strings across all 40+ locales (full parity, pt-br translated).

## [1.0.0] - 2026-08-31

### Highlights
- **XCoder 1.0** — a fast, offline-first code editor and web IDE for Android.
- Built-in **AI assistant** with agents & subagents: read/create/delete files, analyze and patch code, run JavaScript in an isolated worker, run shell commands (terminal/proot when available), and perform Git operations.
- **AI provider manager** with three preset groups: free providers, paid providers with a free tier, and premium paid providers. Any OpenAI-compatible endpoint (custom base URL + key + model) is supported.
- 100% offline core: editor, file system, terminal (proot/Alpine), LSP, themes — no account, no ads, no telemetry.

### Editor
- CodeMirror 6 core with 100+ language modes, LSP integration (TypeScript, Python, HTML/CSS/JSON, Tailwind and more), autocompletion, code folding, multi-selection and quick tools.
- Themes: One Dark, Dracula, GitHub Dark/Light, Nord, Ayu, Catppuccin, Gruvbox, Tokyo Night, Solarized, VS Code Dark and many more — all unlocked.

### Files & terminal
- Local storage, SD card, SFTP and FTP backends; multi-root workspaces.
- Real Linux terminal via proot (Alpine) and background executors.
- Local live-server preview (HTML/CSS/JS) and in-app console.

### Removed (compared to upstream base)
- Ad framework (AdMob), ad-reward system and consent flows.
- In-app purchases, PRO gating and paid locks.
- Account login and cloud auth.
- Remote plugin marketplace (server-dependent): install plugins from a local `.zip` file or a direct URL instead.
- Remote font downloads and promotion/sponsor feeds.

### Misc
- Multi-language UI (40+ locales).
- Backup & restore of settings and files, fully local.
