/**
 * XCoder bootstrap — the sequence documented in docs/architecture.md §3.
 */
import { installGlobal, xcoder } from '@api/xcoder';
import { settings } from '@api/settings';
import { i18n } from '@lib/i18n';
import { events } from '@api/events';
import { toast } from '@api/toast';
import { matchKeybinding, exec as execCommand } from '@api/commands';
import { MemoryBackend } from '@core/file/backend-memory';
import { BrowserBackend } from '@core/file/backend-browser';
import { CordovaBackend } from '@core/file/backend-cordova';
import { registerBackend } from '@core/file/fs';
import { workspace } from '@core/file/workspace';
import { registerBundledThemes } from '@core/editor/themes';
import { registerBundledLanguages } from '@core/editor/languages';
import { editorManager } from '@core/editor/editorManager';
import { terminal } from '@core/terminal/terminal';
import { pluginManager } from '@api/plugins/boot';
import { registerIconSet, hydrateChromeIcons } from './ui/components/icons';
import { mountFileTree } from './ui/components/fileTree';
import { mountTabs } from './ui/components/tabs';
import { mountPalette, openPalette } from './ui/components/palette';
import { mountSettings } from './ui/components/settingsPage';
import { mountAi } from './ui/components/aiChat';
import { mountQuickTools } from './ui/components/quickTools';
import { mountMainMenu } from './ui/components/mainMenu';
import { mountSidebar, toggleSidebar, trackRecents } from './ui/components/sidebarApps';
import { mountSearchInFiles } from './ui/components/searchInFiles';
import { aiManager } from '@core/ai/manager';
import { registerBuiltinCommands } from './ui/builtin';
import { $ } from '@lib/dom';

const LANG_BASE = new URL('lang/', document.baseURI).href;

async function boot(): Promise<void> {
  installGlobal();
  registerIconSet();
  hydrateChromeIcons();

  // 1-2. settings + theme
  await settings.load();
  document.documentElement.dataset.theme = settings.get('theme');

  // 3. i18n — core locales then the user's choice
  await Promise.all(['en', 'pt', 'es'].map((l) => i18n.loadFromUrl(l, LANG_BASE)));
  if (!i18n.available().includes(settings.get('lang'))) {
    await i18n.loadFromUrl(settings.get('lang'), LANG_BASE);
  }
  i18n.setLocale(settings.get('lang'));

  // 4. file system
  const memory = new MemoryBackend();
  memory.seed(demoHome());
  registerBackend(memory);
  const browser = new BrowserBackend();
  await browser.seedWelcome({
    '/home/welcome.md':
      '# Welcome to XCoder\n\n' +
      'This file lives in **browser storage** — edit and press Ctrl+S.\n\n' +
      '- `Ctrl+Shift+P` — command palette\n' +
      '- `Ctrl+P` — quick open\n' +
      '- `Ctrl+\\`` — terminal\n\n' +
      'Tap the ☰ menu to browse files. The bottom bar gives you the keyboard tools.\n'
  });
  registerBackend(browser);
  if (CordovaBackend.isAvailable) {
    try {
      registerBackend(new CordovaBackend());
    } catch (err) {
      console.warn('[boot] cordova backend failed', err);
    }
  }
  await workspace.addFolder('browser:///home');

  // 5-7. editor + UI
  registerBundledThemes();
  registerBundledLanguages();
  editorManager.mount($('#editor-container'));
  mountFileTree();
  mountTabs();
  mountQuickTools();
  mountMainMenu();
  mountSidebar();
  mountSearchInFiles();
  void trackRecents();
  mountPalette();
  mountSettings();
  mountAi();
  void aiManager.load();
  terminal.mountPanel(
    $('#terminal-panel'),
    $('#terminal-tabs'),
    $('#terminal-body')
  );
  terminal.openFileHook = (url) => void editorManager.openFile(url);
  pluginManager.mountPages();

  // header actions
  $('#btn-run').addEventListener('click', () => void execCommand('file.run'));
  $('#welcome-open')?.addEventListener('click', () => void execCommand('file.new'));
  $('#welcome-palette')?.addEventListener('click', () => openPalette('commands'));
  $('#welcome-terminal')?.addEventListener('click', () => terminal.toggle());
  $('#btn-term-close').addEventListener('click', () => terminal.close());
  $('#btn-term-new').addEventListener('click', () => terminal.createTab());
  $('#btn-new-file').addEventListener('click', () => void execCommand('file.new'));

  // 6. commands + keymap
  registerBuiltinCommands();
  document.addEventListener('keydown', (e) => {
    const cmd = matchKeybinding(e);
    if (cmd) {
      e.preventDefault();
      void execCommand(cmd.name);
    }
  });
  void toggleSidebar; // exported for plugins / console use

  // titlebar shows the active file (editor header title)
  const title = $('#titlebar-title');
  const syncTitle = () => {
    const active = editorManager.activeEditor;
    if (active) {
      title.textContent = active.title;
      title.title = active.url;
    } else {
      title.innerHTML = '<span class="brand-accent">X</span>Coder';
      title.removeAttribute('title');
    }
  };
  events.on('editor:open', syncTitle);
  events.on('editor:close', syncTitle);
  events.on('editor:switch', syncTitle);
  syncTitle();

  // 5b. session restore
  await editorManager.restoreSession().catch(() => undefined);

  // 8. terminal settings reaction
  events.on('settings:change', ({ key }) => {
    if (key === 'terminal.fontSize') terminal.applySettings();
  });

  // 10. plugins
  await pluginManager.loadEnabled();

  events.emit('app:ready', {});
  console.info(`[xcoder] ready (v${xcoder.version})`);
}

function demoHome(): Record<string, string> {
  return {
    '/home/project/package.json': JSON.stringify(
      {
        name: 'demo-project',
        version: '1.0.0',
        scripts: { start: 'node index.js', test: 'node test.js' },
        dependencies: {}
      },
      null,
      2
    ),
    '/home/project/index.js':
      '// demo file — try: open index.js   |   git init · add . · commit -m "first"\n' +
      'function greet(name) {\n' +
      '  return `Hello, ${name}!`;\n' +
      '}\n\n' +
      'console.log(greet("XCoder"));\n',
    '/home/project/README.md':
      '# Demo Project\n\nTry the virtual shell:\n\n    git init\n    git add .\n    git commit -m "first commit"\n    git log\n',
    '/home/project/src/main.py':
      'def main():\n    print("Hello from Python")\n\n\nif __name__ == "__main__":\n    main()\n'
  };
}

boot().catch((err) => {
  console.error('[xcoder] boot failed', err);
  toast.error('Boot failed — see console');
});
