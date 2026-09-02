# Git

O XCoder traz um **cliente Git completo** no painel lateral — não é apenas um visualizador: você clona, edita, faz staging, commita e envia de volta, tudo do aparelho.

## Entrar com a conta GitHub

O login usa **OAuth device flow** — o método seguro da própria GitHub para dispositivos limitados, sem digitar senha dentro do app:

1. Abra o app **Git** na barra lateral e toque em **Entrar com GitHub**.
2. O app mostra um **código de 8 caracteres** (por exemplo, `XXXX-XXXX`).
3. Em qualquer navegador, acesse [github.com/login/device](https://github.com/login/device), entre na sua conta e digite o código.
4. Autorize o escopo solicitado. O painel Git atualiza sozinho e mostra o seu avatar.

O token fica **apenas no armazenamento local** do app. Para sair, use **Sair** no painel Git — o token é revogado localmente (revogue também em *Settings › Applications* no GitHub se quiser garantir).

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
