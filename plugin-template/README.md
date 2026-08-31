# My Plugin (template)

XCoder plugin scaffold. Copy this folder (`pnpm run plugin -- new "My Plugin"`
does it for you) and start coding in `main.js`.

## Files

| File | Role |
|---|---|
| `plugin.json` | Manifest — change `id`, `name`, `author` before publishing. |
| `main.js` | Entry point. Registers `init`/`unmount` via `xcoder.setPluginInit/Unmount`. |
| `icon.png` | 512×512 icon. |
| `README.md` | This file — describe your plugin for the marketplace. |

## Install (development)

1. Serve this folder over HTTP (or push it to the device storage):
   `npx serve .`
2. XCoder → **Settings → Plugins → Install from URL…**
3. Paste the folder URL (must expose `plugin.json`).
4. Enable the plugin.

## Package

```bash
pnpm run plugin -- pack /path/to/this/folder
# → com.xcoder.my-plugin.zip  (install via Settings → Plugins)
```

## Docs

- Full guide: [`docs/plugin-development.md`](../docs/plugin-development.md)
- API reference: [`docs/api-reference.md`](../docs/api-reference.md)
- Typings: [`src/types/xcoder.d.ts`](../src/types/xcoder.d.ts)
