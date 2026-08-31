#!/usr/bin/env node
/**
 * Locale skeleton generator.
 *
 * Creates placeholder `<code>.json` files for all supported locales that do
 * not exist yet in src/lang/. Placeholders copy the English values and are
 * flagged "__meta__.status": "placeholder" — the runtime falls back to the
 * en/pt chain until real translations land.
 *
 * Usage:  node utils/generate-locales.js [--force]
 */
const fs = require('fs');
const path = require('path');

const LANG_DIR = path.join(__dirname, '..', 'src', 'lang');

const SUPPORTED = [
  'af', 'ar', 'az', 'be', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'es', 'fa',
  'fi', 'fr', 'gl', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'ms',
  'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sr', 'sv', 'th', 'tr', 'uk', 'ur',
  'vi', 'zh-CN', 'zh-TW'
];

const force = process.argv.includes('--force');
const en = JSON.parse(fs.readFileSync(path.join(LANG_DIR, 'en.json'), 'utf8'));
const stripMeta = ({ __meta__, ...keys }) => keys;

let created = 0;
let skipped = 0;
for (const code of SUPPORTED) {
  const target = path.join(LANG_DIR, `${code}.json`);
  if (fs.existsSync(target) && !force) {
    skipped++;
    continue;
  }
  const skeleton = {
    __meta__: {
      code,
      status: 'placeholder',
      base: 'en',
      hint: 'Copy values from en.json and translate. Missing keys fall back to en at runtime.'
    },
    ...stripMeta(en)
  };
  fs.writeFileSync(target, JSON.stringify(skeleton, null, 2) + '\n', 'utf8');
  created++;
}

console.log(`generate-locales: ${created} created, ${skipped} skipped, ${SUPPORTED.length} supported locales total`);
