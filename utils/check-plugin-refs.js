#!/usr/bin/env node
/**
 * Valida todas as referências de arquivos nos plugin.xml de src/plugins.
 * Garante que source-file, resource-file, js-module e hooks apontam para
 * arquivos que existem — evitando "Failed to install plugin" no CI.
 * Uso: node utils/check-plugin-refs.js  (exit 1 se houver pendências)
 */
const fs = require("fs");
const path = require("path");

const PLUGINS_DIR = path.join(__dirname, "..", "src", "plugins");
const ATTRS = {
  "source-file": "src",
  "resource-file": "src",
  "js-module": "src",
  hook: "src",
};
const tags = Object.keys(ATTRS);

let problems = 0;
for (const plugin of fs.readdirSync(PLUGINS_DIR).sort()) {
  const xmlPath = path.join(PLUGINS_DIR, plugin, "plugin.xml");
  if (!fs.existsSync(xmlPath)) continue;
  const xmlFull = fs.readFileSync(xmlPath, "utf8");
  // Escopa ao bloco <platform name="android"> (única plataforma que buildamos);
  // refs de ios/osx/windows/browser são ignoradas pelo Cordova em builds Android.
  const blockRe = /<platform name="android">([\s\S]*?)<\/platform>/;
  const block = blockRe.exec(xmlFull);
  if (!block) continue;
  const xml = block[1];
  for (const tag of tags) {
    const re = new RegExp(`<${tag}\\b[^>]*>`, "g");
    for (const m of xml.matchAll(re)) {
      const el = m[0];
      const attr = ATTRS[tag];
      const am = new RegExp(`\\b${attr}="([^"]+)"`).exec(el);
      if (!am) continue;
      const target = path.join(PLUGINS_DIR, plugin, am[1]);
      if (!fs.existsSync(target)) {
        console.log(`MISSING [${plugin}] <${tag} ${attr}="${am[1]}"> -> ${target}`);
        problems++;
      }
    }
  }
}
// Valida specs locais no package.json (cordova.plugins)
const pkg = require(path.join(__dirname, "..", "package.json"));
const pluginsCfg = (pkg.cordova && pkg.cordova.plugins) || {};
for (const [name, spec] of Object.entries(pluginsCfg)) {
  const specVal = typeof spec === "string" ? spec : spec && spec.spec;
  if (specVal && (specVal.startsWith("src/") || specVal.startsWith("./src/"))) {
    const p = path.join(__dirname, "..", specVal.replace(/^\.\//, ""));
    if (!fs.existsSync(p)) {
      console.log(`MISSING [package.json] plugin "${name}" spec=${specVal}`);
      problems++;
    }
  }
}
console.log(problems === 0 ? "OK: todas as referências de plugins resolvem." : `ERRO: ${problems} referência(s) quebrada(s).`);
process.exit(problems === 0 ? 0 : 1);
