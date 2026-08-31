/**
 * XCoder path library — POSIX path operations with URL-scheme support.
 *
 * Paths inside XCoder frequently carry a scheme, e.g. `file:///project/main.ts`,
 * `mem://notes/todo.md` or `webdav://server/dav/file.txt`. Every helper in this
 * module understands schemes and treats `scheme://...` as an absolute URL.
 */

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;

export interface ParsedPath {
  /** scheme without `://`, or null when the path has no scheme */
  scheme: string | null;
  /** path portion, always starting with `/` when a scheme is present */
  path: string;
}

/** Split `scheme://rest` into `{ scheme, path }`. */
export function parse(url: string): ParsedPath {
  const m = SCHEME_RE.exec(url);
  if (!m) return { scheme: null, path: url };
  return { scheme: m[1], path: url.slice(m[0].length) };
}

/** Build a url from scheme + path. */
export function format(scheme: string | null, path: string): string {
  if (!scheme) return path;
  return `${scheme}://${path.startsWith('/') ? path : `/${path}`}`;
}

/** True for `/a/b` and `file:///a/b`; false for `a/b`. */
export function isAbsolute(url: string): boolean {
  return url.startsWith('/') || SCHEME_RE.test(url);
}

/** Remove the scheme portion, if any. */
export function stripScheme(url: string): string {
  return parse(url).path;
}

/** Collapse `.`/`..` segments and duplicate slashes. */
export function normalize(p: string): string {
  const { scheme, path } = parse(p);
  const isDir = path.endsWith('/');
  const parts: string[] = [];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length > 0 && parts[parts.length - 1] !== '..') parts.pop();
      else if (!scheme) parts.push('..');
    } else {
      parts.push(seg);
    }
  }
  let out = `/${parts.join('/')}`;
  if (isDir && out !== '/' && !out.endsWith('/')) out += '/';
  return format(scheme, out === '/' && scheme ? '/' : out);
}

/**
 * Join path fragments. If a fragment carries a scheme it replaces the
 * accumulated base (URL-style resolution), matching `join('file:///a', 'b')`
 * → `file:///a/b` and `join('file:///a', 'mem://x', 'y')` → `mem://y`.
 */
export function join(...parts: string[]): string {
  let base = '';
  for (const part of parts) {
    if (!part) continue;
    const { scheme } = parse(part);
    if (scheme) {
      base = part;
      continue;
    }
    if (!base) {
      base = part;
      continue;
    }
    const sep = base.endsWith('/') || part.startsWith('/') ? '' : '/';
    base = `${base}${sep}${part}`;
  }
  return normalize(base);
}

/**
 * Resolve a sequence of paths to an absolute path (like node's `path.resolve`).
 * A fragment with a scheme restarts resolution under that scheme; a fragment
 * starting with `/` restarts the path but *keeps* the active scheme (it is
 * device-relative); relative fragments join the accumulator.
 *
 *   resolve('file:///a/b', 'c')     → 'file:///a/b/c'
 *   resolve('file:///a/b', '/c')    → 'file:///c'
 *   resolve('file:///a', 'mem:///x') → 'mem:///x'
 *   resolve('a', 'b')               → '/a/b'
 */
export function resolve(...parts: string[]): string {
  let scheme: string | null = null;
  let acc = '';
  for (const part of parts) {
    if (!part) continue;
    const parsed = parse(part);
    if (parsed.scheme) {
      scheme = parsed.scheme;
      acc = parsed.path;
      continue;
    }
    if (part.startsWith('/')) {
      acc = part;
      continue;
    }
    acc = acc ? `${acc.replace(/\/+$/, '')}/${part}` : part;
  }
  return normalize(format(scheme, acc || '/'));
}

export function dirname(url: string): string {
  const { scheme, path } = parse(url);
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return format(scheme, '/');
  return format(scheme, path.slice(0, idx));
}

export function basename(url: string): string {
  const { path } = parse(url);
  return path.slice(path.lastIndexOf('/') + 1) || '/';
}

export function extname(url: string): string {
  const base = basename(url);
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
}

/** Posix `relative`. When schemes differ the target is returned unchanged. */
export function relative(from: string, to: string): string {
  const a = parse(from);
  const b = parse(to);
  if (a.scheme !== b.scheme) return to;
  const fromParts = a.path.split('/').filter(Boolean);
  const toParts = b.path.split('/').filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++;
  const up = fromParts.length - i;
  const rel = [...Array(up).fill('..'), ...toParts.slice(i)].join('/');
  return rel || '.';
}

/** True when `child` lies inside `parent` (both may carry schemes). */
export function contains(parent: string, child: string): boolean {
  const a = parse(parent);
  const b = parse(child);
  if (a.scheme !== b.scheme) return false;
  const p = a.path.endsWith('/') ? a.path : `${a.path}/`;
  return b.path.startsWith(p) || b.path === a.path;
}

/** Minimal fuzzy score for Quick Open / palettes. Returns -1 when rejected. */
export function fuzzyMatch(query: string, target: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const direct = t.indexOf(q);
  if (direct >= 0) return 1000 - direct - t.length * 0.1;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak++;
      score += 1 + streak * 0.5 + (ti === 0 || '/-_. '.includes(t[ti - 1]) ? 2 : 0);
      qi++;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : -1;
}
