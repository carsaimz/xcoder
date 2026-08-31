/**
 * Browser backend (`browser://`) — persists to IndexedDB via src/lib/storage.
 * Node store: `{ isDir, name, mtime, size }`; content store: string.
 * Runs anywhere (dev server, plain browser) when Cordova is not available.
 */
import { basename, dirname, parseUrl, buildUrl } from '@lib/path';
import { idbGet, idbSet, idbDel, idbKeys } from '@lib/storage';
import { FsError, type FileEntry, type FileSystemBackend } from './fs';

interface NodeRecord {
  isDir: boolean;
  name: string;
  mtime: number;
  size?: number;
}

export class BrowserBackend implements FileSystemBackend {
  readonly id = 'backend-browser';
  readonly scheme = 'browser';
  readonly displayName = 'Browser storage';
  readonly capabilities = { write: true, watch: false };

  private async getNode(path: string): Promise<NodeRecord | undefined> {
    return idbGet<NodeRecord>('fs-nodes', path);
  }

  private async putNode(path: string, node: NodeRecord): Promise<void> {
    await idbSet('fs-nodes', path, node);
  }

  private async ensureParents(url: string): Promise<void> {
    const { path } = parseUrl(url);
    const segs = path.split('/').filter(Boolean);
    let cur = '';
    for (const seg of segs.slice(0, -1)) {
      cur += '/' + seg;
      if (!(await this.getNode(cur))) {
        await this.putNode(cur, { isDir: true, name: seg, mtime: Date.now() });
      }
    }
  }

  private async must(url: string): Promise<NodeRecord> {
    const { path } = parseUrl(url);
    const node = await this.getNode(path === '' ? '/' : path);
    if (!node) throw new FsError('ENOENT', url);
    return node;
  }

  async stat(url: string): Promise<FileEntry> {
    const { path } = parseUrl(url);
    const node = await this.must(url);
    return {
      name: basename(url) || '/',
      url: buildUrl(this.scheme, path || '/'),
      isDir: node.isDir,
      size: node.size,
      mtime: node.mtime
    };
  }

  async list(url: string): Promise<FileEntry[]> {
    const { path } = parseUrl(url);
    const clean = path === '' || path === '/' ? '/' : path.replace(/\/+$/, '');
    const node = await this.must(url);
    if (!node.isDir) throw new FsError('ENOTDIR', url);
    const prefix = clean === '/' ? '/' : clean + '/';
    const all = await idbKeys('fs-nodes');
    const out: FileEntry[] = [];
    for (const p of all) {
      if (!p.startsWith(prefix) || p === clean) continue;
      const rest = p.slice(prefix.length);
      if (rest.includes('/')) continue;
      const n = await this.getNode(p);
      if (!n) continue;
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
    const node = await this.must(url);
    if (node.isDir) throw new FsError('EISDIR', url);
    const { path } = parseUrl(url);
    return (await idbGet<string>('fs-content', path)) ?? '';
  }

  async write(url: string, content: string): Promise<void> {
    const { path } = parseUrl(url);
    const existing = await this.getNode(path);
    if (existing?.isDir) throw new FsError('EISDIR', url);
    await this.ensureParents(url);
    await this.putNode(path, {
      isDir: false,
      name: basename(url),
      mtime: Date.now(),
      size: content.length
    });
    await idbSet('fs-content', path, content);
  }

  async mkdir(url: string): Promise<void> {
    const { path } = parseUrl(url);
    const segs = path.split('/').filter(Boolean);
    let cur = '';
    for (const seg of segs) {
      cur += '/' + seg;
      const node = await this.getNode(cur);
      if (node && !node.isDir) throw new FsError('ENOTDIR', buildUrl(this.scheme, cur));
      if (!node) await this.putNode(cur, { isDir: true, name: seg, mtime: Date.now() });
    }
  }

  async delete(url: string): Promise<void> {
    const { path } = parseUrl(url);
    await this.must(url);
    if (path === '/') throw new FsError('EPERM', 'cannot delete root');
    const prefix = path.replace(/\/+$/, '');
    const all = await idbKeys('fs-nodes');
    for (const p of all) {
      if (p === path || p.startsWith(prefix + '/')) {
        await idbDel('fs-nodes', p);
        await idbDel('fs-content', p);
      }
    }
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    const oldPath = parseUrl(oldUrl).path;
    const newPath = parseUrl(newUrl).path;
    const node = await this.must(oldUrl);
    if (await this.getNode(newPath)) throw new FsError('EEXIST', newUrl);
    if (node.isDir && newPath.startsWith(oldPath.replace(/\/+$/, '') + '/')) {
      throw new FsError('EPERM', 'cannot move a directory into itself');
    }
    await this.ensureParents(newUrl);
    const prefix = oldPath.replace(/\/+$/, '');
    const all = await idbKeys('fs-nodes');
    for (const p of all) {
      if (p !== oldPath && !p.startsWith(prefix + '/')) continue;
      const target = newPath + p.slice(prefix.length);
      const n = await this.getNode(p);
      if (n) await this.putNode(target, { ...n, name: basename(buildUrl(this.scheme, target)) });
      await idbDel('fs-nodes', p);
      const content = await idbGet<string>('fs-content', p);
      if (content !== undefined) {
        await idbSet('fs-content', target, content);
        await idbDel('fs-content', p);
      }
    }
  }

  /** Demo seed: welcome files on first launch (browser profile only). */
  async seedWelcome(files: Record<string, string>): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      const { path: p } = parseUrl(buildUrl(this.scheme, path));
      if (await this.getNode(p)) continue;
      await this.write(buildUrl(this.scheme, path), content);
    }
  }
}
