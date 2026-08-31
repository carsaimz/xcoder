/**
 * Search in files — sidebar app over `fs.search`.
 * Results grouped per file; a hit click opens the file (content matches are
 * followed by opening — line jumping stays with the editor search row).
 */
import { el, clearNode, $, iconSvg } from '@lib/dom';
import { i18n } from '@lib/i18n';
import * as fs from '@core/file/fs';
import { workspace } from '@core/file/workspace';
import { editorManager } from '@api/editorManager';
import type { SearchHit } from '@core/file/fs';

let input: HTMLInputElement;

export function mountSearchInFiles(): void {
  input = el('input', {
    class: 'sif-input',
    type: 'text',
    placeholder: i18n.t('sif.placeholder'),
    autocomplete: 'off',
    spellcheck: 'false'
  }) as HTMLInputElement;

  const btnSearch = el('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Search' });
  btnSearch.innerHTML = iconSvg('search', 16);
  btnSearch.addEventListener('click', () => void run());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void run();
    }
  });

  const form = el('div', { class: 'sif-form' }, input, btnSearch);

  const results = $('#sif-results');
  const root = $('#panel-search');
  root.insertBefore(form, results);

  $('#btn-sif-clear').addEventListener('click', () => {
    input.value = '';
    clearNode(results);
  });
}

async function run(): Promise<void> {
  const results = $('#sif-results');
  const term = input.value.trim();
  clearNode(results);
  if (!term) return;

  const roots = workspace.listFolders();
  if (!roots.length) {
    results.append(el('div', { class: 'sif-empty' }, i18n.t('sif.noFolder')));
    return;
  }

  const searching = el('div', { class: 'sif-empty' }, i18n.t('sif.searching'));
  results.append(searching);

  try {
    const all: SearchHit[] = [];
    for (const root2 of roots) {
      all.push(...(await fs.search(root2, term, { maxResults: 200 })));
    }
    clearNode(results);
    if (!all.length) {
      results.append(el('div', { class: 'sif-empty' }, i18n.t('sif.noResults')));
      return;
    }
    render(results, groupByFile(all), term);
  } catch (err) {
    clearNode(results);
    results.append(
      el('div', { class: 'sif-empty' }, String(err instanceof Error ? err.message : err))
    );
  }
}

function groupByFile(hits: SearchHit[]): Array<[string, SearchHit[]]> {
  const map = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const list = map.get(hit.url) ?? [];
    list.push(hit);
    map.set(hit.url, list);
  }
  return [...map.entries()];
}

function render(container: HTMLElement, groups: Array<[string, SearchHit[]]>, term: string): void {
  for (const [url, hits] of groups) {
    const name = url.slice(url.lastIndexOf('/') + 1);
    container.append(el('div', { class: 'sif-file' }, name));
    for (const hit of hits.slice(0, 20)) {
      const line = hit.preview ?? hit.kind;
      const btn = el('button', { class: 'sif-hit', type: 'button', title: hit.url });
      btn.append(highlight(line, term));
      btn.addEventListener('click', () => void editorManager.openFile(hit.url));
      container.append(btn);
    }
  }
}

function highlight(line: string, term: string): Node | string {
  const needle = term.trim();
  if (!needle) return line;
  const idx = line.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return line;
  const frag = document.createDocumentFragment();
  frag.append(line.slice(0, idx));
  frag.append(el('b', {}, line.slice(idx, idx + needle.length)));
  frag.append(line.slice(idx + needle.length));
  return frag;
}
