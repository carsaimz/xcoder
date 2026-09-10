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
> (CHANGELOG lido por completo até a v1.13.3).

## ✅ Concluído até a v1.6.2

- **Pós-v1.6.2 — wiki bilíngue:** as 16 páginas da wiki (14 de conteúdo +
  `_Sidebar` + `_Footer`) agora trazem secções 🇧🇷 + 🇺🇸 num único ficheiro,
  no mesmo formato de README/ROADMAP/docs; `publish-wiki.mjs` extrai a
  secção ativa na publicação (`WIKI_LANG=pt|en`) e novo checker
  `wiki/checkWikiBilingual.mjs` valida a política; site continua com
  variantes EN próprias (`content/docs/en/`)
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
3. **Console REPL v2** — snippets salvos, import de módulos do workspace
   no sandbox (via Blob/URL), histórico persistente entre sessões.
4. **Sessões SSH v2** — nome do servidor com favicon/cores, histórico de
   comandos por host, diretório inicial configurável no perfil.
5. **Fontes v2** — preview visual antes de aplicar, import por arquivo
   local (além de URL), variação de peso (bold/black) no editor.

## 🚀 Depois (v1.8+)

6. **Anúncios recompensados** 💡 — assistir um anúncio dá tempo extra sem
   anúncios; horário silencioso (Acode v1.12.0 #1918 / v1.11.8 #1779).
7. **Novos idiomas** — a infra bilíngue pt/en do site e do app abre caminho
   para es/fr (dicionários por área já estão modularizados).
8. **Painel do bot de release** — administrar os posts automáticos
   (editar/apagar o anúncio do release) na área /admin do site.
9. **Colaboração/backup** — sincronizar settings + sessões de IA via
   ghBackend já existente (backup/restore agendado, diff visual).
10. **Editor de temas avançado** — editor visual de tokens (fundo,
    primária, syntax colors) com export/import JSON compartilhável.

## 🧭 Direção contínua

- Manter o CI verde e a pt-br 100% traduzida (`npm run lang:check`).
- Verificar o CHANGELOG do Acode a cada release upstream e portar o que
  for útil (workflows, plugins, IA, editor).
- Nunca travar recursos atrás do Premium — doar é opcional.

---

<a id="english"></a>

## 🇺🇸 English

> Everything here is **free** — Premium stays limited to removing ads and
> raising AI limits. Items marked with 💡 come from continuous comparison
> with upstream [Acode](https://github.com/Acode-Foundation/Acode)
> (their CHANGELOG fully read up to v1.13.3).

## ✅ Done through v1.6.2

- **Post-v1.6.2 — bilingual wiki:** all 16 wiki pages (14 content +
  `_Sidebar` + `_Footer`) now carry 🇧🇷 + 🇺🇸 sections in a single file,
  matching the README/ROADMAP/docs format; `publish-wiki.mjs` extracts
  the active section when publishing (`WIKI_LANG=pt|en`) and a new
  `wiki/checkWikiBilingual.mjs` checker enforces the policy; the website
  keeps its own EN variants (`content/docs/en/`)
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
3. **Console REPL v2** — saved snippets, workspace module imports in the
   sandbox (Blob/URL), persistent history across sessions.
4. **SSH sessions v2** — server names with colors/icons, per-host command
   history, configurable home directory.
5. **Fonts v2** — visual preview before applying, local file import
   (beyond URL), weight variants (bold/black) in the editor.

## 🚀 Later (v1.8+)

6. **Rewarded ads** 💡 — watching an ad grants extra ad-free time;
   quiet hours (Acode v1.12.0 #1918 / v1.11.8 #1779).
7. **New languages** — the pt/en bilingual infra paves the way for es/fr
   (per-area dictionaries are already modular).
8. **Release bot dashboard** — manage automatic announcements
   (edit/delete the release post) in the site's /admin area.
9. **Collaboration/backup** — sync settings + AI sessions via the
   existing ghBackend (scheduled backup/restore, visual diff).
10. **Advanced theme editor** — visual token editor (background,
    primary, syntax colors) with shareable JSON export/import.

## 🧭 Ongoing direction

- Keep CI green and pt-br 100% translated (`npm run lang:check`).
- Check the Acode CHANGELOG on every upstream release and port what is
  useful (workflows, plugins, AI, editor).
- Never gate features behind Premium — donating is optional.
"""
