# Building & Contributing to XCoder

Everything you need to compile, test, package and ship the app.

---

## 1. Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Node.js | ≥ 20 | build tooling, tests |
| pnpm | ≥ 9 (npm works too) | dependency management |
| JDK | 17 | Android build |
| Android SDK | API 34 | `cordova build android` |
| Gradle | (bundled with Cordova) | Android build |

Check your Android setup with `cordova requirements` after adding the platform.

---

## 2. Project scripts

```bash
pnpm install            # install dependencies

pnpm run build:dev      # bundle to www/ (development, readable, sourcemaps)
pnpm run build:prod     # bundle to www/ (minified)
pnpm run watch          # rebuild on change

pnpm run typecheck      # tsc --noEmit (strict)
pnpm run test           # vitest, single run
pnpm run test:watch     # vitest, watch mode
pnpm run lint           # biome check (src + utils)
pnpm run lint:fix       # biome check --write
pnpm run format         # biome format --write

pnpm run lang -- <cmd>  # i18n CLI (see docs/i18n.md)
pnpm run plugin -- <cmd># plugin CLI (new | pack | validate)

pnpm run cordova:android  # cordova build android
pnpm run cordova:run      # cordova run android (device/emulator)
```

---

## 3. Running in a browser (no Android needed)

The bundle is a plain IIFE — the whole IDE runs in any modern browser with
the `browser://` storage backend:

```bash
pnpm run build:dev
npx serve www            # or: python3 -m http.server -d www 8080
# open http://localhost:8080
```

Use this loop for day-to-day development; Android specifics only matter for
native filesystem, Proot and permissions.

---

## 4. Android build

```bash
cordova platform add android
pnpm run build:prod
cordova build android
# → platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

### Release (signed)

```bash
keytool -genkey -v -keystore xcoder.keystore -alias xcoder \
        -keyalg RSA -keysize 2048 -validity 10000

cordova build android --release -- \
  --keystore=xcoder.keystore \
  --alias=xcoder \
  --storePassword=*** \
  --password=***
# → .../outputs/apk/release/app-release.apk
```

Keep the keystore out of git. On first launch the app asks for storage
permissions (required by `cordova-plugin-android-permissions`).

---

## 5. Development workflow

1. **Branch** from `main`: `feat/<topic>` or `fix/<topic>`.
2. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(terminal): add path completion`, `fix(fs): EEXIST on webdav MKCOL`.
3. **Before pushing**:
   ```bash
   pnpm run typecheck && pnpm run test && pnpm run lint
   ```
   CI runs exactly these three.
4. **PR checklist**: description + steps to test; screenshots for UI changes;
   docs updated when APIs change (`docs/api-reference.md` is the contract).

### Code style

- **Biome** owns formatting/linting — do not fight it, run `pnpm run format`.
- TypeScript strict; `any` is allowed only with a comment explaining why.
- No legacy editor prefixes — the public surface is `xcoder.*` only.
- Core modules never import from `src/ui/`.

### Adding a feature — where things go

| Feature | Touch |
|---|---|
| New shell command | `src/core/terminal/shell.ts` (`registerBuiltins`) |
| New command palette entry | `src/ui/builtin.ts` or a plugin |
| New theme | `src/core/editor/themes.ts` + `styles/themes.css` |
| New FS backend | implement `FileSystemBackend`, register in `src/main.ts` |
| New language | already bundled? else `editorLanguages.register` |
| New setting | `src/api/settings.ts` (`DEFAULTS`, `validate`) + settings UI |

---

## 6. Testing

```
tests/
├── path.test.ts       # lib/path — URL math
├── shell.test.ts      # virtual shell + git/npm mocks over MemoryBackend
├── commands.test.ts   # command registry + keybinding matching
└── i18n.test.ts       # fallback chain, emitter, helpers
```

Rules of thumb:

- FS-dependent code is tested against `MemoryBackend` — no mocks, no browser.
- Every bug fix lands with a regression test.
- UI behavior (DOM) is smoke-tested manually in the browser build (§3);
  keep components thin so logic stays testable.

---

## 7. Releasing

1. Bump version in `package.json`, `plugin.json`, `config.xml` (keep in sync).
2. Update `CHANGELOG.md`.
3. Tag: `git tag v1.x.y && git push --tags`.
4. CI attaches the APK and the plugin-template zip to the release.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `cordova: command not found` | `pnpm install` (cordova is a devDependency) or `npm i -g cordova` |
| Gradle/SDK errors | `cordova requirements`; install platform 34 via sdkmanager |
| Blank page after build | serve `www/` over HTTP and check the console — `file://` blocks `fetch` of lang JSON in desktop browsers |
| Tests fail on IndexedDB | they shouldn't — suites run against the memory backend; check you didn't import a UI module in a core test |
