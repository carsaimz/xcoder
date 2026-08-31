#!/usr/bin/env node
/**
 * bump.mjs — set the project version in package.json, config.xml and src/version.ts.
 *
 *   node bump.mjs 1.2.0
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('usage: node bump.mjs <semver>');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// package.json
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// config.xml
const cfgPath = join(root, 'config.xml');
const cfg = readFileSync(cfgPath, 'utf8');
writeFileSync(cfgPath, cfg.replace(/(<widget[^>]*version=")[^"]+/i, `$1${version}`));

// src/version.ts
writeFileSync(join(root, 'src', 'version.ts'), `/** Central version constant. */\nexport const VERSION = '${version}';\n`);

console.log(`version → ${version}`);
