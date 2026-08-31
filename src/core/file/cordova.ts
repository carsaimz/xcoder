/**
 * Cordova backend — bridges to the Cordova File plugin when running inside
 * the Android app. When the plugin is unavailable (plain web) every method
 * throws `ENOSYS`; the workspace then keeps the browser backend as primary.
 */

import * as path from '../../lib/path';
import { FsError, FileSystemBackend, ListOptions, ReadOptions, Stat, WriteOptions } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CwdEntry {
  nativeURL: string;
  getFile(name: string, opts: unknown, success: (e: any) => void, error: (e: any) => void): void;
  getDirectory(name: string, opts: unknown, success: (e: any) => void, error: (e: any) => void): void;
  createReader(): { readEntries(success: (e: any[]) => void, error: (e: any) => void): void };
  removeRecursively(success: () => void, error: (e: any) => void): void;
}

interface CordovaFs {
  dataDirectory: string;
  resolveLocalFileSystemURL(
    url: string,
    success: (entry: any) => void,
    error: (e: any) => void,
  ): void;
}

function cordovaFs(): CordovaFs | null {
  const c = (globalThis as any).cordova;
  return c?.file ?? null;
}

function codeOf(err: any): FsError['code'] {
  // Cordova FileError codes: NOT_FOUND=1, SECURITY=2, ABORT=3, NOT_READABLE=4,
  // ENCODING=5, NO_MODIFICATION_ALLOWED=6, INVALID_STATE=7, SYNTAX=8,
  // INVALID_MODIFICATION=9, QUOTA_EXCEEDED=10, TYPE_MISMATCH=11, PATH_EXISTS=12.
  switch (err?.code) {
    case 1: return 'ENOENT';
    case 2: return 'EINVAL';
    case 3: return 'ENOSYS';
    case 4: return 'ENOTDIR';
    case 5: return 'ENOSYS';
    case 6: return 'ENOENT';
    case 7: return 'EINVAL';
    case 8: return 'ENOSYS';
    case 9: return 'EEXIST';
    case 10: return 'EEXIST';
    case 11: return 'ENOTEMPTY';
    default: return 'EINVAL';
  }
}

export class CordovaBackend implements FileSystemBackend {
  readonly scheme: string;
  readonly displayName: string;

  constructor(
    private rootDirName = 'xcoder',
    scheme = 'file',
    displayName = 'Device storage',
  ) {
    this.scheme = scheme;
    this.displayName = displayName;
  }

  static available(): boolean {
    return cordovaFs() !== null;
  }

  private require(): CordovaFs {
    const fs = cordovaFs();
    if (!fs) throw new FsError('Cordova file plugin not available on this platform', 'ENOSYS');
    return fs;
  }

  private entry(url: string): Promise<any> {
    const fs = this.require();
    const rel = path.stripScheme(url).replace(/^\/+/, '');
    const base = fs.dataDirectory;
    const target = rel ? `${base}${this.rootDirName}/${rel}` : `${base}${this.rootDirName}`;
    return new Promise((resolve, reject) => {
      fs.resolveLocalFileSystemURL(
        target,
        (entry) => resolve(entry),
        (err) => reject(new FsError(`cordova fs error for ${url}`, codeOf(err))),
      );
    });
  }

  async stat(url: string): Promise<Stat> {
    const entry = await this.entry(url);
    const isDir = entry.isDirectory;
    return {
      path: path.normalize(url),
      isDir,
      size: isDir ? 0 : (entry.getMetadata ? await new Promise<number>((res) => entry.getMetadata((m: any) => res(m.size), () => res(0))) : 0),
      mtime: 0,
    };
  }

  async listdir(url: string, opts?: ListOptions): Promise<Stat[]> {
    const entry = await this.entry(url);
    if (!entry.isDirectory) throw new FsError(`not a directory: ${url}`, 'ENOTDIR');
    const reader = entry.createReader();
    const raw = await new Promise<any[]>((resolve, reject) => {
      const acc: any[] = [];
      const read = () =>
        reader.readEntries((batch: any[]) => {
          if (!batch.length) return resolve(acc);
          acc.push(...batch);
          read();
        }, (err: any) => reject(new FsError('readEntries failed', codeOf(err))));
      read();
    });
    const includeDirs = opts?.includeDirs !== false;
    return raw
      .filter((e) => includeDirs || e.isFile)
      .map((e) => ({
        path: path.join(path.format(this.scheme, path.stripScheme(url)), e.name),
        isDir: e.isDirectory,
        size: e.isFile ? 0 : 0,
        mtime: 0,
      }));
  }

  async readFile(url: string, opts?: ReadOptions): Promise<string | Uint8Array> {
    const entry = await this.entry(url);
    if (entry.isDirectory) throw new FsError(`is a directory: ${url}`, 'EISDIR');
    const text = await new Promise<string>((resolve, reject) => {
      entry.file((file: any) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new FsError(`read failed: ${url}`, 'EINVAL'));
        reader.readAsText(file);
      }, (err: any) => reject(new FsError(`file() failed: ${url}`, codeOf(err))));
    });
    if (opts?.encoding === 'binary') return new TextEncoder().encode(text);
    return text;
  }

  async writeFile(url: string, data: string | Uint8Array, _opts?: WriteOptions): Promise<void> {
    const fs = this.require();
    const rel = path.stripScheme(url).replace(/^\/+/, '');
    // ensure all parent dirs
    const parts = rel.split('/').filter(Boolean);
    let cur = `${fs.dataDirectory}${this.rootDirName}`;
    await new Promise<void>((resolve, reject) => {
      fs.resolveLocalFileSystemURL(cur, () => resolve(), (err) =>
        reject(new FsError('root missing', codeOf(err))));
    });
    for (const part of parts.slice(0, -1)) {
      cur = `${cur}/${part}`;
      await new Promise<void>((resolve) => {
        fs.resolveLocalFileSystemURL(cur, () => resolve(), () => {
          const parent = cur.split('/').slice(0, -1).join('/');
          fs.resolveLocalFileSystemURL(parent, (p: any) => {
            p.getDirectory(part, { create: true }, () => resolve(), () => resolve());
          }, () => resolve());
        });
      });
    }
    const fileName = parts[parts.length - 1];
    const dirEntry = await new Promise<any>((resolve, reject) => {
      fs.resolveLocalFileSystemURL(cur, resolve, (err) => reject(new FsError(`write dir missing: ${url}`, codeOf(err))));
    });
    const fileEntry = await new Promise<any>((resolve, reject) => {
      dirEntry.getFile(fileName, { create: true }, resolve, (err: any) => reject(new FsError(`create failed: ${url}`, codeOf(err))));
    });
    const writer = await new Promise<any>((resolve, reject) => {
      fileEntry.createWriter(resolve, (err: any) => reject(new FsError(`createWriter failed: ${url}`, codeOf(err))));
    });
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    await new Promise<void>((resolve, reject) => {
      writer.onwrite = () => resolve();
      writer.onerror = (err: any) => reject(new FsError(`write failed: ${url}`, codeOf(err)));
      writer.write(new Blob([text], { type: 'text/plain' }));
    });
  }

  async delete(url: string, recursive = false): Promise<void> {
    const entry = await this.entry(url);
    await new Promise<void>((resolve, reject) => {
      if (entry.isDirectory && recursive) {
        entry.removeRecursively(() => resolve(), (err: any) => reject(new FsError(`remove failed: ${url}`, codeOf(err))));
      } else {
        entry.remove(() => resolve(), (err: any) => reject(new FsError(`remove failed: ${url}`, codeOf(err))));
      }
    });
  }

  async mkdir(url: string): Promise<void> {
    const fs = this.require();
    const rel = path.stripScheme(url).replace(/^\/+/, '');
    const parts = rel.split('/').filter(Boolean);
    let cur = `${fs.dataDirectory}${this.rootDirName}`;
    for (const part of parts) {
      const next = `${cur}/${part}`;
      await new Promise<void>((resolve, reject) => {
        fs.resolveLocalFileSystemURL(next, () => {
          cur = next;
          resolve();
        }, () => {
          fs.resolveLocalFileSystemURL(cur, (p: any) => {
            p.getDirectory(part, { create: true }, () => {
              cur = next;
              resolve();
            }, (err: any) => reject(new FsError(`mkdir failed: ${url}`, codeOf(err))));
          }, (err: any) => reject(new FsError(`mkdir parent missing: ${url}`, codeOf(err))));
        });
      });
    }
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    const entry = await this.entry(oldUrl);
    const fs = this.require();
    const rel = path.stripScheme(newUrl).replace(/^\/+/, '');
    const parentRel = path.dirname(`/${rel}`).replace(/^\/+/, '');
    const parent = await new Promise<any>((resolve, reject) => {
      fs.resolveLocalFileSystemURL(
        `${fs.dataDirectory}${this.rootDirName}/${parentRel}`,
        resolve,
        (err) => reject(new FsError(`rename target missing: ${newUrl}`, codeOf(err))),
      );
    });
    await new Promise<void>((resolve, reject) => {
      entry.moveTo(parent, path.basename(newUrl), () => resolve(), (err: any) =>
        reject(new FsError(`moveTo failed: ${oldUrl} → ${newUrl}`, codeOf(err))));
    });
  }

  async exists(url: string): Promise<boolean> {
    try {
      await this.entry(url);
      return true;
    } catch {
      return false;
    }
  }
}
