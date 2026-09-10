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

Todo o conteúdo deste repositório é **bilíngue num único ficheiro** (secção
🇧🇷 primeiro, depois 🇺🇸): README, ROADMAP, CONTRIBUTING, CoC, docs/ **e todas
as páginas da wiki** (desde a v1.6.3). Ao publicar no GitHub Wiki, o passo
`publish-wiki.mjs` extrai apenas a secção ativa:

```bash
WIKI_LANG=pt GITHUB_TOKEN=... node wiki/publish-wiki.mjs   # padrão
WIKI_LANG=en GITHUB_TOKEN=... node wiki/publish-wiki.mjs   # wiki em inglês
```

O site da comunidade continua com as variantes EN na sua própria camada de
i18n (`content/docs/en/` + `docsLangBody`), servida por idioma da sessão.

All content in this repository is **bilingual in a single file** (🇧🇷 section
first, then 🇺🇸): README, ROADMAP, CONTRIBUTING, CoC, docs/ **and every wiki
page** (since v1.6.3). When publishing to the GitHub Wiki, the
`publish-wiki.mjs` step extracts only the active section (`WIKI_LANG=pt|en`,
`pt` by default). The community website keeps its own EN variants in its
i18n layer (`content/docs/en/` + `docsLangBody`), served per session language.
