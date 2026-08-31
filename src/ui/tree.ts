/** File tree for the active workspace root. */

import { el, icon, clear } from '../lib/dom';
import * as path from '../lib/path';
import { bus } from '../lib/events';
import { t } from '../lib/i18n';
import { fs, Stat } from '../core/file';
import { editorManager } from '../core/editor/editorManager';
import * as dialog from '../api/dialog';
import { toast } from '../api/toast';

export class FileTree {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private renderSeq = 0;

  constructor(parent: HTMLElement) {
    this.container = el('div', { class: 'tree' });
    parent.appendChild(this.container);
    this.rootEl = el('div');
    this.container.appendChild(this.rootEl);
    bus.on('workspace:roots', () => void this.render());
    bus.on('workspace:changed', () => void this.render());
    bus.on('editor:active', () => void this.render());
    void this.render();
  }

  private async render(): Promise<void> {
    const seq = ++this.renderSeq;
    clear(this.rootEl);
    const roots = fs.listRoots();
    if (!roots.length) {
      this.rootEl.appendChild(el('div', { class: 'tree-empty' }, t('tree.empty')));
      return;
    }
    for (const root of roots.slice(0, 3)) {
      if (seq !== this.renderSeq) return;
      const head = el(
        'div',
        { class: 'tree-head' },
        el('span', {}, root.label || t('tree.rootLabel')),
      );
      const actions = el('div', { class: 'actions' });
      actions.appendChild(
        el('button', {
          class: 'icon-btn',
          title: t('tree.newFile'),
          onclick: () => void this.newFile(),
        }, icon('plus', 15)),
      );
      actions.appendChild(
        el('button', {
          class: 'icon-btn',
          title: t('tree.refresh'),
          onclick: () => void this.render(),
        }, icon('refresh', 15)),
      );
      head.appendChild(actions);
      this.rootEl.appendChild(head);
      await this.renderDir(root.url, this.rootEl, 0, seq);
    }
  }

  private async renderDir(dir: string, parent: HTMLElement, depth: number, seq: number): Promise<void> {
    if (depth > 6) return;
    let entries: Stat[] = [];
    try {
      entries = await fs.listdir(dir);
    } catch {
      return;
    }
    if (seq !== this.renderSeq) return;
    if (!entries.length && depth === 0) {
      parent.appendChild(el('div', { class: 'tree-empty' }, t('tree.empty')));
      return;
    }
    for (const entry of entries) {
      const name = path.basename(entry.path);
      const active = editorManager.activePath() === entry.path;
      const item = el(
        'div',
        { class: `tree-item${active ? ' active' : ''}` },
        icon(entry.isDir ? 'folder' : 'file', 15),
        el('span', {}, name),
      );
      item.addEventListener('click', () => void this.onItem(entry));
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        void this.contextMenu(entry);
      });
      // long-press for mobile
      let pressTimer: ReturnType<typeof setTimeout>;
      item.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => void this.contextMenu(entry), 550);
      });
      item.addEventListener('touchend', () => clearTimeout(pressTimer));
      item.addEventListener('touchmove', () => clearTimeout(pressTimer));
      parent.appendChild(item);
      if (entry.isDir) {
        const children = el('div', { class: 'tree-children' });
        parent.appendChild(children);
        await this.renderDir(entry.path, children, depth + 1, seq);
      }
    }
  }

  private async onItem(entry: Stat): Promise<void> {
    if (entry.isDir) return;
    try {
      await editorManager.open(entry.path);
    } catch (err) {
      toast(t('editor.openFailed', { path: entry.path, reason: (err as Error).message }), 'error');
    }
  }

  private async contextMenu(entry: Stat): Promise<void> {
    const choice = await dialog.select(
      `${path.basename(entry.path)}`,
      [
        { value: 'open', label: 'Open' },
        { value: 'rename', label: t('rename') },
        { value: 'delete', label: t('delete') },
      ],
    );
    if (!choice) return;
    if (choice === 'open' && !entry.isDir) await this.onItem(entry);
    if (choice === 'rename') {
      const newName = await dialog.prompt(t('rename'), path.basename(entry.path));
      if (newName && newName !== path.basename(entry.path)) {
        const target = path.join(path.dirname(entry.path), newName);
        try {
          await fs.rename(entry.path, target);
        } catch (err) {
          toast((err as Error).message, 'error');
        }
      }
    }
    if (choice === 'delete') {
      const ok = await dialog.confirm(t('tree.deleteConfirm', { path: entry.path }));
      if (ok) {
        try {
          await fs.delete(entry.path, true);
          if (editorManager.activePath() === entry.path) editorManager.closeAll();
        } catch (err) {
          toast((err as Error).message, 'error');
        }
      }
    }
  }

  private async newFile(): Promise<void> {
    const root = fs.cwd();
    const p = await dialog.prompt(t('ws.newFilePrompt'), path.join(root, 'untitled.txt'));
    if (!p) return;
    const target = path.isAbsolute(p) ? p : path.join(root, p);
    if (await fs.exists(target)) {
      toast(t('ws.fileExists', { path: p }), 'warn');
      return;
    }
    await fs.writeFile(target, '');
    await editorManager.open(target);
  }
}
