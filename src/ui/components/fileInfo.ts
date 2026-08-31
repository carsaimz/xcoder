/**
 * File properties dialog (replaces the old desktop statusbar with an
 * "file info" popup).
 */
import { dialog } from '@api/dialog';
import { editorLanguages } from '@api/editorLanguages';
import { terminal } from '@core/terminal/terminal';
import { dirname } from '@lib/path';
import { i18n } from '@lib/i18n';
import type { Editor } from '@api/editorManager';

export async function showFileInfo(editor: Editor): Promise<void> {
  const doc = editor.view.state.doc;
  const chars = doc.length;
  const lines = doc.lines;
  const size = new TextEncoder().encode(doc.toString()).length;
  const lang = editorLanguages.get(editor.url);
  const branch = await gitBranch(editor.url);

  await dialog.info(i18n.t('filemenu.properties'), [
    [i18n.t('fileinfo.name'), editor.title],
    [i18n.t('fileinfo.path'), editor.url],
    [i18n.t('fileinfo.size'), `${size} B · ${chars} ${i18n.t('fileinfo.chars')}`],
    [i18n.t('fileinfo.lines'), String(lines)],
    [i18n.t('fileinfo.syntax'), lang?.name ?? 'Plain Text'],
    [i18n.t('fileinfo.encoding'), 'UTF-8'],
    [i18n.t('fileinfo.eol'), 'LF'],
    [i18n.t('fileinfo.branch'), branch]
  ]);
}

async function gitBranch(fileUrl: string): Promise<string> {
  try {
    const { output } = await terminal.exec('git status', { cwdUrl: dirname(fileUrl) });
    return /On branch ([^\s]+)/.exec(output)?.[1] ?? '—';
  } catch {
    return '—';
  }
}
