/**
 * Cordova backend (`file://`) — wraps cordova-plugin-file.
 * Only registered when running under Android (window.cordova present).
 *
 * All entry-based callbacks are wrapped into promises; directories use
 * removeRecursively/moveTo/copyTo. Path math stays in lib/path so this file
 * only deals with the Cordova API.
 */
import { basename, dirname } from '@lib/path';
import { FsError, type FileEntry, type FileSystemBackend } from './fs';

/* Minimal ambient shape of cordova-plugin-file (avoid @types dependency). */
interface CdvFlags {
  create?: boolean;
  exclusive?: boolean;
}

interface CdvWriter {
  write(data: Blob | string): void;
  length: number;
  truncate(n: number): void;
  onwriteend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

interface CdvEntry {
  isDirectory: boolean;
  isFile: boolean;
  name: string;
  fullPath: string;
  toURL(): string;
  getMetadata(ok: (m: { size: number; modificationTime: string }) => void, fail: (e: unknown) => void): void;
  file(ok: (f: { size: number }) => void, fail: (e: unknown) => void): void;
  createReader(): {
    readEntries(ok: (entries: CdvEntry[]) => void, fail: (e: unknown) => void): void;
  };
  createWriter(ok: (w: CdvWriter) => void, fail: (e: unknown) => void): void;
  remove(ok: () => void, fail: (e: unknown) => void): void;
  removeRecursively(ok: () => void, fail: (e: unknown) => void): void;
  moveTo(parent: CdvEntry, newName: string, ok?: (e: CdvEntry) => void, fail?: (e: unknown) => void): void;
  copyTo(parent: CdvEntry, newName: string, ok?: (e: CdvEntry) => void, fail?: (e: unknown) => void): void;
  getFile(
    name: string,
    flags: CdvFlags,
    ok: (entry: CdvEntry) => void,
    fail: (e: unknown) => void
  ): void;
  getDirectory(
    name: string,
    flags: CdvFlags,
    ok: (entry: CdvEntry) => void,
    fail: (e: unknown) => void
  ): void;
}

type CdvWindow = Window & {
  cordova?: unknown;
  resolveLocalFileSystemURL?: (url: string, ok: (e: CdvEntry) => void, fail: (e: unknown) => void) => void;
  requestFileSystem?: (
    type: number,
    size: number,
    ok: (fs: { root: CdvEntry }) => void,
    fail: (e: unknown) => void
  ) => void;
};

function w(): CdvWindow {
  return window as CdvWindow;
}

function entryUrl(url: string): Promise<CdvEntry> {
  return new Promise((resolve, reject) => {
    const resolveFn = w().resolveLocalFileSystemURL;
    if (!resolveFn) {
      reject(new FsError('EIO', 'resolveLocalFileSystemURL unavailable'));
      return;
    }
    resolveFn(url, resolve, (err) => reject(cdvError(err, url)));
  });
}

function cdvError(err: unknown, url: string): FsError {
  const code = (err as { code?: number } | null)?.code ?? 0;
  if (code === 1) return new FsError('ENOENT', url);
  if (code === 12) return new FsError('EEXIST', url);
  return new FsError('EIO', `${url} (cordova code ${code})`);
}

function entryToFileEntry(entry: CdvEntry, url: string): Promise<FileEntry> {
  return new Promise((resolve) => {
    entry.getMetadata(
      (m) =>
        resolve({
          name: entry.name || '/',
          url,
          isDir: entry.isDirectory,
          size: entry.isFile ? m.size : undefined,
          mtime: new Date(m.modificationTime).getTime()
        }),
      () =>
        resolve({
          name: entry.name || '/',
          url,
          isDir: entry.isDirectory
        })
    );
  });
}

export class CordovaBackend implements FileSystemBackend {
  readonly id = 'backend-cordova';
  readonly scheme = 'file';
  readonly displayName = 'Device storage';
  readonly capabilities = { write: true, watch: false };

  static get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!w().cordova && !!w().resolveLocalFileSystemURL;
  }

  async stat(url: string): Promise<FileEntry> {
    const entry = await entryUrl(url);
    return entryToFileEntry(entry, url);
  }

  async list(url: string): Promise<FileEntry[]> {
    const dir = await entryUrl(url);
    if (!dir.isDirectory) throw new FsError('ENOTDIR', url);
    const out: FileEntry[] = [];
    await new Promise<void>((resolve, reject) => {
      const reader = dir.createReader();
      const readChunk = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            resolve();
            return;
          }
          for (const e of entries) {
            const childUrl = e.toURL().replace(/\/$/, '');
            out.push(await entryToFileEntry(e, childUrl));
          }
          readChunk(); // readEntries returns paginated results
        }, (err) => reject(cdvError(err, url)));
      };
      readChunk();
    });
    return out.sort((a, b) =>
      a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)
    );
  }

  async read(url: string): Promise<string> {
    const entry = await entryUrl(url);
    if (entry.isDirectory) throw new FsError('EISDIR', url);
    return new Promise((resolve, reject) => {
      entry.file((file: unknown) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new FsError('EIO', `read failed: ${url}`));
        reader.readAsText(file as Blob);
      }, (err) => reject(cdvError(err, url)));
    });
  }

  async write(url: string, content: string): Promise<void> {
    const parent = await entryUrl(dirname(url));
    const name = basename(url);
    await new Promise<void>((resolve, reject) => {
      parent.getFile(
        name,
        { create: true },
        (fileEntry: CdvEntry) => {
          fileEntry.createWriter((writer: CdvWriter) => {
            writer.onwriteend = () => resolve();
            writer.onerror = () => reject(new FsError('EIO', `write failed: ${url}`));
            writer.truncate(0);
            writer.write(new Blob([content], { type: 'text/plain' }));
          }, (err: unknown) => reject(cdvError(err, url)));
        },
        (err: unknown) => reject(cdvError(err, url))
      );
    });
  }

  async mkdir(url: string): Promise<void> {
    const parent = await entryUrl(dirname(url));
    await new Promise<void>((resolve, reject) => {
      parent.getDirectory(
        basename(url),
        { create: true },
        () => resolve(),
        (err: unknown) => reject(cdvError(err, url))
      );
    });
  }

  async delete(url: string): Promise<void> {
    const entry = await entryUrl(url);
    await new Promise<void>((resolve, reject) => {
      const done = () => resolve();
      const fail = (err: unknown) => reject(cdvError(err, url));
      if (entry.isDirectory) entry.removeRecursively(done, fail);
      else entry.remove(done, fail);
    });
  }

  async rename(oldUrl: string, newUrl: string): Promise<void> {
    const entry = await entryUrl(oldUrl);
    const parent = await entryUrl(dirname(newUrl));
    await new Promise<void>((resolve, reject) => {
      entry.moveTo(parent, basename(newUrl), () => resolve(), (err) => reject(cdvError(err, oldUrl)));
    });
  }

  async copy(src: string, dest: string): Promise<void> {
    const entry = await entryUrl(src);
    const parent = await entryUrl(dirname(dest));
    await new Promise<void>((resolve, reject) => {
      entry.copyTo(parent, basename(dest), () => resolve(), (err) => reject(cdvError(err, src)));
    });
  }
}
