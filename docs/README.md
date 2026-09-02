# XCoder Documentation Hub

This folder is the single source of truth for XCoder documentation. The same
Markdown files are consumed by three surfaces:

1. **GitHub** — rendered directly in the repository and the wiki.
2. **App** — displayed in-app (WebView) and bundled where useful.
3. **Website** — [`carsaimz/xcoder-web`](https://github.com/carsaimz/xcoder-web)
   (live) renders the community docs, blog, forum and marketplace, and serves
   the app integration APIs (Backend URL). The wiki sources in `wiki/` are the
   Portuguese canonical set consumed there.

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

- Write in **English**; add a `*.pt-br.md` sibling for Portuguese when
  convenient (mirrors `readme.md` / `readme.pt-br.md`).
- Use relative links so files work on GitHub, in the app and on the website.
- Keep screenshots in `docs/screenshots/` (PNG, compressed, ≤ 300 KB each).
