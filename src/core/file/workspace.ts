/**
 * Multi-root workspace.
 *
 * Roots are folder URLs merged into one logical tree for the sidebar.
 * Persisted in the KV store; a `.xcoder-workspace` JSON file can be opened
 * to restore a saved set of roots.
 */
import { KVStore } from '@lib/storage';
import { events } from '@api/events';

export interface WorkspaceFile {
  folders: Array<{ url: string }>;
}

const store = new KVStore('kv', 'workspace:');
let folders: string[] = [];

export async function load(): Promise<string[]> {
  folders = (await store.get<string[]>('folders')) ?? [];
  return [...folders];
}

export async function addFolder(url: string): Promise<void> {
  if (folders.includes(url)) return;
  folders.push(url);
  await persist();
}

export async function removeFolder(url: string): Promise<void> {
  folders = folders.filter((f) => f !== url);
  await persist();
}

export function listFolders(): string[] {
  return [...folders];
}

/** Parse a `.xcoder-workspace` file and replace the current roots. */
export async function openWorkspaceFile(content: string): Promise<string[]> {
  const parsed = JSON.parse(content) as WorkspaceFile;
  if (!Array.isArray(parsed.folders)) throw new Error('invalid workspace file');
  folders = parsed.folders.map((f) => f.url).filter(Boolean);
  await persist();
  return [...folders];
}

async function persist(): Promise<void> {
  await store.set('folders', folders);
  events.emit('workspace:change', { folders: [...folders] });
}

/** Named API object (consumers: `import { workspace } from '@core/file/workspace'`). */
export const workspace = { load, addFolder, removeFolder, listFolders, openWorkspaceFile };
