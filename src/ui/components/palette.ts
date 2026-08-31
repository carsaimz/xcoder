/**
 * Command palette + quick open.
 *
 * Two modes share one overlay:
 *  - `>` prefix (or Ctrl+Shift+P): commands
 *  - plain text  (or Ctrl+P):      quick file open
 */
import { el, clearNode, $, iconEl } from '@lib/dom';
import { commands } from '@api/commands';
import { editorManager } from '@api/editorManager';
import * as fs from '@core/file/fs';
import { workspace } from '@core/file/workspace';
import { fuzzyScore } from '@lib/helpers';
import { i18n } from '@lib/i18n';

interface PaletteItem {
  label: string;
  detail?: string;
  icon?: string;
  run: () => void;
}

let items: PaletteItem[] = [];
let filtered: PaletteItem[] = [];
let selectedIndex = 0;
let mode: 'commands' | 'files' = 'commands';

export function mountPalette(): void {
  const overlay = $('#palette-overlay');
  const input = $('#palette-input') as HTMLInputElement;
  const list = $('#palette-list');

  const close = () => {
    overlay.classList.add('hidden');
    input.value = '';
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  input.addEventListener('input', () => {
    mode = input.value.startsWith('>') ? 'commands' : 'files';
    void refresh(input.value.replace(/^>\s*/, ''));
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
      renderList(list);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderList(list);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) {
        close();
        item.run();
      }
    }
  });

  $('#welcome-palette')?.addEventListener('click', () => openPalette('commands'));
}

export function openPalette(which: 'commands' | 'files'): void {
  const overlay = $('#palette-overlay');
  const input = $('#palette-input') as HTMLInputElement;
  overlay.classList.remove('hidden');
  mode = which;
  input.value = which === 'commands' ? '>' : '';
  input.placeholder = which === 'commands' ? i18n.t('palette.commands') : i18n.t('palette.files');
  void refresh('');
  input.focus();
}

async function refresh(query: string): Promise<void> {
  selectedIndex = 0;
  if (mode === 'commands') {
    items = commands.list().map((cmd) => ({
      label: cmd.name,
      detail: [cmd.description, keyHint(cmd)].filter(Boolean).join(' · '),
      icon: 'command',
      run: () => void commands.exec(cmd.name)
    }));
  } else {
    const urls: string[] = [];
    for (const folder of workspace.listFolders()) {
      urls.push(...(await fs.walkFiles(folder, 800)));
    }
    items = urls.map((url) => ({
      label: url,
      detail: undefined,
      icon: 'file',
      run: () => void editorManager.openFile(url)
    }));
  }
  const q = query.toLowerCase().trim();
  filtered = !q
    ? items.slice(0, 50)
    : (items
        .map((item) => ({ item, score: fuzzyScore(q, item.label) }))
        .filter((x) => x.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 50)
        .map((x) => x.item));
  renderList($('#palette-list'));
}

function keyHint(cmd: { bindKey?: { win?: string; mac?: string } }): string {
  const chord = cmd.bindKey?.win ?? cmd.bindKey?.mac;
  return chord ? `⌘ ${chord}` : '';
}

function renderList(list: HTMLElement): void {
  clearNode(list);
  if (!filtered.length) {
    list.append(el('li', { class: 'palette-empty' }, i18n.t('palette.noResults')));
    return;
  }
  filtered.forEach((item, idx) => {
    const li = el(
      'li',
      { class: `palette-item${idx === selectedIndex ? ' selected' : ''}`, role: 'option' },
      item.icon ? iconEl(item.icon, 14) : null,
      el('span', { class: 'p-label' }, item.label),
      item.detail ? el('span', { class: 'p-detail' }, item.detail) : null
    );
    li.addEventListener('click', () => {
      $('#palette-overlay').classList.add('hidden');
      item.run();
    });
    li.addEventListener('mousemove', () => {
      if (selectedIndex !== idx) {
        selectedIndex = idx;
        for (const [i, child] of [...list.children].entries()) {
          child.classList.toggle('selected', i === idx);
        }
      }
    });
    list.append(li);
  });
}
