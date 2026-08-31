/**
 * WebDAV backend (`webdav://`) — plain `fetch` + PROPFIND/MKCOL/MOVE/COPY.
 * URL form: `webdav://<host>/<path>`; TLS/HTTP decided by the server config
 * passed to the constructor. Basic auth (base64) attached when credentials
 * are provided.
 */
import { basename, dirname, parseUrl, buildUrl } from '@lib/path';
import { FsError, type FileEntry, type FileSystemBackend } from './fs';

export interface WebdavConfig {
  /** e.g. 'https://dev.example.com/dav' — host part of webdav:// URLs. */
  baseUrl: string;
  username?: string;
  password?: string;
}

interface PropFindEntry {
  href: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function decodeHref(href: string): string {
  return decodeURIComponent(decodeEntities(href));
}

export class WebdavBackend implements FileSystemBackend {
  readonly id: string;
  readonly scheme: string;
  readonly displayName: string;
  readonly capabilities = { write: true, watch: false };
  private cfg: WebdavConfig;

  constructor(scheme = 'webdav', cfg: WebdavConfig) {
    this.id = `backend-${scheme}`;
    this.scheme = scheme;
    this.displayName = `WebDAV (${new URL(cfg.baseUrl).host})`;
    this.cfg = cfg;
  }

  private httpUrl(url: string): string {
    const { path } = parseUrl(url);
    const base = this.cfg.baseUrl.replace(/\/+$/, '');
    return base + (path === '/' ? '/' : encodeURI(path));
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (this.cfg.username !== undefined) {
      const token = btoa(`${this.cfg.username}:${this.cfg.password ?? ''}`);
      h.Authorization = `Basic ${token}`;
    }
    return h;
  }

  private async dav(
    method: string,
    url: string,
    body?: string,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const res = await fetch(this.httpUrl(url), {
      method,
      headers: this.headers(headers),
      body
    });
    if (!res.ok) {
      if (res.status === 404) throw new FsError('ENOENT', url);
      if (res.status === 405 || res.status === 412) throw new FsError('EEXIST', url);
      if (res.status === 401) throw new FsError('EPERM', `auth failed: ${url}`);
      throw new FsError('EIO', `${method} ${url} → HTTP ${res.status}`);
    }
    return res;
  }

  private async propfind(url: string, depth: '0' | '1'): Promise<PropFindEntry[]> {
    const body =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<D:propfind xmlns:D="DAV:"><D:prop>' +
      '<D:resourcetype/><D:getcontentlength/><D:getlastmodified/>' +
      '</D:prop></D:propfind>';
    const res = await this.dav('PROPFIND', url, body, { Depth: depth });
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const responses = [...doc.getElementsByTagNameNS('DAV:', 'response')];
    const base = this.cfg.baseUrl.replace(/\/+$/, '');
    return responses.map((r) => {
      const hrefEl = r.getElementsByTagNameNS('DAV:', 'href')[0];
      const href = decodeHref(hrefEl?.textContent ?? '');
      const isDir = r.getElementsByTagNameNS('DAV:', 'collection').length > 0;
      const sizeEl = r.getElementsByTagNameNS('DAV:', 'getcontentlength')[0];
      const mtimeEl = r.getElementsByTagNameNS('DAV:', 'getlastmodified')[0];
      // Server hrefs are absolute paths on the DAV host → rebuild as scheme://
      const davPath = href.startsWith('http') ? new URL(href).pathname : href;
      return {
        href: davPath,
        isDir,
        size: sizeEl ? Number(sizeEl.textContent ?? 0) : undefined,
        mtime: mtimeEl ? new Date(mtimeEl.textContent ?? '').getTime() : undefined
      };
    });
  }

  private async entry(url: string): Promise<FileEntry> {
    const list = await this.propfind(url, '0');
    const found = list[0];
    if (!found) throw new FsError('ENOENT', url);
    return {
      name: basename(url) || '/',
      url,
      isDir: found.isDir,
      size: found.size,
      mtime: found.mtime
    };
  }

  async stat(url: string): Promise<FileEntry> {
    return this.entry(url);
  }

  async list(url: string): Promise<FileEntry[]> {
    const self = await this.entry(url);
    if (!self.isDir) throw new FsError('ENOTDIR', url);
    const all = await this.propfind(url, '1');
    const parentPath = parseUrl(url).path.replace(/\/+$/, '');
    return all
      .filter((e) => decodeHref(e.href).replace(/\/+$/, '') !== parentPath)
      .map((e) => ({
        name: basename(decodeHref(e.href).replace(/\/+$/, '')),
        url: buildUrl(this.scheme, decodeHref(e.href).replace(/\/+$/, '')),
        isDir: e.isDir,
        size: e.size,
        mtime: e.mtime
      }))
      .sort((a, b) =>
        a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)
      );
  }

  async read(url: string): Promise<string> {
    const res = await this.dav('GET', url);
    return res.text();
  }

  async write(url: string, content: string): Promise<void> {
    // MKCOL parents on demand (servers are not required to auto-create).
    const { path } = parseUrl(url);
    const segs = path.split('/').filter(Boolean);
    let cur = '';
    for (const seg of segs.slice(0, -1)) {
      cur += '/' + seg;
      try {
        await this.dav('MKCOL', buildUrl(this.scheme, cur));
      } catch (err) {
        if (!(err instanceof FsError) || err.code !== 'EEXIST') {
          // EEXIST is fine (parent already there); others are real problems
          if (err instanceof FsError && err.code === 'EIO') {
            // some servers return 405 → parent exists
          } else {
            throw err;
          }
        }
      }
    }
    await this.dav('PUT', url, content, { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  async mkdir(url: string): Promise<void> {
    const { path } = parseUrl(url);
    const segs = path.split('/').filter(Boolean);
    let cur = '';
    for (const seg of segs) {
      cur += '/' + seg;
      try {
        await this.dav('MKCOL', buildUrl(this.scheme, cur));
      } catch (err) {
        if (!(err instanceof FsError) || err.code !== 'EEXIST') throw err;
      }
    }
  }

  async delete(url: string): Promise<void> {
    await this.dav('DELETE', url);
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    await this.dav('MOVE', oldUrl, undefined, {
      Destination: this.httpUrl(newUrl),
      Overwrite: 'T'
    });
  }

  async copy(src: string, dest: string): Promise<void> {
    await this.dav('COPY', src, undefined, {
      Destination: this.httpUrl(dest),
      Overwrite: 'T'
    });
  }
}
