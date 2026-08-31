/**
 * FileSystemBackend contract shared by every storage provider in XCoder.
 * All paths are absolute and may carry a scheme (`file:///a/b.txt`).
 */

export interface Stat {
  path: string;
  size: number;
  mtime: number;
  isDir: boolean;
}

export interface ReadOptions {
  /** when 'binary' a Uint8Array is returned */
  encoding?: 'utf8' | 'binary';
}

export interface WriteOptions {
  /** create parent directories automatically (default true) */
  mkdirs?: boolean;
  /** append instead of overwrite */
  append?: boolean;
}

export interface ListOptions {
  /** include directory entries (default true) */
  includeDirs?: boolean;
}

export class FsError extends Error {
  constructor(
    message: string,
    readonly code: 'ENOENT' | 'EEXIST' | 'ENOTDIR' | 'EISDIR' | 'ENOTEMPTY' | 'EINVAL' | 'ENOSYS',
  ) {
    super(message);
    this.name = 'FsError';
  }
}

export interface FileSystemBackend {
  /** unique scheme handled by this backend, e.g. `file` */
  readonly scheme: string;
  /** human readable name shown in the workspace UI */
  readonly displayName: string;
  stat(path: string): Promise<Stat>;
  listdir(path: string, opts?: ListOptions): Promise<Stat[]>;
  readFile(path: string, opts?: ReadOptions): Promise<string | Uint8Array>;
  writeFile(path: string, data: string | Uint8Array, opts?: WriteOptions): Promise<void>;
  delete(path: string, recursive?: boolean): Promise<void>;
  mkdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
