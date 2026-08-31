/**
 * Global search & replace panel — project-wide search with regex,
 * case-sensitivity and whole-word options, results grouped by file,
 * and file-by-file replace with confirmation.
 */

import { el, icon, clear } from '../lib/dom';
import { bus } from '../lib/events';
import { t } from '../lib/i18n';
import { fs } from '../core/file';
import { editorManager } from '../core/editor/editorManager';
import {
  compilePattern,
  findInContent,
  replaceInContent,
  searchWorkspace,
  groupByFile,
  SearchOptions,
  SearchHit,
  DEFAULT_SEARCH_OPTIONS,
} from '../lib/searchEngine';
import { toast } from '../api/toast';

export class SearchPanel {
  private root: HTMLElement;
  private input: HTMLInputElement;
  private resultsBox: HTMLElement;
  private statusLine: HTMLElement;
  private replaceInput: HTMLInputElement;
  private opts: SearchOptions = { ...DEFAULT_SEARCH_OPTIONS };
  private hits: SearchHit[] = [];
  private running = false;
  private abort: { aborted: boolean } = { aborted: false };

  constructor(parent: HTMLElement) {
    this.root = el('div', { class: 'search-panel hidden' });

    const head = el(
      'div',
      { class: 'search-head' },
      el('div', { class: 'title' }, icon('search', 15), el('span', {}, t('search.title'))),
      el('button', { class: 'icon-btn', title: t('close'), onclick: () => this.hide() }, icon('close', 15)),
    );

    const queryRow = el('div', { class: 'search-query-row' });
    this.input = el('input', {
      class: 'search-input',
      placeholder: t('search.placeholder'),
      autocomplete: 'off',
      spellcheck: 'false',
    }) as HTMLInputElement;
    const replaceBtn = el(
      'button',
      { class: 'btn btn-ghost', title: t('search.toggleReplace'), onclick: () => this.toggleReplace() },
      icon('wand', 15),
    );
    queryRow.append(this.input, replaceBtn);

    this.replaceInput = el('input', {
      class: 'search-input hidden',
      placeholder: t('search.replacePlaceholder'),
      autocomplete: 'off',
      spellcheck: 'false',
    }) as HTMLInputElement;
    const replaceRow = el('div', { class: 'search-query-row' }, this.replaceInput);
    const replaceAllBtn = el(
      'button',
      { class: 'btn btn-primary', onclick: () => void this.replaceAll() },
      t('search.replaceAll'),
    );
    replaceRow.appendChild(replaceAllBtn);

    const optsRow = el('div', { class: 'search-opts-row' });
    const opt = (key: keyof SearchOptions, label: string): HTMLElement =>
      el(
        'button',
        {
          class: 'chip',
          dataset: { opt: key },
          onclick: (e) => {
            const target = e.currentTarget as HTMLElement;
            this.opts[key] = !this.opts[key];
            target.classList.toggle('active', this.opts[key]);
            void this.run();
          },
        },
        label,
      );
    optsRow.append(
      opt('caseSensitive', t('search.caseSensitive')),
      opt('wholeWord', t('search.wholeWord')),
      opt('regex', t('search.regex')),
    );

    this.statusLine = el('div', { class: 'search-status' }, '');
    this.resultsBox = el('div', { class: 'search-results' });

    this.root.append(head, queryRow, replaceRow, optsRow, this.statusLine, this.resultsBox);
    parent.appendChild(this.root);

    let debounce: ReturnType<typeof setTimeout> | null = null;
    this.input.addEventListener('input', () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void this.run(), 350);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.run();
      if (e.key === 'Escape') this.hide();
    });
    bus.on('workspace:changed', () => {
      if (this.visible && this.input.value) void this.run();
    });
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(prefill?: string): void {
    this.root.classList.remove('hidden');
    if (prefill !== undefined) this.input.value = prefill;
    this.input.focus();
    this.input.select();
    if (this.input.value) void this.run();
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.abort.aborted = true;
  }

  toggle(prefill?: string): void {
    this.visible ? this.hide() : this.show(prefill);
  }

  private toggleReplace(): void {
    this.replaceInput.classList.toggle('hidden');
  }

  private async run(): Promise<void> {
    const query = this.input.value;
    clear(this.resultsBox);
    this.hits = [];
    if (!query.trim()) {
      this.statusLine.textContent = '';
      return;
    }
    const pattern = compilePattern(query, this.opts);
    if (!pattern) {
      this.statusLine.textContent = t('search.invalidRegex');
      return;
    }
    if (this.running) this.abort.aborted = true;
    this.running = true;
    this.abort = { aborted: false };
    const signal = this.abort;
    this.statusLine.textContent = t('search.searching');
    try {
      const roots = fs.listRoots();
      const target = roots[0]?.url ?? '/';
      const start = performance.now();
      const hits = await searchWorkspace(fs, target, pattern, {
        signal,
        maxFiles: 1500,
        maxHits: 500,
        onProgress: (p) => {
          if (p.files % 40 === 0) this.statusLine.textContent = t('search.progress', { files: String(p.files), hits: String(p.hits) });
        },
      });
      if (signal.aborted) return;
      this.hits = hits;
      const ms = Math.round(performance.now() - start);
      this.statusLine.textContent = t('search.done', { hits: String(hits.length), files: String(groupByFile(hits).size), ms: String(ms) });
      this.renderResults();
    } finally {
      this.running = false;
    }
  }

  private renderResults(): void {
    clear(this.resultsBox);
    const groups = groupByFile(this.hits);
    for (const [file, hits] of groups) {
      const group = el('div', { class: 'search-file-group' });
      const head = el(
        'div',
        { class: 'search-file-head' },
        icon('file', 14),
        el('span', { class: 'search-file-path' }, file),
        el('span', { class: 'search-file-count' }, String(hits.length)),
      );
      head.addEventListener('click', () => void this.openAt(file, hits[0]));
      group.appendChild(head);
      for (const hit of hits.slice(0, 12)) {
        const row = el(
          'div',
          { class: 'search-hit' },
          el('span', { class: 'search-hit-line' }, String(hit.line)),
          el('span', { class: 'search-hit-text' }, hit.text),
        );
        row.addEventListener('click', () => void this.openAt(file, hit));
        group.appendChild(row);
      }
      if (hits.length > 12) {
        group.appendChild(el('div', { class: 'search-hit-more' }, t('search.more', { n: String(hits.length - 12) })));
      }
      this.resultsBox.appendChild(group);
    }
  }

  private async openAt(file: string, hit: SearchHit): Promise<void> {
    try {
      await editorManager.open(file);
      const view = editorManager.view;
      if (!view) return;
      const line = view.state.doc.line(hit.line);
      view.dispatch({
        selection: { anchor: line.from + Math.min(hit.column, line.length) },
        scrollIntoView: true,
      });
      view.focus();
    } catch {
      /* file may be binary — ignore */
    }
  }

  private async replaceAll(): Promise<void> {
    const replacement = this.replaceInput.value;
    if (!this.hits.length) {
      toast(t('search.noHits'), 'warn');
      return;
    }
    const pattern = compilePattern(this.input.value, this.opts);
    if (!pattern) return;
    const { confirm } = await import('../api/dialog');
    const ok = await confirm(t('search.confirmReplaceMsg', { n: String(this.hits.length) }), t('search.confirmReplaceTitle'));
    if (!ok) return;
    let fileCount = 0;
    for (const [file] of groupByFile(this.hits)) {
      try {
        const text = await fs.readText(file);
        const next = replaceInContent(text, pattern, replacement);
        if (next !== text) {
          await fs.writeFile(file, next);
          fileCount++;
          const session = [...editorManager.sessions.values()].find((s) => s.path === file);
          if (session) {
            const view = editorManager.view;
            if (view && editorManager.activeId === session.id) {
              view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
            } else {
              session.state = session.state.update({ changes: { from: 0, to: session.state.doc.length, insert: next } }).state;
            }
            session.dirty = true;
          }
        }
      } catch {
        /* skip unreadable */
      }
    }
    toast(t('search.replaced', { files: String(fileCount) }), 'success');
    await this.run();
  }
}
