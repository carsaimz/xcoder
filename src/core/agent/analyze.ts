/** Code structure outline without a full parser — regex heuristics per family. */

import * as path from '../../lib/path';
import { Workspace } from '../file';

export interface Outline {
  path: string;
  language: string;
  lines: number;
  imports: string[];
  functions: string[];
  classes: string[];
  exports: string[];
  todos: string[];
}

const PATTERNS: Record<string, { fn: RegExp[]; cls: RegExp[]; imp: RegExp[]; exp: RegExp[] }> = {
  clike: {
    fn: [
      /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g,
      /^\s*(?:public|private|protected|static)?\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*{/gm,
    ],
    cls: [/class\s+([A-Za-z_$][\w$]*)/g, /interface\s+([A-Za-z_$][\w$]*)/g, /type\s+([A-Za-z_$][\w$]*)\s*=/g],
    imp: [/import\s+[^;]*?from\s+['"]([^'"]+)['"]/g, /^\s*import\s+['"]([^'"]+)['"]/gm, /require\(['"]([^'"]+)['"]\)/g],
    exp: [/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g, /export\s+\{([^}]+)\}/g],
  },
  python: {
    fn: [/def\s+([A-Za-z_][\w]*)\s*\(/g, /async\s+def\s+([A-Za-z_][\w]*)\s*\(/g],
    cls: [/class\s+([A-Za-z_][\w]*)/g],
    imp: [/^\s*import\s+([\w.]+)/gm, /^\s*from\s+([\w.]+)\s+import/gm],
    exp: [],
  },
};

function familyFor(ext: string): string | null {
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'java', 'kt', 'cs', 'go', 'rs', 'c', 'h', 'cpp', 'php', 'swift', 'dart'].includes(ext)) return 'clike';
  if (['py'].includes(ext)) return 'python';
  return null;
}

function unique(a: string[]): string[] {
  return [...new Set(a.map((s) => s.trim()).filter(Boolean))];
}

export async function analyzeFile(workspace: Workspace, filePath: string): Promise<Outline> {
  const ext = path.extname(filePath).replace('.', '');
  const text = (await workspace.readText(filePath)) as string;
  const lines = text.split('\n');
  const family = familyFor(ext);
  const outline: Outline = {
    path: filePath,
    language: ext || 'plaintext',
    lines: lines.length,
    imports: [],
    functions: [],
    classes: [],
    exports: [],
    todos: [],
  };
  if (!family) {
    outline.todos = lines
      .map((l, i) => (/\b(TODO|FIXME|HACK|XXX)\b/.exec(l) ? `${i + 1}: ${l.trim().slice(0, 120)}` : ''))
      .filter(Boolean);
    return outline;
  }
  const p = PATTERNS[family];
  for (const re of p.fn) {
    for (const m of text.matchAll(re)) outline.functions.push(m[1]);
  }
  for (const re of p.cls) {
    for (const m of text.matchAll(re)) outline.classes.push(m[1]);
  }
  for (const re of p.imp) {
    for (const m of text.matchAll(re)) outline.imports.push(m[1]);
  }
  for (const re of p.exp) {
    for (const m of text.matchAll(re)) {
      if (m[1].includes(',')) m[1].split(',').forEach((x) => outline.exports.push(x.trim()));
      else outline.exports.push(m[1]);
    }
  }
  outline.functions = unique(outline.functions).slice(0, 50);
  outline.classes = unique(outline.classes).slice(0, 25);
  outline.imports = unique(outline.imports).slice(0, 50);
  outline.exports = unique(outline.exports).slice(0, 50);
  outline.todos = lines
    .map((l, i) => (/\b(TODO|FIXME|HACK|XXX)\b/.exec(l) ? `${i + 1}: ${l.trim().slice(0, 120)}` : ''))
    .filter(Boolean)
    .slice(0, 20);
  return outline;
}
