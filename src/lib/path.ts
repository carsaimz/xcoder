/**
 * Path & URL utilities.
 *
 * XCoder files are identified by URLs: `<scheme>://<path>`, e.g.
 *   file:///sdcard/Projects/site/index.html
 *   browser:///home/welcome.md
 *   memory:///home/user/main.py
 *
 * These helpers are DOM-free so they run in Node (Vitest) too.
 */

export interface UrlParts {
  scheme: string;
  path: string;
}

/** Split `scheme://path` into parts. A bare path gets scheme ''. */
export function parseUrl(url: string): UrlParts {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/.exec(url);
  if (!m) return { scheme: '', path: url };
  return { scheme: m[1].toLowerCase(), path: m[2] };
}

/** Build `scheme://path`. */
export function buildUrl(scheme: string, path: string): string {
  return scheme ? `${scheme}://${path}` : path;
}

/** Normalize `/a/./b/../c` → `/a/c`. Does NOT touch the scheme. */
export function normalize(p: string): string {
  const leading = p.startsWith('/');
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(seg);
  }
  return (leading ? '/' : '') + out.join('/') + (p.endsWith('/') ? '/' : '');
}

/** Join URL segments onto a base URL (scheme-aware). */
export function joinUrl(base: string, ...parts: string[]): string {
  const { scheme, path } = parseUrl(base);
  let result = normalize(path.replace(/\/+$/, '') + '/' + parts.join('/'));
  if (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1);
  return buildUrl(scheme, result);
}

/** Resolve `rel` (may contain ..) against absolute `base`. */
export function resolve(base: string, rel: string): string {
  if (!rel) return base;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rel)) return rel;
  return joinUrl(base, rel);
}

/** Parent directory of a URL path ('/' if root). */
export function dirname(url: string): string {
  const { scheme, path } = parseUrl(url);
  const idx = path.replace(/\/+$/, '').lastIndexOf('/');
  const dir = idx <= 0 ? '/' : path.slice(0, idx);
  return buildUrl(scheme, dir || '/');
}

/** Final segment of a URL path. */
export function basename(url: string): string {
  const { path } = parseUrl(url);
  const clean = path.replace(/\/+$/, '');
  const idx = clean.lastIndexOf('/');
  return idx === -1 ? clean : clean.slice(idx + 1);
}

/** Lowercase extension without the dot ('' if none). */
export function extname(url: string): string {
  const name = basename(url);
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return '';
  return name.slice(idx + 1).toLowerCase();
}

/** True when `parent` is an ancestor-or-self of `child` (same scheme). */
export function isInside(parent: string, child: string): boolean {
  const a = parseUrl(parent);
  const b = parseUrl(child);
  if (a.scheme !== b.scheme) return false;
  const p = a.path.replace(/\/+$/, '');
  return b.path.startsWith(p + '/') || b.path === p;
}
