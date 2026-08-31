#!/usr/bin/env node
/**
 * changelog.mjs — generate release notes from conventional commits.
 *
 *   node changelog.mjs <from-ref> <to-ref>
 *
 * Groups commit subjects by type (feat/fix/perf/refactor/docs/test/chore…),
 * collects breaking changes (feat!:/fix!: or BREAKING CHANGE: bodies) and
 * emits GitHub-flavoured markdown with commit links.
 */

import { execFileSync } from 'node:child_process';

const [fromRef, toRef] = process.argv.slice(2);
if (!fromRef || !toRef) {
  console.error('usage: node changelog.mjs <from-ref> <to-ref>');
  process.exit(1);
}

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();

/** hash | subject | body-with-¶ */
const raw = git([
  'log',
  '--no-merges',
  '--pretty=%H%x09%s%x09%b',
  `${fromRef}..${toRef}`,
]);

const GROUPS = {
  feat: 'Features',
  fix: 'Bug fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build system',
  ci: 'CI/CD',
  style: 'Style',
  chore: 'Maintenance',
};

const shaUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY || 'carsaimz/xcoder'}`;

function shortSha(hash) {
  return `[${hash.slice(0, 7)}](${shaUrl}/commit/${hash})`;
}

const buckets = new Map(Object.keys(GROUPS).map((k) => [k, []]));
const breaking = [];
const other = [];

for (const line of raw.split('\n')) {
  if (!line.trim()) continue;
  const [hash, subject = '', body = ''] = line.split('\t');
  const clean = subject.trim();
  const breakingInline = /^(?:\w+)(?:\([^)]*\))?!:\s*(.+)$/.exec(clean);
  const hasBreakingBody = /BREAKING CHANGE:/i.test(body);
  if (breakingInline || hasBreakingBody) {
    breaking.push({ hash, text: breakingInline ? breakingInline[1] : clean });
  }
  const m = /^(\w+)(?:\([^)]*\))?:\s*(.+)$/.exec(clean);
  if (m && buckets.has(m[1])) {
    buckets.get(m[1]).push({ hash, text: m[2] });
  } else {
    other.push({ hash, text: clean });
  }
}

const out = [];
if (breaking.length) {
  out.push('## ⚠ Breaking changes');
  for (const b of breaking) out.push(`- ${b.text} (${shortSha(b.hash)})`);
  out.push('');
}
for (const [type, title] of Object.entries(GROUPS)) {
  const items = buckets.get(type);
  if (!items?.length) continue;
  out.push(`## ${title}`);
  for (const item of items) out.push(`- ${item.text} (${shortSha(item.hash)})`);
  out.push('');
}
if (other.length) {
  out.push('## Other changes');
  for (const item of other) out.push(`- ${item.text} (${shortSha(item.hash)})`);
  out.push('');
}
if (!out.length) out.push('_No notable changes._');

console.log(out.join('\n').trim());
