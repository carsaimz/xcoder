/**
 * Browser backend — persists files into IndexedDB through the shared
 * KV storage. Path layout mirrors a POSIX tree inside a flat key space:
 *   `<rootKey>:n:<path>`  → node record (stat info)
 *   `<rootKey>:c:<path>`  → file content (string)
 */

import { storage } from '../../lib/storage';
import * as path from '../../lib/path';
import { FsError, FileSystemBackend, ListOptions, ReadOptions, Stat, WriteOptions } from './types';

interface NodeRecord {
  isDir: boolean;
  size: number;
  mtime: number;
}

const NODE_PREFIX = ':n:';
const CONTENT_PREFIX = ':c:';

export class BrowserBackend implements FileSystemBackend {
  readonly scheme: string;
  readonly displayName: string;
  private rootKey: string;

  constructor(rootKey = 'fs', scheme = 'file', displayName = 'Browser storage') {
    this.rootKey = rootKey;
    this.scheme = scheme;
    this.displayName = displayName;
  }

  private nodeKey(p: string): string {
    return `${this.rootKey}${NODE_PREFIX}${path.stripScheme(p)}`;
  }

  private contentKey(p: string): string {
    return `${this.rootKey}${CONTENT_PREFIX}${path.stripScheme(p)}`;
  }

  /** The filesystem root always exists implicitly. */
  private async nodeAt(key: string): Promise<NodeRecord | undefined> {
    if (key === '/' || key === '') return { isDir: true, size: 0, mtime: 0 };
    return storage.get<NodeRecord>(this.nodeKey(key));
  }

  private dirOf(p: string): string {
    return path.stripScheme(path.dirname(p));
  }

  private async ensureDir(p: string): Promise<void> {
    const parts = path.stripScheme(p).split('/').filter(Boolean);
    let acc = '';
    for (const part of parts) {
      acc += `/${part}`;
      const node = await storage.get<NodeRecord>(this.nodeKey(acc));
      if (node && !node.isDir) throw new FsError(`not a directory: ${acc}`, 'ENOTDIR');
      if (!node) {
        await storage.set<NodeRecord>(this.nodeKey(acc), { isDir: true, size: 0, mtime: Date.now() });
      }
    }
  }

  async stat(url: string): Promise<Stat> {
    const key = path.stripScheme(url);
    const node = await this.nodeAt(key);
    if (!node) throw new FsError(`no such file or directory: ${url}`, 'ENOENT');
    return { path: path.normalize(url), ...node };
  }

  async listdir(url: string, opts?: ListOptions): Promise<Stat[]> {
    const dir = path.stripScheme(url);
    const node = await this.nodeAt(dir);
    if (!node) throw new FsError(`no such directory: ${url}`, 'ENOENT');
    if (!node.isDir) throw new FsError(`not a directory: ${url}`, 'ENOTDIR');
    const includeDirs = opts?.includeDirs !== false;
    const keys = await storage.keys();
    const prefix = `${this.rootKey}${NODE_PREFIX}`;
    const dirPrefix = dir === '/' ? `${prefix}/` : `${prefix}${dir}/`;
    const out: Stat[] = [];
    for (const key of keys) {
      if (!key.startsWith(dirPrefix)) continue;
      const rest = key.slice(prefix.length);
      const rel = rest.slice(dir.length + 1);
      if (!rel || rel.includes('/')) continue;
      const rec = await storage.get<NodeRecord>(key);
      if (!rec) continue;
      if (rec.isDir && !includeDirs) continue;
      out.push({ isDir: rec.isDir, size: rec.size, mtime: rec.mtime, path: path.format(this.scheme, rest) });
    }
    return out.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.path.localeCompare(b.path)));
  }

  async readFile(url: string, opts?: ReadOptions): Promise<string | Uint8Array> {
    const key = path.stripScheme(url);
    const node = await this.nodeAt(key);
    if (!node) throw new FsError(`no such file: ${url}`, 'ENOENT');
    if (node.isDir) throw new FsError(`is a directory: ${url}`, 'EISDIR');
    const content = await storage.get<string>(this.contentKey(key));
    const text = content ?? '';
    if (opts?.encoding === 'binary') return new TextEncoder().encode(text);
    return text;
  }

  async writeFile(url: string, data: string | Uint8Array, opts?: WriteOptions): Promise<void> {
    const key = path.stripScheme(url);
    const node = await this.nodeAt(key);
    if (node?.isDir) throw new FsError(`is a directory: ${url}`, 'EISDIR');
    if (opts?.mkdirs !== false) await this.ensureDir(this.dirOf(url));
    const prev = opts?.append ? ((await storage.get<string>(this.contentKey(key))) ?? '') : '';
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    const merged = prev + text;
    await storage.set(this.contentKey(key), merged);
    await storage.set<NodeRecord>(this.nodeKey(key), {
      isDir: false,
      size: merged.length,
      mtime: Date.now(),
    });
  }

  async delete(url: string, recursive = false): Promise<void> {
    const key = path.stripScheme(url);
    const node = await this.nodeAt(key);
    if (!node) throw new FsError(`no such file or directory: ${url}`, 'ENOENT');
    const keys = await storage.keys();
    const nodePrefix = `${this.rootKey}${NODE_PREFIX}`;
    const dirPrefix = `${nodePrefix}${key}/`;
    const children = keys.filter((k) => k.startsWith(dirPrefix));
    if (children.length > 0 && !recursive) throw new FsError(`directory not empty: ${url}`, 'ENOTEMPTY');
    for (const child of children) {
      await storage.delete(child);
      await storage.delete(child.replace(nodePrefix, `${this.rootKey}${CONTENT_PREFIX}`));
    }
    await storage.delete(this.nodeKey(key));
    await storage.delete(this.contentKey(key));
  }

  async mkdir(url: string): Promise<void> {
    const key = path.stripScheme(url);
    const node = await storage.get<NodeRecord>(this.nodeKey(key));
    if (node) throw new FsError(node.isDir ? `directory exists: ${url}` : `file exists: ${url}`, 'EEXIST');
    await this.ensureDir(url);
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    const from = path.stripScheme(oldUrl);
    const to = path.stripScheme(newUrl);
    const node = await this.nodeAt(from);
    if (!node) throw new FsError(`no such file or directory: ${oldUrl}`, 'ENOENT');
    if (await this.nodeAt(to)) throw new FsError(`target exists: ${newUrl}`, 'EEXIST');
    const keys = await storage.keys();
    const nodePrefix = `${this.rootKey}${NODE_PREFIX}`;
    const entries = keys.filter((k) => k === this.nodeKey(from) || k.startsWith(`${nodePrefix}${from}/`));
    for (const key of entries) {
      const rel = key.slice(nodePrefix.length);
      const target = rel === from ? to : `${to}${rel.slice(from.length)}`;
      const rec = await storage.get<NodeRecord>(key);
      if (rec) await storage.set(this.nodeKey(target), rec);
      const content = await storage.get<string>(this.contentKey(rel));
      if (content !== undefined) await storage.set(this.contentKey(target), content);
    }
    for (const key of entries) {
      const rel = key.slice(nodePrefix.length);
      await storage.delete(key);
      await storage.delete(this.contentKey(rel));
    }
  }

  async exists(url: string): Promise<boolean> {
    return (await this.nodeAt(path.stripScheme(url))) !== undefined;
  }
}
