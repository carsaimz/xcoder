/**
 * File menu — per-editor actions (tab long-press / right-click).
 * File menu: properties, rename, syntax, goto, close….
 */
import { dialog } from '@api/dialog';
import { editorManager } from '@api/editorManager';
import { editorLanguages } from '@api/editorLanguages';
import { events } from '@api/events';
import { toast } from '@api/toast';
import * as fs from '@core/file/fs';
import { i18n } from '@lib/i18n';
import { openSearchRow } from './quickTools';
import { showFileInfo } from './fileInfo';
import { selectAll } from '@codemirror/commands';
import { showContextMenu, type MenuEntry } from './contextMenu';
import type { Editor } from '@api/editorManager';

export function openFileMenu(editor: Editor, x: number, y: number): void {
  const lang = editorLanguages.get(editor.url);
  const items: MenuEntry[] = [
    {
      label: i18n.t('filemenu.properties'),
      icon: 'info',
      action: () => void showFileInfo(editor)
    },
    {
      label: i18n.t('filemenu.rename'),
      icon: 'file',
      action: () => void promptRename(editor)
    },
    'separator',
    {
      label: i18n.t('filemenu.syntax'),
      value: lang?.name ?? 'Plain Text',
      icon: 'chevron-down',
      action: () => void pickLanguage(editor)
    },
    {
      label: i18n.t('filemenu.goto'),
      icon: 'goto',
      action: () => void promptGoto(editor)
    },
    {
      label: i18n.t('filemenu.search'),
      icon: 'search',
      action: () => {
        editorManager.activate(editor);
        openSearchRow();
      }
    },
    {
      label: i18n.t('filemenu.selectAll'),
      icon: 'select-all',
      action: () => {
        editorManager.activate(editor);
        void selectAll(editor.view);
      }
    },
    'separator',
    {
      label: i18n.t('filemenu.close'),
      icon: 'close',
      action: () => void editorManager.closeEditor(editor)
    },
    {
      label: i18n.t('filemenu.closeOthers'),
      icon: 'close',
      action: () => void closeOthers(editor)
    },
    {
      label: i18n.t('filemenu.closeRight'),
      icon: 'close',
      action: () => void closeSide(editor, 'right')
    },
    {
      label: i18n.t('filemenu.closeLeft'),
      icon: 'close',
      action: () => void closeSide(editor, 'left')
    },
    'separator',
    {
      label: i18n.t('filemenu.copyPath'),
      icon: 'copy',
      action: () => {
        void navigator.clipboard?.writeText(editor.url);
        toast.info(i18n.t('tree.pathCopied'));
      }
    }
  ];
  showContextMenu(x, y, items);
}

async function promptRename(editor: Editor): Promise<void> {
  const name = editor.url.slice(editor.url.lastIndexOf('/') + 1);
  const newName = await dialog.prompt(
    i18n.t('filemenu.rename'),
    i18n.t('tree.renamePrompt', { name }),
    { value: name, required: true }
  );
  if (!newName || newName === name) return;
  const parent = editor.url.slice(0, editor.url.lastIndexOf('/'));
  try {
    await fs.rename(editor.url, `${parent}/${newName}`);
  } catch (err) {
    toast.error(String(err instanceof Error ? err.message : err));
  }
}

async function pickLanguage(editor: Editor): Promise<void> {
  const langs = editorLanguages.list();
  const current = editorLanguages.get(editor.url);
  const index = await dialog.select(
    i18n.t('filemenu.syntax'),
    editor.title,
    langs.map((l) => l.name),
    langs.findIndex((l) => l.id === current?.id)
  );
  if (index === null || index < 0) return;
  const info = langs[index];
  const { supportFor } = await import('@core/editor/languages');
  const support = supportFor(`x.${info.extensions[0]}`);
  if (support) editor.reconfigureLanguage(support);
}

async function promptGoto(editor: Editor): Promise<void> {
  const input = await dialog.prompt(i18n.t('filemenu.goto'), i18n.t('filemenu.gotoPrompt'), {
    placeholder: '42',
    type: 'number'
  });
  if (!input) return;
  const line = Number.parseInt(input, 10);
  if (!Number.isFinite(line) || line < 1) return;
  editorManager.activate(editor);
  const doc = editor.view.state.doc;
  const target = doc.line(Math.min(line, doc.lines));
  editor.view.dispatch({
    selection: { anchor: target.from },
    scrollIntoView: true
  });
  editor.view.focus();
}

async function closeOthers(keep: Editor): Promise<void> {
  for (const ed of [...editorManager.editors]) {
    if (ed !== keep) await editorManager.closeEditor(ed);
  }
}

async function closeSide(keep: Editor, side: 'left' | 'right'): Promise<void> {
  const index = editorManager.editors.indexOf(keep);
  for (const ed of [...editorManager.editors]) {
    const i = editorManager.editors.indexOf(ed);
    if ((side === 'right' && i > index) || (side === 'left' && i < index)) {
      await editorManager.closeEditor(ed);
    }
  }
}

/** Wire long-press + contextmenu on tabs (called from tabs.ts render). */
export function attachTabMenu(tab: HTMLElement, editor: Editor): void {
  tab.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openFileMenu(editor, e.clientX, e.clientY);
  });
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  tab.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    pressTimer = setTimeout(() => openFileMenu(editor, t.clientX, t.clientY), 500);
  }, { passive: true });
  tab.addEventListener('touchend', () => clearTimeout(pressTimer));
  tab.addEventListener('touchmove', () => clearTimeout(pressTimer));
  events.on('editor:close', ({ url }) => {
    if (url === editor.url) clearTimeout(pressTimer);
  });
}
