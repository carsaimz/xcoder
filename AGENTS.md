# XCoder

XCoder (`com.carsaimz.xcoder`, fork do Acode, MIT) — editor offline-first para Android (Cordova) + IDE web + app desktop Electron. CodeMirror 6, terminal Alpine via proot, LSP, agente IA em `src/lib/ai/`. `package.json` é a fonte da versão (`1.8.21`); `config.xml` sincroniza via `utils/config.js`.

> Todos os comandos a partir da raiz do repo (pasta com `package.json`). Node 18+ (CI usa 20), Java 17, Android SDK API 36, Gradle 8.x.

## Comandos (ordem do CI)

```bash
npm ci --legacy-peer-deps   # CI canónico; CONTRIBUTING documenta o npm como gestor canónico
npm run setup               # deps + cordova platform add android + plugins de src/plugins
npm run check               # Biome check --write (lint+format) — rodar antes de commit
npm run typecheck           # tsc --noEmit
npm test                    # vitest run
node utils/check-plugin-refs.js    # valida plugin.xml vs package.json
npm run lang:check          # cobre traduções + node wiki/checkWikiBilingual.mjs no CI
```

- Teste único: `npx vitest run tests/unit/<ficheiro>.test.js` ou `npx vitest run -t "nome"`.
- `npm run typecheck:checkjs` — ratchet progressivo de `checkJs` sobre JS puro (hoje 5 folhas em `src/lib/ai/`: actionPrompt, modelId, pkg, providerLogos, slashCommands). Para adicionar um ficheiro: `node scripts/checkjs_add_file.mjs <ficheiro>` mede os erros do closure inteiro — arruma o JSDoc antes de adicioná-lo a `tsconfig.checkjs.json`; ficheiros de fanout largo (markdown.js, agent.js) puxam ~11k erros da árvore toda.
- `npm run dev` — `utils/scripts/dev.js`: servidor HTTPS (cert auto-assinado, fallback HTTP sem `openssl`) + `rspack --watch` + `cordova run android` + watcher de `src/plugins/` + reload via WebSocket.
- Web bundle sem Android: `npx rspack --mode development` (sempre com `node utils/config.js p|d` antes — ver "efeitos laterais").
- APK debug: `npm run build` / `npm run build d` → `platforms/android/app/build/outputs/apk/debug/app-debug.apk`. Release: `npm run build p` (APK) / `npm run build p bundle` (AAB). `utils/scripts/build.sh` = `config.js` + `rspack` + `cordova build`.
- Desktop: `node utils/config.js p && npx rspack --mode production`, depois `cd desktop && npm install && node copy-vendor.cjs && npx electron-builder --win nsis portable` (ou `--linux AppImage deb`).
- Traduções: `npm run lang add|remove|search|update` (`utils/lang.js`), base `src/lang/en-us.json`.

CI (`.github/workflows/ci.yml`): `ci --legacy-peer-deps -> biome check -> typecheck -> test -> check-plugin-refs -> lang:check -> wiki bilingual -> typos -> build prod`. O Biome no CI é **blocking** (o `|| true` foi removido) — drift de formatação quebra o CI: roda `npm run check` antes de commitar.

## Arquitetura (só o que não é óbvio)

- **Entrypoint real:** `www/index.html` carrega `cordova.js` + `./build/boot.js` (`src/boot.js`). `boot.js` nunca importa `main.js` — faz load dinâmico de `build/main.js/main.css` (de `src/main.js`) e, com `DEV_MODE`, busca-os do dev server com `WebSocket` reload. Entradas Rspack (`rspack.config.js`): `boot`, `main`, `console`, `consoleWorker`, `searchInFilesWorker`, `searchIndexWorker`, workers LSP (`src/cm/lsp/workers/*.ts`), `replWorker`. Saída: `www/build/`.
- **Boot app:** `src/main.js` no evento `deviceready` cria `window.editorManager`, `window.xcoder`, `window.sidebar`, expõe `strings`, carrega plugins e restaura pastas/abas. Não importes a fábrica `lib/editorManager` esperando uma instância — usa `window.editorManager`.
- **Imports bare `src/`:** `rspack resolve.modules: ["node_modules", "src"]` + `tsconfig/jsconfig paths {"*": ["./src/*"]}`. Escreve `import x from "lib/settings"`, não `"./src/..."`. Vitest espelha isto.
- **JSX-like:** JSX de `html-tag-js` dentro de `.js/.ts` (ex: `<span .../>`) processado por `utils/custom-loaders/html-tag-jsx-loader.js` antes do SWC. Não é React — sem JSX runtime, sem TSX real; `tsx: false` no SWC.
- **Cordova nativo (vendored):** `src/plugins/*` (terminal, proot, server, sftp/ftp, sdcard, websocket...) instalados por `utils/setup.js` via `cordova plugin add ./src/plugins/<dir>` (`file:` no `package.json`). `config.xml` tem hooks `before_prepare/after_prepare` (`hooks/restore-cordova-resources.js`, `modify-java-files.js`, `post-process.js`) que fazem patch em `platforms/android` gerado — não edites `platforms/` à mão.
- **AI:** `src/lib/ai/agent.js|client.js|providers.js|tools.js|terminalTool.js|vshell.js|...`. Janela 24 mensagens, outputs clampados — não reenvies histórico completo em nenhum novo loop.
- **Desktop (`desktop/`):** `desktop/package.json` (`xcoder-desktop`, Electron, `private`, sem scripts de teste — `main.cjs|preload.cjs|services.cjs` = shim Cordova: `file/sdcard/system/Executor` → Node/Electron). Terminal usa a shell real (bash/PowerShell), não Alpine/proot. `utils/config.js` sincroniza a versão com a raiz (não edites à mão).

## Armadilhas

- **Não assuma fontes:** `.prettierrc`/`prettier` existem mas o canónico é **Rspack + Biome** (2.5.11, `indentStyle: "tab"`); `webpack.config.js` foi removido (rspack é a única fonte). Biome só cobre `src/**/*.js`, `utils/**/*.js`, `src/lang/**/*.json` — exclui `src/plugins/**`, `www/`, `platforms/`, `hooks/`, `fastlane/`. One-offs de versões passadas vivem em `scripts/archive/` — não os corra nem estenda.
- **`utils/config.js` tem efeitos laterais em ficheiros versionados:** escreve `.babelrc` (`compact` = só em `p`), `res/android/values/ic_launcher_background.xml`, copia `src/res/libs` → `www/res/libs`, sincroniza `version` em `config.xml` com `package.json`. É por isso que o `build.sh` corre-o primeiro; não o saltes.
- **`package.json` é a fonte da versão, não o `config.xml`.**
- **`tsconfig` tem `checkJs: false` + `allowJs: true`** — o `typecheck` só valida TS de verdade (workers LSP); não ligues `checkJs` sem atualizar JSDoc no codebase inteiro.
- **Testes:** Vitest só recolhe `tests/**/*.test.{js,ts}` com `happy-dom` + `tests/setup.js` (shim de `localStorage` — Node ≥22 esconde o storage nativo atrás de `--localstorage-file` e o happy-dom só regista `sessionStorage` no `about:blank`; sem o shim, qualquer módulo que leia `localStorage` no import quebra em Windows/Node novos) + o mesmo JSX transform do Rspack. `testTimeout`/`hookTimeout` = 15s. `terminalCli.test.js` resolve o bash do Git for Windows (skip se não houver) e, em Windows, as asserções de path saído do bash comparam via `bashAbsPath(...)` (msys relata `/tmp/...`). `src/test/` é o harness on-device (WebView) — nunca o corras no Vitest. Single test: `npx vitest run tests/unit/x.test.js`.
- **Traduções:** `en-us.json` é a chave primária; `lib/lang` faz merge de `en-us` por baixo do locale escolhido (fallback inglês, não português hardcoded). Locale novo = JSON em `src/lang/` + registo em `src/lib/lang.js` + `npm run lang:check` verde. Não edites `src/lang/index.d.ts` à mão (gerado).
- **Ícones:** fonte IcoMoon (`svg:` prefix, `utils/code-editor-icon.icomoon.json` → `src/res/icons/icons.ttf`). Ícones específicos de plugin **não** entram na fonte do editor.
- **Segurança/privacidade:** sem telemetria; login só no site via deep link `xcoder://` (auth/GitHub), nunca credenciais no app. `google-services.json` está no repo — não adiciones segredos novos sem pensar.
- **Comentários `<!-- -- -->` em XML:** `--` dentro de comentário XML quebra o parser expat do Cordova (`No platforms added`) — escrever por extenso.
- **`package-lock.json` vs `desktop/package-lock.json`:** são subprojetos separados; `npm audit`/bump no root não cobre o desktop.
- **Binários grandes no repo:** assets do proot (`.so`/Alpine por arquitectura — ~20 MB no total), fontes em `src/res/fonts/`, `utils/code-editor-icon.icomoon.json` (946 KB). Não os delete; se o tamanho do repo incomodar (clone fresco lento), considerar Git LFS — exige migração de histórico, não fazer às pressas.
- **Churn fantasma de line endings:** `core.autocrlf=true` no Windows + Biome gravando LF: depois de `npm run check` muitos ficheiros mudam só o EOL — no commit vira no-op (o git normaliza para LF). Commitar só o diff real.

