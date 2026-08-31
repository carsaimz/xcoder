#!/usr/bin/env node
/**
 * XCoder plugin CLI.
 *
 *   node utils/plugin-cli.js new <name>       scaffold a plugin from plugin-template/
 *   node utils/plugin-cli.js pack <dir>       zip a plugin folder (needs jszip)
 *   node utils/plugin-cli.js validate <dir>   check manifest + files
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'plugin-template');

function cmdNew(name) {
  if (!name) return console.error('usage: plugin new <name>');
  const slug = name.toLowerCase().replace(/[^\w-]+/g, '-');
  const target = path.join(process.cwd(), slug);
  if (fs.existsSync(target)) return console.error(`exists: ${target}`);
  fs.cpSync(TEMPLATE, target, { recursive: true });

  // rewrite the manifest with a real id and name
  const manifestPath = path.join(target, 'plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.id = `com.xcoder.${slug}`;
  manifest.name = name;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`plugin scaffolded at ${target}`);
  console.log(`next: edit main.js (id: ${manifest.id})`);
}

function readManifest(dir) {
  const manifestPath = path.join(dir, 'plugin.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`missing plugin.json in ${dir}`);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

async function cmdPack(dir) {
  if (!dir) return console.error('usage: plugin pack <dir>');
  const abs = path.resolve(dir);
  const manifest = readManifest(abs);
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('plugin.json', JSON.stringify(manifest, null, 2));
  for (const f of manifest.files ?? ['main.js']) {
    const p = path.join(abs, f);
    if (!fs.existsSync(p)) throw new Error(`manifest lists "${f}" but it is missing`);
    zip.file(f, fs.readFileSync(p));
  }
  if (fs.existsSync(path.join(abs, 'icon.png'))) {
    zip.file('icon.png', fs.readFileSync(path.join(abs, 'icon.png')));
  }
  const out = path.join(ROOT, `${manifest.id}.zip`);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(out, buf);
  console.log(`packed: ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}

function cmdValidate(dir) {
  if (!dir) return console.error('usage: plugin validate <dir>');
  const abs = path.resolve(dir);
  const manifest = readManifest(abs);
  const problems = [];
  if (!/^[a-z0-9.-]+$/.test(manifest.id)) problems.push('invalid id (reverse-DNS, lowercase)');
  if (!manifest.name) problems.push('missing name');
  if (!manifest.version) problems.push('missing version (semver)');
  if (!manifest.author?.name) problems.push('missing author.name');
  const main = manifest.main ?? 'main.js';
  if (!fs.existsSync(path.join(abs, main))) problems.push(`missing entry: ${main}`);
  for (const f of manifest.files ?? []) {
    if (!fs.existsSync(path.join(abs, f))) problems.push(`manifest file missing: ${f}`);
  }
  if (problems.length) {
    console.error('invalid plugin:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`OK: ${manifest.id}@${manifest.version} — ${manifest.files?.length ?? 1} files`);
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'new': cmdNew(args[0]); break;
  case 'pack': void cmdPack(args[0]); break;
  case 'validate': cmdValidate(args[0]); break;
  default:
    console.log('usage: pnpm run plugin -- <new|pack|validate> [args]');
}
