# Changelog

All notable changes to **XCoder** are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

## [1.4.8] - 2026-09-02

### Added
- Native Firebase wired, icon pack tier 3, changelog fix


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
