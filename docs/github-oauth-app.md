# Integração GitHub do XCoder — guia de configuração

Este guia documenta a integração oficial do app com o GitHub: o que já
foi criado, onde cada chave entra no código e por que **webhook** e
**bot user id** não exigem nenhuma configuração manual.

## Visão geral: como o app entra na sua conta GitHub

O XCoder oferece duas formas de acesso, e **nenhuma delícia exige que o
usuário crie clientes próprios**:

1. **Token de acesso pessoal (PAT)** — o usuário cola um token gerado em
   <https://github.com/settings/tokens> (classic ou fine-grained, com os
   escopos `repo`, `workflow` e `gist`). É o caminho mais simples e
   funciona sem nenhuma configuração do lado do app.
2. **Device Flow oficial** — o usuário escolhe "Entrar com um código",
   abre `github.com/login/device` e digita o código exibido. O *client
   id* vem embutido no app (veja abaixo). O client id é público por
   design; o Device Flow **não usa client secret** e **não precisa de
   backend**.

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
| Callback URL | `https://xcoderapp.vercel.app` | registrado (Device Flow não usa callback) |
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

O Device Flow **não usa** client secret — ele só seria necessário num
fluxo web com callback (trocar `?code=` por token num backend nosso, por
exemplo num futuro "Entrar com GitHub" no site). Guarde o secret num
gerenciador de senhas; se ele já circulou por chat/e-mail, gere um novo
em **General → Client secrets → Generate** (o antigo pode ser removido).
**Nunca** coloque o secret em `src/`, em commits ou em issues — não há
nenhum lugar do app/site que precise dele hoje.

## Webhook: quando existe e quando precisa

- O webhook do GitHub App pode ficar **desativado (Inactive)**: nada no
  app recebe eventos do GitHub em tempo real; o app só chama a API
  quando você usa.
- Se um dia quisermos receber eventos (`push`, `issues`...) num servidor
  nosso:
  1. O webhook exige uma **URL pública HTTPS** (por exemplo
     `https://xcoderapp.vercel.app/api/github/webhook`).
  2. Cria-se um **Webhook secret** (string aleatória) e o servidor
     valida a assinatura `X-Hub-Signature-256` de cada entrega.
  3. O endpoint do site recebe o `POST`, valida a assinatura e responde
     `2xx` rápido (processamento pesado vai para uma fila).

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
| Client Secret | Não (Device Flow não usa) | guardado pelo mantenedor, fora do repo |
| Callback URL | Já registrada (Device Flow não usa) | Settings do app no GitHub |
| Webhook | Não (pode ficar Inactive) | — |
| Webhook secret | Não | — |
| Bot user id | Não (automático, `<slug>[bot]`) | — |
| PAT do usuário | Alternativa sempre disponível | cola na tela do app |
