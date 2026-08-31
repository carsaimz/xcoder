/**
 * Facade — file system operations, backends, search and workspace roots.
 */
import * as core from '@core/file/fs';
import * as workspace from '@core/file/workspace';
import type { FileSystemBackend, FileEntry, SearchHit } from '@core/file/fs';
import { editorManager } from './editorManager';

export type { FileSystemBackend, FileEntry, SearchHit } from '@core/file/fs';
export { FsError } from '@core/file/fs';

export const fileSystem = {
  read: (url: string) => core.read(url),
  write: (url: string, content: string) => core.write(url, content),
  createFile: (url: string, content?: string) => core.createFile(url, content),
  createDir: (url: string) => core.createDir(url),
  list: (url: string) => core.list(url),
  stat: (url: string) => core.stat(url),
  exists: (url: string) => core.exists(url),
  delete: (url: string) => core.deletePath(url),
  rename: (oldUrl: string, newUrl: string) => core.rename(oldUrl, newUrl),
  copy: (src: string, dest: string) => core.copy(src, dest),
  search: (rootUrl: string, pattern: string, opts?: { maxResults?: number }) =>
    core.search(rootUrl, pattern, opts),
  walkFiles: (rootUrl: string) => core.walkFiles(rootUrl),
  registerBackend: (backend: FileSystemBackend) => core.registerBackend(backend),
  listBackends: () => core.listBackends(),
  openFile: (url: string) => editorManager.openFile(url),
  // multi-root workspace
  workspace: {
    addFolder: workspace.addFolder,
    removeFolder: workspace.removeFolder,
    listFolders: workspace.listFolders,
    openWorkspaceFile: workspace.openWorkspaceFile
  }
};
