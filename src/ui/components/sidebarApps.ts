/**
 * Sidebar drawer wiring — app rail (files / search / AI / settings), panel
 * switching, open/close with backdrop. The drawer overlays the full screen
 * and slides in from the left.
 */
import { $, clearNode, el } from '@lib/dom';
import { i18n } from '@lib/i18n';
import { editorManager } from '@api/editorManager';
import { KVStore } from '@lib/storage';

const recents = new KVStore('kv', 'recents:');

export function mountSidebar(): void {
  const sidebar = $('#sidebar');
  const backdrop = $('#sidebar-backdrop');

  const close = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
  };
  const open = () => {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
    editorManager.activeEditor?.view.contentDOM.blur();
  };
  const toggle = () => (sidebar.classList.contains('open') ? close() : open());

  $('#btn-menu').addEventListener('click', toggle);
  backdrop.addEventListener('click', close);

  // rail app switching
  const panels: Array<[string, string]> = [
    ['rail-files', 'panel-files'],
    ['rail-search', 'panel-search']
  ];
  for (const [railId, panelId] of panels) {
    const rail = document.getElementById(railId)!;
    rail.addEventListener('click', () => {
      for (const [r, p] of panels) {
        document.getElementById(r)?.classList.toggle('active', r === railId);
        document.getElementById(p)?.classList.toggle('active', p === panelId);
      }
      rail.classList.add('active');
      open();
    });
  }

  // rail buttons that open overlays instead of panels
  document.getElementById('btn-ai')?.addEventListener('click', close);
  document.getElementById('btn-settings')?.addEventListener('click', close);

  void renderRecents();
}

export function toggleSidebar(): void {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar?.classList.toggle('open');
  backdrop?.classList.toggle('show', sidebar?.classList.contains('open') ?? false);
}

/** Track recently opened files and render them on the welcome screen. */
export async function trackRecents(): Promise<void> {
  const { events } = await import('@api/events');
  events.on('editor:open', async ({ url }) => {
    const list = ((await recents.get<string[]>('list')) ?? []).filter((u) => u !== url);
    list.unshift(url);
    await recents.set('list', list.slice(0, 8));
  });
}

async function renderRecents(): Promise<void> {
  const container = document.getElementById('welcome-recents');
  if (!container) return;
  const list = (await recents.get<string[]>('list')) ?? [];
  if (!list.length) return;
  clearNode(container);
  container.append(el('div', { class: 'recents-title' }, i18n.t('welcome.recents')));
  for (const url of list.slice(0, 5)) {
    const name = url.slice(url.lastIndexOf('/') + 1);
    const row = el(
      'div',
      { class: 'recent-file' },
      el('span', { class: 'r-name' }, name),
      el('span', { class: 'r-path' }, url)
    );
    row.addEventListener('click', () => void editorManager.openFile(url));
    container.append(row);
  }
}
