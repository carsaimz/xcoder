/**
 * File system abstraction.
 *
 * Every file lives behind a URL (`scheme://path`). Backends register by scheme
 * and the registry dispatches operations. Mutations broadcast `fs:update`.
 *
 * The generic `search()` implementation walks any backend, so every scheme
 * (memory, browser, cordova, webdav, …) gets filename + content search free.
 */
import { parseUrl, buildUrl, joinUrl, dirname } from '@lib/path';
import { events } from '@api/events';

export interface FileEntry {
  name: string;
  url: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
}

export interface FsCapabilities {
  write: boolean;
  watch: boolean;
}

export interface FileSystemBackend {
  id: string;
  scheme: string;
  displayName: string;
  capabilities: FsCapabilities;
  stat(url: string): Promise<FileEntry>;
  list(url: string): Promise<FileEntry[]>;
  read(url: string): Promise<string>;
  write(url: string, content: string): Promise<void>;
  mkdir(url: string): Promise<void>;
  delete(url: string): Promise<void>;
  rename(oldUrl: string, newUrl: string): Promise<void>;
  copy?(src: string, dest: string): Promise<void>;
}

export class FsError extends Error {
  constructor(
    public code: 'ENOENT' | 'EEXIST' | 'ENOTDIR' | 'EISDIR' | 'EPERM' | 'EREADONLY' | 'EUNKNOWN_SCHEME' | 'EIO',
    message: string
  ) {
    super(`[${code}] ${message}`);
    this.name = 'FsError';
  }
}

export interface SearchHit {
  url: string;
  name: string;
  kind: 'name' | 'content';
  preview?: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const backends = new Map<string, FileSystemBackend>();

export function registerBackend(backend: FileSystemBackend): void {
  const existing = backends.get(backend.scheme);
  if (existing && existing.id !== backend.id) {
    throw new Error(`[fs] scheme already registered by another backend: ${backend.scheme}`);
  }
  // same backend id re-registering (hot reload / repeated test setup) → replace
  backends.set(backend.scheme, backend);
}

export function listBackends(): FileSystemBackend[] {
  return [...backends.values()];
}

export function getBackend(scheme: string): FileSystemBackend {
  const b = backends.get(scheme.toLowerCase());
  if (!b) throw new FsError('EUNKNOWN_SCHEME', `no backend for "${scheme}://"`);
  return b;
}

function backendFor(url: string): FileSystemBackend {
  return getBackend(parseUrl(url).scheme);
}

function assertWritable(backend: FileSystemBackend): void {
  if (!backend.capabilities.write) {
    throw new FsError('EREADONLY', `${backend.displayName} is read-only`);
  }
}

// ---------------------------------------------------------------------------
// Generic operations (dispatch + event emission)
// ---------------------------------------------------------------------------

export async function stat(url: string): Promise<FileEntry> {
  return backendFor(url).stat(url);
}

export async function exists(url: string): Promise<boolean> {
  try {
    await backendFor(url).stat(url);
    return true;
  } catch (err) {
    if (err instanceof FsError && err.code === 'ENOENT') return false;
    throw err;
  }
}

export async function list(url: string): Promise<FileEntry[]> {
  return backendFor(url).list(url);
}

export async function read(url: string): Promise<string> {
  return backendFor(url).read(url);
}

export async function write(url: string, content: string): Promise<void> {
  const backend = backendFor(url);
  assertWritable(backend);
  await backend.write(url, content);
  events.emit('fs:update', { url, type: 'write' });
}

export async function createFile(url: string, content = ''): Promise<FileEntry> {
  const backend = backendFor(url);
  assertWritable(backend);
  if (await exists(url)) throw new FsError('EEXIST', url);
  await backend.write(url, content);
  events.emit('fs:update', { url, type: 'create' });
  return backend.stat(url);
}

export async function createDir(url: string): Promise<FileEntry> {
  const backend = backendFor(url);
  assertWritable(backend);
  if (await exists(url)) throw new FsError('EEXIST', url);
  await backend.mkdir(url);
  events.emit('fs:update', { url, type: 'create' });
  return backend.stat(url);
}

export async function deletePath(url: string): Promise<void> {
  const backend = backendFor(url);
  assertWritable(backend);
  await backend.delete(url);
  events.emit('fs:update', { url, type: 'delete' });
}

export async function rename(oldUrl: string, newUrl: string): Promise<void> {
  const backend = backendFor(oldUrl);
  assertWritable(backend);
  await backend.rename(oldUrl, newUrl);
  events.emit('fs:update', { url: oldUrl, type: 'delete' });
  events.emit('fs:update', { url: newUrl, type: 'create' });
}

export async function copy(src: string, dest: string): Promise<void> {
  const backend = backendFor(src);
  assertWritable(backend);
  if (backend.copy) {
    await backend.copy(src, dest);
  } else {
    const entry = await backend.stat(src);
    if (entry.isDir) {
      await createDir(dest);
      for (const child of await backend.list(src)) {
        await copy(child.url, joinUrl(dest, child.name));
      }
      return;
    }
    await write(dest, await backend.read(src));
  }
  events.emit('fs:update', { url: dest, type: 'create' });
}

// ---------------------------------------------------------------------------
// Generic recursive search over any backend
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 256 * 1024;
const NAME_SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.svn']);

export async function search(
  rootUrl: string,
  pattern: string,
  opts: { maxResults?: number } = {}
): Promise<SearchHit[]> {
  const max = opts.maxResults ?? 200;
  if (!pattern) return [];
  const needle = pattern.toLowerCase();
  const hits: SearchHit[] = [];

  async function walk(dirUrl: string): Promise<void> {
    if (hits.length >= max) return;
    let entries: FileEntry[];
    try {
      entries = await list(dirUrl);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (hits.length >= max) return;
      if (entry.isDir) {
        if (NAME_SKIP.has(entry.name)) continue;
        await walk(entry.url);
        continue;
      }
      if (entry.name.toLowerCase().includes(needle)) {
        hits.push({ url: entry.url, name: entry.name, kind: 'name' });
        continue;
      }
      if ((entry.size ?? 0) > MAX_FILE_BYTES) continue;
      try {
        const text = await read(entry.url);
        const idx = text.toLowerCase().indexOf(needle);
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          hits.push({
            url: entry.url,
            name: entry.name,
            kind: 'content',
            preview: text.slice(start, idx + pattern.length + 40).replace(/\s+/g, ' ')
          });
        }
      } catch {
        /* unreadable (binary) — skip */
      }
    }
  }

  await walk(rootUrl);
  return hits;
}

/** Walk a directory recursively, returning every file URL (quick-open index). */
export async function walkFiles(rootUrl: string, max = 2000): Promise<string[]> {
  const out: string[] = [];
  async function walk(dirUrl: string): Promise<void> {
    if (out.length >= max) return;
    let entries: FileEntry[];
    try {
      entries = await list(dirUrl);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= max) return;
      if (entry.isDir) {
        if (NAME_SKIP.has(entry.name)) continue;
        await walk(entry.url);
      } else {
        out.push(entry.url);
      }
    }
  }
  await walk(rootUrl);
  return out;
}

export { FsError as FsErrorClass, buildUrl, dirname };
