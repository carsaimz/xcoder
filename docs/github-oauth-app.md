# Integração GitHub do XCoder — guia de configuração
# XCoder GitHub integration — setup guide

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

Este guia documenta a integração oficial do app com o GitHub: o que já
foi criado, onde cada chave entra no código e por que **webhook** e
**bot user id** não exigem nenhuma configuração manual.

## Visão geral: como o app entra na sua conta GitHub

O XCoder oferece três formas de acesso, e **nenhuma delas exige que o
usuário crie clientes próprios** (ordem do chooser em
`src/lib/ghSignIn.js`):

1. **Conectar com GitHub (navegador) — web flow do GitHub App** — o app
   abre o navegador em
   `github.com/login/oauth/authorize?client_id=…&redirect_uri=<site>/api/github/callback`;
   o site oficial troca o `code` pelo token **no servidor** (o client
   secret vive só na env da Vercel) e devolve a sessão ao app por
   `xcoder://github/session#…`, fechando o login automaticamente
   (`src/lib/ghWebFlow.js`). É o caminho mais fácil: um toque.
2. **Device Flow oficial** — o usuário escolhe "Entrar com um código",
   abre `github.com/login/device` e digita o código exibido. O *client
   id* vem embutido no app (veja abaixo). O client id é público por
   design; o Device Flow **não usa client secret** e **não precisa de
   backend**. É o plano B quando o retorno do navegador não chega ao app.
3. **Token de acesso pessoal (PAT)** — o usuário cola um token gerado em
   <https://github.com/settings/tokens> (classic ou fine-grained, com os
   escopos `repo`, `workflow` e `gist`) na página GitHub das
   configurações. Alternativa manual que sempre funciona.

No código, a ordem de decisão está em `src/lib/ghSignIn.js`
(`resolveGhClientId()`): primeiro o client id oficial embutido
(`config.GH_OAUTH_CLIENT_ID` em `src/lib/config.js`), depois um valor
antigo salvo por instalações legadas. Se não houver client id, a
interface oferece somente o fluxo por PAT.

## O que já foi criado (mantenedor)

| Item | Valor | Estado |
|------|-------|--------|
| Tipo de app | **GitHub App** (não OAuth App clássico) | criado |
| Client ID | `Ov23liUF4sGyfo278bN8` | **embutido no app** (`src/lib/config.js`) |
| Callback URL | `https://xcoderapp.vercel.app/api/github/callback` | registrado + **rota publicada no site** (web flow) |
| Client Secret | guardado pelo mantenedor — **nunca vai para o repo** | n/a (Device Flow não usa) |

O Device Flow funciona com **GitHub Apps e OAuth Apps**. A única
diferença prática: GitHub Apps **ignoram o parâmetro `scope`** — as
permissões do token do usuário vêm das configurações do próprio app
(`src/lib/ghAuth.js` já detecta client ids `Ov23li*`/`Iv1.` e só envia
`scope` para OAuth Apps clássicos).

## Falta fazer no GitHub (2 minutos)

1. Acesse <https://github.com/settings/apps> → **XCoder** (seu app) →
   **General**.
2. Em **Identifying and authorizing users**, marque ✅ **Enable Device
   Flow**. Sem isso o app recebe erro ao pedir o código — este é o
   **único ajuste obrigatório**.
3. Em **Permissions**, configure (o push/clone do app depende delas):
   - *Repository permissions* → **Contents: Read and write** (clone,
     push, gists de repositório);
   - *Repository permissions* → **Pull requests: Read and write**;
   - *Repository permissions* → **Workflows: Read and write** (editar
     arquivos em `.github/`);
   - *Metadata: Read-only* (obrigatória, vem marcada);
   - *Account permissions* → **Email addresses: Read-only** e
     **Profile: Read-only** (identidade na tela de conta).
4. **Save changes**. Usuários que já autorizaram precisam reautorizar
   quando as permissões crescem — o GitHub avisa na tela deles.

Depois disso, "Entrar com um código" no app funciona de ponta a ponta.

## Client Secret: guarda, não publica

O Device Flow **não usa** client secret, mas o **web flow usa**: o site
troca o `?code=` por token no servidor. O secret entra como variável de
ambiente da Vercel (projeto do site):

```text
GITHUB_APP_CLIENT_ID=Ov23liUF4sGyfo278bN8
GITHUB_APP_CLIENT_SECRET=<secret do GitHub App>
GITHUB_APP_WEBHOOK_SECRET=<string aleatória do webhook>
```

Sem essas envs, a rota `/api/github/callback` responde com uma página
explicando a configuração que falta (o Device Flow continua funcionando
sem elas). Se o secret já circulou por chat/e-mail, gere um novo em
**General → Client secrets → Generate** e atualize a env da Vercel —
nenhuma build do app precisa mudar. **Nunca** coloque o secret em
`src/`, em commits ou em issues (o repo `xcoder` é público).

## Webhook: rota já publicada no site

- O site já tem o receiver: `POST /api/github/webhook`
  (`xcoder-web/src/app/api/github/webhook`). Ele valida a assinatura
  `X-Hub-Signature-256` (HMAC-SHA256 com `GITHUB_APP_WEBHOOK_SECRET`),
  responde o `ping` do GitHub com `pong` e registra os demais eventos.
- Para ativar: GitHub → Settings do App → **Webhook → Active** →
  **Webhook URL**: `https://xcoderapp.vercel.app/api/github/webhook` →
  **Webhook secret**: a MESMA string da env
  `GITHUB_APP_WEBHOOK_SECRET` da Vercel. Ao salvar, o GitHub envia um
  `ping` e a URL fica verde.
- Sem webhook ativo, nada quebra: o app só chama a API quando você usa;
  os eventos recebidos hoje são apenas registrados (ações de bot com
  installation tokens entram na v1.7+).

## Bot user id: o que é e se precisamos dele

- Ao criar um **GitHub App**, o GitHub gera o usuário virtual
  `<slug-do-app>[bot]` — visível em
  `https://github.com/settings/apps` e via
  `https://api.github.com/users/<slug-do-app>%5Bbot%5D` (o `[bot]` vai
  URL-encoded como `%5Bbot%5D`). O "id" numérico aparece nesse JSON
  (`"id": 123456789`).
- **No fluxo atual ele não é usado**: com o Device Flow tudo que o app
  faz (push, clone, gist) sai no nome da conta do próprio usuário — o
  comportamento desejado para um editor de código pessoal. O bot user
  só apareceria para ações feitas com a identidade do app (instalações,
  comentários automáticos).
- Não há nada para configurar: o bot nasce junto com o app; escolha o
  slug com calma, pois ele não pode ser renomeado depois sem quebrar
  menções.

## Resumo para o mantenedor

| Item | Precisa? | Onde entra |
|------|----------|------------|
| Client ID do GitHub App | ✅ já feito | `src/lib/config.js` → `GH_OAUTH_CLIENT_ID` |
| Enable Device Flow | ✅ falta marcar | Settings do app no GitHub |
| Permissões (Contents/PR/Workflows) | ✅ falta configurar | Settings do app no GitHub |
| Client Secret | env do site (web flow) | Vercel → `GITHUB_APP_CLIENT_SECRET` (rotacionar se exposto) |
| Callback URL | ✅ rota publicada | `<site>/api/github/callback` |
| Webhook | ✅ rota publicada — ativar é opcional | `<site>/api/github/webhook` |
| Webhook secret | env do site | Vercel → `GITHUB_APP_WEBHOOK_SECRET` |
| Bot user id | Não (automático, `<slug>[bot]`) | — |
| PAT do usuário | Alternativa sempre disponível | cola na tela do app |

---

<a id="english"></a>

## 🇺🇸 English

This guide documents the app's official GitHub integration: what already
exists, where each key lands in the code, and why **webhook** and **bot
user id** need no manual setup.

## Overview: how the app signs in to GitHub

XCoder offers three access paths, and **none of them asks users to create
their own OAuth clients** (chooser order in `src/lib/ghSignIn.js`):

1. **Connect with GitHub (browser) — GitHub App web flow** — the app opens
   the browser at
   `github.com/login/oauth/authorize?client_id=…&redirect_uri=<site>/api/github/callback`;
   the official site exchanges the `code` for a token **server-side** (the
   client secret lives only in the Vercel env) and hands the session back
   via `xcoder://github/session#…`, completing the sign-in automatically
   (`src/lib/ghWebFlow.js`). Easiest path: one tap.
2. **Official Device Flow** — the user picks "Sign in with a code", opens
   `github.com/login/device` and types the displayed code. The *client id*
   ships with the app (see below). A client id is public by design; the
   Device Flow uses **no client secret** and needs **no backend**. It is
   the plan B when the browser return leg cannot reach the app.
3. **Personal access token (PAT)** — the user pastes a token generated at
   <https://github.com/settings/tokens> (classic or fine-grained, with
   `repo`, `workflow` and `gist` scopes) on the app's GitHub settings page.
   The manual path that always works.

In code, the decision order lives in `src/lib/ghSignIn.js`
(`resolveGhClientId()`): the built-in official client id first
(`config.GH_OAUTH_CLIENT_ID` in `src/lib/config.js`), then a legacy value
saved by old installs. With no client id, the UI only offers the PAT flow.

## Already done (maintainer)

| Item | Value | Status |
|------|-------|--------|
| App type | **GitHub App** (not a classic OAuth App) | created |
| Client ID | `Ov23liUF4sGyfo278bN8` | **built into the app** (`src/lib/config.js`) |
| Callback URL | `https://xcoderapp.vercel.app/api/github/callback` | registered + **route published on the site** (web flow) |
| Client Secret | kept by the maintainer — **never enters the repo** | n/a (Device Flow does not use it) |

The Device Flow works with **GitHub Apps and OAuth Apps**. The only
practical difference: GitHub Apps **ignore the `scope` parameter** — the
user token's permissions come from the app's own settings
(`src/lib/ghAuth.js` detects `Ov23li*`/`Iv1.` client ids and only sends
`scope` to classic OAuth Apps).

## Still missing on GitHub (2 minutes)

1. Open <https://github.com/settings/apps> → **XCoder** (your app) →
   **General**.
2. Under **Identifying and authorizing users**, check ✅ **Enable Device
   Flow**. Without it the app gets an error when requesting the code —
   this is the **only mandatory toggle**.
3. Under **Permissions**, configure (the app's push/clone depends on them):
   - *Repository permissions* → **Contents: Read and write** (clone,
     push, repo gists);
   - *Repository permissions* → **Pull requests: Read and write**;
   - *Repository permissions* → **Workflows: Read and write** (editing
     files under `.github/`);
   - *Metadata: Read-only* (mandatory, pre-checked);
   - *Account permissions* → **Email addresses: Read-only** and
     **Profile: Read-only** (identity on the account screen).
4. **Save changes**. Users who already authorized must re-authorize when
   permissions grow — GitHub notifies them on their side.

After that, "Sign in with a code" works end to end.

## Client Secret: keep it, never publish it

The Device Flow does **not** use a client secret, but the **web flow
does**: the site exchanges `?code=` for a token server-side. The secret
goes into the Vercel env of the site project:

```text
GITHUB_APP_CLIENT_ID=Ov23liUF4sGyfo278bN8
GITHUB_APP_CLIENT_SECRET=<GitHub App secret>
GITHUB_APP_WEBHOOK_SECRET=<random webhook string>
```

Without those envs, `/api/github/callback` answers with a page explaining
the missing setup (the Device Flow keeps working regardless). If the
secret ever leaked through chat/e-mail, generate a new one under
**General → Client secrets → Generate** and update the Vercel env — no app
build needs to change. **Never** put the secret in `src/`, commits or
issues (the `xcoder` repo is public).

## Webhook: route already published on the site

- The site already ships the receiver: `POST /api/github/webhook`
  (`xcoder-web/src/app/api/github/webhook`). It validates the
  `X-Hub-Signature-256` signature (HMAC-SHA256 with
  `GITHUB_APP_WEBHOOK_SECRET`), answers GitHub's `ping` with `pong` and
  logs the remaining events.
- To enable: GitHub → App settings → **Webhook → Active** →
  **Webhook URL**: `https://xcoderapp.vercel.app/api/github/webhook` →
  **Webhook secret**: the SAME string as the Vercel env
  `GITHUB_APP_WEBHOOK_SECRET`. On save, GitHub sends a `ping` and the URL
  turns green.
- With no webhook active nothing breaks: the app only calls the API when
  you use it; events received today are just logged (bot actions with
  installation tokens land in v1.7+).

## Bot user id: what it is and whether we need it

- Creating a **GitHub App** makes GitHub generate the virtual user
  `<app-slug>[bot]` — visible at `https://github.com/settings/apps` and
  via `https://api.github.com/users/<app-slug>%5Bbot%5D` (`[bot]`
  URL-encoded as `%5Bbot%5D`). The numeric "id" appears in that JSON
  (`"id": 123456789`).
- **The current flow does not use it**: with the Device Flow everything
  the app does (push, clone, gist) happens under the user's own account —
  the desired behavior for a personal code editor. The bot user would only
  show up for actions performed with the app's identity (installations,
  automated comments).
- There is nothing to configure: the bot is born with the app; choose the
  slug carefully, since renaming it later breaks mentions.

## Maintainer summary

| Item | Needed? | Where it lands |
|------|---------|----------------|
| GitHub App Client ID | ✅ done | `src/lib/config.js` → `GH_OAUTH_CLIENT_ID` |
| Enable Device Flow | ✅ to do | App settings on GitHub |
| Permissions (Contents/PR/Workflows) | ✅ to do | App settings on GitHub |
| Client Secret | site env (web flow) | Vercel → `GITHUB_APP_CLIENT_SECRET` (rotate if exposed) |
| Callback URL | ✅ route published | `<site>/api/github/callback` |
| Webhook | ✅ route published — enabling is optional | `<site>/api/github/webhook` |
| Webhook secret | site env | Vercel → `GITHUB_APP_WEBHOOK_SECRET` |
| Bot user id | No (automatic, `<slug>[bot]`) | — |
| User PAT | always-available alternative | pasted on the app's screen |
