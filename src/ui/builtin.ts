/**
 * Built-in commands — registered at boot into the global command registry.
 */
import { addCommand } from '@api/commands';
import { editorManager } from '@api/editorManager';
import { terminal } from '@core/terminal/terminal';
import { editorThemes } from '@api/editorThemes';
import { workspace } from '@core/file/workspace';
import * as fs from '@core/file/fs';
import { dialog } from '@api/dialog';
import { toast } from '@api/toast';
import { aiManager } from '@core/ai/manager';
import { xcoder } from '@api/xcoder';
import { i18n } from '@lib/i18n';
import { openPalette } from './components/palette';
import { askAi, togglePanel } from './components/aiChat';
import { toggleSidebar } from './components/sidebarApps';
import { openSearchRow } from './components/quickTools';
import { openSettingsSection } from './components/mainMenu';
import { editorManager as em } from '@api/editorManager';

export function registerBuiltinCommands(): void {
  addCommand({
    name: 'file.new',
    description: i18n.t('cmd.fileNew'),
    bindKey: { win: 'Ctrl-N', mac: 'Command-N' },
    exec: async () => {
      const folder = workspace.listFolders()[0] ?? 'memory:///home';
      const name = await dialog.prompt(i18n.t('cmd.fileNew'), i18n.t('tree.fileNamePrompt'), {
        placeholder: 'untitled.js',
        required: true
      });
      if (!name) return;
      const url = `${folder.replace(/\/+$/, '')}/${name}`;
      await fs.createFile(url, '');
      await editorManager.openFile(url);
    }
  });

  addCommand({
    name: 'file.save',
    description: i18n.t('cmd.fileSave'),
    bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
    exec: async () => {
      await editorManager.saveActive();
    }
  });

  addCommand({
    name: 'file.saveAll',
    description: i18n.t('cmd.fileSaveAll'),
    bindKey: { win: 'Ctrl-Alt-S', mac: 'Command-Alt-S' },
    exec: () => editorManager.saveAll()
  });

  addCommand({
    name: 'file.close',
    description: i18n.t('cmd.fileClose'),
    bindKey: { win: 'Ctrl-W', mac: 'Command-W' },
    exec: async () => {
      const active = editorManager.activeEditor;
      if (active) await editorManager.closeEditor(active);
    }
  });

  addCommand({
    name: 'file.openRecent',
    description: i18n.t('cmd.quickOpen'),
    bindKey: { win: 'Ctrl-P', mac: 'Command-P' },
    exec: () => openPalette('files')
  });

  addCommand({
    name: 'view.commandPalette',
    description: i18n.t('cmd.palette'),
    bindKey: { win: 'Ctrl-Shift-P', mac: 'Command-Shift-P' },
    exec: () => openPalette('commands')
  });

  addCommand({
    name: 'file.saveAs',
    description: i18n.t('cmd.fileSaveAs'),
    exec: async () => {
      const active = em.activeEditor;
      if (!active) return;
      const dir = active.url.slice(0, active.url.lastIndexOf('/') + 1);
      const path = await dialog.prompt(i18n.t('cmd.fileSaveAs'), i18n.t('tree.fileNamePrompt'), {
        value: active.title,
        required: true
      });
      if (!path) return;
      const url = `${dir}${path}`;
      const content = active.view.state.doc.toString();
      await fs.createFile(url, content);
      await editorManager.openFile(url);
      toast.success(i18n.t('toast.saved'));
    }
  });

  addCommand({
    name: 'file.run',
    description: i18n.t('cmd.fileRun'),
    bindKey: { win: 'Ctrl-R', mac: 'Command-R' },
    exec: async () => {
      const active = em.activeEditor;
      if (!active) return;
      await editorManager.saveActive();
      const path = active.url.replace(/^[a-z]+:\/\//, '');
      const ext = active.title.split('.').pop()?.toLowerCase() ?? '';
      const runner = ext === 'py' ? 'python' : ext === 'sh' ? 'bash' : 'node';
      if (!['js', 'mjs', 'cjs', 'py', 'sh'].includes(ext)) {
        toast.warning(i18n.t('toast.noRunner'));
        return;
      }
      terminal.open();
      await terminal.exec(`${runner} ${path}`, { cwdUrl: active.url });
    }
  });

  addCommand({
    name: 'search.inFile',
    description: i18n.t('cmd.searchInFile'),
    bindKey: { win: 'Ctrl-F', mac: 'Command-F' },
    exec: () => openSearchRow()
  });

  addCommand({
    name: 'view.plugins',
    description: i18n.t('cmd.plugins'),
    exec: () => void openSettingsSection('plugins')
  });

  addCommand({
    name: 'view.toggleSidebar',
    description: i18n.t('cmd.toggleSidebar'),
    bindKey: { win: 'Ctrl-B', mac: 'Command-B' },
    exec: () => toggleSidebar()
  });

  addCommand({
    name: 'view.settings',
    description: i18n.t('cmd.settings'),
    bindKey: { win: 'Ctrl-,', mac: 'Command-,' },
    exec: () => {
      document.getElementById('btn-settings')?.click();
    }
  });

  addCommand({
    name: 'terminal.toggle',
    description: i18n.t('cmd.terminalToggle'),
    bindKey: { win: 'Ctrl-`', mac: 'Command-`' },
    exec: () => terminal.toggle()
  });

  addCommand({
    name: 'terminal.clear',
    description: i18n.t('cmd.terminalClear'),
    exec: () => {
      const tab = terminal.activeTab;
      if (tab) tab.term.write('\x1b[2J\x1b[H');
    }
  });

  addCommand({
    name: 'terminal.newTab',
    description: i18n.t('cmd.terminalNew'),
    exec: () => {
      terminal.open();
      terminal.createTab();
    }
  });

  for (const id of ['dark', 'light', 'solarized', 'oled'] as const) {
    addCommand({
      name: `theme.set${id[0].toUpperCase()}${id.slice(1)}`,
      description: i18n.t('cmd.themeSet', { theme: id }),
      exec: () => editorThemes.set(id)
    });
  }

  addCommand({
    name: 'app.about',
    description: i18n.t('cmd.about'),
    exec: () => {
      void dialog.alert('XCoder', `XCoder v${xcoder.version} — mobile-first IDE.\nCodeMirror 6 · Cordova · MIT.`);
    }
  });

  // ── AI agents ─────────────────────────────────────────────────────────
  addCommand({
    name: 'ai.togglePanel',
    description: i18n.t('cmd.aiToggle'),
    bindKey: { win: 'Ctrl-I', mac: 'Command-I' },
    exec: () => void togglePanel()
  });

  addCommand({
    name: 'ai.newChat',
    description: i18n.t('cmd.aiNewChat'),
    exec: async () => {
      await togglePanel(true);
      const { aiManager: mgr } = await import('@core/ai/manager');
      await mgr.newSession('chat');
    }
  });

  addCommand({
    name: 'ai.explainSelection',
    description: i18n.t('cmd.aiExplain'),
    exec: async () => {
      if (!hasSelection()) {
        toast.warning(i18n.t('ai.noSelection'));
        return;
      }
      await askAi(i18n.t('cmd.aiExplain') + ': explain what this code does, pitfalls and possible improvements.', { selection: true });
    }
  });

  addCommand({
    name: 'ai.fixSelection',
    description: i18n.t('cmd.aiFix'),
    exec: async () => {
      if (!hasSelection()) {
        toast.warning(i18n.t('ai.noSelection'));
        return;
      }
      const id = (aiManager.activeSessionId ?? (await aiManager.newSession("developer"))) as string;
      await aiManager.setSessionAgent(id, 'developer');
      await askAi('Fix the selected code: apply the corrected version with edit_file, then summarize what you changed.', { selection: true });
    }
  });

  addCommand({
    name: 'ai.reviewFile',
    description: i18n.t('cmd.aiReview'),
    exec: async () => {
      const active = editorManager.activeEditor;
      if (!active) {
        toast.warning(i18n.t('ai.noFile'));
        return;
      }
      const id = (aiManager.activeSessionId ?? (await aiManager.newSession("analyzer"))) as string;
      await aiManager.setSessionAgent(id, 'analyzer');
      await askAi('Review the active file for bugs, security issues and performance problems. Be concise and specific (file:line).', { file: true });
    }
  });

  addCommand({
    name: 'ai.commitMessage',
    description: i18n.t('cmd.aiCommitMsg'),
    exec: async () => {
      try {
        const message = await aiManager.runOneShot(
          'git',
          'Inspect this repository (git status, git diff). Propose EXACTLY ONE Conventional Commits message (type(scope): subject) for the current changes. Reply with ONLY the message inside a fenced block — do not commit, do not stage.'
        );
        const match = /```[a-z]*\n([\s\S]*?)```/.exec(message);
        const proposed = (match?.[1] ?? message).trim().split('\n')[0].slice(0, 120);
        if (!proposed) {
          toast.warning(message.slice(0, 140));
          return;
        }
        const finalMsg = await dialog.prompt(
          i18n.t('ai.commitPromptTitle'),
          i18n.t('ai.commitPromptBody'),
          { value: proposed, required: true }
        );
        if (!finalMsg) return;
        await terminal.exec('git add -A');
        const res = await terminal.exec(`git commit -m ${JSON.stringify(finalMsg)}`);
        if (res.code === 0) toast.success(i18n.t('ai.commitDone'));
        else toast.error(res.output.slice(0, 160));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    }
  });
}

function hasSelection(): boolean {
  const ed = editorManager.activeEditor;
  if (!ed) return false;
  return !ed.view.state.selection.main.empty;
}

export { toggleSidebar } from './components/sidebarApps';
