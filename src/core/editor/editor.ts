/**
 * One Editor per open file: wraps a CodeMirror 6 EditorView, tracks dirty
 * state and owns save/reconfiguration.
 */
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { basename } from '@lib/path';
import { uuid, debounce } from '@lib/helpers';
import * as fs from '@core/file/fs';
import { settings } from '@api/settings';
import { events } from '@api/events';
import { editorCompartments, baseExtensions, wrapExtension, fontExtension } from './extensions';

export interface EditorInit {
  url: string;
  content: string;
  themeExtension: Extension;
  languageExtension?: Extension;
  lspExtension?: Extension;
}

export class Editor {
  readonly id = uuid();
  readonly url: string;
  readonly view: EditorView;
  title: string;
  isDirty = false;
  private savedText: string;

  constructor(init: EditorInit) {
    this.url = init.url;
    this.title = basename(init.url);
    this.savedText = init.content;

    const opts = {
      tabSize: settings.get('tabSize'),
      wordWrap: settings.get('wordWrap'),
      fontSize: settings.get('fontSize')
    };

    this.view = new EditorView({
      state: EditorState.create({
        doc: init.content,
        extensions: [
          baseExtensions(opts),
          editorCompartments.theme.of(init.themeExtension),
          editorCompartments.language.of(init.languageExtension ?? []),
          editorCompartments.lsp.of(init.lspExtension ?? []),
          editorCompartments.wrap.of(wrapExtension(opts.wordWrap)),
          editorCompartments.font.of(fontExtension(opts.fontSize)),
          EditorView.updateListener.of((u) => this.onUpdate(u))
        ]
      }),
      parent: undefined
    });
  }

  /** DOM element of this editor (the UI appends it into the editor area). */
  get dom(): HTMLElement {
    return this.view.dom;
  }

  get text(): string {
    return this.view.state.doc.toString();
  }

  private onUpdate(update: ViewUpdate): void {
    if (!update.docChanged) return;
    const dirty = this.text !== this.savedText;
    if (dirty !== this.isDirty) {
      this.isDirty = dirty;
      events.emit('editor:dirty', { url: this.url, isDirty: dirty });
    }
    if (settings.get('autoSave') && dirty) this.debouncedSave();
  }

  private debouncedSave = debounce(() => {
    if (this.isDirty) void this.save();
  }, 1500);

  async save(): Promise<void> {
    if (!this.isDirty) return;
    await fs.write(this.url, this.text);
    this.savedText = this.text;
    this.isDirty = false;
    events.emit('editor:dirty', { url: this.url, isDirty: false });
    events.emit('editor:save', { url: this.url });
  }

  markSaved(): void {
    this.savedText = this.text;
    this.isDirty = false;
    events.emit('editor:dirty', { url: this.url, isDirty: false });
  }

  setCursor(line: number, column = 0): void {
    const doc = this.view.state.doc;
    const clampedLine = Math.min(Math.max(1, line), doc.lines);
    const info = doc.line(clampedLine);
    const pos = Math.min(info.from + Math.max(0, column), info.to);
    this.view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' })
    });
    this.focus();
  }

  focus(): void {
    this.view.focus();
  }

  reconfigureTheme(ext: Extension): void {
    this.view.dispatch({ effects: editorCompartments.theme.reconfigure(ext) });
  }

  reconfigureLanguage(ext: Extension): void {
    this.view.dispatch({ effects: editorCompartments.language.reconfigure(ext) });
  }

  reconfigureLsp(ext: Extension): void {
    this.view.dispatch({ effects: editorCompartments.lsp.reconfigure(ext) });
  }

  reconfigureFormatting(opts: { tabSize: number; wordWrap: boolean; fontSize: number }): void {
    this.view.dispatch({
      effects: [
        editorCompartments.wrap.reconfigure(wrapExtension(opts.wordWrap)),
        editorCompartments.font.reconfigure(fontExtension(opts.fontSize))
      ]
    });
  }

  destroy(): void {
    this.debouncedSave.cancel();
    this.view.destroy();
  }
}
