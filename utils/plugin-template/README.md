# __PLUGIN_NAME__

An [XCoder](https://github.com/carsaimz/xcoder) plugin.

## Develop

- Edit `main.js` — the plugin entry.
- `plugin.json` declares the id, name, version and entry file.

## Install

Zip this folder (`plugin.json` must be at the zip root) and use
**XCoder → Plugins → Install from .zip**.

## API

Inside the plugin, `globalThis.xcoder.require(name)` exposes:

`path` `bus` `storage` `helpers` `i18n` `commands` `settings` `toast` `dialog`
`cache` `plugins` `fs` `editor` `shell` `agents` `ai` `lsp` `version`

See docs/api-reference.md for the full contract.
