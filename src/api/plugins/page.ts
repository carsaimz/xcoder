/**
 * Plugin pages — the full-screen surface a plugin can claim (`$page`).
 * Rendered into #plugin-pages (see index.html).
 */
import { el, $, clearNode, iconSvg } from '@lib/dom';
import type { PluginPage } from './lifecycle';

interface PageEntry {
  id: string;
  title: string;
  body: HTMLElement;
  page: PluginPage;
}

const pages = new Map<string, PageEntry>();

export function mountPages(): void {
  const root = $('#plugin-pages');
  const closeBtn = root.querySelector('.plugin-pages-close') as HTMLElement | null;
  if (closeBtn && !closeBtn.innerHTML.trim()) closeBtn.innerHTML = iconSvg('close', 18);
  closeBtn?.addEventListener('click', () => {
    for (const entry of pages.values()) if (root.contains(entry.page)) entry.page.close();
  });
}

export function createPluginPage(id: string): PluginPage {
  const existing = pages.get(id);
  if (existing) return existing.page;

  const host = $('#plugin-pages');
  const titleEl = $('#plugin-pages-title');
  const bodyEl = $('#plugin-pages-body');

  const body = el('div', { class: 'plugin-page' });
  const page = el('section', { class: 'plugin-page-host', dataset: { pluginId: id } }) as PluginPage;
  page.append(body);
  (page as unknown as { setTitle: (t: string) => void }).setTitle = (t: string) => {
    (pages.get(id) ?? { title: t }).title = t;
    titleEl.textContent = t;
  };
  (page as unknown as { show: () => void }).show = () => {
    for (const [, entry] of pages) entry.body.classList.remove('active');
    body.classList.add('active');
    host.classList.add('open');
  };
  (page as unknown as { close: () => void }).close = () => {
    host.classList.remove('open');
  };

  bodyEl.append(page);
  pages.set(id, { id, title: id, body, page });
  return page;
}

export function destroyPluginPage(id: string): void {
  const entry = pages.get(id);
  if (!entry) return;
  clearNode(entry.body);
  entry.page.remove();
  pages.delete(id);
}
