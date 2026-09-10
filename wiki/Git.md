# Git

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

O XCoder traz um **cliente Git completo** no painel lateral — não é apenas um visualizador: você clona, edita, faz staging, commita e envia de volta, tudo do aparelho.

## Entrar com a conta GitHub

O login usa **OAuth device flow** — o método seguro da própria GitHub para dispositivos limitados, sem digitar senha dentro do app:

1. Abra o app **Git** na barra lateral e toque em **Entrar com GitHub**.
2. O app mostra um **código de 8 caracteres** (por exemplo, `XXXX-XXXX`).
3. Em qualquer navegador, acesse [github.com/login/device](https://github.com/login/device), entre na sua conta e digite o código.
4. Autorize o escopo solicitado. O painel Git atualiza sozinho e mostra o seu avatar.

O token fica **apenas no armazenamento local** do app. Para sair, use **Sair** no painel Git — o token é revogado localmente (revogue também em *Settings › Applications* no GitHub se quiser garantir).

> Também é possível entrar com um **PAT** (Personal Access Token) ou, se o app tiver um OAuth client id configurado, pelo fluxo de dispositivo oficial — as opções aparecem no mesmo chooser de login.

## Fluxo de trabalho diário

- **Clonar** — Git › **Clonar repositório**, informe `dono/repo` ou a URL HTTPS. O clone entra no explorador de arquivos como um projeto normal.
- **Alterações** — o painel lista arquivos modificados; toque para ver o diff.
- **Staging e commit** — marque os arquivos, escreva a mensagem e confirme. O terminal também aceita o fluxo clássico (`git add`, `git commit -m`).
- **Push/Pull** — sincronize com o remoto por um toque; credenciais vêm do login device flow, sem pedir senha.
- **Branches** — crie, troque e compare branches pelo seletor no topo do painel.
- **Histórico** — a linha do tempo de commits mostra autor e data formatada no seu idioma.

## Sem conta conectada

Repositórios **públicos** podem ser clonados e lidos sem login. Para **enviar** alterações (push) ou acessar repos privados, o login é obrigatório.

## Problemas comuns

- **"Bad credentials"** — o token expirou ou foi revogado; faça login novamente.
- **Rate limit da API (403)** — sem login você compartilha a cota anônima do GitHub; entre com a conta para ter cota própria.
- **Push rejeitado (non-fast-forward)** — faça um **pull** antes e resolva conflitos no editor.
- **Clone lento/falha** — redes móveis instáveis derrubam clones grandes; tente clone raso (`--depth 1` no terminal) ou Wi-Fi.

Mais diagnósticos em [[Solucao-de-Problemas]].

---

<a id="english"></a>

## 🇺🇸 English

XCoder ships with a **full Git client** in the side panel — not just a viewer: you clone, edit, stage, commit and push back, all from the device.

## Sign in with your GitHub account

Login uses **OAuth device flow** — GitHub's own secure method for limited devices, with no password typed inside the app:

1. Open the **Git** app in the sidebar and tap **Sign in with GitHub**.
2. The app shows an **8-character code** (for example, `XXXX-XXXX`).
3. In any browser, go to [github.com/login/device](https://github.com/login/device), sign in to your account and type the code.
4. Authorize the requested scope. The Git panel refreshes by itself and shows your avatar.

The token stays **only in the app's local storage**. To sign out, use **Sign out** in the Git panel — the token is revoked locally (also revoke it under *Settings › Applications* on GitHub if you want to be sure).

> You can also sign in with a **PAT** (Personal Access Token) or, if the app has an OAuth client id configured, through the official device flow — the options appear in the same login chooser.

## Daily workflow

- **Clone** — Git › **Clone repository**, enter `owner/repo` or the HTTPS URL. The clone lands in the file explorer as a regular project.
- **Changes** — the panel lists modified files; tap to see the diff.
- **Staging and commit** — check the files, write the message and confirm. The terminal also accepts the classic flow (`git add`, `git commit -m`).
- **Push/Pull** — sync with the remote in one tap; credentials come from the device flow login, with no password prompt.
- **Branches** — create, switch and compare branches from the selector at the top of the panel.
- **History** — the commit timeline shows author and date formatted in your language.

## Without a connected account

**Public** repositories can be cloned and read without signing in. To **push** changes or access private repos, signing in is required.

## Common issues

- **"Bad credentials"** — the token expired or was revoked; sign in again.
- **API rate limit (403)** — without login you share GitHub's anonymous quota; sign in to get your own.
- **Push rejected (non-fast-forward)** — do a **pull** first and resolve conflicts in the editor.
- **Slow/failed clone** — unstable mobile networks drop large clones; try a shallow clone (`--depth 1` in the terminal) or Wi-Fi.

More diagnostics in [[Solucao-de-Problemas|Troubleshooting]].
