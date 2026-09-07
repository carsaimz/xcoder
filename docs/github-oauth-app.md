# Integração GitHub do XCoder — guia de configuração

Este guia explica o que o mantenedor precisa criar no GitHub para a
integração do app, onde cada chave entra no código e por que **webhook**
e **bot user id** não são necessários para o fluxo atual (e quando
seriam).

## Visão geral: como o app entra na sua conta GitHub

O XCoder oferece duas formas de acesso, e **nenhuma delas exige que o
usuário crie clientes próprios**:

1. **Token de acesso pessoal (PAT)** — o usuário cola um token gerado em
   <https://github.com/settings/tokens> (classic ou fine-grained, com os
   escopos `repo`, `workflow` e `gist`). É o caminho mais simples e
   funciona hoje, sem nenhuma configuração do lado do app.
2. **Device Flow oficial** — o usuário escolhe "Entrar com um código",
   abre `github.com/login/device` e digita o código exibido. Para isso
   existir é preciso um **OAuth App oficial do XCoder** cujo *client id*
   vem embutido no app (veja abaixo). O client id é público por design;
   o Device Flow **não usa client secret** e **não precisa de backend**.

No código, a ordem de decisão está em `src/lib/ghSignIn.js`
(`resolveGhClientId()`): primeiro o client id oficial embutido
(`config.GH_OAUTH_CLIENT_ID` em `src/lib/config.js`), depois um valor
antigo salvo por instalações legadas. Se não houver client id, a
interface oferece somente o fluxo por PAT.

## Criando o OAuth App oficial (passo a passo)

1. Acesse <https://github.com/settings/developers> → **New OAuth App**.
2. Preencha:
   - **Application name**: `XCoder`
   - **Homepage URL**: `https://github.com/carsaimz/xcoder`
   - **Callback URL**: pode ficar em branco ou apontar para
     `https://github.com/carsaimz/xcoder` — o Device Flow não usa
     callback.
3. Marque **Enable Device Flow**. Este é o único ajuste obrigatório.
4. Crie o app e copie o **Client ID** (formato `Iv1.xxxxxxxxxxxxxxxx`
   ou `Ov23lixxxxxxxxxxxxxx`).
5. Envie o Client ID — ele entra em **uma única linha** do código:

   ```js
   // src/lib/config.js
   const GH_OAUTH_CLIENT_ID = "Iv1.xxxxxxxxxxxxxxxx";
   ```

Pronto: a próxima build do app já nasce com "Entrar com um código"
funcionando, sem nenhuma configuração pelo usuário.

## Webhook: quando existe e quando precisa

- **OAuth App (o que estamos criando) não tem webhook.** Se o formulário
  de criação mostrar um campo de webhook, é o formulário de *GitHub
  App* — não preencha e não ative nada. Nada no app recebe eventos do
  GitHub em tempo real; o app só faz chamadas à API quando você usa.
- **GitHub App** (modelo diferente, com mais permissões) tem webhook
  obrigatório. Só faria sentido se quiséssemos, por exemplo, receber
  eventos de `push`/`issues` num servidor nosso. Nesse caso:
  1. O webhook exige uma **URL pública HTTPS** nossa (por exemplo
     `https://xcoderapp.vercel.app/api/github/webhook`).
  2. Cria-se um **Webhook secret** (string aleatória) e o servidor
     valida a assinatura `X-Hub-Signature-256` de cada entrega.
  3. Se não houver servidor para receber eventos, desmarque a opção
     **Active** do webhook — o GitHub App funciona sem entregar nada.

Para a integração atual do app (PAT + Device Flow), **não há nada para
configurar em webhook**.

## Bot user id: o que é e se precisamos dele

- O "**bot user**" só existe para **GitHub Apps**: ao criar um GitHub
  App, o GitHub gera o usuário virtual `<slug-do-app>[bot]`
  (por exemplo `xcoder-bot[bot]`), que aparece como autor de commits,
  PRs e reviews feitos pelo app. O "bot user id" é o id numérico desse
  usuário (visível em `https://api.github.com/users/xcoder-bot[bot]`).
- **OAuth App não tem bot user.** Com o Device Flow, tudo que o app faz
  (push, clone, gist) sai no nome da conta do próprio usuário — é
  exatamente o comportamento desejado para um editor de código pessoal.
- Se um dia criarmos um GitHub App para automação (ex.: um bot que
  comenta em issues), o bot user já virá criado junto; não há nada para
  "fazer" manualmente além de escolher o slug do app com calma, porque
  ele não pode ser renomeado depois sem quebrar as menções.

## Resumo para o mantenedor

| Item | Precisa? | Onde entra |
|------|----------|------------|
| Client ID do OAuth App | Sim | `src/lib/config.js` → `GH_OAUTH_CLIENT_ID` |
| Client Secret | Não (Device Flow não usa) | — |
| Webhook | Não (OAuth App não tem) | — |
| Webhook secret | Não | — |
| Bot user id | Não (só existe em GitHub App) | — |
| PAT do usuário | Alternativa já disponível | cola na tela do app |
