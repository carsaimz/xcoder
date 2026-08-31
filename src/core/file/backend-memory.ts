/**
 * In-memory backend (`memory://`).
 *
 * Used by: Vitest suites, the virtual shell's demo home, and as reference
 * implementation for the backend contract. Paths are absolute (`/`-rooted).
 */
import { basename, dirname, parseUrl, buildUrl } from '@lib/path';
import { FsError, type FileEntry, type FileSystemBackend } from './fs';

interface Node {
  isDir: boolean;
  name: string;
  mtime: number;
  size?: number;
  content?: string;
}

export class MemoryBackend implements FileSystemBackend {
  readonly id: string;
  readonly scheme: string;
  readonly displayName: string;
  readonly capabilities = { write: true, watch: false };
  private nodes = new Map<string, Node>();

  constructor(scheme = 'memory', displayName = 'In-memory') {
    this.id = `backend-${scheme}`;
    this.scheme = scheme;
    this.displayName = displayName;
    this.nodes.set('/', { isDir: true, name: '', mtime: Date.now() });
  }

  /** Test/demo helper: seed a whole tree from `{ 'path': 'content' }`. */
  seed(files: Record<string, string>): void {
    for (const [path, content] of Object.entries(files)) {
      const url = buildUrl(this.scheme, path);
      this.mkdirSync(dirname(url));
      const p = parseUrl(url).path;
      this.nodes.set(p, {
        isDir: false,
        name: basename(url),
        mtime: Date.now(),
        size: content.length,
        content
      });
    }
  }

  private mkdirSync(url: string): void {
    const { path } = parseUrl(url);
    const segs = path.split('/').filter(Boolean);
    let cur = '';
    for (const seg of segs) {
      cur += '/' + seg;
      if (!this.nodes.has(cur)) {
        this.nodes.set(cur, { isDir: true, name: seg, mtime: Date.now() });
      }
    }
  }

  private must(url: string): Node {
    const { path } = parseUrl(url);
    const node = this.nodes.get(path === '' ? '/' : path);
    if (!node) throw new FsError('ENOENT', url);
    return node;
  }

  async stat(url: string): Promise<FileEntry> {
    const { path } = parseUrl(url);
    const node = this.must(url);
    return {
      name: basename(url) || '/',
      url: buildUrl(this.scheme, path || '/'),
      isDir: node.isDir,
      size: node.size,
      mtime: node.mtime
    };
  }

  async list(url: string): Promise<FileEntry[]> {
    const node = this.must(url);
    if (!node.isDir) throw new FsError('ENOTDIR', url);
    const { path } = parseUrl(url);
    const prefix = path === '/' ? '/' : path.replace(/\/+$/, '') + '/';
    const out: FileEntry[] = [];
    for (const [p, n] of this.nodes) {
      if (!p.startsWith(prefix) || p === path) continue;
      const rest = p.slice(prefix.length);
      if (rest.includes('/')) continue; // deeper level
      out.push({
        name: n.name,
        url: buildUrl(this.scheme, p),
        isDir: n.isDir,
        size: n.size,
        mtime: n.mtime
      });
    }
    return out.sort((a, b) =>
      a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)
    );
  }

  async read(url: string): Promise<string> {
    const node = this.must(url);
    if (node.isDir) throw new FsError('EISDIR', url);
    return node.content ?? '';
  }

  async write(url: string, content: string): Promise<void> {
    const { path } = parseUrl(url);
    const parent = dirname(url);
    if (!this.nodes.has(parseUrl(parent).path)) {
      throw new FsError('ENOENT', `parent missing: ${parent}`);
    }
    const existing = this.nodes.get(path);
    if (existing?.isDir) throw new FsError('EISDIR', url);
    this.nodes.set(path, {
      isDir: false,
      name: basename(url),
      mtime: Date.now(),
      size: content.length,
      content
    });
  }

  async mkdir(url: string): Promise<void> {
    const { path } = parseUrl(url);
    const segs = path.split('/').filter(Boolean);
    let cur = '';
    for (const seg of segs) {
      cur += '/' + seg;
      const node = this.nodes.get(cur);
      if (node && !node.isDir) throw new FsError('ENOTDIR', buildUrl(this.scheme, cur));
      if (!node) {
        this.nodes.set(cur, { isDir: true, name: seg, mtime: Date.now() });
      }
    }
  }

  async delete(url: string): Promise<void> {
    const { path } = parseUrl(url);
    const node = this.must(url);
    if (path === '/') throw new FsError('EPERM', 'cannot delete root');
    for (const p of [...this.nodes.keys()]) {
      if (p === path || p.startsWith(path.replace(/\/+$/, '') + '/')) {
        this.nodes.delete(p);
      }
    }
    void node;
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    const oldPath = parseUrl(oldUrl).path;
    const newPath = parseUrl(newUrl).path;
    const node = this.must(oldUrl);
    if (this.nodes.has(newPath)) throw new FsError('EEXIST', newUrl);
    const moved: Array<[string, Node]> = [];
    const prefix = oldPath.replace(/\/+$/, '');
    for (const [p, n] of this.nodes) {
      if (p === oldPath || p.startsWith(prefix + '/')) {
        moved.push([p, n]);
      }
    }
    if (node.isDir && newPath.startsWith(prefix + '/')) {
      throw new FsError('EPERM', 'cannot move a directory into itself');
    }
    for (const [p, n] of moved) {
      this.nodes.delete(p);
      this.nodes.set(newPath + p.slice(prefix.length), { ...n, name: basename(buildUrl(this.scheme, newPath + p.slice(prefix.length))) });
    }
  }
}
