# Central de Documentação do XCoder / XCoder Documentation Hub

[🇧🇷 Português](#português) | [🇺🇸 English](#english)

---

<a id="português"></a>

## 🇧🇷 Português

Esta pasta é a fonte única de verdade da documentação do XCoder. Os mesmos
ficheiros Markdown alimentam três superfícies:

1. **GitHub** — renderizados direto no repositório e na wiki.
2. **App** — exibidos dentro do app (WebView) e empacotados quando útil.
3. **Website** — [`carsaimz/xcoder-web`](https://github.com/carsaimz/xcoder-web)
   (no ar) renderiza as docs da comunidade, blog, fórum e marketplace, e
   serve as APIs de integração do app (Backend URL).

## Estrutura

```
docs/
├── README.md        ← este ficheiro
└── screenshots/     ← capturas de tela do app referenciadas pelos READMEs
```

Adições planejadas (PRs bem-vindos):

- `docs/guides/` — uso do agente de IA, painel Git, terminal e proot, plugins.
- `docs/plugins/` — referência da API de plugins e guia de publicação.
- `docs/faq.md` — perguntas frequentes.

## Convenções

- Escreva em **português e inglês no mesmo ficheiro**, com âncoras de
  idioma (seção 🇧🇷 primeiro, depois 🇺🇸) — sem ficheiros irmãos por idioma.
- Use links relativos para que os ficheiros funcionem no GitHub, no app e
  no site.
- Guarde capturas de tela em `docs/screenshots/` (PNG, comprimidas,
  ≤ 300 KB cada).

---

<a id="english"></a>

## 🇺🇸 English

This folder is the single source of truth for XCoder documentation. The same
Markdown files are consumed by three surfaces:

1. **GitHub** — rendered directly in the repository and the wiki.
2. **App** — displayed in-app (WebView) and bundled where useful.
3. **Website** — [`carsaimz/xcoder-web`](https://github.com/carsaimz/xcoder-web)
   (live) renders the community docs, blog, forum and marketplace, and serves
   the app integration APIs (Backend URL).

## Layout

```
docs/
├── README.md        ← this file
└── screenshots/     ← app screenshots referenced by the READMEs
```

Planned additions (PRs welcome):

- `docs/guides/` — AI agent usage, Git panel, terminal & proot, plugins.
- `docs/plugins/` — plugin API reference and publishing guide.
- `docs/faq.md` — frequently asked questions.

## Conventions

- Write in **Portuguese and English in the same file**, with language
  anchors (🇧🇷 section first, then 🇺🇸) — no per-language sibling files.
- Use relative links so files work on GitHub, in the app and on the website.
- Keep screenshots in `docs/screenshots/` (PNG, compressed, ≤ 300 KB each).
