# Roadmap do XCoder / XCoder Roadmap

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

> Onde o XCoder está indo — nos dois idiomas, no mesmo ficheiro.
> Where XCoder is heading — both languages, same file.

---

<a id="português"></a>

## 🇧🇷 Português

> Tudo aqui é **gratuito** — o Premium continua limitado a remover anúncios
> e ampliar os limites de IA. Itens marcados com 💡 vêm da comparação
> contínua com o upstream [Acode](https://github.com/Acode-Foundation/Acode)
> (CHANGELOG lido por completo até a v1.13.5).

## ✅ Concluído até a v1.7.3

- **v1.7.3 — API oficial de fileIcons + pacotes de ícones (Acode #2887
  portado):** os ícones de ficheiros e pastas agora passam por uma API
  pública estável (`acode.require("fileIcons")` com `register`, `icon`
  e `onChange`) — o mesmo sistema de temas estilo VS Code/Zed do
  upstream, quase 1:1. O pacote embutido continua o padrão e mantém as
  classes `file_type_*` existentes; plugins podem registar os próprios
  pacotes (SVG por URL/pasta ou classes), com propriedade ligada ao
  script do plugin e des-registo automático em falha de load ou
  desinstalação. Nova opção "Pacote de ícones" em Configurações do app
  → Interface, com lista viva dos temas disponíveis; ícones de pastas
  agora refletem aberto/fechado e a raiz tem ícone próprio; ícones
  renderizados são atualizados ao trocar de tema (árvore de ficheiros,
  listas, abas do editor, pesquisa e painel de referências); +56
  testes dos 5 ficheiros de teste do upstream (795 no total)
- **v1.7.2 — quebra de linha suave com indentação (Acode #2886 +
  #2880):** linhas quebradas continuam na indentação da linha original
  (ou +1/+2 níveis, configurável) em vez de voltar à margem;
  oportunidades de quebra em pontuação estilo VS Code (fecha
  `)`/`]` juntos, quebra antes de aberturas, inclusive CJK); nova
  opção "Indentação da quebra de linha" em Configurações do editor →
  Texto e layout (Nenhuma / Mesma indentação / Indentar (+1 nível) /
  Indentação profunda (+2 níveis)), reconfigura ao vivo; +6 testes
  (739 no total)
- **v1.7.1 — conta à prova de falha + repositórios onde são usados:**
  - **Perfil corrigido de vez:** a renovação de token em voo podia
    ressuscitar a sessão recém-apagada pelo "Terminar sessão" (guarda
    de época em `lib/supabase.js`); o botão voltar do hardware lançava
    erro nas páginas de perfil e suporte (chave `action` do
    actionStack); confirmação descartada pelo voltar agora resolve
    como cancelado; logout à prova de falha de rede
  - **"Meus repositórios" movido da página GitHub** para onde os
    repositórios são usados: cartão "Repositório GitHub" no Git
    (sidebar) com o repositório ativo + seletor, e o chat de IA ganhou
    o contexto do repositório ativo com as ferramentas
    `github_read`/`github_write` (árvore, conteúdo com sha, Contents
    API, issues — escrita sempre com aprovação; token nunca sai do
    aparelho)
  - **Acode #2851 portado:** chamadas de plugin muito cedo durante o
    boot do Cordova não falham mais (fallback
    `cordova.require("cordova/exec")`)
  - +18 testes (733 em 87 ficheiros)

- **v1.7.0 — Sessões SSH v2 + Fontes v2 (v1.7.x itens 3 e 4):**
  - **SSH v2:** cor estável por host (derivada do nome, determinística),
    histórico de comandos por servidor (local, cap 100, prompts de
    senha/fase-chave nunca gravados, Ctrl+C/D/U abandonam a linha) e
    diretório inicial configurável por servidor (precedência: opção
    explícita > home salvo > caminho da URL > `/`); hosts apagados são
    limpos automaticamente
  - **Fontes v2:** preview ao vivo de cada fonte na própria lista
    (pangrama traduzido, pré-carregamento em background), peso da fonte
    do editor 400–900 com reconfiguração ao vivo do CodeMirror e página
    de fontes 100% internacionalizada (+28 chaves)
  - **Suporte normalizado:** classes `main scroll` no corpo (mesmo
    defeito latente do perfil v1.6.4) + import `logger` faltante no
    caminho de erro
  - **proot fd fix (Acode #2878):** o probe do `init-sandbox.sh` passou a
    usar o pid do shell e a semântica do realpath(3) — sem mais avisos
    "can't sanitize binding /proc/self/fd/N"
  - **Repo:** `congrats-pr.yml` agradece PRs da comunidade mesclados
    (grátis, sem Discord); `Ctrl-Shift-W` abre o Welcome (Acode #2773)
  - **Site:** últimas lacunas de i18n fechadas (editor do blog admin,
    tiers do /sponsor, placeholders dinâmicos) — +47 traduções EN
  - +22 testes (716 no total)
- **v1.6.4 — conserto definitivo da conta:** "Entrar"/"Criar conta" da
  página de perfil estavam mortos desde sempre — o getter `body` do
  WCPage devolve `null` após o setter substituir o `.main` interno
  (o div do perfil não tinha a classe `main`), e as leituras dos campos
  explodiam num TypeError silencioso; corpo agora mantém referência
  local `$body` + classes padrão `main scroll` (padrão Sobre). Fecha o
  ciclo iniciado em 1.6.1/1.6.2 (sessão válida, PAT persistido, ponte
  site → app); +7 testes de regressão com renderização real (694 no
  total)
- **v1.6.3 — Console REPL v2 + wiki bilíngue:**
  - **Console REPL v2 (v1.7.x item 3):** histórico persistente entre
    sessões (localStorage, dedupe, cap 50), snippets salvos com nome
    (salvar/listar/excluir na toolbar) e **imports do workspace** —
    `import {x} from "./lib/mod.js"` resolve arquivos relativos à pasta
    do arquivo aberto, empacota como Blob URLs e roda no sandbox
    (transitivo, com guardas de ciclo e cap de 64 módulos)
  - **Wiki bilíngue:** as 16 páginas (14 conteúdo + `_Sidebar` +
    `_Footer`) trazem secções 🇧🇷 + 🇺🇸 num único ficheiro;
    `publish-wiki.mjs` extrai a secção ativa (`WIKI_LANG=pt|en`) e o
    checker `wiki/checkWikiBilingual.mjs` entrou no CI
  - +35 testes (652 → 687)
- **v1.6.2 — PAT de verdade, ícones e conta unificada:**
  - **PAT persistido de verdade (fix crítico):** o kit de settings não
    grava valores de prompt — o PAT colado era descartado em silêncio
    ("conectei via PAT e os repos não aparecem"); agora ghSettings
    persiste `ghToken`/`gitRemoteUrl`/`ghBranch` e busca o perfil na
    hora; limpar o token encerra a sessão GitHub
  - **Ícones Fontes/Sessões SSH:** `svg:server`, `svg:type` (e `copy`,
    `trash-2`, `check`, `qr-code`) adicionados ao pack — o fallback
    anterior (`icon svg:nome`) não existe na fonte de ícones e renderizava
    nada; `select` agora também desenha ícones `svg:` como vetores
    (picker de repos, chooser de login, ações de commit)
  - **Conta unificada site ↔ app:** botão "Continuar com a conta do site"
    (nova rota `/auth/app-handoff` no site entrega a sessão já existente
    para o app via `xcoder://auth/oauth`); página de conta re-renderiza
    em `authchange`; sessão expirada é renovada em background;
    erros de login aparecem DENTRO do formulário (nunca mais "não faz nada")
  - **Settings reagrupadas:** Core → Aparência → Código e ferramentas →
    Conexões → Dados e backup → Sobre (novas strings pt/en)
  - **Bot de review em PRs (grátis):** workflow `pr-review.yml` comenta
    no PR com resumo bilíngue por área, sugestões por regras e checklist
    (substitui reviewers pagos tipo Greptile por algo nosso)
  - Actions atualizadas (checkout v7, setup-node v7, github-script v9,
    create-pull-request v8, stale v11); +8 testes (640 → 652)
- **v1.6.1 — GitHub App web flow de um toque + conta à prova de
  webview:** "Conectar com GitHub (navegador)" como 1ª opção (site troca
  o código pelo token no servidor, retorno `xcoder://github/session`
  com validação anti-CSRF); card da conta do sidebar git renderiza
  mesmo quando o status do git local falha; cliente Supabase do app com
  camada HTTP nativa (login e-mail/senha à prova de CORS); site publicou
  `/api/github/callback` + `/api/github/webhook` (HMAC) e o formulário
  de conta não falha mais em silêncio
- **v1.6.0 — roadmap v1.6.x completo + fix do sign-in GitHub:**
  - **Sessões SSH** (item 1): página própria lista os servidores SFTP
    salvos e abre o terminal remoto com um toque
  - **Console JS** (item 2): REPL real num **Web Worker em sandbox**
  - **Gerenciador de fontes** (item 3): fontes por URL aplicadas ao
    editor e à interface separadamente
  - **Onboarding do terminal** (item 4): explica Alpine × FailSafe e
    oferece "Reinstalar ambiente" num toque
  - **Fix crítico do Device Flow**: sessão salvava VAZIA; agora o token é
    consumido como string e a sessão sem token é rejeitada
- **v1.5.4 — GitHub App oficial + model picker com logos:** Client ID do
  GitHub App embutido (Device Flow de fábrica) e picker de modelos com
  logo real por marca, badge grátis/pago e busca instantânea
- **v1.5.3 — polimento de UI + GitHub sem clientes próprios:** botões
  ←/→ removidos do header; suportes de IA abaixo do modelo com scroll;
  ids de modelo sem prefixo `models/`; sign-in GitHub refeito + guia
  `docs/github-oauth-app.md`; Dependabot agrupado por github-actions
- Agente de IA com ferramentas, subagentes e streaming + pílulas
  "Pensar"/"Buscar" que desligam de verdade
- Provedores **Integrados sem chave**: Pollinations (texto + imagem),
  DuckDuckGo AI — e logos REAIS de 16 marcas no chat
- Editor multi-painel (split view) com abas por painel 💡
- Navegação por histórico de abas com histórico persistente 💡
- **Guia de indentação ativa** (opt-in, estilo VSCode) 💡
- Terminal Alpine (proot) com **auto-cura do modo FailSafe**
- Site embutido (aba Website), marketplace com 16+ plugins, conta
  compartilhada com o site (login único)
- **Site 100% bilíngue pt/en** — incluindo /user/*, submissão de plugins,
  fórum, posts e docs
- **Anúncio automático de release no fórum** (release estável → post do bot)
- Release assinado automático, build de preview por rótulo (app + site),
  CI com checagem de traduções e typos, Dependabot + bot de dependências

## 🎯 Próximo (v1.7.x)

1. **Mais plugins portados do Acode** 💡 — linter, formatter (Prettier/
   Ruff), compilador Sass ao vivo, runner avançado, visualizador de
   documentos.
2. **API de plugins expandida** 💡 — ativar/desativar sem reiniciar,
   segredos seguros, ratings, exposição de pacotes CM6.

## 🚀 Depois (v1.8+)

3. **Anúncios recompensados** 💡 — assistir um anúncio dá tempo extra sem
   anúncios; horário silencioso (Acode v1.12.0 #1918 / v1.11.8 #1779).
4. **Novos idiomas** — a infra bilíngue pt/en do site e do app abre caminho
   para es/fr (dicionários por área já estão modularizados).
5. **Painel do bot de release** — administrar os posts automáticos
   (editar/apagar o anúncio do release) na área /admin do site.
6. **Colaboração/backup** — sincronizar settings + sessões de IA via
   ghBackend já existente (backup/restore agendado, diff visual).
7. **Editor de temas avançado** — editor visual de tokens (fundo,
    primária, syntax colors) com export/import JSON compartilhável.

## 🧭 Direção contínua

- Manter o CI verde e a pt-br 100% traduzida (`npm run lang:check`).
- **Acode triado até 16/09 (v1.13.5):** indentação de word wrap portada
  (#2886 + #2880) e API oficial de fileIcons com pacotes de ícones
  portada (#2887). **#2891 (r8) estudado e ADIADO:** as regras do
  upstream são sólidas (keep para CordovaPlugin via reflexão, bridge
  JS, BuildConfig, dontwarn do java.lang.management para o SSH), mas
  exigem validação em dispositivo real — roturas de r8 só aparecem em
  runtime (precedente v1.4.8 no nosso fork), stack traces ficam
  ofuscados nos crash reports e o soak time upstream tem só 3 dias.
  Revisitar quando houver passada de testes em dispositivo; diff é
  pequeno (build-extras.gradle + proguard-rules.pro + config.xml).
  Já cobertos aqui: menu de contexto de abas (#2863), recuperação
  de migração SFTP (#2840), corrida do cordova.exec (#2851).
- Verificar o CHANGELOG do Acode a cada release upstream e portar o que
  for útil (workflows, plugins, IA, editor).
- Nunca travar recursos atrás do Premium — doar é opcional.

---

<a id="english"></a>

## 🇺🇸 English

> Everything here is **free** — Premium stays limited to removing ads and
> raising AI limits. Items marked with 💡 come from continuous comparison
> with upstream [Acode](https://github.com/Acode-Foundation/Acode)
> (their CHANGELOG fully read up to v1.13.5).

## ✅ Done through v1.7.3

- **v1.7.3 — official fileIcons API + icon packs (Acode #2887
  ported):** file and folder icons now go through a stable public API
  (`acode.require("fileIcons")` with `register`, `icon` and
  `onChange`) — the same VS Code/Zed-style icon theme system as
  upstream, ported nearly 1:1. The builtin pack stays the default and
  keeps the existing `file_type_*` classes; plugins can register their
  own packs (SVG by URL/folder or classes), with ownership bound to
  the plugin script and automatic unregistration on load failure or
  uninstall. New "Icon pack" option in App settings → Interface with a
  live list of available themes; folder icons now reflect
  expanded/collapsed state and roots get their own icon; rendered
  icons refresh on theme change (file tree, lists, editor tabs, search
  and references panel); +56 tests from upstream's 5 test files (795
  total)
- **v1.7.2 — indented soft wrap (Acode #2886 + #2880):** wrapped lines
  now continue at the original line's indentation (or +1/+2 levels,
  configurable) instead of returning to the margin; VS Code-style
  punctuation break opportunities (closing brackets stay together,
  breaks happen before openings, CJK included); new "Word wrap
  indentation" option in Editor settings → Text & layout (None / Same
  indent / Indent (+1 level) / Deep indent (+2 levels)), live
  reconfiguration; +6 tests (739 total)
- **v1.7.1 — bullet-proof account + repos where they are used:**
  - **Profile fixed for good:** an in-flight token refresh could
    resurrect the session just cleared by "Sign out" (epoch guard in
    `lib/supabase.js`); the hardware back button threw on the
    profile/support pages (actionStack `action` key); back-dismissed
    confirms now resolve as cancelled; sign-out survives network
    failures
  - **"Meus repositórios" moved out of the GitHub settings page** to
    where repos are used: a "Repositório GitHub" card in the Git
    sidebar (active repo + picker) and the AI chat now receives the
    active repo context with `github_read`/`github_write` tools (tree,
    file contents with sha, Contents API commits, issues — writes
    always user-approved; the token never leaves the device)
  - **Acode #2851 ported:** very-early plugin calls no longer fail
    during the Cordova boot race (`cordova.require("cordova/exec")`
    fallback)
  - +18 tests (733 in 87 files)

- **v1.7.0 — SSH sessions v2 + Fonts v2 (v1.7.x items 3 and 4):**
  - **SSH v2:** stable per-host color (derived from the name,
    deterministic), per-server command history (local, cap 100,
    password/key-phase prompts never recorded, Ctrl+C/D/U abandon the
    line) and a configurable home directory per server (precedence:
    explicit option > saved home > URL path > `/`); deleted hosts are
    cleaned automatically
  - **Fonts v2:** live preview of each font in the list itself
    (translated pangram, background preloading), editor font weight
    400–900 with live CodeMirror reconfiguration and a fully
    internationalized fonts page (+28 keys)
  - **Support normalized:** `main scroll` classes on the body (same
    latent defect as profile v1.6.4) + missing `logger` import on the
    error path
  - **proot fd fix (Acode #2878):** the `init-sandbox.sh` probe now
    uses the shell's pid and realpath(3) semantics — no more "can't
    sanitize binding /proc/self/fd/N" warnings
  - **Repo:** `congrats-pr.yml` thanks community PRs merged (free, no
    Discord); `Ctrl-Shift-W` opens the Welcome (Acode #2773)
  - **Site:** last i18n gaps closed (admin blog editor, /sponsor
    tiers, dynamic placeholders) — +47 EN translations
  - +22 tests (716 total)
- **v1.6.4 — definitive account fix:** the profile page's "Sign in"/
  "Sign up" buttons were dead from day one — the WCPage `body` getter
  returned `null` after the setter replaced the inner `.main` (the
  profile div lacked the `main` class), and field reads exploded in a
  silent TypeError; the body now keeps a local `$body` reference +
  default `main scroll` classes (About-page pattern). Closes the cycle
  started in 1.6.1/1.6.2 (valid session, persisted PAT, site → app
  bridge); +7 regression tests with real rendering (694 total)
- **v1.6.3 — Console REPL v2 + bilingual wiki:**
  - **Console REPL v2 (v1.7.x item 3):** persistent history across
    sessions (localStorage, dedupe, cap 50), named saved snippets
    (save/list/delete on the toolbar) and **workspace imports** —
    `import {x} from "./lib/mod.js"` resolves files relative to the
    open file's folder, inlines them as Blob URLs and runs them in the
    sandbox (transitive, with cycle guards and a 64-module cap)
  - **Bilingual wiki:** all 16 pages (14 content + `_Sidebar` +
    `_Footer`) carry 🇧🇷 + 🇺🇸 sections in a single file;
    `publish-wiki.mjs` extracts the active section (`WIKI_LANG=pt|en`)
    and the `wiki/checkWikiBilingual.mjs` checker joined CI
  - +35 tests (652 → 687)
- **v1.6.2 — real PAT persistence, icons and unified account:**
  - **PAT actually persisted (critical fix):** the settings kit does not
    save prompt values — pasted PATs were silently dropped ("connected via
    PAT and repos never appear"); ghSettings now persists
    `ghToken`/`gitRemoteUrl`/`ghBranch` and fetches the profile right
    away; clearing the token signs the GitHub session out
  - **Fonts/SSH icons:** `svg:server`, `svg:type` (plus `copy`,
    `trash-2`, `check`, `qr-code`) added to the pack — the previous
    fallback (`icon svg:<name>`) matches no icon-font glyph and rendered
    nothing; `select` dialogs now draw `svg:` icons as vectors (repo
    picker, sign-in chooser, commit actions)
  - **Site ↔ app unified account:** "Continue with the site account"
    button (new `/auth/app-handoff` site route hands the existing site
    session to the app via `xcoder://auth/oauth`); the account page
    re-renders on `authchange`; expired sessions refresh in the
    background; sign-in errors render INSIDE the form (never "nothing
    happens" again)
  - **Settings regrouped:** Core → Appearance → Code & tools →
    Connections → Data & backup → About (new pt/en strings)
  - **Free PR review bot:** `pr-review.yml` workflow comments on PRs with
    a bilingual per-area summary, rule-based suggestions and a checklist
    (replaces paid reviewers like Greptile with something of our own)
  - Actions bumped (checkout v7, setup-node v7, github-script v9,
    create-pull-request v8, stale v11); +8 tests (640 → 652)
- **v1.6.1 — one-tap GitHub App web flow + webview-proof login:** browser
  sign-in as first option (site exchanges the code server-side, returns
  via `xcoder://github/session` with anti-CSRF state); git sidebar
  account card renders even when local git status fails; native HTTP
  layer for the Supabase client; site published `/api/github/callback` +
  `/api/github/webhook` (HMAC); auth form never fails silently
- **v1.6.0 — v1.6.x roadmap complete + GitHub sign-in fix:** SSH sessions
  page, sandboxed JS console REPL, font manager, terminal onboarding;
  Device Flow saved an EMPTY session — token now consumed as a string
- **v1.5.4 — official GitHub App + model picker with logos:** built-in
  client id (factory Device Flow) and a model picker with real brand
  logos, free/paid badges and instant search
- **v1.5.3 — UI polish + clientless GitHub:** header arrow buttons
  removed; AI capability pills below the model; `models/` prefix
  normalized; GitHub sign-in rebuilt + `docs/github-oauth-app.md` guide
- AI agent with tools, subagents and streaming; real Think/Search pills
- Keyless built-in providers: Pollinations (text + image), DuckDuckGo AI
  — and real brand logos for 16 providers in the chat
- Multi-pane editor (split view) with per-pane tabs 💡
- Tab history navigation with persistent history across sessions 💡
- **Active indent guide** (opt-in, VSCode-style) 💡
- Alpine terminal (proot) with **FailSafe mode self-healing**
- Embedded site (Website tab), marketplace with 16+ plugins, shared site
  account (single sign-in)
- **Site fully bilingual pt/en** — including /user/*, plugin submission,
  forum, posts and docs
- **Automatic release announcement on the forum** (stable release → bot post)
- Auto-signed releases, label-based preview builds (app + site), CI with
  translation and typos checks, Dependabot + deps bot

## 🎯 Next (v1.7.x)

1. **More plugins ported from Acode** 💡 — linter, formatter (Prettier/
   Ruff), live Sass compiler, advanced runner, document viewer.
2. **Expanded plugin API** 💡 — toggle without restart, secure secrets,
   ratings, CM6 package exposure.

## 🚀 Later (v1.8+)

3. **Rewarded ads** 💡 — watching an ad grants extra ad-free time;
   quiet hours (Acode v1.12.0 #1918 / v1.11.8 #1779).
4. **New languages** — the pt/en bilingual infra paves the way for es/fr
   (per-area dictionaries are already modular).
5. **Release bot dashboard** — manage automatic announcements
   (edit/delete the release post) in the site's /admin area.
6. **Collaboration/backup** — sync settings + AI sessions via the
   existing ghBackend (scheduled backup/restore, visual diff).
7. **Advanced theme editor** — visual token editor (background,
    primary, syntax colors) with shareable JSON export/import.

## 🧭 Ongoing direction

- Keep CI green and pt-br 100% translated (`npm run lang:check`).
- **Acode triaged through 16/09 (v1.13.5):** word wrap indentation
  ported (#2886 + #2880) and the official fileIcons API with icon
  packs ported (#2887). **#2891 (r8) studied and DEFERRED:** upstream's
  rules are solid (keep for reflectively-instantiated CordovaPlugin
  classes, JS bridge, BuildConfig, java.lang.management dontwarn for
  the SSH library), but they need real-device validation — r8
  breakages only show at runtime (v1.4.8 precedent in this fork),
  stack traces become obfuscated in crash reports and upstream soak
  time is only 3 days. Revisit when a device-testing pass is
  available; the diff is small (build-extras.gradle +
  proguard-rules.pro + config.xml). Already covered here: tab context
  menu (#2863), SFTP migration recovery (#2840), cordova.exec race
  (#2851).
- Check the Acode CHANGELOG on every upstream release and port what is
  useful (workflows, plugins, AI, editor).
- Never gate features behind Premium — donating is optional.
