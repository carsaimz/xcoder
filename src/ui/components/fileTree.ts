/**
 * File explorer tree over the FS abstraction + workspace roots.
 * Re-renders on `fs:update` / `workspace:change`; lazy-expands directories.
 */
import { el, clearNode, iconEl, $ } from '@lib/dom';
import { i18n } from '@lib/i18n';
import * as fs from '@core/file/fs';
import { workspace } from '@core/file/workspace';
import { editorManager } from '@api/editorManager';
import { events } from '@api/events';
import { dialog } from '@api/dialog';
import { toast } from '@api/toast';
import { showContextMenu, type MenuItem } from './contextMenu';
import { fileBadge } from './fileBadge';
import type { FileEntry } from '@core/file/fs';

const expanded = new Set<string>();

export function mountFileTree(): void {
  const root = $('#file-tree');
  events.on('fs:update', () => void render());
  events.on('workspace:change', () => void render());
  events.on('editor:switch', ({ url }) => markActive(root, url));
  void render();

  $('#btn-new-file').addEventListener('click', () => void promptNewFile());
  $('#btn-new-folder').addEventListener('click', () => void promptNewDir());
  $('#btn-refresh').addEventListener('click', () => void render());
}

async function render(): Promise<void> {
  const root = $('#file-tree');
  clearNode(root);
  const folders = workspace.listFolders();
  if (!folders.length) {
    root.append(
      el('div', { class: 'tree-empty' }, i18n.t('tree.empty'))
    );
    return;
  }
  for (const folderUrl of folders) {
    const label = decodeURIComponent(folderUrl).replace(/\/+$/, '').split('/').pop() || folderUrl;
    const folderRow = el(
      'div',
      { class: 'tree-item root', role: 'treeitem' },
      iconEl('folder'),
      el('span', { class: 'label' }, label)
    );
    root.append(folderRow);
    const children = el('div', { class: 'tree-children open' });
    root.append(children);
    await renderDir(children, folderUrl);
  }
  const activeUrl = editorManager.activeEditor?.url;
  if (activeUrl) markActive(root, activeUrl);
}

async function renderDir(container: HTMLElement, dirUrl: string): Promise<void> {
  let entries: FileEntry[];
  try {
    entries = await fs.list(dirUrl);
  } catch {
    container.append(el('div', { class: 'tree-empty' }, i18n.t('tree.unreadable')));
    return;
  }
  if (!entries.length) {
    container.append(el('div', { class: 'tree-empty' }, '·'));
    return;
  }
  for (const entry of entries) {
    container.append(renderEntry(entry));
  }
}

function renderEntry(entry: FileEntry): HTMLElement {
  const isExpanded = expanded.has(entry.url);
  const row = el(
    'div',
    {
      class: 'tree-item',
      role: 'treeitem',
      'data-url': entry.url,
      'data-dir': String(entry.isDir)
    },
    entry.isDir ? iconEl(isExpanded ? 'chevron' : 'folder') : iconEl('file'),
    el('span', { class: 'label' }, entry.name)
  );

  if (entry.isDir) {
    row.addEventListener('click', () => {
      const children = row.nextElementSibling as HTMLElement | null;
      if (children?.classList.contains('tree-children')) {
        children.classList.toggle('open');
        if (children.classList.contains('open')) expanded.add(entry.url);
        else expanded.delete(entry.url);
      }
    });
  } else {
    row.addEventListener('click', () => {
      void editorManager.openFile(entry.url);
    });
  }

  // colored extension badge on files (colored file icons)
  if (!entry.isDir) {
    const icon = row.querySelector('.icon');
    if (icon) icon.replaceWith(fileBadge(entry.name));
  }

  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showEntryMenu(e.clientX, e.clientY, entry);
  });
  // long-press → context menu (mobile)
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  row.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    pressTimer = setTimeout(() => showEntryMenu(touch.clientX, touch.clientY, entry), 500);
  }, { passive: true });
  row.addEventListener('touchend', () => clearTimeout(pressTimer));
  row.addEventListener('touchmove', () => clearTimeout(pressTimer));

  const wrapper = el('div', {}, row);
  if (entry.isDir) {
    const children = el('div', { class: `tree-children${isExpanded ? ' open' : ''}` });
    wrapper.append(children);
    if (isExpanded) void renderDir(children, entry.url);
  }
  return wrapper;
}

function showEntryMenu(x: number, y: number, entry: FileEntry): void {
  const items: MenuItem[] = [
    {
      label: i18n.t('tree.open'),
      action: () => void editorManager.openFile(entry.url)
    },
    {
      label: i18n.t('tree.rename'),
      action: () => void promptRename(entry)
    },
    {
      label: i18n.t('tree.copyPath'),
      action: () => {
        void navigator.clipboard?.writeText(entry.url);
        toast.info(i18n.t('tree.pathCopied'));
      }
    },
    {
      label: i18n.t('tree.delete'),
      danger: true,
      action: () => void promptDelete(entry)
    }
  ];
  if (entry.isDir) {
    items.splice(1, 0,
      {
        label: i18n.t('tree.newFile'),
        action: () => void promptNewFile(entry.url)
      },
      {
        label: i18n.t('tree.newFolder'),
        action: () => void promptNewDir(entry.url)
      }
    );
  }
  showContextMenu(x, y, items);
}

async function promptNewFile(dirUrl?: string): Promise<void> {
  const folder = dirUrl ?? workspace.listFolders()[0];
  if (!folder) {
    toast.warning(i18n.t('tree.noFolder'));
    return;
  }
  const name = await dialog.prompt(
    i18n.t('tree.newFile'),
    i18n.t('tree.fileNamePrompt'),
    { placeholder: 'example.js', required: true }
  );
  if (!name) return;
  const url = folder.endsWith('/') ? folder + name : `${folder}/${name}`;
  try {
    await fs.createFile(url, '');
    await editorManager.openFile(url);
  } catch (err) {
    toast.error(String(err instanceof Error ? err.message : err));
  }
}

async function promptNewDir(dirUrl?: string): Promise<void> {
  const folder = dirUrl ?? workspace.listFolders()[0];
  if (!folder) {
    toast.warning(i18n.t('tree.noFolder'));
    return;
  }
  const name = await dialog.prompt(
    i18n.t('tree.newFolder'),
    i18n.t('tree.folderNamePrompt'),
    { placeholder: 'src', required: true }
  );
  if (!name) return;
  const url = folder.endsWith('/') ? folder + name : `${folder}/${name}`;
  try {
    await fs.createDir(url);
  } catch (err) {
    toast.error(String(err instanceof Error ? err.message : err));
  }
}

async function promptRename(entry: FileEntry): Promise<void> {
  const newName = await dialog.prompt(
    i18n.t('tree.rename'),
    i18n.t('tree.renamePrompt', { name: entry.name }),
    { value: entry.name, required: true }
  );
  if (!newName || newName === entry.name) return;
  const parent = entry.url.slice(0, entry.url.lastIndexOf('/'));
  try {
    await fs.rename(entry.url, `${parent}/${newName}`);
  } catch (err) {
    toast.error(String(err instanceof Error ? err.message : err));
  }
}

async function promptDelete(entry: FileEntry): Promise<void> {
  const ok = await dialog.confirm(
    i18n.t('tree.delete'),
    i18n.t('tree.deleteConfirm', { name: entry.name })
  );
  if (!ok) return;
  try {
    await fs.deletePath(entry.url);
  } catch (err) {
    toast.error(String(err instanceof Error ? err.message : err));
  }
}

function markActive(root: HTMLElement, url: string): void {
  for (const item of root.querySelectorAll<HTMLElement>('.tree-item[data-url]')) {
    item.classList.toggle('active', item.dataset.url === url);
  }
}
