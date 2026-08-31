# Contributing to XCoder

Thank you for considering a contribution! This document explains the development workflow,
the commit conventions that power our automated changelog, and how to contribute
translations and plugins.

## Development setup

```bash
git clone https://github.com/carsaimz/xcoder.git
cd xcoder
npm install
npm run dev          # start the dev server (http://localhost:8080)
```

Before opening a pull request, make sure the whole pipeline passes:

```bash
npm run typecheck    # tsc --noEmit, strict mode — zero errors expected
npm test             # vitest — keep the suite green, add tests for new logic
npm run build        # rspack production build — must succeed
node utils/lang-cli.mjs --check   # locale key parity (en/pt/es)
```

## Conventional commits (required)

XCoder generates its release changelog **from commit messages**, so we follow
[Conventional Commits](https://www.conventionalcommits.org/) strictly:

```
<type>(<optional scope>): <short imperative summary>

[optional body]
[optional footer(s)]
```

| Type | Use for | Changelog section |
| --- | --- | --- |
| `feat` | new user-facing feature | Features |
| `fix` | bug fix | Bug fixes |
| `perf` | performance improvement | Performance |
| `refactor` | code change that neither fixes nor adds behaviour | Refactoring |
| `docs` | documentation only | Documentation |
| `test` | tests only | Tests |
| `build` | build system / dependencies | Build system |
| `ci` | GitHub Actions / pipelines | CI/CD |
| `chore` | maintenance | Maintenance |

Scopes used in this repo: `editor`, `file`, `terminal`, `git`, `agent`, `ai`, `lsp`, `ui`,
`plugins`, `i18n`, `path`, `release`.

Breaking changes append `!` after the type/scope (`feat(api)!:`) **or** include a footer
starting with `BREAKING CHANGE:`. They are surfaced in a dedicated release section.

Examples:

```
feat(agent): add ops subagent for python scripting
fix(path): keep scheme when resolving device-absolute fragments
docs: translate agents.md to Portuguese
chore(release): v1.2.0
```

## Pull request workflow

1. Fork the repo and create a branch from `main`:
   `git checkout -b feat/my-feature`
2. Make your changes with focused commits (conventional messages).
3. Run the checks listed above.
4. Open the PR using the provided template. The labeler bot will tag it automatically;
   the CI workflow runs typecheck, tests and build.
5. A maintainer reviews and merges (squash is common — keep the title conventional).

## Translating (i18n)

The source of truth is `src/lang/en.ts`. Portuguese and Spanish are complete; the other 40
locales are generated stubs.

```bash
node utils/lang-cli.mjs --missing de   # list keys missing from de
# translate keys in src/lang/gen/de.ts
node utils/lang-cli.mjs                # regenerate gen/index.ts
```

Add the locale to `ALL_LOCALES` in `utils/lang-cli.mjs` if it is not listed yet, then open a
PR with the `i18n` label. Please translate whole files (not single keys) so the language
ships complete.

## Writing a plugin

```bash
npm run gen:plugin my-plugin
cd my-plugin
# edit main.js, plugin.json
# zip the folder and install it via XCoder → Plugins → Install from .zip
```

Plugins run against the `xcoder` facade (`commands`, `fs`, `editor`, `agents`, `ai`, …).
The full contract lives in [docs/api-reference.md](docs/api-reference.md) and
[docs/plugin-development.md](docs/plugin-development.md).

## Reporting bugs

Open an issue with the **bug report** template. Include the app version, platform
(web/Android), reproduction steps and console output. For AI-provider problems, include the
provider preset id (never your API key!) and the HTTP status returned.

## Code style

- Strict TypeScript, no `any` unless justified with a comment.
- Event names use the `domain:action` convention on the shared bus.
- Every module is import-cycle free; keep it that way.
- Prefer small pure functions that the test suite can exercise headlessly (the shell, git
  state machine and agent tools are all tested without a browser).

## Licensing

By contributing you agree your work is released under the project's MIT license.
