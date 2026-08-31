/**
 * Editor tab strip — open-file list: fixed-width tabs, active
 * top border, yellow dirty bullet, long-press → file menu.
 */
import { el, clearNode, $ } from '@lib/dom';
import { editorManager } from '@api/editorManager';
import { events } from '@api/events';
import { attachTabMenu } from './fileMenu';
import { fileBadge } from './fileBadge';
import type { Editor } from '@api/editorManager';

export function mountTabs(): void {
  const bar = $('#tabs');
  const welcome = $('#welcome');

  const refresh = () => {
    clearNode(bar);
    for (const editor of editorManager.editors) {
      bar.append(renderTab(editor));
    }
    welcome?.classList.toggle('has-editors', editorManager.editors.length > 0);
    bar.scrollTo({ left: bar.scrollWidth });
  };

  events.on('editor:open', refresh);
  events.on('editor:close', refresh);
  events.on('editor:switch', refresh);
  events.on('editor:dirty', refresh);
  refresh();
}

function renderTab(editor: Editor): HTMLElement {
  const tab = el(
    'div',
    {
      class: `tab${editor === editorManager.activeEditor ? ' active' : ''}${editor.isDirty ? ' dirty' : ''}`,
      role: 'tab',
      'aria-selected': String(editor === editorManager.activeEditor),
      title: editor.url
    },
    fileBadge(editor.title),
    el('span', { class: 'tab-title' }, editor.title)
  );
  const close = el('button', { class: 'tab-close', 'aria-label': 'Close tab' }, '×');
  close.addEventListener('click', (e) => {
    e.stopPropagation();
    void editorManager.closeEditor(editor);
  });
  tab.append(close);
  tab.addEventListener('click', () => editorManager.activate(editor));
  tab.addEventListener('auxclick', (e) => {
    if (e.button === 1) void editorManager.closeEditor(editor);
  });
  attachTabMenu(tab, editor);
  return tab;
}
