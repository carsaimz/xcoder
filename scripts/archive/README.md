# scripts/archive — one-off patchers (historical reference)

Scripts used **once** during past releases to patch the tree in place via
exact string replacement. They are NOT wired into `npm run`, reference
absolute paths from another machine (`/home/z/my-project/xcoder`), and
assume the source tree of the version noted in their name — running them
against current `main` will fail loudly (anchors no longer match).

| file | release |
| --- | --- |
| `applyGhFixes.mjs` | v1.5.4 GitHub sign-in fixes |
| `applyV160Batch1.mjs` | v1.6.0 remaining wiring (webpack entry, settings, commands) |
| `patch_1816_titleactions.py` | v1.8.16 sidebar view title actions |

Do not extend them: sanctioned edits go directly into `src/` (Biome +
tests), and future mechanical migrations should be done in a scratch
branch and discarded after landing — that is why the originals are here.

Note: `applyV160Batch1.mjs` also documents a real trap — `webpack.config.js`
had MIXED line endings (LF line inside a CRLF file). That file was removed
in the Rspack-only cleanup; if its `replWorker` entry starts failing tests,
compare `rspack.config.js` instead.
