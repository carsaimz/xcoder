/**
 * Live Markdown preview — split pane rendered next to the editor while a
 * .md/markdown file is active. Zero-dependency, XSS-safe renderer.
 */

import { el, icon } from '../lib/dom';
import { bus } from '../lib/events';
import { t } from '../lib/i18n';
import { editorManager } from '../core/editor/editorManager';
import { renderMarkdown } from '../lib/markdown';

const MD_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd']);

export function isMarkdownPath(p: string | null): boolean {
  if (!p) return false;
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  return MD_EXTENSIONS.has(ext);
}

export class MarkdownPreview {
  private host: HTMLElement;
  private body: HTMLElement;
  private visible = false;
  private activePath: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(editorHost: HTMLElement) {
    this.host = el('div', { class: 'md-preview hidden' });
    const head = el(
      'div',
      { class: 'md-preview-head' },
      el('div', { class: 'title' }, icon('file', 15), el('span', {}, t('preview.title'))),
      el('button', { class: 'icon-btn', title: t('close'), onclick: () => this.hide() }, icon('close', 15)),
    );
    this.body = el('div', { class: 'md-preview-body' });
    this.host.append(head, this.body);
    editorHost.appendChild(this.host);

    bus.on('editor:change', () => this.schedule());
    bus.on('editor:active', () => this.sync());
    bus.on('editor:open', () => this.sync());
    bus.on('editor:close', () => this.sync());
  }

  get isOpen(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  show(): void {
    this.visible = true;
    this.sync();
  }

  hide(): void {
    this.visible = false;
    this.host.classList.add('hidden');
    document.querySelector('.editor-host')?.classList.remove('split');
  }

  /** Show/hide and re-render depending on the active session. */
  private sync(): void {
    const path = editorManager.activePath();
    if (!this.visible || !isMarkdownPath(path)) {
      this.host.classList.add('hidden');
      document.querySelector('.editor-host')?.classList.remove('split');
      return;
    }
    this.host.classList.remove('hidden');
    document.querySelector('.editor-host')?.classList.add('split');
    this.activePath = path;
    this.render();
  }

  private schedule(): void {
    if (!this.visible) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.render(), 250);
  }

  private render(): void {
    const session = editorManager.active;
    if (!session || session.path !== this.activePath) return;
    const text = editorManager.view?.state.doc.toString() ?? session.state.doc.toString();
    this.body.innerHTML = renderMarkdown(text);
    this.body.scrollTop = 0;
  }
}
