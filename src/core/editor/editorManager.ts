/**
 * EditorManager — CodeMirror 6 owner: tabs, sessions, language/theme
 * compartments, auto-save and document formatting (prettier, lazy loaded).
 */

import { bus } from '../../lib/events';
import * as path from '../../lib/path';
import { fs } from '../file';
import { settings } from '../../api/settings';
import {
  EditorState,
  Compartment,
  StateEffect,
  Extension,
  Text,
} from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import {
  searchKeymap,
  highlightSelectionMatches,
  search,
} from '@codemirror/search';
import { themeExtensions, ThemeName } from './themes';
import { loadLanguage, findLanguage } from './languages';

export interface EditorSession {
  id: string;
  path: string;
  state: EditorState;
  dirty: boolean;
  savedAt: number;
}

interface SessionRestore {
  paths: string[];
  active: string | null;
}

const languageCompartment = new Compartment();
const themeCompartment = new Compartment();
const wrapCompartment = new Compartment();
const tabCompartment = new Compartment();

export class EditorManager {
  sessions = new Map<string, EditorSession>();
  order: string[] = [];
  activeId: string | null = null;
  view: EditorView | null = null;
  private container: HTMLElement | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- setup ------------------------------------------------------------------

  /** Attach the CodeMirror view to a DOM container. */
  attach(container: HTMLElement): void {
    this.container = container;
    this.view = new EditorView({
      parent: container,
      state: this.createState(''),
      extensions: this.baseExtensions(),
    });
    container.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void this.save();
      }
    });
  }

  private baseExtensions(): Extension[] {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      foldGutter(),
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),
      search({ top: true }),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) this.onDocChanged(update);
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          bus.emit('editor:cursor', { line: line.number, col: pos - line.from + 1 });
        }
        if (update.focusChanged && update.view.hasFocus) bus.emit('editor:focus');
      }),
    ];
  }

  createState(content: string, filePath = 'untitled.txt'): EditorState {
    return EditorState.create({
      doc: content,
      extensions: [
        ...this.baseExtensions(),
        languageCompartment.of([]),
        themeCompartment.of(themeExtensions((settings.get('theme') as ThemeName) ?? 'dark')),
        wrapCompartment.of(settings.get('wordWrap') ? EditorView.lineWrapping : []),
        tabCompartment.of([
          indentUnit.of(' '.repeat(settings.get('tabSize') ?? 4)),
          EditorState.tabSize.of(settings.get('tabSize') ?? 4),
        ]),
      ],
    });
  }

  // ---- sessions ----------------------------------------------------------------

  async open(filePath: string, content?: string): Promise<EditorSession> {
    const existing = [...this.sessions.values()].find((s) => s.path === filePath);
    if (existing) {
      this.setActive(existing.id);
      return existing;
    }
    let text = content;
    if (text === undefined) {
      try {
        text = (await fs.readText(filePath)) as string;
      } catch (err) {
        bus.emit('editor:open-failed', { path: filePath, reason: (err as Error).message });
        throw err;
      }
    }
    const state = this.createState(text, filePath);
    const session: EditorSession = {
      id: `ses-${this.order.length + 1}-${Date.now().toString(36)}`,
      path: filePath,
      state,
      dirty: false,
      savedAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    this.order.push(session.id);
    this.setActive(session.id);
    void this.applyLanguage(session);
    bus.emit('editor:open', session);
    return session;
  }

  private async applyLanguage(session: EditorSession): Promise<void> {
    const lang = await loadLanguage(session.path);
    if (this.activeId === session.id && this.view) {
      this.view.dispatch({ effects: languageCompartment.reconfigure(lang ? [lang] : []) });
    }
    session.state = session.state.update({ effects: languageCompartment.reconfigure(lang ? [lang] : []) }).state;
  }

  setActive(id: string | null): void {
    if (!this.sessions.has(id ?? '')) id = null;
    this.activeId = id;
    const session = id ? this.sessions.get(id)! : null;
    if (this.view && session) {
      this.view.setState(session.state);
      void this.applyLanguage(session);
    }
    bus.emit('editor:active', session);
    void this.persistSession();
  }

  get active(): EditorSession | null {
    return this.activeId ? this.sessions.get(this.activeId) ?? null : null;
  }

  activePath(): string | null {
    return this.active?.path ?? null;
  }

  close(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    this.order = this.order.filter((x) => x !== id);
    if (this.activeId === id) this.setActive(this.order[this.order.length - 1] ?? null);
    bus.emit('editor:close', session);
    void this.persistSession();
  }

  closeAll(): void {
    for (const id of [...this.order]) this.close(id);
  }

  private onDocChanged(update: { state: EditorState }): void {
    const session = this.active;
    if (!session) return;
    session.state = update.state;
    session.dirty = true;
    bus.emit('editor:change', session);
    this.scheduleAutoSave();
  }

  private scheduleAutoSave(): void {
    if (!settings.get('autoSave')) return;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    const delay = settings.get('autoSaveDelay') ?? 2000;
    this.autoSaveTimer = setTimeout(() => void this.save(), delay);
  }

  async save(targetPath?: string, contentOverride?: string): Promise<boolean> {
    const session = this.active;
    const filePath = targetPath ?? session?.path;
    if (!filePath) return false;
    let content = contentOverride;
    if (content === undefined && session && session.path === filePath) {
      content = this.view ? this.view.state.doc.toString() : session.state.doc.toString();
    }
    if (content === undefined && session) content = session.state.doc.toString();
    try {
      await fs.writeFile(filePath, content ?? '');
      if (session && session.path === filePath) {
        session.dirty = false;
        session.savedAt = Date.now();
      }
      bus.emit('editor:save', { path: filePath });
      return true;
    } catch (err) {
      bus.emit('editor:save-failed', { path: filePath, reason: (err as Error).message });
      return false;
    }
  }

  async renameSession(id: string, newPath: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    session.path = newPath;
    void this.applyLanguage(session);
    bus.emit('editor:rename', { id, path: newPath });
  }

  // ---- theme / settings reactions ------------------------------------------------

  applyTheme(name: ThemeName): void {
    this.view?.dispatch({ effects: themeCompartment.reconfigure(themeExtensions(name)) });
  }

  applySettings(): void {
    this.view?.dispatch({
      effects: [
        wrapCompartment.reconfigure(settings.get('wordWrap') ? EditorView.lineWrapping : []),
        tabCompartment.reconfigure([
          indentUnit.of(' '.repeat(settings.get('tabSize') ?? 4)),
          EditorState.tabSize.of(settings.get('tabSize') ?? 4),
        ]),
      ],
    });
  }

  // ---- restore -------------------------------------------------------------------

  private async persistSession(): Promise<void> {
    const snapshot: SessionRestore = {
      paths: this.order.map((id) => this.sessions.get(id)!.path),
      active: this.active?.path ?? null,
    };
    const { storage } = await import('../../lib/storage');
    await storage.set('editor:sessions', snapshot);
  }

  async restoreSession(): Promise<void> {
    const { storage } = await import('../../lib/storage');
    const snap = await storage.get<SessionRestore>('editor:sessions');
    if (!snap?.paths?.length) return;
    for (const p of snap.paths) {
      try {
        if (await fs.exists(p)) await this.open(p);
      } catch {
        /* file vanished — skip */
      }
    }
    if (snap.active) {
      const ses = [...this.sessions.values()].find((s) => s.path === snap.active);
      if (ses) this.setActive(ses.id);
    }
  }

  // ---- formatting (prettier, lazily imported) -------------------------------------

  static readonly FORMATTERS: Record<string, string> = {
    js: 'babel', jsx: 'babel', mjs: 'babel', cjs: 'babel',
    ts: 'typescript', tsx: 'typescript', mts: 'typescript',
    json: 'json', jsonc: 'json',
    css: 'css', scss: 'scss', less: 'less',
    html: 'html', vue: 'vue', svelte: 'html',
    md: 'markdown', markdown: 'markdown',
    yaml: 'yaml', yml: 'yaml',
  };

  /** Format a document with prettier. Throws when no parser exists. */
  static readonly PLUGIN_LOADERS: Record<string, () => Promise<unknown>> = {
    babel: () => import('prettier/plugins/babel'),
    estree: () => import('prettier/plugins/estree'),
    typescript: () => import('prettier/plugins/typescript'),
    postcss: () => import('prettier/plugins/postcss'),
    html: () => import('prettier/plugins/html'),
    markdown: () => import('prettier/plugins/markdown'),
    yaml: () => import('prettier/plugins/yaml'),
  };

  static async format(filePath: string, code: string): Promise<string> {
    const ext = path.extname(filePath).replace('.', '');
    const parser = EditorManager.FORMATTERS[ext];
    if (!parser) throw new Error(`no formatter for .${ext}`);
    const prettier = await import('prettier/standalone');
    const need = new Set<string>();
    if (parser === 'babel' || parser === 'json') need.add('babel');
    if (parser === 'typescript') need.add('typescript');
    if (parser === 'css' || parser === 'scss' || parser === 'less') need.add('postcss');
    if (parser === 'html' || parser === 'vue') need.add('html');
    if (parser === 'markdown') need.add('markdown');
    if (parser === 'yaml') need.add('yaml');
    if (need.has('babel') || need.has('typescript')) need.add('estree');
    const plugins: unknown[] = [];
    for (const name of need) {
      const loader = EditorManager.PLUGIN_LOADERS[name];
      if (loader) plugins.push(await loader());
    }
    const formatted = await (prettier as unknown as {
      format: (src: string, opts: Record<string, unknown>) => Promise<string>;
    }).format(code, {
      parser,
      plugins,
      tabWidth: settings.get('tabSize') ?? 4,
      printWidth: 100,
      semi: true,
      singleQuote: false,
    });
    return formatted;
  }

  /** Format the active session (or a given path) in place. */
  async formatActive(): Promise<boolean> {
    const session = this.active;
    if (!session || !this.view) return false;
    const code = this.view.state.doc.toString();
    try {
      const formatted = await EditorManager.format(session.path, code);
      if (formatted === code) return true;
      const sel = this.view.state.selection.main;
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: formatted },
        selection: {
          anchor: Math.min(sel.anchor, formatted.length),
          head: Math.min(sel.head, formatted.length),
        },
      });
      session.dirty = true;
      if (settings.get('autoSave')) await this.save();
      return true;
    } catch (err) {
      bus.emit('editor:format-failed', { path: session.path, reason: (err as Error).message });
      return false;
    }
  }

  /** Set explicit syntax for active file (palette command). */
  async setSyntax(langName: string): Promise<boolean> {
    const lang = findLanguage(langName) ??
      (await Promise.resolve(
        (await import('@codemirror/language-data')).languages.find(
          (l) => l.name.toLowerCase() === langName.toLowerCase(),
        ) ?? null,
      ));
    if (!lang || !this.view) return false;
    const support = await lang.load();
    this.view.dispatch({ effects: languageCompartment.reconfigure(support ? [support] : []) });
    return true;
  }
}

export const editorManager = new EditorManager();
