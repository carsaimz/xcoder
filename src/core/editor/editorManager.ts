/**
 * Tab lifecycle: open/activate/close/save, session restore, and global
 * reconfiguration when settings or themes change.
 */
import type { Editor } from './editor';
import { Editor as EditorClass } from './editor';
import * as fs from '@core/file/fs';
import { supportFor } from './languages';
import { getTheme } from './themes';
import { settings } from '@api/settings';
import { events } from '@api/events';
import { toast } from '@api/toast';
import { dialog } from '@api/dialog';
import { KVStore } from '@lib/storage';
import { i18n } from '@lib/i18n';

const session = new KVStore('kv', 'session:');

class EditorManagerImpl {
  private editors: Editor[] = [];
  private active: Editor | null = null;
  private container: HTMLElement | null = null;
  private autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Called by the UI during boot. */
  mount(container: HTMLElement): void {
    this.container = container;
    this.subscribeSettings();
  }

  get activeEditor(): Editor | null {
    return this.active;
  }

  get all(): readonly Editor[] {
    return this.editors;
  }

  getByUrl(url: string): Editor | undefined {
    return this.editors.find((e) => e.url === url);
  }

  async openFile(
    url: string,
    opts: { line?: number; column?: number } = {}
  ): Promise<Editor> {
    if (!this.container) throw new Error('[editorManager] not mounted');

    const existing = this.getByUrl(url);
    if (existing) {
      this.activate(existing);
      if (opts.line) existing.setCursor(opts.line, opts.column);
      return existing;
    }

    let content: string;
    try {
      content = await fs.read(url);
    } catch (err) {
      toast.error(i18n.t('editor.cannotOpen', { url }));
      throw err;
    }

    const theme = getTheme(settings.get('theme'));
    const editor = new EditorClass({
      url,
      content,
      themeExtension: [theme.cmTheme, theme.highlight],
      languageExtension: supportFor(url) ?? []
    });

    this.editors.push(editor);
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-pane';
    wrapper.dataset.editorId = editor.id;
    wrapper.append(editor.dom);
    this.container.append(wrapper);

    this.activate(editor);
    events.emit('editor:open', { url });
    if (opts.line) editor.setCursor(opts.line, opts.column);
    void this.persistSession();
    return editor;
  }

  activate(editor: Editor): void {
    if (this.active === editor) return;
    this.active = editor;
    for (const e of this.editors) {
      const wrapper = e.dom.parentElement;
      if (wrapper) wrapper.classList.toggle('active', e === editor);
    }
    editor.focus();
    events.emit('editor:switch', { url: editor.url });
  }

  async closeEditor(editorOrUrl: Editor | string): Promise<boolean> {
    const editor =
      typeof editorOrUrl === 'string'
        ? this.getByUrl(editorOrUrl)
        : editorOrUrl;
    if (!editor) return false;

    if (editor.isDirty) {
      const ok = await dialog.confirm(
        i18n.t('dialog.unsavedTitle'),
        i18n.t('dialog.unsavedMessage', { file: editor.title })
      );
      if (!ok) return false;
    }

    const idx = this.editors.indexOf(editor);
    this.editors.splice(idx, 1);
    editor.destroy();
    events.emit('editor:close', { url: editor.url });

    if (this.active === editor) {
      this.active = null;
      const next = this.editors[Math.min(idx, this.editors.length - 1)];
      if (next) this.activate(next);
    }
    void this.persistSession();
    return true;
  }

  async saveActive(): Promise<void> {
    if (this.active) await this.active.save();
  }

  async saveAll(): Promise<void> {
    for (const e of this.editors) await e.save();
  }

  // -- session ---------------------------------------------------------------

  async persistSession(): Promise<void> {
    await session.set('openTabs', this.editors.map((e) => e.url));
    await session.set('activeTab', this.active?.url ?? null);
  }

  async restoreSession(): Promise<void> {
    const urls = (await session.get<string[]>('openTabs')) ?? [];
    const activeUrl = await session.get<string | null>('activeTab');
    for (const url of urls) {
      try {
        await this.openFile(url);
      } catch {
        /* file vanished — skip */
      }
    }
    if (activeUrl) {
      const target = this.getByUrl(activeUrl);
      if (target) this.activate(target);
    }
  }

  // -- settings reactions -----------------------------------------------------

  private subscribeSettings(): void {
    events.on('settings:change', ({ key }) => {
      if (key === 'theme') this.retheme();
      if (key === 'fontSize' || key === 'tabSize' || key === 'wordWrap') {
        this.reformatAll();
      }
    });
    events.on('editor:dirty', ({ url, isDirty }) => {
      if (!isDirty || !settings.get('autoSave')) return;
      const prev = this.autoSaveTimers.get(url);
      if (prev) clearTimeout(prev);
      this.autoSaveTimers.set(
        url,
        setTimeout(() => {
          this.autoSaveTimers.delete(url);
          void this.getByUrl(url)?.save();
        }, 1600)
      );
    });
  }

  private retheme(): void {
    const theme = getTheme(settings.get('theme'));
    const ext = [theme.cmTheme, theme.highlight];
    for (const e of this.editors) e.reconfigureTheme(ext);
  }

  private reformatAll(): void {
    const opts = {
      tabSize: settings.get('tabSize'),
      wordWrap: settings.get('wordWrap'),
      fontSize: settings.get('fontSize')
    };
    for (const e of this.editors) e.reconfigureFormatting(opts);
  }
}

export const editorManager = new EditorManagerImpl();
// re-export the class type for consumers
export { Editor };
