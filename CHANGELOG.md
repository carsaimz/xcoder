# Changelog / Registro de mudanças

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

All notable changes to **XCoder** are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

<a id="português"></a>

## 🇧🇷 Português

Todas as mudanças notáveis do **XCoder** ficam neste ficheiro. As entradas
históricas estão em pt-br; a partir da v1.6.2 cada release traz também um
resumo em inglês.

## [1.7.0] - 2026-09-11

### Adicionado — Sessões SSH v2 (roadmap v1.7.x item 3)

- **Identidade visual por host:** cada servidor salvo ganha uma cor
  estável derivada do próprio nome (determinística — o mesmo host
  aparece sempre com a mesma cor na lista de sessões SSH), com rótulo
  `user@host:porta` e o diretório inicial configurado visível na linha
  do servidor
- **Histórico de comandos por host:** os comandos digitados nos
  terminais SSH são gravados por servidor (cap 100, dedupe consecutivo,
  apenas no aparelho — nada vai para a rede); o diálogo lista do mais
  recente ao mais antigo, um toque copia o comando, e o botão limpa o
  histórico do host. Prompts de senha/frase-chave/código são detectados
  no buffer do terminal e NUNCA são gravados; Ctrl+C/D/U e ESC abandonam
  a linha em edição
- **Diretório inicial configurável:** ação nova em cada servidor grava
  o diretório onde o shell começa (vazio = padrão do servidor); o
  terminal respeita a precedência opção explícita > home configurado >
  caminho da URL > `/`; hosts apagados pelo navegador de arquivos são
  limpos automaticamente da lista
- Novo módulo puro `lib/sshSessions.js` (visual, histórico, home dir,
  resolução de diretório) + 16 testes

### Adicionado — Fontes v2 (roadmap v1.7.x item 4)

- **Preview ao vivo em cada linha** do gerenciador de fontes — cada
  fonte é renderizada nela mesma ("AaBbCc 123 — …" com pangrama
  traduzido) ANTES de aplicar; fontes remotas são pré-carregadas em
  background e cacheadas
- **Variação de peso no editor:** nova opção "Peso da fonte do editor"
  nas configurações (400 Normal → 900 Black) aplicada ao tema do
  CodeMirror com reconfiguração ao vivo; validação de peso no
  `fonts.setEditorFont` e default `editorFontWeight: 400`
- **Página de fontes internacionalizada** — 28 chaves novas (en +
  pt-br 100%), incluindo subtítulos, diálogos de aplicar/excluir e
  mensagens de erro

### Corrigido

- **Página de suporte normalizada:** o corpo da página não tinha as
  classes `main scroll` (o mesmo defeito latente que matava a página de
  perfil antes da v1.6.4 — `$page.body` voltava `null`) e o caminho de
  erro de abertura da conta usava `logger` SEM import (ReferenceError
  silenciosa no catch); código morto `maskAccount` removido
- **Aviso do proot "can't sanitize binding" eliminado na origem** (porte
  do upstream Acode #2878): o `init-sandbox.sh` testava os descritores
  via `/proc/self` DENTRO de command substitution — o readlink via o
  /dev/null do próprio filho em vez do stderr real do sandbox — e
  acabava sempre ligando o binding do fd de pipe; agora o probe usa o
  pid do shell (`$$`), compara o alvo cru do magic link (mesma semântica
  do realpath(3) do proot) e só liga stdin/stdout/stderr quando
  resolvem para caminho real

### Adicionado — repositório

- **Workflow `congrats-pr.yml`:** quando um PR da comunidade é mesclado
  (autor ≠ dono, sem bots), o bot deixa um obrigado bilíngue no PR —
  alternativa gratuita e sem dependências ao bot de Discord do upstream
  (#2855)
- **Atalho de teclado novo:** `Ctrl-Shift-W` abre a aba Welcome (porte
  do Acode #2773)

### Site (xcoder-web)

- **i18n final:** editor do blog admin traduzido (17 strings), tiers e
  textos do /sponsor cobertos em inglês, placeholders dinâmicos de chat
  e download convertidos para tokens (`{room}`, `{v}`), +47 traduções
  novas no dicionário EN

### Testes

- +22 testes (716 no total, 83 ficheiros): sshSessions (16) e fontsV2
  (6); baseline 716/716 verde, tsc limpo, biome limpo, build production
  OK, boot harness OK ("STARTED APP AND ITS SERVICES", todos os chunks
  carregados)

### EN summary

- **SSH sessions v2:** stable per-host colors, per-host command history
  (local-only, password-prompt safe, cap 100) and a configurable home
  directory per server (explicit option > stored home > URL path > /)
- **Fonts v2:** live preview of every font in the manager list, editor
  font weight (400–900) with live CodeMirror reconfigure, and a fully
  localized fonts page (28 new keys)
- **Fixed:** support page normalized (missing `main scroll` classes +
  missing `logger` import in error path); proot "can't sanitize
  binding" fd warnings fixed at the source (ported Acode #2878)
- **Repo:** congrats workflow for merged community PRs; Ctrl-Shift-W
  opens Welcome (Acode #2773)
- **Site:** last i18n gaps closed (admin blog editor, sponsor tiers,
  dynamic placeholders) — +47 EN translations
- Tests: 716/716 green (83 files)

## [1.6.4] - 2026-09-11

### Corrigido — conta (página de perfil)

- **"Entrar" e "Criar conta" voltaram a funcionar de verdade** — faltava
  o conserto central: o setter `body` do WCPage SUBSTITUI o contêiner
  interno `.main` da página pelo elemento atribuído, e o getter `body`
  só encontra elementos `.main`/`main` — o div da página de perfil não
  era nenhum dos dois, então `$page.body` voltava `null` depois da
  atribuição e cada toque em "Entrar"/"Criar conta" morria num
  `TypeError` silencioso (promise rejeitada sem tratamento). A sessão
  até chegava a ser criada no papel, mas a página nunca conseguia ler os
  campos — e ficava presa em "Convidado" para sempre. O corpo agora
  guarda a referência local `$body` (usada pelas 7 leituras do ficheiro)
  e carrega as classes padrão `main scroll`, mesmo padrão da página
  Sobre, restaurando também o dimensionamento/rolagem canônicos
- As versões 1.6.1/1.6.2 consertaram a validade da sessão
  (`ensureFreshSession`), a persistência do PAT e a ponte site → app —
  mas o clique morto permanecia; é por isso que o perfil continuava sem
  conta mesmo após o login

### EN summary

- **Sign-in buttons on the account page work again.** The WCPage `body`
  setter replaces the page's internal `.main` container with the
  assigned element, and the `body` getter only resolves elements
  matching `.main`/`main` — the profile div was neither, so `$page.body`
  returned null afterwards and every tap on "Entrar"/"Criar conta"
  died in a silent TypeError (async click handler, unhandled rejection).
  The page body now keeps a local `$body` reference (all 7 reads) and
  carries the standard `main scroll` classes (About-page pattern), which
  also restores the canonical sizing/scrolling. v1.6.1/v1.6.2 had fixed
  session freshness, PAT persistence and the site→app handoff — the dead
  click remained, which is why the profile still showed "Convidado".

## [1.6.3] - 2026-09-10

### Adicionado — Console REPL v2 + wiki bilíngue

- **Console REPL v2 (roadmap v1.7.x item 3)**: o console JS da barra
  lateral ganhou três superpoderes. **Histórico persistente** — os
  comandos executados sobrevivem ao reinício do app (localStorage com
  dedupe de repetições e cap de 50). **Snippets salvos** — dois botões
  novos na toolbar (salvar/listar): nomeie, carregue e exclua snippets
  direto do console. **Imports do workspace** — snippets podem importar
  módulos do projeto com `import {x} from "./lib/mod.js"` (bem como
  `import()` dinâmico e reexports): os arquivos relativos são resolvidos
  a partir da pasta do arquivo aberto, convertidos em Blob URLs e
  executados no sandbox — resolução transitiva com guardas de ciclo e
  cap de 64 módulos; módulos ausentes aparecem como erro no console
  ANTES de executar
- **Wiki 100% bilíngue**: as 16 páginas da wiki (14 de conteúdo +
  `_Sidebar` + `_Footer`) agora trazem secção 🇧🇷 + 🇺🇸 no mesmo
  ficheiro, no mesmo formato de README/ROADMAP/docs; `publish-wiki.mjs`
  extrai apenas a secção ativa na publicação (`WIKI_LANG=pt|en`, padrão
  pt) e o novo `wiki/checkWikiBilingual.mjs` valida a política no CI

### EN summary

- **JS Console v2**: persistent history, saved snippets and workspace
  imports (`./relative` specifiers are inlined as Blob URLs into the
  sandboxed worker, transitively, with cycle/cap guards).
- **Bilingual wiki**: all 16 wiki pages now carry 🇧🇷 + 🇺🇸 sections in a
  single file; `publish-wiki.mjs` extracts the active section when
  publishing (`WIKI_LANG=pt|en`) and CI enforces the policy.

### Testes

- +35 testes (652 → 687): histórico (dedupe/cap/corrupção), snippets
  (upsert/remove/cap), imports (cláusulas, rewriting de snippet e de
  módulo, resolução transitiva, ciclos, cap, especificadores externos) e
  guardas de wiring do app

## [1.6.2] - 2026-09-10

### Corrigido — GitHub que não aparecia + ícones + conta

- **PAT persistido de verdade (causa raiz de "conectei via PAT e os repos
  não aparecem")**: o kit de settings NÃO grava valores de prompt — só
  atualiza a linha e chama o callback; o comentário "the settings kit
  already persisted the prompt value" em `ghSettings.js` estava errado e o
  token colado era descartado em silêncio. Agora a página persiste
  `ghToken`/`gitRemoteUrl`/`ghBranch` explicitamente (`settings.update`),
  busca o perfil logo após salvar um token e encerra a sessão GitHub
  quando o token é limpo. Guardas em `v162Fixes.test.js`
- **Ícones das opções Fontes e Sessões SSH**: os nomes `svg:server` e
  `svg:type` não existiam no pack (`src/utils/svgIcons.js`) e o fallback
  (`icon svg:<nome>`) não corresponde a nenhum glifo da fonte de ícones —
  nada renderizava. Adicionados `server`, `type`, `copy`, `trash-2`,
  `check` e `qr-code` (Lucide) + regenerados os vetores de
  `src/res/icons/svg/` (61). `dialogs/select.js` agora também desenha
  ícones `svg:` como vetores — picker de repositórios, chooser de login e
  ações de commit incluídos; ícones do chooser corrigidos
  (`external-link`, `qr-code`)
- **Página de conta: fim do "Convidado eterno"**: novo botão "Continuar
  com a conta do site" (abre `/auth/app-handoff`, que entrega a sessão já
  existente do site para o app via `xcoder://auth/oauth`); a página
  re-renderiza no evento `authchange` (sessão chegando pelo intent);
  sessão expirada é renovada em background (`ensureFreshSession`);
  **erros de login aparecem dentro do formulário** (`data-form-error`) —
  falhas nunca mais parecem "o botão não faz nada"

### Adicionado

- **Settings reagrupadas por categoria**: Core → Aparência (Tema, Fontes)
  → Código e ferramentas (Formatter, LSP, IA, Plugins, marketplace URL) →
  Conexões (GitHub, Sessões SSH) → Dados e backup → Sobre o XCoder; novas
  strings `settings-category-*` (en + pt-br)
- **Site: `/auth/app-handoff`** (xcoder-web) — ponte de sessão
  site → app: usuário logado no site tem a sessão entregue ao app
  automaticamente; sem sessão, mostra o formulário compartilhado e entrega
  após o login
- **Workflow `pr-review.yml`** (app + site): bot de review GRATUITO do
  próprio repo — comentário fixo bilíngue no PR com resumo do diff por
  área, sugestões por regras (src sem testes, package.json sem lockfile,
  docs sem nota bilíngue) e checklist do revisor (substitui reviewers
  pagos tipo Greptile; comentário único atualizado a cada push)
- Actions atualizadas: checkout v7, setup-node v7, setup-java v6,
  github-script v9, create-pull-request v8, stale v11

### Documentação

- **MDs bilíngues**: README (fundido com README.en.md, apagado),
  CONTRIBUTING, CODE_OF_CONDUCT (texto canônico do Contributor Covenant
  restaurado nas seções corrompidas), ROADMAP, docs/{ADS,ICONS,README,
  github-oauth-app} — secção 🇧🇷 + 🇺🇸 no mesmo ficheiro, com âncoras;
  wiki/README.md documenta a política (páginas da wiki seguem pt por ora —
  conversão no roadmap v1.7.x); `_typos.toml` exclui os MDs bilíngues

### Testes

- +8 testes (640 → 652): varredura de completude do pack de ícones, render
  `svg:` no select, guardas de persistência do PAT, wiring do handoff e
  ordem das categorias

<a id="english"></a>

## 🇺🇸 English

Every notable change to **XCoder** is documented here. Historical entries
are written in Brazilian Portuguese; from v1.6.2 onward each release also
carries a short English summary right below the Portuguese one.


## [1.6.1] - 2026-09-10

### Added — GitHub App web flow (um toque no navegador)

- **"Conectar com GitHub (navegador)"** como primeira opção do chooser
  (`src/lib/ghWebFlow.js`): o app abre o navegador em
  `github.com/login/oauth/authorize`, o site oficial troca o código pelo
  token NO SERVIDOR (o client secret vive só na env da Vercel — nunca no
  app/repo público) e devolve a sessão por `xcoder://github/session#…`;
  o app valida o `state` anti-CSRF, salva a sessão e atualiza o card da
  conta na hora (via `settings.on`, já reativo). Device Flow e PAT
  seguem disponíveis como alternativas
- Handler de retorno `xcoder://github/session` registrado no boot
  (`registerGhIntentHandler`), com tolerância a falha do perfil
  (fallback nos parâmetros `login`/`avatar` anexados pelo callback)

### Fixed — conta conectada ainda invisível em alguns casos

- O `refresh()` do app lateral de git fazia **early-return quando o
  status do repositório local falhava** e o cartão de conta nunca
  renderizava — agora a conta e os comandos GitHub renderizam
  independentes do estado do git local
- **Login da conta do app à prova de webview**: o cliente Supabase do
  app (`src/lib/supabase.js`) ganhou camada HTTP nativa
  (cordova-plugin-advanced-http, sem CORS) para TODAS as requisições
  (entrar, criar conta, perfil, refresh, settings) — o login e-mail +
  senha na página de conta funciona mesmo quando o `fetch` do webview
  falha, com as mensagens de erro reais do servidor

### Site (xcoder-web)

- **`/api/github/callback`**: troca code→token server-side
  (`GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`), página de
  fallback com "copiar link de retorno" e retorno automático por
  `xcoder://github/session`
- **`/api/github/webhook`**: receiver com validação HMAC
  (`X-Hub-Signature-256`), `ping`→`pong` e registro dos eventos
- O formulário de conta nunca mais falha em silêncio — backend não
  configurado e erros comuns do Supabase agora mostram mensagens pt-br
- Guia `docs/github-oauth-app.md` atualizado: web flow, envs da Vercel,
  webhook URL + secret, bot user `<slug>[bot]`, rotação do secret

### Tests
- +10 testes (630 → 640): web flow (disponibilidade, authorize URL sem
  `scope`, anti-CSRF, salvamento de sessão) e política do sign-in
  (ordem web → device, secret ausente do código-fonte, handler no boot,
  conta renderiza mesmo sem git local)

## [1.6.0] - 2026-09-10

### Roadmap v1.6.x — concluído

- **Sessões SSH** (item 1): nova página de configurações lista os
  servidores SFTP salvos e abre o terminal SSH com um toque; credenciais
  permanecem no perfil nativo SFTP (nada sensível nas configurações) e o
  botão "Nova conexão SFTP" abre o navegador de arquivos no menu certo
- **Console JS** (item 2): novo app da sidebar — REPL real num Web Worker
  em sandbox (sem DOM, sem Cordova): valor da última expressão, console
  capturado (log/warn/error), histórico ↑/↓, Ctrl+Enter executa, saída
  limitada a 200 linhas; worker novo `build/replWorker.js` (rspack +
  webpack)
- **Gerenciador de fontes** (item 3): instale fontes por URL
  (.ttf/.otf/.woff2 — baixadas para `DATA/fonts` e cacheadas), aplique ao
  **editor** e à **interface** separadamente, veja e remova as instaladas;
  usa a infra `lib/fonts.js` que já existia (a UI era a peça faltante)
- **Onboarding do terminal** (item 4): na primeira abertura de terminal,
  um diálogo explica Alpine × FailSafe e oferece "Reinstalar ambiente";
  mostrado uma vez (flag `terminalOnboardingDone` nas configurações)

### Fixed
- **Device Flow salvava sessão VAZIA** (o relato "conectou o GitHub mas o
  app não mostra a conta nem lista repositórios"): o resultado de
  `pollForToken()` era destruturado como `{token, user}` quando na verdade
  é a string do token — o app gravava `ghToken` vazio e o card da conta
  voltava para "Entrar"; agora o token é consumido como string, o perfil
  é buscado em separado (falha tolerada) e `saveGhSession()` rejeita
  sessões sem token
- **Perfil via plugin nativo** (CORS-free) com `fetch` como fallback —
  mesma estratégia do `ghGet` das configurações
- **Card da conta na sidebar Git atualiza na hora** quando a sessão muda
  (entrar/sair pelas configurações reflete imediatamente)
- Site: **página da conta persistia deslogada** — o gate e o header
  re-leem a sessão ao voltar de aba congelada (visibilitychange/pageshow);
  o formulário inline do gate força re-leitura ao entrar; `/auth/callback`
  não troca o código PKCE duas vezes (o segundo exchange falhava com
  "Falha na autenticação" mesmo com sessão válida)

### Tests
- +19 testes (611 → 630): regressão do Device Flow (fluxo completo com
  fetch simulado, sessão salva com token+perfil), runtime do REPL
  (valor da última expressão, console, erros, serialização) e guards de
  wiring das 4 features

## [1.5.4] - 2026-09-07

### GitHub App oficial
- **Chaves oficiais integradas**: o Client ID do GitHub App do mantenedor
  (`Ov23li…`) agora vem embutido no app (`config.GH_OAUTH_CLIENT_ID`) —
  "Entrar com um código" (Device Flow) sai de fábrica, sem PAT e sem
  criação de clientes próprios
- **Device Flow entende GitHub Apps**: client ids `Ov23li…`/`Iv1.` não
  enviam o parâmetro `scope` (as permissões do token do usuário vêm das
  configurações do app no GitHub); OAuth Apps clássicos continuam
  enviando os escopos de sempre
- Guia `docs/github-oauth-app.md` atualizado com o app real: ativar
  **Enable Device Flow**, permissões recomendadas (Contents/Pull
  requests/Workflows: read & write), papel do **client secret** (guardado
  pelo mantenedor, fora do repo — o Device Flow não usa), **webhook**
  (pode ficar Inactive) e **bot user id** (automático, `<slug>[bot]`)

### Model picker com logos (roadmap v1.6.x item 5)
- **Novo seletor de modelos próprio** (o select nativo era texto-only):
  lista com **logo real de cada marca**, badge **grátis/pago**, o modelo
  atual marcado com ✓ e **busca instantânea** — digite para filtrar;
  grupos sem resultados desaparecem
- A busca ao vivo (⟳) também usa o novo picker: os modelos vindos da API
  do provedor (até 300) agora são filtráveis por texto
- Os atalhos "Buscar modelos disponíveis" e "Digitar id manualmente"
  viraram ações do rodapé; provedores sem chave continuam visíveis mas
  desabilitados (nunca dá erro de endpoint por escolha inválida)
- Novo componente `components/modelPicker` no padrão dos dialogs
  (actionStack/máscara/tema) com helpers puros testáveis

### Tests
- +18 testes (device flow sem `scope` para GitHub Apps, filtro e logos
  do picker, wiring do chat, placeholders de tradução) — 611 no total

## [1.5.3] - 2026-09-07

### Changed
- **Botões ← e → removidos do header do editor** — a navegação por
  histórico de abas continua pelos atalhos Alt-←/Alt-→ e pelos comandos
  na paleta; o histórico persistente entre sessões não foi afetado

### Fixed
- **Suportes de IA (texto, imagem, vídeo, agentes) agora ficam em linha
  PRÓPRIA, por baixo do modelo** — complementa o rework da faixa da
  v1.5.2: o nome do modelo (e o logo) ficam na linha de cima; as pílulas
  de suporte descem para a linha de baixo, que rola lateralmente quando
  falta espaço — nada é mais escondido nem ao lado nem embaixo

### GitHub — sem "clientes próprios" (sign-in refeito)
- **Ninguém precisa mais criar OAuth App próprio**: a tela do GitHub
  (configurações + app lateral de git) passa a oferecer **PAT primeiro**
  (token de acesso pessoal, validado contra o perfil) e o **Device Flow
  oficial** com o client id embutido no app (`config.GH_OAUTH_CLIENT_ID`
  em `src/lib/config.js` — vazio até as chaves oficiais serem entregues;
  instalações legadas com client id salvo continuam funcionando)
- Fluxo compartilhado extraído para `src/lib/ghSignIn.js` (escolha do
  método → PAT ou device flow → sessão salva); a linha "OAuth App client
  id" saiu da página de configurações
- **Novo guia `docs/github-oauth-app.md`** (pt-br): passo a passo do
  OAuth App oficial, onde entra o client id e explicação de por que
  **webhook** e **bot user id** não se aplicam ao fluxo atual (e quando
  aplicariam)

### Fixed — modelos
- **Busca de modelos sem o prefixo "models/"**: catálogos do Google
  reportam ids como `models/gemini-2.5-flash`; o app normaliza para
  `gemini-2.5-flash` na listagem (`listModels`) e na leitura de modelos
  salvos (`resolveModel`). Ids que apenas CONTÊM `models/` no meio
  (ex.: Fireworks `accounts/fireworks/models/...`) e namespacing de
  vendor (ex.: OpenRouter `google/gemini-2.5-pro`) permanecem intactos

### CI
- **Dependabot**: bumps de `github-actions` agrupados num único PR
  (menos inundação) + nota de que FECHAR um PR do Dependabot suprime
  aquela atualização até a versão-alvo mudar (motivo do silêncio desde
  31/08 — merge em vez de fechar, ou deixe o auto-merge agir)

### Tests
- +12 testes (581 → 593): `aiModelId` (normalização de ids — unidade,
  listModels com fetch stub e guards) e `ghSignInPolicy` (sem clientes
  próprios no código, PAT antes do device flow, client id oficial
  embutido, ambos os pontos de entrada no fluxo compartilhado);
  `tabHistoryNav` atualizado para garantir que os botões NÃO voltam ao
  header e que os comandos continuam registrados
- i18n: chaves novas pt-br/en-us para o seletor de método, prompt de PAT
  e aviso de client id ausente; chaves mortas removidas; pt-br 100%

## [1.5.2] - 2026-09-07

### Changed — chat de IA
- **Faixa do chat invertida e melhorada**: o NOME DO MODELO vem primeiro
  (negrito, cor primária) e o logo do provedor vem depois; a faixa rola
  na horizontal (sem barra visível) quando o nome é longo — as pílulas
  de suporte (texto/imagem/vídeo/agentes) nunca mais ficam escondidas
- **Logos reais dos provedores** (16 marcas): OpenAI, Google Gemini,
  Anthropic, DuckDuckGo, Hugging Face, Cloudflare, NVIDIA, Perplexity,
  OpenRouter, GitHub Models, Mistral, DeepSeek, Z.ai, Groq, Azure OpenAI
  (multicoloridos preservados) — na faixa do chat e nos cartões da página
  de Provedores; marcas monocromáticas seguem a cor do tema

### Fixed — compositor e chat
- **Pílulas "Pensar" e "Buscar" agora desligam de verdade**: as chaves
  `aiShowThinking`/`aiWebTools` não existiam nos defaults do settings e
  `settings.update()` descartava silenciosamente chaves desconhecidas —
  o estado voltava a "ativo" e o agente ignorava o toggle; o checkbox
  "Busca na web" da página de IA também não tinha handler e agora persiste
- **Copiar mensagem volta a funcionar** (falhava sobretudo em mensagens
  da IA): nova cascata `writeClipboard` — plugin nativo cordova-clipboard →
  Clipboard API → fallback `execCommand` com textarea oculta (a Clipboard
  API do WebView rejeita com NotAllowedError em vários aparelhos)

### Fixed — editor
- Botões ←/→ do histórico de abas: continuam visíveis quando "mortos"
  (esmaecidos em vez de `disabled` com `pointer-events:none`) e um toque
  neles mostra toast "Sem mais abas atrás/adiante no histórico" — os
  atalhos Alt-←/Alt-→ também dão feedback

### Changed — erros de IA/provedores traduzidos
- `explainError` + `friendlyError` agora passam por `window.strings` com
  placeholders `{name}`/`{model}`/`{provider}`/`{status}` interpolados
  (antes o utilizador via "{name}" literal em strings pt e texto cru em
  inglês nos casos sem tradução)
- Novas branches localizadas: rede sem conexão, pedido cancelado, erro
  genérico do provedor, "No API key configured", máximo de passos, erros
  de ferramentas/subagentes e o diálogo de permissão do agente
- `PROVIDER_NAMES` completo (16 provedores faltantes; "gemini" → "google")
- Toast de modelos usa `explainError` (erros HTTP explicados em pt)

### Fixed — terminal (Alpine de volta sem desinstalar)
- **Auto-cura do modo FailSafe**: o servidor AXS guarda um marcador de
  modo (`axs-mode`); se estiver a correr em modo diferente do ajuste atual
  (ex.: shell Android de uma sessão antiga com FailSafe ligado), o terminal
  reinicia-o — o Alpine proot volta sem "Uninstall"
- Banner no terminal quando o modo FailSafe está ativo, explicando porquê
  e como desligar
- Extração do rootfs verificada (`bin/busybox`): falha do `tar` não mente
  mais com marcador `.extracted` saudável — o erro manda reinstalar

### Added
- **Guia de indentação ativa** (roadmap v1.5.x item 2, opt-in em
  Configurações › Editor › Guias): destaca as guias do bloco que contém a
  linha atual, estilo VSCode — varredura limitada de ancestrais, linhas
  em branco resolvidas, indentações desalinhadas ignoradas
- **Anúncio automático de release** (item 4): workflow `release-announce`
  publica o anúncio no fórum do site quando uma release estável sai
  (`/api/announcements/release` no site, segredo partilhado + conta bot,
  idempotente por versão; pre-releases não anunciam)

### Tests
- +29 testes (553 → 582): `v152QuickFixes` (21 — faixa, logos, clipboard,
  toggles, botões do histórico, erros localizados, cura do terminal) e
  `activeIndentGuide` (8 — algoritmo puro de blocos ancestrais)
- Validado com o harness de boot em bundle de produção (10/10 apps)

### Site (xcoder-web)
- **Perfil com sessão corrigido**: `useDashUser` subscreve
  `onAuthStateChange` — entrar pela própria página /user (ou noutro separa-
  dor) agora atualiza o gate; logout também limpa
- **Site 100% bilíngue na última milha** (item 1): /user/*, submissão de
  plugins, tópico do fórum, corpo dos posts do blog e das docs (variantes
  EN em content/{docs,blog}/en/, troca no cliente com SSG)

## [1.5.1] - 2026-09-07

### Fixed
- **Boot crash "Sidebar is not defined" — o app inteiro morria ao iniciar**
  (v1.4.19 → v1.5.0). Causa raiz: `src/sidebarApps/ai/index.js` usava
  `Sidebar.on("show", ...)` no `initApp` SEM o import top-level de
  `components/sidebar`; o identificador livre só explodia em RUNTIME, quando
  `loadApps()` registrava o 4º app (ai) — tsc não pega (checkJs:false) e o
  biome não tem regra de variável não-declarada. A rejeição abortava TODA a
  cadeia depois de `await sidebarApps.loadApps()` no main.js: apps git/
  website/notificações/conta/configurações/sobre nunca registravam (sidebar
  só com pasta+busca+plugins), `editorManager.onupdate` ficava sem ligar
  (header sem lápis/terminal/paleta/arquivos abertos), quicktools invisíveis,
  terminal morto, pastas/arquivos nunca restaurados e sem aba de boas-vindas
- **Blindagem do boot**: `loadApps()` agora isola o registro de cada app
  (try/catch por app) — um app quebrado é logado + toast e o boot continua;
  nunca mais um único módulo ruim congela o editor inteiro
- **Guard no `themes.apply()`**: tema salvo que pertence a plugin ainda não
  registrado (ou desinstalado) não gera mais rejeição flutuante
  "reading 'primaryColor'" a cada boot; `add()` reaplica quando registrar

### Tests
- +12 testes (541 → 553): `sidebarAppImports` — varredura source-level que
  garante que TODO uso do identificador livre `Sidebar` tem import válido
  (top-level ou local antes do uso), avaliação ao vivo dos 10 descritores de
  apps do sidebar e guard estrutural do try/catch por app no `loadApps()`
- Validado end-to-end com harness de boot (bundle de produção em DOM
  simulado com cordova/memfs stubados): 10/10 apps registrados, aba de
  boas-vindas aberta, "Started app and its services" no log


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
