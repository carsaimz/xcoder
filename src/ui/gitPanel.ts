/**
 * Visual Git panel — branch, staged/unstaged/untracked files, staging,
 * commit, push/pull and log, driven by the virtual shell's GitStore.
 */

import { el, icon, clear } from '../lib/dom';
import { bus } from '../lib/events';
import { t } from '../lib/i18n';
import { Shell } from '../core/terminal/shell';
import { editorManager } from '../core/editor/editorManager';
import { toast } from '../api/toast';

type FileKind = 'modified' | 'added' | 'deleted';

interface GitSummary {
  isRepo: boolean;
  branch: string;
  remote: { name: string; url: string } | null;
  pushed: boolean;
  ahead: boolean;
  staged: Array<{ path: string; kind: FileKind }>;
  unstaged: Array<{ path: string; kind: 'modified' | 'deleted' }>;
  untracked: string[];
  commits: number;
}

const KIND_LABEL: Record<FileKind, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
};

export class GitPanel {
  private root: HTMLElement;
  private shell: Shell;
  private content: HTMLElement;
  private commitInput: HTMLInputElement;
  private logBox: HTMLElement | null = null;

  constructor(parent: HTMLElement, shell: Shell) {
    this.shell = shell;
    this.root = el('div', { class: 'git-panel hidden' });
    const head = el(
      'div',
      { class: 'terminal-head' },
      el('div', { class: 'title' }, icon('git', 15), el('span', {}, t('git.title'))),
      el('div', { class: 'actions' },
        el('button', { class: 'icon-btn', title: t('git.log'), onclick: () => void this.toggleLog() }, icon('menu', 15)),
        el('button', { class: 'icon-btn', title: t('tree.refresh'), onclick: () => void this.refresh() }, icon('refresh', 15)),
        el('button', { class: 'icon-btn', title: t('close'), onclick: () => this.hide() }, icon('close', 15)),
      ),
    );

    const commitRow = el('div', { class: 'git-commit-row' });
    this.commitInput = el('input', {
      class: 'terminal-input',
      placeholder: t('git.commitPlaceholder'),
      autocomplete: 'off',
      spellcheck: 'false',
    }) as HTMLInputElement;
    const commitBtn = el(
      'button',
      { class: 'btn btn-primary', onclick: () => void this.commit() },
      t('git.commit'),
    );
    const stageAllBtn = el(
      'button',
      { class: 'btn', title: t('git.stageAll'), onclick: () => void this.stageAll() },
      icon('plus', 14),
    );
    const pushBtn = el(
      'button',
      { class: 'btn', title: t('git.push'), onclick: () => void this.run('push') },
      el('span', {}, '↑'),
    );
    const pullBtn = el(
      'button',
      { class: 'btn', title: t('git.pull'), onclick: () => void this.run('pull') },
      el('span', {}, '↓'),
    );
    commitRow.append(this.commitInput, stageAllBtn, commitBtn, pullBtn, pushBtn);

    this.content = el('div', { class: 'git-content' });
    this.logBox = el('div', { class: 'git-log hidden' });
    this.root.append(head, commitRow, this.content, this.logBox);
    parent.appendChild(this.root);

    this.commitInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.commit();
    });
    bus.on('editor:save', () => {
      if (this.visible) void this.refresh();
    });
    bus.on('workspace:changed', () => {
      if (this.visible) void this.refresh();
    });
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(): void {
    this.root.classList.remove('hidden');
    void this.refresh();
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  private async refresh(): Promise<void> {
    clear(this.content);
    let summary: GitSummary;
    try {
      summary = (await this.shell.git().summary()) as GitSummary;
    } catch {
      this.content.appendChild(el('div', { class: 'git-empty' }, t('git.notRepo', { dir: this.shell.cwd })));
      return;
    }
    if (!summary.isRepo) {
      const initBtn = el('button', { class: 'btn btn-primary', onclick: () => void this.run('init') }, t('git.init'));
      this.content.append(el('div', { class: 'git-empty' }, t('git.notRepo', { dir: this.shell.cwd }), initBtn));
      return;
    }

    // branch line
    this.content.appendChild(
      el(
        'div',
        { class: 'git-branch-row' },
        icon('git', 14),
        el('span', { class: 'git-branch' }, summary.branch),
        summary.remote
          ? el('span', { class: 'git-remote' }, summary.ahead ? t('git.ahead', { remote: summary.remote.name }) : summary.remote.name)
          : el('span', { class: 'git-remote dim' }, t('git.noRemote')),
        el('span', { class: 'git-count dim' }, t('git.commitCount', { n: String(summary.commits) })),
      ),
    );

    const section = (title: string, onEmpty?: string): HTMLElement => {
      const box = el('div', { class: 'git-section' }, el('div', { class: 'git-section-title' }, title));
      if (onEmpty) box.appendChild(el('div', { class: 'git-empty dim' }, onEmpty));
      this.content.appendChild(box);
      return box;
    };

    const stagedBox = section(t('git.staged'), summary.staged.length ? undefined : t('git.nothingStaged'));
    for (const f of summary.staged) {
      stagedBox.appendChild(this.fileRow(f.path, f.kind, true));
    }
    const unstagedBox = section(t('git.unstaged'), summary.unstaged.length || summary.untracked.length ? undefined : t('git.clean'));
    for (const f of summary.unstaged) {
      unstagedBox.appendChild(this.fileRow(f.path, f.kind, false));
    }
    for (const p of summary.untracked) {
      unstagedBox.appendChild(this.fileRow(p, 'added', false, true));
    }
  }

  private fileRow(path_: string, kind: FileKind, staged: boolean, untracked = false): HTMLElement {
    const badge = untracked ? 'U' : KIND_LABEL[kind];
    const row = el(
      'div',
      { class: 'git-file-row' },
      el('span', { class: `git-badge kind-${kind}` }, badge),
      el('span', { class: 'git-file-path' }, path_),
      el('button', { class: 'icon-btn', title: staged ? t('git.open') : t('git.stage'), onclick: () => void this.stageOne(path_) }, icon(staged ? 'file' : 'plus', 14)),
    );
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.icon-btn')) return;
      void this.openFile(path_);
    });
    return row;
  }

  private async openFile(relPath: string): Promise<void> {
    const abs = this.shell.resolveTarget(relPath);
    try {
      await editorManager.open(abs);
    } catch {
      toast(t('editor.openFailed', { path: relPath, reason: 'not found' }), 'error');
    }
  }

  private async stageOne(relPath: string): Promise<void> {
    const res = await this.shell.run(`git add "${relPath}"`);
    if (res.code === 0) toast(t('git.stagedOk', { path: relPath }), 'success');
    else toast(res.stderr || res.stdout, 'error');
    await this.refresh();
  }

  private async stageAll(): Promise<void> {
    await this.shell.run('git add .');
    await this.refresh();
  }

  private async commit(): Promise<void> {
    const message = this.commitInput.value.trim();
    if (!message) {
      toast(t('git.commitNeedsMessage'), 'warn');
      return;
    }
    const res = await this.shell.run(`git commit -m ${JSON.stringify(message)}`);
    if (res.code === 0) {
      this.commitInput.value = '';
      toast(res.stdout.split('\n')[0] || t('git.commitOk'), 'success');
    } else {
      toast(res.stderr || res.stdout, 'error');
    }
    await this.refresh();
  }

  private async run(action: 'init' | 'push' | 'pull'): Promise<void> {
    const res = await this.shell.run(`git ${action}`);
    const out = res.code === 0 ? res.stdout : res.stderr || res.stdout;
    toast(out.split('\n')[0], res.code === 0 ? 'success' : 'error');
    if (action === 'init') {
      // initialize default remote helpers? nothing else to do
    }
    await this.refresh();
  }

  private async toggleLog(): Promise<void> {
    if (!this.logBox) return;
    const hidden = this.logBox.classList.toggle('hidden');
    if (hidden) return;
    clear(this.logBox);
    const res = await this.shell.run('git log --oneline -n 20');
    const lines = (res.stdout || res.stderr).split('\n').filter(Boolean);
    if (!lines.length) {
      this.logBox.appendChild(el('div', { class: 'git-empty dim' }, t('git.noCommits')));
      return;
    }
    for (const line of lines) {
      this.logBox.appendChild(
        el(
          'div',
          { class: 'git-log-line' },
          el('span', { class: 'git-log-id' }, line.slice(0, 7)),
          el('span', {}, line.slice(7).trim() || line),
        ),
      );
    }
  }
}
