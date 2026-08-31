#!/usr/bin/env node
/**
 * XCoder i18n CLI.
 *
 *   node utils/lang-cli.js add <code> [name]   scaffold a new locale
 *   node utils/lang-cli.js remove <code>       delete a locale file
 *   node utils/lang-cli.js search <term>       search keys and values
 *   node utils/lang-cli.js update              diff all locales against en.json
 *   node utils/lang-cli.js stats               translation coverage
 */
const fs = require('fs');
const path = require('path');

const LANG_DIR = path.join(__dirname, '..', 'src', 'lang');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flatEntries(dict) {
  return Object.entries(dict).filter(([k]) => k !== '__meta__');
}

function cmdAdd(code, name) {
  if (!code) return console.error('usage: lang add <code> [name]');
  const target = path.join(LANG_DIR, `${code}.json`);
  if (fs.existsSync(target)) return console.error(`locale exists: ${target}`);
  const en = readJson(path.join(LANG_DIR, 'en.json'));
  const skeleton = {
    __meta__: { code, name: name || code, status: 'placeholder', base: 'en' },
    ...Object.fromEntries(flatEntries(en))
  };
  fs.writeFileSync(target, JSON.stringify(skeleton, null, 2) + '\n');
  console.log(`created ${target} — translate values from en.json`);
}

function cmdRemove(code) {
  if (!code) return console.error('usage: lang remove <code>');
  const target = path.join(LANG_DIR, `${code}.json`);
  if (code === 'en') return console.error('refusing to remove the base locale');
  if (!fs.existsSync(target)) return console.error(`not found: ${target}`);
  fs.unlinkSync(target);
  console.log(`removed ${target}`);
}

function cmdSearch(term) {
  if (!term) return console.error('usage: lang search <term>');
  const needle = term.toLowerCase();
  for (const file of fs.readdirSync(LANG_DIR).filter((f) => f.endsWith('.json'))) {
    const dict = readJson(path.join(LANG_DIR, file));
    for (const [k, v] of flatEntries(dict)) {
      if (k.toLowerCase().includes(needle) || String(v).toLowerCase().includes(needle)) {
        console.log(`${file.replace('.json', '').padEnd(6)} ${k} = ${v}`);
      }
    }
  }
}

function cmdUpdate() {
  const en = readJson(path.join(LANG_DIR, 'en.json'));
  const enKeys = new Set(flatEntries(en).map(([k]) => k));
  let pending = 0;
  for (const file of fs.readdirSync(LANG_DIR).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
    const dict = readJson(path.join(LANG_DIR, file));
    const missing = [...enKeys].filter((k) => !(k in dict));
    const extra = flatEntries(dict).map(([k]) => k).filter((k) => !enKeys.has(k));
    if (missing.length || extra.length) {
      pending++;
      console.log(`${file}: ${missing.length} missing, ${extra.length} obsolete`);
      for (const k of missing) console.log(`  - missing: ${k}`);
      for (const k of extra) console.log(`  - obsolete: ${k}`);
    }
  }
  if (!pending) console.log('all locales in sync with en.json');
}

function cmdStats() {
  const en = readJson(path.join(LANG_DIR, 'en.json'));
  const total = flatEntries(en).length;
  console.log(`base keys: ${total}\n`);
  const rows = [];
  for (const file of fs.readdirSync(LANG_DIR).filter((f) => f.endsWith('.json'))) {
    const dict = readJson(path.join(LANG_DIR, file));
    const keys = flatEntries(dict);
    let translated = 0;
    for (const [k, v] of keys) {
      const enValue = en[k];
      if (file !== 'en.json' && v === enValue) continue;
      translated++;
    }
    const pct = file === 'en.json' ? 100 : Math.round((translated / total) * 100);
    rows.push({ file: file.replace('.json', ''), pct, status: dict.__meta__?.status ?? '?' });
  }
  for (const r of rows.sort((a, b) => b.pct - a.pct)) {
    console.log(`${r.file.padEnd(7)} ${String(r.pct).padStart(3)}%  ${r.status}`);
  }
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'add': cmdAdd(args[0], args[1]); break;
  case 'remove': cmdRemove(args[0]); break;
  case 'search': cmdSearch(args[0]); break;
  case 'update': cmdUpdate(); break;
  case 'stats': cmdStats(); break;
  default:
    console.log('usage: pnpm run lang -- <add|remove|search|update|stats> [args]');
}
