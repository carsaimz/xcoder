/**
 * Multi-root workspace. Routes every operation to the backend registered for
 * the path's scheme. The primary backend answers for `file://` URLs.
 */

import { bus } from '../../lib/events';
import * as path from '../../lib/path';
import { FsError, FileSystemBackend, ListOptions, ReadOptions, Stat, WriteOptions } from './types';
import { MemoryBackend } from './memory';
import { BrowserBackend } from './browser';

export { MemoryBackend, BrowserBackend };
export type { FileSystemBackend };
export * from './types';

export interface WorkspaceRoot {
  url: string;
  label: string;
}

export interface WorkspaceEntry {
  backend: FileSystemBackend;
  root?: string;
}

export class Workspace {
  private backends = new Map<string, WorkspaceEntry>();
  private roots: WorkspaceRoot[] = [];

  /** Register a backend under its scheme. */
  mount(backend: FileSystemBackend, opts?: { root?: string; label?: string }): this {
    this.backends.set(backend.scheme, { backend, root: opts?.root });
    if (opts?.root) {
      this.roots.push({ url: opts.root, label: opts.label ?? opts.root });
      bus.emit('workspace:roots', this.listRoots());
    }
    return this;
  }

  unmount(scheme: string): void {
    const entry = this.backends.get(scheme);
    this.backends.delete(scheme);
    if (entry?.root) {
      this.roots = this.roots.filter((r) => !path.contains(entry.root!, r.url));
      bus.emit('workspace:roots', this.listRoots());
    }
  }

  /** Resolve a URL to its backend + normalized path. Falls back to primary. */
  resolve(url: string): { backend: FileSystemBackend; path: string } {
    const { scheme, path: p } = path.parse(url);
    const entry = scheme ? this.backends.get(scheme.toLowerCase()) : undefined;
    if (entry) return { backend: entry.backend, path: path.format(scheme, p) };
    const primary = this.backends.get('file');
    if (!primary) throw new FsError(`no backend for scheme "${scheme ?? 'file'}" and no primary backend`, 'EINVAL');
    return { backend: primary.backend, path: path.format('file', url) };
  }

  addRoot(url: string, label?: string): void {
    if (this.roots.some((r) => r.url === url)) return;
    this.roots.push({ url, label: label ?? path.basename(url) });
    bus.emit('workspace:roots', this.listRoots());
  }

  removeRoot(url: string): void {
    this.roots = this.roots.filter((r) => r.url !== url);
    bus.emit('workspace:roots', this.listRoots());
  }

  listRoots(): WorkspaceRoot[] {
    return [...this.roots];
  }

  /** Preferred working directory: first root or `/`. */
  cwd(): string {
    return this.roots[0]?.url ?? path.format('file', '/');
  }

  // ---- passthrough operations -------------------------------------------------

  async stat(url: string): Promise<Stat> {
    const { backend, path: p } = this.resolve(url);
    return backend.stat(p);
  }

  async listdir(url: string, opts?: ListOptions): Promise<Stat[]> {
    const { backend, path: p } = this.resolve(url);
    return backend.listdir(p, opts);
  }

  async readFile(url: string, opts?: ReadOptions): Promise<string | Uint8Array> {
    const { backend, path: p } = this.resolve(url);
    return backend.readFile(p, opts);
  }

  async readText(url: string): Promise<string> {
    const data = await this.readFile(url);
    return typeof data === 'string' ? data : new TextDecoder().decode(data);
  }

  async writeFile(url: string, data: string | Uint8Array, opts?: WriteOptions): Promise<void> {
    const { backend, path: p } = this.resolve(url);
    await backend.writeFile(p, data, opts);
    bus.emit('workspace:changed', { path: url, kind: 'write' });
  }

  async delete(url: string, recursive = false): Promise<void> {
    const { backend, path: p } = this.resolve(url);
    await backend.delete(p, recursive);
    bus.emit('workspace:changed', { path: url, kind: 'delete' });
  }

  async mkdir(url: string): Promise<void> {
    const { backend, path: p } = this.resolve(url);
    await backend.mkdir(p);
    bus.emit('workspace:changed', { path: url, kind: 'mkdir' });
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    const a = this.resolve(oldUrl);
    const b = this.resolve(newUrl);
    if (a.backend !== b.backend) throw new FsError('rename across backends is not supported', 'EINVAL');
    await a.backend.rename(a.path, b.path);
    bus.emit('workspace:changed', { path: oldUrl, kind: 'rename', newPath: newUrl });
  }

  async exists(url: string): Promise<boolean> {
    const { backend, path: p } = this.resolve(url);
    return backend.exists(p);
  }

  /** Ensure a directory (and all parents) exists. */
  async ensureDir(url: string): Promise<void> {
    const parts = path.stripScheme(url).split('/').filter(Boolean);
    let acc = path.parse(url).scheme ? `${path.parse(url).scheme}://` : '';
    for (const part of parts) {
      acc = acc ? path.join(acc, part) : `/${part}`;
      if (!(await this.exists(acc))) await this.mkdir(acc);
    }
  }

  /**
   * Recursive search under `root` for files whose content matches `query`
   * (case-insensitive substring). Skips heavy folders by default.
   */
  async search(
    root: string,
    query: string,
    opts?: { glob?: string; maxResults?: number; skipDirs?: string[] },
  ): Promise<Array<{ path: string; line: number; text: string }>> {
    const skip = new Set(['node_modules', '.git', 'www', 'dist', 'build', 'coverage', ...(opts?.skipDirs ?? [])]);
    const max = opts?.maxResults ?? 80;
    const results: Array<{ path: string; line: number; text: string }> = [];
    const q = query.toLowerCase();
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (results.length >= max || depth > 8) return;
      let entries: Stat[] = [];
      try {
        entries = await this.listdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= max) return;
        if (entry.isDir) {
          if (!skip.has(path.basename(entry.path))) await walk(entry.path, depth + 1);
          continue;
        }
        if (opts?.glob && !path.basename(entry.path).includes(opts.glob.replace(/\*/g, ''))) continue;
        try {
          const text = (await this.readText(entry.path)) as string;
          const lines = text.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              results.push({ path: entry.path, line: i + 1, text: lines[i].trim().slice(0, 160) });
              if (results.length >= max) return;
            }
          }
        } catch {
          /* binary or unreadable — skip */
        }
      }
    };
    await walk(root, 0);
    return results;
  }
}

// ---- default singleton -------------------------------------------------------

function createDefault(): Workspace {
  const ws = new Workspace();
  // In browser contexts persist to IndexedDB; in Node/tests stay in memory.
  const hasBrowser = typeof document !== 'undefined';
  const primary: FileSystemBackend = hasBrowser
    ? new BrowserBackend()
    : new MemoryBackend();
  ws.mount(primary, { root: path.format('file', '/'), label: 'device' });
  return ws;
}

/** Global workspace singleton. */
export const fs = createDefault();
