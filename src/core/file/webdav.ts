/**
 * WebDAV backend — minimal client (PROPFIND/GET/PUT/MKCOL/MOVE/DELETE)
 * over fetch. Works against Nextcloud, Apache, rclone serve webdav…
 */

import * as path from '../../lib/path';
import { FsError, FileSystemBackend, ListOptions, ReadOptions, Stat, WriteOptions } from './types';

interface DavConfig {
  /** e.g. https://cloud.example.com/remote.php/dav/files/me */
  baseUrl: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
}

export class WebDavBackend implements FileSystemBackend {
  readonly scheme = 'webdav';
  readonly displayName = 'WebDAV';

  constructor(private cfg: DavConfig) {}

  private url(p: string): string {
    const rel = path.stripScheme(p).replace(/^\/+/, '');
    const base = this.cfg.baseUrl.replace(/\/+$/, '');
    return rel ? `${base}/${rel.split('/').map(encodeURIComponent).join('/')}` : base;
  }

  private async req(p: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cfg.username !== undefined) {
      const token = btoa(`${this.cfg.username}:${this.cfg.password ?? ''}`);
      headers.set('Authorization', `Basic ${token}`);
    }
    for (const [k, v] of Object.entries(this.cfg.headers ?? {})) headers.set(k, v);
    const res = await fetch(this.url(p), { ...init, headers });
    if (!res.ok && res.status !== 404) {
      throw new FsError(`webdav ${init.method ?? 'GET'} ${p} → ${res.status}`, res.status === 409 ? 'ENOENT' : 'EINVAL');
    }
    return res;
  }

  private parseMultiStatus(xml: string, baseHref: string): Stat[] {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const out: Stat[] = [];
    for (const response of doc.getElementsByTagNameNS('DAV:', 'response')) {
      const hrefEl = response.getElementsByTagNameNS('DAV:', 'href')[0];
      if (!hrefEl) continue;
      let href = decodeURIComponent(hrefEl.textContent ?? '');
      // server hrefs are /baseUrl/... — normalize to scheme path
      const basePath = new URL(this.cfg.baseUrl).pathname.replace(/\/+$/, '');
      if (href.startsWith(basePath)) href = href.slice(basePath.length) || '/';
      if (!href.startsWith('/')) href = `/${href}`;
      if (href === '/' || href === baseHref) continue;
      const isCollection = response.getElementsByTagNameNS('DAV:', 'collection').length > 0;
      const sizeEl = response.getElementsByTagNameNS('DAV:', 'getcontentlength')[0];
      const modEl = response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0];
      const dir = baseHref.replace(/\/+$/, '');
      const name = href.replace(/\/+$/, '').split('/').pop() ?? '';
      out.push({
        path: path.format('webdav', `${dir}/${name}`),
        isDir: isCollection,
        size: sizeEl ? Number(sizeEl.textContent ?? 0) : 0,
        mtime: modEl ? Date.parse(modEl.textContent ?? '') || 0 : 0,
      });
    }
    return out;
  }

  async stat(url: string): Promise<Stat> {
    const res = await this.req(url, { method: 'PROPFIND', headers: { Depth: '0' } });
    if (res.status === 404) throw new FsError(`no such file or directory: ${url}`, 'ENOENT');
    const xml = await res.text();
    const rel = path.stripScheme(url).replace(/\/+$/, '');
    const all = this.parseMultiStatus(xml, rel.endsWith('/') ? rel : `${rel}/x/..`);
    const self = all[0];
    if (!self) throw new FsError(`stat failed: ${url}`, 'EINVAL');
    return { ...self, path: path.normalize(url) };
  }

  async listdir(url: string, opts?: ListOptions): Promise<Stat[]> {
    const res = await this.req(url, { method: 'PROPFIND', headers: { Depth: '1' } });
    if (res.status === 404) throw new FsError(`no such directory: ${url}`, 'ENOENT');
    const xml = await res.text();
    const baseHref = path.stripScheme(url);
    const items = this.parseMultiStatus(xml, `${baseHref}/`).filter((s) =>
      opts?.includeDirs === false ? !s.isDir : true,
    );
    return items;
  }

  async readFile(url: string, opts?: ReadOptions): Promise<string | Uint8Array> {
    const res = await this.req(url, { method: 'GET' });
    if (res.status === 404) throw new FsError(`no such file: ${url}`, 'ENOENT');
    if (opts?.encoding === 'binary') return new Uint8Array(await res.arrayBuffer());
    return res.text();
  }

  async writeFile(url: string, data: string | Uint8Array, opts?: WriteOptions): Promise<void> {
    if (opts?.mkdirs !== false) {
      const dir = path.dirname(url);
      await this.mkdirRecursive(dir);
    }
    if (opts?.append) {
      let prev = '';
      try {
        prev = (await this.readFile(url)) as string;
      } catch {
        prev = '';
      }
      data = prev + (typeof data === 'string' ? data : new TextDecoder().decode(data));
    }
    await this.req(url, { method: 'PUT', body: data as BodyInit });
  }

  private async mkdirRecursive(url: string): Promise<void> {
    const rel = path.stripScheme(url);
    const parts = rel.split('/').filter(Boolean);
    let acc = '';
    for (const part of parts) {
      acc += `/${part}`;
      const exists = await this.exists(path.format('webdav', acc));
      if (!exists) await this.req(path.format('webdav', acc), { method: 'MKCOL' });
    }
  }

  async delete(url: string, _recursive = false): Promise<void> {
    const res = await this.req(url, { method: 'DELETE' });
    if (res.status === 404) throw new FsError(`no such file or directory: ${url}`, 'ENOENT');
  }

  async mkdir(url: string): Promise<void> {
    await this.req(url, { method: 'MKCOL' });
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    await this.req(oldUrl, {
      method: 'MOVE',
      headers: { Destination: this.url(newUrl), Overwrite: 'F' },
    });
  }

  async exists(url: string): Promise<boolean> {
    try {
      await this.req(url, { method: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  }
}
