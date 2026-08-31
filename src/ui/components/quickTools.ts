/**
 * Quick tools footer — the mobile editing bar.
 * Sticky modifier keys (ctrl/shift/alt/meta) apply to the next action, then
 * clear. Key actions map to CodeMirror commands honoring the sticky state.
 * Insert actions type characters at the cursor. Hold-to-repeat on arrows/del.
 */
import { el, $, iconSvg } from '@lib/dom';
import { editorManager } from '@api/editorManager';
import { events } from '@api/events';
import {
  undo,
  redo,
  selectAll,
  moveLineUp,
  moveLineDown,
  copyLineUp,
  copyLineDown,
  cursorLineStart,
  cursorLineEnd,
  cursorLineUp,
  cursorLineDown,
  cursorCharLeft,
  cursorCharRight,
  cursorGroupLeft,
  cursorGroupRight,
  cursorDocStart,
  cursorDocEnd,
  selectCharLeft,
  selectCharRight,
  selectLineUp,
  selectLineDown,
  selectGroupLeft,
  selectGroupRight,
  selectDocStart,
  selectDocEnd,
  selectLineStart,
  selectLineEnd,
  selectPageUp,
  selectPageDown,
  simplifySelection,
  deleteCharForward,
  deleteLine,
  cursorPageUp,
  cursorPageDown
} from '@codemirror/commands';
import { SearchQuery, setSearchQuery } from '@codemirror/search';
import type { Command, EditorView } from '@codemirror/view';
import { openPalette } from './palette';

type Mods = { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean };

interface QtItem {
  id: string;
  icon?: string;
  letters?: string;
  kind: 'mod' | 'key' | 'command' | 'insert' | 'search' | 'palette';
  value?: string;
  repeat?: boolean;
}

const ITEMS: QtItem[] = [
  { id: 'ctrl', letters: 'ctrl', kind: 'mod' },
  { id: 'tab', icon: 'tab-key', kind: 'key', value: 'tab' },
  { id: 'shift', letters: 'shft', kind: 'mod' },
  { id: 'undo', icon: 'undo', kind: 'command', value: 'undo' },
  { id: 'redo', icon: 'redo', kind: 'command', value: 'redo' },
  { id: 'search', icon: 'search', kind: 'search' },
  { id: 'save', icon: 'save', kind: 'command', value: 'save' },
  { id: 'esc', letters: 'esc', kind: 'key', value: 'esc' },
  { id: 'lcurly', letters: '{', kind: 'insert', value: '{' },
  { id: 'rcurly', letters: '}', kind: 'insert', value: '}' },
  { id: 'lbracket', letters: '[', kind: 'insert', value: '[' },
  { id: 'rbracket', letters: ']', kind: 'insert', value: ']' },
  { id: 'lparen', letters: '(', kind: 'insert', value: '(' },
  { id: 'rparen', letters: ')', kind: 'insert', value: ')' },
  { id: 'langle', letters: '<', kind: 'insert', value: '<' },
  { id: 'rangle', letters: '>', kind: 'insert', value: '>' },
  { id: 'left', icon: 'arrow-left', kind: 'key', value: 'left', repeat: true },
  { id: 'right', icon: 'arrow-right', kind: 'key', value: 'right', repeat: true },
  { id: 'up', icon: 'arrow-up', kind: 'key', value: 'up', repeat: true },
  { id: 'down', icon: 'arrow-down', kind: 'key', value: 'down', repeat: true },
  { id: 'moveline-up', icon: 'move-line-up', kind: 'command', value: 'movelinesup' },
  { id: 'moveline-down', icon: 'move-line-down', kind: 'command', value: 'movelinesdown' },
  { id: 'copyline-up', icon: 'copy-line-up', kind: 'command', value: 'copylinesup' },
  { id: 'copyline-down', icon: 'copy-line-down', kind: 'command', value: 'copylinesdown' },
  { id: 'semicolon', letters: ';', kind: 'insert', value: ';' },
  { id: 'quote', letters: "'", kind: 'insert', value: "'" },
  { id: 'dquote', letters: '"', kind: 'insert', value: '"' },
  { id: 'amp', letters: '&', kind: 'insert', value: '&' },
  { id: 'pipe', letters: '|', kind: 'insert', value: '|' },
  { id: 'equal', letters: '=', kind: 'insert', value: '=' },
  { id: 'slash', letters: '/', kind: 'insert', value: '/' },
  { id: 'exclam', letters: '!', kind: 'insert', value: '!' },
  { id: 'palette', icon: 'palette', kind: 'palette' },
  { id: 'alt', letters: 'alt', kind: 'mod' },
  { id: 'meta', letters: 'meta', kind: 'mod' },
  { id: 'home', letters: 'home', kind: 'key', value: 'home' },
  { id: 'end', letters: 'end', kind: 'key', value: 'end' },
  { id: 'pgup', letters: 'pgup', kind: 'key', value: 'pageup' },
  { id: 'pgdn', letters: 'pgdn', kind: 'key', value: 'pagedown' },
  { id: 'del', letters: 'del', kind: 'key', value: 'del', repeat: true },
  { id: 'tilde', letters: '~', kind: 'insert', value: '~' },
  { id: 'backtick', letters: '`', kind: 'insert', value: '`' },
  { id: 'hash', letters: '#', kind: 'insert', value: '#' },
  { id: 'dollar', letters: '$', kind: 'insert', value: '$' },
  { id: 'modulo', letters: '%', kind: 'insert', value: '%' },
  { id: 'caret', letters: '^', kind: 'insert', value: '^' },
  { id: 'hyphen', letters: '-', kind: 'insert', value: '-' },
  { id: 'paste', icon: 'paste', kind: 'command', value: 'paste' },
  { id: 'selectall', icon: 'select-all', kind: 'command', value: 'selectall' }
];

const mods: Mods = { ctrl: false, shift: false, alt: false, meta: false };
let searchRow: HTMLElement;
let findInput: HTMLInputElement;
let countEl: HTMLElement;

export function mountQuickTools(): void {
  const row = $('#qt-row');
  searchRow = $('#qt-search');

  for (const item of ITEMS) {
    const btn = el('button', {
      class: `qt-btn${item.letters ? ' letters' : ''}`,
      type: 'button',
      'data-id': item.id,
      title: item.id
    });
    if (item.icon) btn.innerHTML = iconFor(item.icon);
    else if (item.letters) btn.textContent = item.letters;
    if (item.kind === 'mod') {
      btn.addEventListener('click', () => {
        const key = item.id as keyof Mods;
        mods[key] = !mods[key];
        btn.classList.toggle('active', mods[key]);
        view()?.focus();
      });
    } else if (item.repeat) {
      attachRepeater(btn, () => run(item));
    } else {
      btn.addEventListener('click', () => run(item));
    }
    row.append(btn);
  }

  buildSearchRow();
  syncUnsaved();
  events.on('editor:dirty', syncUnsaved);
  events.on('editor:switch', syncUnsaved);
}

function iconFor(name: string): string {
  return iconSvg(name, 18);
}

function view(): import('@codemirror/view').EditorView | null {
  return editorManager.activeEditor?.view ?? null;
}

function run(item: QtItem): void {
  const v = view();
  if (!v) return;
  switch (item.kind) {
    case 'insert':
      insert(item.value ?? '');
      break;
    case 'key':
      runKey(item.value ?? '');
      break;
    case 'command':
      runCommand(item.value ?? '');
      break;
    case 'search':
      toggleSearchRow();
      break;
    case 'palette':
      clearMods();
      openPalette('commands');
      return;
  }
  clearMods();
  v.focus();
}

function insert(text: string): void {
  const v = view();
  if (!v) return;
  v.dispatch(v.state.replaceSelection(text));
}

function runCommand(name: string): void {
  const v = view();
  if (!v) return;
  const map: Record<string, (view: EditorView) => unknown> = {
    undo,
    redo,
    movelinesup: moveLineUp,
    movelinesdown: moveLineDown,
    copylinesup: copyLineUp,
    copylinesdown: copyLineDown,
    selectall: selectAll,
    paste: doPaste,
    save: () => void editorManager.saveActive()
  };
  const cmd = map[name];
  if (cmd) void cmd(v);
}

async function doPaste(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText();
    if (text) insert(text);
  } catch {
    /* clipboard unavailable */
  }
}

function runKey(key: string): void {
  const v = view();
  if (!v) return;
  const { ctrl, shift } = mods;
  const table: Record<string, Command> = {
    tab: shift ? indentLessCmd : indentTabCmd,
    esc: escCmd,
    left: ctrl ? (shift ? selectGroupLeft : cursorGroupLeft) : shift ? selectCharLeft : cursorCharLeft,
    right: ctrl ? (shift ? selectGroupRight : cursorGroupRight) : shift ? selectCharRight : cursorCharRight,
    up: shift ? selectLineUp : cursorLineUp,
    down: shift ? selectLineDown : cursorLineDown,
    home: ctrl ? (shift ? selectDocStart : cursorDocStart) : shift ? selectLineStart : cursorLineStart,
    end: ctrl ? (shift ? selectDocEnd : cursorDocEnd) : shift ? selectLineEnd : cursorLineEnd,
    pageup: shift ? selectPageUp : cursorPageUp,
    pagedown: shift ? selectPageDown : cursorPageDown,
    del: shift ? deleteLine : deleteCharForward
  };
  const cmd = table[key];
  if (cmd) void cmd(v);
}

const indentTabCmd: Command = (v) => {
  v.dispatch(v.state.replaceSelection('\t'));
  return true;
};

const indentLessCmd: Command = (v) => {
  // remove one indent level from each selected line
  const { state } = v;
  const changes: Array<{ from: number; to: number }> = [];
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) {
      const line = state.doc.line(n);
      const m = /^[ \t]+/.exec(line.text);
      if (!m) continue;
      const unit = m[0].startsWith('\t') ? '\t' : '  ';
      const cut = m[0].startsWith(unit) ? unit.length : Math.min(1, m[0].length);
      if (cut > 0) changes.push({ from: line.from, to: line.from + cut });
    }
  }
  if (changes.length) {
    v.dispatch({ changes: changes.map((c) => ({ from: c.from, to: c.to, insert: '' })) });
  }
  return true;
};

const escCmd: Command = (v) => {
  simplifySelection(v);
  closeSearchRow();
  return true;
};

function clearMods(): void {
  for (const k of Object.keys(mods) as (keyof Mods)[]) mods[k] = false;
  for (const btn of document.querySelectorAll<HTMLElement>('.qt-btn[data-id]')) {
    const id = btn.dataset.id;
    if (id && id in mods) btn.classList.remove('active');
  }
}

function attachRepeater(btn: HTMLElement, fn: () => void): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let delay: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(timer);
    timer = undefined;
    document.removeEventListener('pointerup', stop);
    document.removeEventListener('pointercancel', stop);
  };
  btn.addEventListener('pointerdown', () => {
    fn();
    delay = setTimeout(() => {
      timer = setInterval(fn, 110);
    }, 380);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
  });
}

/* -- search row ------------------------------------------------------------------ */

function buildSearchRow(): void {
  findInput = el('input', {
    class: 'qt-search-input',
    type: 'text',
    placeholder: 'Find…',
    autocomplete: 'off',
    spellcheck: 'false'
  }) as HTMLInputElement;
  countEl = el('span', { id: 'qt-count' });
  const prev = iconBtn('arrow-up', 'Previous match');
  const next = iconBtn('arrow-down', 'Next match');
  const close = iconBtn('close', 'Close search');
  prev.addEventListener('click', () => void doSearch(true));
  next.addEventListener('click', () => void doSearch(false));
  close.addEventListener('click', () => closeSearchRow());
  findInput.addEventListener('input', () => void doSearch(false));
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void doSearch(e.shiftKey);
    }
    if (e.key === 'Escape') closeSearchRow();
  });
  searchRow.append(findInput, countEl, prev, next, close);
}

function iconBtn(icon: string, label: string): HTMLButtonElement {
  const b = el('button', { class: 'qt-btn', type: 'button', 'aria-label': label, title: label });
  b.innerHTML = iconSvg(icon, 18);
  return b;
}

export function openSearchRow(word?: string): void {
  searchRow.classList.add('open');
  const v = view();
  let seed = word;
  if (!seed && v) {
    const sel = v.state.selection.main;
    if (!sel.empty) seed = v.state.doc.sliceString(sel.from, sel.to).slice(0, 80);
  }
  if (seed) findInput.value = seed;
  findInput.focus();
  findInput.select();
  void doSearch(false);
}

export function closeSearchRow(): void {
  searchRow.classList.remove('open');
  const v = view();
  if (v) v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) });
  countEl.textContent = '';
}

export function toggleSearchRow(): void {
  if (searchRow.classList.contains('open')) closeSearchRow();
  else openSearchRow();
}

async function doSearch(backwards: boolean): Promise<void> {
  const v = view();
  const term = findInput.value;
  if (!v || !term) {
    countEl.textContent = '';
    return;
  }
  // highlight all matches via the search state effect (no CM panel)
  v.dispatch({
    effects: setSearchQuery.of(new SearchQuery({ search: term, caseSensitive: false }))
  });
  navigate(term, backwards);
  updateCount(term);
}

/** Own match navigation — avoids @codemirror/search's built-in panel. */
function navigate(term: string, backwards: boolean): void {
  const v = view();
  if (!v || !term) return;
  const hay = v.state.doc.toString().toLowerCase();
  const needle = term.toLowerCase();
  const sel = v.state.selection.main;
  let idx: number;
  if (backwards) {
    idx = hay.lastIndexOf(needle, Math.max(0, sel.from - 1));
    if (idx === -1) idx = hay.lastIndexOf(needle); // wrap
  } else {
    idx = hay.indexOf(needle, Math.min(sel.to, hay.length));
    if (idx === -1) idx = hay.indexOf(needle); // wrap
  }
  if (idx === -1) return;
  v.dispatch({
    selection: { anchor: idx, head: idx + needle.length },
    scrollIntoView: true
  });
}

function updateCount(term: string): void {
  const v = view();
  if (!v) return;
  const text = v.state.doc.toString().toLowerCase();
  const needle = term.toLowerCase();
  let total = 0;
  let idx = text.indexOf(needle);
  while (idx !== -1) {
    total++;
    idx = text.indexOf(needle, idx + needle.length);
  }
  countEl.textContent = total ? `${total} hit${total === 1 ? '' : 's'}` : 'no hits';
}

function syncUnsaved(): void {
  const save = document.querySelector<HTMLElement>('.qt-btn[data-id="save"]');
  if (!save) return;
  const dirty = editorManager.editors.some((e) => e.isDirty);
  save.classList.toggle('notice', dirty);
  (save as HTMLButtonElement).disabled = !editorManager.activeEditor;
}
