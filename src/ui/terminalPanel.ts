/** Bottom terminal panel wired to the virtual shell. */

import { el, icon, clear } from '../lib/dom';
import { bus } from '../lib/events';
import { t } from '../lib/i18n';
import { Shell } from '../core/terminal/shell';
import * as path from '../lib/path';

export class TerminalPanel {
  private root: HTMLElement;
  private out: HTMLElement;
  private input: HTMLInputElement;
  private historyIndex = -1;

  constructor(
    parent: HTMLElement,
    private shell: Shell,
  ) {
    this.root = el('div', { class: 'terminal-panel hidden' });
    const head = el(
      'div',
      { class: 'terminal-head' },
      el('div', { class: 'title' }, icon('terminal', 15), el('span', {}, t('terminal.title'))),
    );
    const actions = el('div', { class: 'actions' });
    actions.appendChild(
      el('button', {
        class: 'icon-btn',
        title: t('terminal.clear'),
        onclick: () => clear(this.out),
      }, icon('trash', 15)),
    );
    actions.appendChild(
      el('button', {
        class: 'icon-btn',
        title: t('close'),
        onclick: () => this.hide(),
      }, icon('close', 15)),
    );
    head.appendChild(actions);

    this.out = el('div', { class: 'terminal-out' });
    const row = el('div', { class: 'terminal-input-row' });
    this.input = el('input', { class: 'terminal-input', placeholder: t('terminal.hint'), autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
    this.promptSpan = el('span', { class: 'prompt' }, '$ ');
    row.append(this.promptSpan, this.input);

    this.root.append(head, this.out, row);
    parent.appendChild(this.root);

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.submit();
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.historyIndex = Math.min(this.historyIndex + 1, shell.history.length - 1);
        if (shell.history[shell.history.length - 1 - this.historyIndex]) {
          this.input.value = shell.history[shell.history.length - 1 - this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.historyIndex = Math.max(this.historyIndex - 1, -1);
        const cmd = this.historyIndex === -1 ? '' : shell.history[shell.history.length - 1 - this.historyIndex];
        this.input.value = cmd;
      }
    });
    this.root.addEventListener('click', () => this.input.focus());
    bus.on('shell:open', (p) => {
      void editorOpen(String(p));
    });
  }

  private promptSpan: HTMLElement;

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.input.focus();
    void this.updatePrompt();
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  async updatePrompt(): Promise<void> {
    this.promptSpan.textContent = `${path.basename(this.shell.cwd) || '/'} $ `;
  }

  print(text: string, cls = ''): void {
    const line = el('div', { class: cls }, text);
    this.out.appendChild(line);
    this.out.scrollTop = this.out.scrollHeight;
  }

  async submit(): Promise<void> {
    const line = this.input.value;
    this.input.value = '';
    this.historyIndex = -1;
    if (!line.trim()) return;
    this.print(`${path.basename(this.shell.cwd) || '/'} $ ${line}`, 'cmd');
    const res = await this.shell.run(line);
    if (res.stdout === '__CLEAR__') {
      clear(this.out);
      return;
    }
    if (res.stdout) this.print(res.stdout);
    if (res.stderr) this.print(res.stderr, 'err');
    void this.updatePrompt();
  }

  runCommand(line: string): Promise<void> {
    this.show();
    this.input.value = line;
    return this.submit();
  }
}

async function editorOpen(p: string): Promise<void> {
  const { editorManager } = await import('../core/editor/editorManager');
  try {
    await editorManager.open(p);
  } catch {
    /* ignore */
  }
}
