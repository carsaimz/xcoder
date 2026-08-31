/**
 * Status bar — bottom strip with git branch, cursor position (Ln/Col),
 * active language, dirty state and quick access to terminal/git/search.
 */

import { el, icon } from '../lib/dom';
import { bus } from '../lib/events';
import { t } from '../lib/i18n';
import { editorManager } from '../core/editor/editorManager';
import { Shell } from '../core/terminal/shell';

export class StatusBar {
  private root: HTMLElement;
  private branchEl: HTMLElement;
  private cursorEl: HTMLElement;
  private langEl: HTMLElement;
  private dirtyEl: HTMLElement;
  private shell: Shell;

  constructor(parent: HTMLElement, shell: Shell) {
    this.shell = shell;
    this.root = el('div', { class: 'status-bar' });
    this.branchEl = el('span', { class: 'status-item status-branch', title: t('git.title') }, icon('git', 12), el('span', { class: 'status-branch-label' }, '—'));
    this.cursorEl = el('span', { class: 'status-item', title: 'Ln / Col' }, 'Ln 1, Col 1');
    this.langEl = el('span', { class: 'status-item status-lang' }, 'plain text');
    this.dirtyEl = el('span', { class: 'status-item status-dirty' }, '');
    const spacer = el('span', { class: 'spacer' });
    const right = el('span', { class: 'status-item status-brand' }, 'XCoder');
    this.root.append(this.branchEl, this.cursorEl, this.langEl, this.dirtyEl, spacer, right);
    parent.appendChild(this.root);

    bus.on('editor:cursor', (pos: { line: number; col: number }) => {
      this.cursorEl.textContent = t('status.cursor', { line: String(pos.line), col: String(pos.col) });
    });
    const updateSession = (): void => {
      const session = editorManager.active;
      const p = session?.path ?? null;
      const ext = p ? p.split('.').pop()?.toLowerCase() ?? '' : '';
      this.langEl.textContent = ext || t('status.plainText');
      this.dirtyEl.textContent = session?.dirty ? '●' : '';
      this.refreshBranch();
    };
    bus.on('editor:active', updateSession);
    bus.on('editor:open', updateSession);
    bus.on('editor:change', updateSession);
    bus.on('editor:save', updateSession);
    bus.on('editor:close', updateSession);
    bus.on('workspace:roots', () => this.refreshBranch());
    bus.on('git:changed', () => this.refreshBranch());
    updateSession();
  }

  async refreshBranch(): Promise<void> {
    const label = this.branchEl.querySelector('.status-branch-label');
    try {
      const summary = await this.shell.git().summary();
      if (label) label.textContent = summary.isRepo ? summary.branch : t('git.noRepoShort');
    } catch {
      if (label) label.textContent = '—';
    }
  }
}
