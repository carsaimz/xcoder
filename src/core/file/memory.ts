/** In-memory FileSystemBackend — used by tests, demos and as a safe fallback. */

import { FsError, FileSystemBackend, ListOptions, ReadOptions, Stat, WriteOptions } from './types';
import * as path from '../../lib/path';

interface Node {
  stat: Stat;
  content?: Uint8Array;
}

export class MemoryBackend implements FileSystemBackend {
  readonly scheme: string;
  readonly displayName = 'Memory';

  private nodes = new Map<string, Node>();

  constructor(scheme = 'file') {
    this.scheme = scheme;
    this.nodes.set('/', { stat: { path: path.format(scheme, '/'), size: 0, mtime: Date.now(), isDir: true } });
  }

  private key(p: string): string {
    const normalized = path.normalize(path.join('/', p));
    return path.stripScheme(normalized);
  }

  async stat(url: string): Promise<Stat> {
    const node = this.nodes.get(this.key(url));
    if (!node) throw new FsError(`no such file or directory: ${url}`, 'ENOENT');
    return { ...node.stat, path: path.normalize(url) };
  }

  async listdir(url: string, opts?: ListOptions): Promise<Stat[]> {
    const dir = this.key(url);
    const dirNode = this.nodes.get(dir);
    if (!dirNode) throw new FsError(`no such directory: ${url}`, 'ENOENT');
    if (!dirNode.stat.isDir) throw new FsError(`not a directory: ${url}`, 'ENOTDIR');
    const includeDirs = opts?.includeDirs !== false;
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    const out: Stat[] = [];
    for (const [key, node] of this.nodes) {
      if (!key.startsWith(prefix) || key === '/') continue;
      const rest = key.slice(prefix.length);
      if (rest.includes('/')) continue; // deeper level
      if (node.stat.isDir && !includeDirs) continue;
      out.push({ ...node.stat, path: path.format(this.scheme, key) });
    }
    return out.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.path.localeCompare(b.path, undefined, { numeric: true });
    });
  }

  async readFile(url: string, opts?: ReadOptions): Promise<string | Uint8Array> {
    const node = this.nodes.get(this.key(url));
    if (!node) throw new FsError(`no such file: ${url}`, 'ENOENT');
    if (node.stat.isDir) throw new FsError(`is a directory: ${url}`, 'EISDIR');
    const bytes = node.content ?? new Uint8Array();
    if (opts?.encoding === 'binary') return bytes;
    return new TextDecoder().decode(bytes);
  }

  async writeFile(url: string, data: string | Uint8Array, opts?: WriteOptions): Promise<void> {
    const key = this.key(url);
    const existing = this.nodes.get(key);
    if (existing?.stat.isDir) throw new FsError(`is a directory: ${url}`, 'EISDIR');
    if (opts?.mkdirs !== false) {
      const dir = path.dirname(key);
      await this.ensureDir(dir);
    }
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const prev = opts?.append ? (existing?.content ?? new Uint8Array()) : new Uint8Array();
    const merged = new Uint8Array(prev.length + bytes.length);
    merged.set(prev, 0);
    merged.set(bytes, prev.length);
    this.nodes.set(key, {
      stat: { path: path.normalize(url), size: merged.length, mtime: Date.now(), isDir: false },
      content: merged,
    });
  }

  private async ensureDir(dir: string): Promise<void> {
    const parts = dir.split('/').filter(Boolean);
    let acc = '';
    for (const part of parts) {
      acc += `/${part}`;
      const existing = this.nodes.get(acc);
      if (existing && !existing.stat.isDir) throw new FsError(`not a directory: ${acc}`, 'ENOTDIR');
      if (!existing) {
        this.nodes.set(acc, {
          stat: { path: path.format(this.scheme, acc), size: 0, mtime: Date.now(), isDir: true },
        });
      }
    }
  }

  async mkdir(url: string): Promise<void> {
    const key = this.key(url);
    const existing = this.nodes.get(key);
    if (existing) {
      if (existing.stat.isDir) throw new FsError(`directory exists: ${url}`, 'EEXIST');
      throw new FsError(`file exists at path: ${url}`, 'EEXIST');
    }
    await this.ensureDir(key);
  }

  async delete(url: string, recursive = false): Promise<void> {
    const key = this.key(url);
    const node = this.nodes.get(key);
    if (!node) throw new FsError(`no such file or directory: ${url}`, 'ENOENT');
    if (node.stat.isDir) {
      const children = [...this.nodes.keys()].filter((k) => k.startsWith(`${key}/`));
      if (children.length > 0 && !recursive) {
        throw new FsError(`directory not empty: ${url}`, 'ENOTEMPTY');
      }
      for (const child of children) this.nodes.delete(child);
    }
    this.nodes.delete(key);
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    const from = this.key(oldUrl);
    const to = this.key(newUrl);
    const node = this.nodes.get(from);
    if (!node) throw new FsError(`no such file or directory: ${oldUrl}`, 'ENOENT');
    if (this.nodes.get(to)) throw new FsError(`target exists: ${newUrl}`, 'EEXIST');
    const moved = path.stripScheme(path.normalize(newUrl));
    const entries = [...this.nodes.entries()].filter(([k]) => k === from || k.startsWith(`${from}/`));
    for (const [k, v] of entries) {
      const rel = k === from ? moved : `${moved}${k.slice(from.length)}`;
      this.nodes.delete(k);
      this.nodes.set(rel, { ...v, stat: { ...v.stat, path: path.format(this.scheme, rel) } });
    }
  }

  async exists(url: string): Promise<boolean> {
    return this.nodes.has(this.key(url));
  }

  /** Test helper: seed multiple paths at once. */
  seed(files: Record<string, string>): void {
    for (const [p, content] of Object.entries(files)) {
      this.writeFile(p, content).catch(() => undefined);
    }
  }
}
