# Wiki do XCoder (fontes)

Esta pasta contém as fontes da **[Wiki oficial](https://github.com/carsaimz/xcoder/wiki)** do XCoder. O mesmo conteúdo alimenta a seção **Docs** do [site da comunidade](https://github.com/carsaimz/xcoder-web) — uma única fonte de verdade para wiki, site e app (WebView).

## Páginas

| Arquivo | Página |
|---|---|
| `Home.md` | Boas-vindas e índice |
| `Instalacao.md` | Instalação do APK |
| `Primeiros-Passos.md` | Tutorial inicial |
| `Interface.md` | Tour pela interface |
| `Atalhos.md` | Atalhos de teclado |
| `Assistente-IA.md` | Configuração de provedores de IA |
| `Git.md` | Login device flow e fluxo Git |
| `Temas.md` | Os 30 temas e como criar o seu |
| `Plugins.md` | Marketplace e desenvolvimento de plugins |
| `Build.md` | Compilar do código-fonte |
| `Solucao-de-Problemas.md` | Erros comuns e diagnóstico |
| `FAQ.md` | Perguntas frequentes |
| `Contribuindo.md` | Como contribuir |
| `Integracao-App.md` | API de backend/site para o app |
| `_Sidebar.md` / `_Footer.md` | Navegação da wiki |

## Como publicar no GitHub Wiki

O GitHub só cria o repositório da wiki depois que a **primeira página é salva pela interface web** — não dá para fazer por API. Então:

1. **(uma vez)** Abra <https://github.com/carsaimz/xcoder/wiki> e salve uma página `Home` com qualquer conteúdo. Isso inicializa o wiki repo.
2. Publique/atualize as páginas com:
   ```bash
   GITHUB_TOKEN=seu_pat_classico node wiki/publish-wiki.mjs
   ```
   > Use um **PAT clássico** com escopo `repo` — PATs fine-grained ainda não têm acesso de escrita a wikis.

Enquanto a wiki hospedada não estiver ativa, este diretório já serve como documentação versionada no repositório (e os mesmos textos estão no site, com busca).

## Política de idiomas / Language policy

Este repositório adota conteúdo **bilíngue num único ficheiro** (secção
🇧🇷 primeiro, depois 🇺🇸) para README, ROADMAP, CONTRIBUTING, CoC e docs/.
As páginas da wiki são a exceção por ora: elas são renderizadas pelo site
(que mantém as variantes EN na sua camada de i18n, `docsLangBody`) e
publicadas na wiki do GitHub em português. Converter as 15 páginas para o
formato bilíngue está no roadmap v1.7.x — o passo de publicação
(`publish-wiki.mjs`) precisará extrair apenas a secção ativa.

This repository uses **bilingual single-file content** (🇧🇷 section first,
then 🇺🇸) for README, ROADMAP, CONTRIBUTING, CoC and docs/. Wiki pages are
the exception for now: the site renders them (keeping EN variants in its
i18n layer, `docsLangBody`) and publishes the GitHub wiki in Portuguese.
Converting the 15 pages to the bilingual format is on the v1.7.x roadmap —
the publish step (`publish-wiki.mjs`) will need to extract the active
section only.
