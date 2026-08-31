/**
 * Facade — editorManager (open editors & tabs).
 */
import { editorManager as core, Editor } from '@core/editor/editorManager';

export { type Editor } from '@core/editor/editorManager';
export const editorManager = {
  get activeEditor(): Editor | null {
    return core.activeEditor;
  },
  get editors(): readonly Editor[] {
    return core.all;
  },
  openFile: (url: string, opts?: { line?: number; column?: number }) => core.openFile(url, opts),
  activate: (editor: Editor) => core.activate(editor),
  closeEditor: (editorOrUrl: Editor | string) => core.closeEditor(editorOrUrl),
  saveActive: () => core.saveActive(),
  saveAll: () => core.saveAll()
};
