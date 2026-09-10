# Integração GitHub do XCoder — guia de configuração

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
