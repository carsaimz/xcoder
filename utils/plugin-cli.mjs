#!/usr/bin/env node
/**
 * plugin-cli — scaffold a new XCoder plugin.
 *
 *   node utils/plugin-cli.mjs my-plugin
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE = join(__dirname, 'plugin-template');

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('usage: node utils/plugin-cli.mjs <plugin-id>   (lowercase, kebab-case)');
  process.exit(1);
}
const target = join(ROOT, name);
if (existsSync(target)) {
  console.error(`directory already exists: ${target}`);
  process.exit(1);
}

mkdirSync(target, { recursive: true });
for (const file of ['plugin.json', 'main.js', 'README.md']) {
  const src = join(TEMPLATE, file);
  const raw = readFileSync(src, 'utf8').replace(/__PLUGIN_ID__/g, name).replace(/__PLUGIN_NAME__/g, name);
  writeFileSync(join(target, file), raw);
}
cpSync(join(TEMPLATE, 'xcoder.d.ts'), join(target, 'xcoder.d.ts'));

console.log(`✓ created plugin scaffold in ./${name}/`);
console.log('  - edit main.js and plugin.json');
console.log(`  - zip the folder and install via XCoder → Plugins → Install from .zip`);
