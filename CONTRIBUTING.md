# Contributing to XCoder

Obrigado por contribuir! This project follows the same spirit as its ancestor
Pragmatic, plugin-friendly, mobile-first.

## Setup (5 minutes)

```bash
git clone https://github.com/xcoder-app/xcoder.git
cd xcoder
pnpm install
pnpm run build:dev
npx serve www        # IDE running at http://localhost:3000
```

Verify your toolchain before the first PR:

```bash
pnpm run typecheck   # strict TypeScript
pnpm run test        # Vitest suites
pnpm run lint        # Biome
```

All three must pass — CI blocks anything else.

## How to contribute

### 1. Report bugs

Open an issue with: XCoder version, platform (browser / Android + version),
steps to reproduce, expected vs actual, console output. Attach screenshots
for UI issues.

### 2. Propose features

Open a **discussion first** for anything architectural (new backend, LSP
surface changes, plugin API). Small, well-scoped features can go straight to
a PR.

### 3. Submit code

1. Fork + branch: `feat/short-name` or `fix/short-name`.
2. [Conventional Commits](https://www.conventionalcommits.org/) —
   `feat(shell): add tab completion for paths`.
3. Add/adjust tests for behavior changes (see `tests/`).
4. Update docs when you touch public APIs:
   - `docs/api-reference.md` is the **contract** — keep it in sync.
   - `docs/architecture.md` for structural changes.
5. Run the trio (typecheck/test/lint) and open the PR.

### 4. Translate

See [`docs/i18n.md`](./i18n.md). The 40 placeholder locales are waiting for
you — `pnpm run lang -- stats` shows where help is needed most.

### 5. Build plugins

You never need to touch the core to extend XCoder. Start from
[`plugin-template/`](../plugin-template/) and follow
[`docs/plugin-development.md`](./plugin-development.md). Great first
contributions are plugins, not core patches.

## Code rules

| Rule | Why |
|---|---|
| Public APIs only through `src/api/*` facades | keeps the plugin contract stable |
| No legacy editor prefixes in public APIs | `xcoder.*` is the only surface |
| Core never imports `src/ui/` | core must stay testable in Node |
| FS access always through URLs + backends | never call `cordova.*` directly |
| `any` only with a justification comment | strict TS is the default |
| One PR, one concern | reviewable > heroic |

## Review process

- Maintainers triage weekly; expect a first response within ~7 days.
- PRs need one approval; API changes need two.
- We may ask you to split or squash commits — nothing personal.

## License

By contributing you agree your work is released under the project's
[MIT license](./LICENSE).
