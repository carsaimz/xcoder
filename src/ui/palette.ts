/** Command palette (Ctrl+K) and Quick Open (Ctrl+P) overlays. */

import { el, icon, clear, qs } from '../lib/dom';
import * as path from '../lib/path';
import { commands } from '../api/commands';
import { t } from '../lib/i18n';
import { fuzzyMatch } from '../lib/path';
import { fs } from '../core/file';
import { editorManager } from '../core/editor/editorManager';

interface Item {
  label: string;
  hint?: string;
  icon?: string;
  run: () => void;
}

let openOverlay: HTMLElement | null = null;

function closeOverlay(): void {
  openOverlay?.remove();
  openOverlay = null;
}

function showOverlay(items: Item[], placeholder: string, initialQuery = ''): void {
  closeOverlay();
  const overlay = el('div', { class: 'overlay' });
  const box = el('div', { class: 'palette' });
  const input = el('input', { class: 'palette-input', placeholder, value: initialQuery }) as HTMLInputElement;
  const list = el('div', { class: 'palette-list' });
  box.append(input, list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  openOverlay = overlay;

  let selected = 0;
  let filtered: Array<{ item: Item; score: number }> = [];

  const render = (): void => {
    clear(list);
    const q = input.value.trim();
    filtered = items
      .map((item) => ({ item, score: q ? fuzzyMatch(q, item.label) : 0 }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
    if (!filtered.length) {
      list.appendChild(el('div', { class: 'palette-empty' }, t('palette.noResults')));
      return;
    }
    if (selected >= filtered.length) selected = 0;
    filtered.forEach((entry, i) => {
      const row = el(
        'div',
        { class: `palette-item${i === selected ? ' selected' : ''}` },
        entry.item.icon ? icon(entry.item.icon, 16) : icon('chevron', 16),
        el('span', { class: 'label' }, entry.item.label),
        entry.item.hint ? el('span', { class: 'hint' }, entry.item.hint) : '',
      );
      row.addEventListener('click', () => {
        closeOverlay();
        entry.item.run();
      });
      list.appendChild(row);
    });
    list.querySelector('.palette-item.selected')?.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', () => {
    selected = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlay();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + 1, Math.max(filtered.length - 1, 0));
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filtered[selected];
      if (chosen) {
        closeOverlay();
        chosen.item.run();
      }
    }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });
  render();
  input.focus();
}

/** Open the command palette. */
export function openPalette(): void {
  const items: Item[] = commands.list().map((cmd) => ({
    label: commands.labelOf(cmd),
    hint: cmd.keybinding,
    icon: cmd.icon,
    run: () => void commands.execute(cmd.id),
  }));
  showOverlay(items, t('palette.placeholder'));
}

/** Quick open: fuzzy-search workspace files. */
export async function openQuickOpen(): Promise<void> {
  const files: string[] = [];
  const roots = fs.listRoots();
  const skip = new Set(['node_modules', '.git', 'www', 'dist', 'coverage']);
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (files.length > 400 || depth > 7) return;
    let entries;
    try {
      entries = await fs.listdir(dir, { includeDirs: false });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDir) {
        if (!skip.has(path.basename(entry.path))) await walk(entry.path, depth + 1);
      } else {
        files.push(entry.path);
      }
    }
  };
  await Promise.all(roots.map((r) => walk(r.url, 0)));

  const items: Item[] = files.map((p) => ({
    label: path.basename(p),
    hint: p,
    icon: 'file',
    run: () => {
      void editorManager.open(p);
    },
  }));
  showOverlay(items.length ? items : [{ label: t('tree.empty'), run: () => undefined }], t('editor.quickOpenHint'));
}

/** Global keyboard shortcuts. */
export function installShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'k') {
      e.preventDefault();
      openPalette();
    } else if (k === 'p') {
      e.preventDefault();
      void openQuickOpen();
    } else if (k === 's') {
      // handled by editor host too; prevent browser save
      e.preventDefault();
    } else if (k === 'b') {
      e.preventDefault();
      qs<HTMLElement>('.sidebar')?.classList.toggle('collapsed');
    }
  });
}
