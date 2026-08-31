/**
 * Search engine — pure helpers for project-wide search & replace.
 * Supports plain text, regex, case sensitivity and whole-word matching,
 * plus a workspace walker that skips heavy/virtual directories.
 */

import * as path from './path';

export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  caseSensitive: false,
  regex: false,
  wholeWord: false,
};

export interface ContentMatch {
  line: number;
  /** 0-based column of the match start on the line */
  column: number;
  /** the full line, trimmed for display */
  text: string;
  length: number;
}

/** Compile a query into a global RegExp honoring the option flags. */
export function compilePattern(query: string, opts: SearchOptions): RegExp | null {
  if (!query) return null;
  let source: string;
  if (opts.regex) {
    try {
      // validate the user regex first
      new RegExp(query);
      source = query;
    } catch {
      return null;
    }
  } else {
    source = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  if (opts.wholeWord) source = `\\b(?:${source})\\b`;
  try {
    return new RegExp(source, opts.caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/** Find all matches of `pattern` in a text document (line/column aware). */
export function findInContent(text: string, pattern: RegExp, maxMatches = 200): ContentMatch[] {
  const out: ContentMatch[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && out.length < maxMatches; i++) {
    const line = lines[i];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null && out.length < maxMatches) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      out.push({ line: i + 1, column: m.index, text: line.trim().slice(0, 200), length: m[0].length });
    }
  }
  return out;
}

/** Replace every match of `pattern` in a text document. */
export function replaceInContent(text: string, pattern: RegExp, replacement: string): string {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return text.replace(re, replacement);
}

/** True for directories that should never be walked in project search. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'www', 'dist', 'build', 'out', 'coverage',
  'platforms', 'plugins', '.gradle', '.idea', '__pycache__', '.cache',
]);

/** Binary-ish extensions that are skipped when reading content. */
const SKIP_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'pdf', 'zip', 'gz',
  'tar', 'rar', '7z', 'woff', 'woff2', 'ttf', 'eot', 'otf', 'mp3', 'mp4',
  'wav', 'ogg', 'apk', 'aab', 'jar', 'so', 'exe', 'bin', 'class', 'db',
]);

export interface SearchHit extends ContentMatch {
  file: string;
}

export interface WalkProgress {
  files: number;
  hits: number;
}

export interface SearchWalkOptions {
  maxFiles?: number;
  maxHits?: number;
  maxDepth?: number;
  glob?: string;
  onProgress?: (p: WalkProgress) => void;
  signal?: { aborted: boolean };
}

interface ListableWorkspace {
  listdir(dir: string): Promise<Array<{ path: string; isDir: boolean }>>;
  readText(file: string): Promise<string>;
}

/**
 * Walk a workspace root and collect every match of `pattern`.
 * Returns hits grouped flat; UI groups by file.
 */
export async function searchWorkspace(
  ws: ListableWorkspace,
  root: string,
  pattern: RegExp,
  opts: SearchWalkOptions = {},
): Promise<SearchHit[]> {
  const maxFiles = opts.maxFiles ?? 800;
  const maxHits = opts.maxHits ?? 400;
  const maxDepth = opts.maxDepth ?? 10;
  const hits: SearchHit[] = [];
  let files = 0;
  const glob = opts.glob?.replace(/\*/g, '').toLowerCase() ?? null;

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (hits.length >= maxHits || files >= maxFiles || depth > maxDepth) return;
    if (opts.signal?.aborted) return;
    let entries: Array<{ path: string; isDir: boolean }>;
    try {
      entries = await ws.listdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (hits.length >= maxHits || files >= maxFiles || opts.signal?.aborted) return;
      const base = path.basename(entry.path);
      if (entry.isDir) {
        if (!SKIP_DIRS.has(base)) await walk(entry.path, depth + 1);
        continue;
      }
      const ext = path.extname(base).replace('.', '').toLowerCase();
      if (SKIP_EXTS.has(ext)) continue;
      if (glob && !base.toLowerCase().includes(glob)) continue;
      files++;
      opts.onProgress?.({ files, hits: hits.length });
      let text: string;
      try {
        text = await ws.readText(entry.path);
      } catch {
        continue;
      }
      const matches = findInContent(text, pattern, Math.max(1, maxHits - hits.length));
      for (const m of matches) {
        hits.push({ ...m, file: entry.path });
        if (hits.length >= maxHits) return;
      }
    }
  };

  await walk(root, 0);
  return hits;
}

/** Group flat hits by file path, preserving order. */
export function groupByFile(hits: SearchHit[]): Map<string, SearchHit[]> {
  const groups = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const list = groups.get(hit.file);
    if (list) list.push(hit);
    else groups.set(hit.file, [hit]);
  }
  return groups;
}
