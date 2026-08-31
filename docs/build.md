# Building XCoder

## Web

```bash
npm install
npm run build        # NODE_ENV=production rspack build → www/
npm run build:dev    # development build with sourcemaps
npm run dev          # dev server + HMR (port 8080)
npm run serve        # static-serve the www/ folder
```

Output layout: `www/index.html` (committed), `www/bundle.js` + `www/bundle.css`
(generated) and lazy chunks (`NNNN.bundle.js`) for CodeMirror grammars and Prettier
parsers, fetched on first use.

Quality gates:

```bash
npm run typecheck    # strict tsc, zero errors
npm test             # vitest, 88 cases
node utils/lang-cli.mjs --check
```

## Android (Cordova)

Requirements: JDK 17, Android SDK (API 34), Gradle (wrapper via cordova-android 13).

```bash
npm run build                                        # web assets first
npx cordova platform add android@13
npx cordova build android                            # debug APK
npx cordova build android --release -- --packageType=bundle   # signed AAB
```

Artifacts land in `platforms/android/app/build/outputs/{apk,bundle}/…`.

> You normally don't run these by hand — CI builds every APK/AAB (below).

## CI/CD pipelines

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci.yml` | push / PR to `main` | typecheck + tests + locale parity, then production build with artifact upload |
| `release.yml` | push tag `v*` **or** manual dispatch with a version | gates on tests → generates changelog from conventional commits → creates the GitHub release → dispatches the Android release build |
| `android-debug.yml` | push to `main` (src/www changes) | debug APK → rolling `dev-build` pre-release + artifact |
| `android-release.yml` | called by `release.yml` (or manually with a tag) | release APK + AAB, signed when secrets exist, attached to the tag's release |

Supporting bots: **Dependabot** (npm grouped updates + Actions versions), **labeler**
(path-based PR labels), **greetings** (first issue/PR welcome), **stale** (60/14 days).

### Release checklist (maintainer)

```bash
# option A — automatic
gh workflow run release.yml -f version=1.2.0
# option B — manual
npm version minor           # or patch/major
git push origin main --tags
```

The release workflow bumps `package.json`/`config.xml`/`src/version.ts`, prepends the new
section to `CHANGELOG.md`, commits `chore(release): vX.Y.Z`, tags and pushes.

### Android signing secrets

| Secret | Value |
| --- | --- |
| `KEYSTORE_BASE64` | `base64 -w0 my-release.keystore` |
| `KEYSTORE_PASSWORD` | keystore store password |
| `KEY_ALIAS` | signing key alias |
| `KEY_PASSWORD` | key password |

Generate a keystore locally:

```bash
keytool -genkey -v -keystore my-release.keystore -alias xcoder \
        -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 my-release.keystore > keystore.b64   # paste into the secret
```

Keep `my-release.keystore` **out of git** (already in `.gitignore`). Without the secrets
the release job still publishes unsigned artifacts and notes it in the job summary.

### Changing the Android target

`config.xml` pins `android@^13` (SDK 34, minSdk 24). Bump the engine spec and the workflows
(`cordova platform add android@X`) together.
