/**
 * XCoder entrypoint — boots storage, settings, i18n, workspace, editor,
 * terminal shell, UI, commands, plugins and exposes the xcoder facade.
 */

import './style.css';
import { el, icon } from './lib/dom';
import { bus } from './lib/events';
import { t, setLocale, detectLocale, listLocales, registerGeneratedLocales } from './lib/i18n';
import { settings } from './api/settings';
import { commands } from './api/commands';
import { toast } from './api/toast';
import * as dialog from './api/dialog';
import { plugins } from './api/plugins';
import { initRegistry } from './api/registry';
import { VERSION } from './version';
import { fs } from './core/file';
import { MemoryBackend, BrowserBackend } from './core/file';
import { WebDavBackend } from './core/file/webdav';
import { editorManager } from './core/editor/editorManager';
import { THEME_LIST, ThemeName } from './core/editor/themes';
import { Shell } from './core/terminal/shell';
import { bindShell } from './core/agent';
import { providers } from './core/ai';
import { FileTree } from './ui/tree';
import { TerminalPanel } from './ui/terminalPanel';
import { AgentPanel } from './ui/agentPanel';
import { openPalette, openQuickOpen, installShortcuts } from './ui/palette';
import { openSettings, initSettingsSync } from './ui/settingsPage';
import { openPlugins } from './ui/pluginsPage';
import { allLanguages } from './core/editor/languages';

async function boot(): Promise<void> {
  const root = document.getElementById('root')!;
  root.innerHTML = '';

  await settings.whenReady();
  document.documentElement.dataset.theme = settings.get('theme');

  // i18n: register generated stubs, then detect unless configured
  registerGeneratedLocales();
  const locale = settings.get('locale');
  setLocale(locale && locale !== 'en' ? locale : detectLocale());
  bus.on('shell:locale', (code) => void settings.set('locale', String(code)));
  let localeReload: ReturnType<typeof setTimeout> | null = null;
  bus.on('locale:changed', (code) => {
    void settings.set('locale', String(code));
    // UI chrome is rendered once; a reload applies the new language cleanly
    if (localeReload) clearTimeout(localeReload);
    localeReload = setTimeout(() => window.location.reload(), 150);
  });

  // workspace: browser storage in production, memory when unavailable
  if (typeof indexedDB === 'undefined') {
    fs.unmount('file');
    fs.mount(new MemoryBackend(), { root: 'file:///', label: 'device' });
  }
  const shell = new Shell(fs);
  await shell.init();
  bindShell(shell);
  initRegistry({ shell });

  // providers from settings
  providers.load(settings.get('providers'), settings.get('agent').activeProfileId);
  bus.on<{ key: string }>('settings:change', async ({ key }) => {
    if (key === 'providers' || key === 'agent' || key === '*') {
      providers.load(settings.get('providers'), settings.get('agent').activeProfileId);
    }
  });

  // ---- layout ---------------------------------------------------------------
  const ide = el('div', { class: 'ide' });
  const header = el('div', { class: 'ide-header' });
  const body = el('div', { class: 'ide-body' });
  const sidebar = el('div', { class: 'sidebar' });
  const tabsWrap = el('div', { class: 'tabs-wrap', style: 'display:flex;flex-direction:column;flex:1;min-width:0' });
  const tabsList = el('div', { class: 'tabs-list' });
  const editorHost = el('div', { class: 'editor-host' });
  tabsWrap.append(tabsList, editorHost);
  sidebar.appendChild(tabsWrap);
  body.appendChild(sidebar);
  ide.append(header, body);
  root.appendChild(ide);

  const menuBtn = (name: string, title: string, onClick: () => void) => {
    const btn = el('button', { class: 'icon-btn', title, 'aria-label': title }, icon(name, 19));
    btn.addEventListener('click', onClick);
    return btn;
  };

  header.append(
    el('span', { class: 'brand' }, 'XCoder'),
    menuBtn('menu', t('header.menu'), () => sidebar.classList.toggle('collapsed')),
    menuBtn('search', t('header.quickOpen'), () => void openQuickOpen()),
    menuBtn('terminal', t('header.terminal'), () => terminal.toggle()),
    menuBtn('robot', t('header.agent'), () => agentPanel.open()),
    el('span', { class: 'spacer' }),
    menuBtn('save', t('header.save'), () => void commands.execute('file.save')),
    menuBtn('plugin', t('header.plugins'), () => openPlugins()),
    menuBtn('gear', t('header.settings'), () => openSettings()),
  );

  const tree = new FileTree(sidebar);
  void tree;
  editorManager.attach(editorHost);
  new TabsRenderer(tabsList, editorHost);
  const terminal = new TerminalPanel(body, shell);
  const agentPanel = new AgentPanel(document.body);

  // ---- commands ---------------------------------------------------------------
  commands.registerMany([
    { id: 'file.save', label: 'header.save', icon: 'save', keybinding: 'Ctrl+S', run: async () => { await editorManager.save(); } },
    { id: 'file.quickOpen', label: 'header.quickOpen', icon: 'search', keybinding: 'Ctrl+P', run: () => void openQuickOpen() },
    { id: 'view.palette', label: 'header.palette', keybinding: 'Ctrl+K', run: openPalette },
    { id: 'view.terminal', label: 'header.terminal', icon: 'terminal', run: () => terminal.toggle() },
    { id: 'view.toggleSidebar', label: 'header.menu', run: () => { sidebar.classList.toggle('collapsed'); } },
    { id: 'editor.format', label: 'editor.format', icon: 'wand', run: async () => {
      const active = editorManager.activePath();
      const ok = await editorManager.formatActive();
      if (ok && active) toast(t('editor.formatOk', { path: active }), 'success');
    } },
    { id: 'editor.setSyntax', label: 'Set syntax…', run: async () => {
      const langs = allLanguages().map((l) => ({ value: l.name, label: l.name }));
      const choice = await dialog.select('Language', langs.slice(0, 120));
      if (choice) await editorManager.setSyntax(choice);
    } },
    { id: 'agent.open', label: 'header.agent', icon: 'robot', run: () => agentPanel.open() },
    { id: 'agent.runTask', label: 'agent.run', run: () => {
      agentPanel.open();
      const input = document.querySelector<HTMLTextAreaElement>('.agent-input');
      input?.focus();
    } },
    { id: 'settings.open', label: 'header.settings', icon: 'gear', run: () => openSettings() },
    { id: 'plugins.open', label: 'header.plugins', icon: 'plugin', run: openPlugins },
    { id: 'workspace.addWebdav', label: 'Workspace: add WebDAV mount…', run: async () => {
      const url = await dialog.prompt('https://server/dav/path', '', 'WebDAV URL');
      if (!url) return;
      const user = await dialog.prompt('username', '');
      const password = user !== null ? await dialog.prompt('password', '') : null;
      const backend = new WebDavBackend({ baseUrl: url, username: user ?? undefined, password: password ?? undefined });
      fs.mount(backend);
      fs.addRoot('webdav:///', 'webdav');
      toast('WebDAV mounted', 'success');
    } },
    { id: 'theme.setDark', label: 'Theme: dark', run: () => applyTheme('dark') },
    { id: 'theme.setLight', label: 'Theme: light', run: () => applyTheme('light') },
    { id: 'theme.setOcean', label: 'Theme: ocean', run: () => applyTheme('ocean') },
    { id: 'locale.cycle', label: 'settings.locale', run: async () => {
      const codes = listLocales().filter((l) => ['en', 'pt', 'es'].includes(l.code));
      const choice = await dialog.select(t('settings.locale'), codes.map((c) => ({ value: c.code, label: c.name })));
      if (choice) {
        setLocale(choice);
        await settings.set('locale', choice);
      }
    } },
    { id: 'terminal.runAgentCommand', label: 'Terminal: agent <task>', run: async () => {
      const task = await dialog.prompt('agent create utils/date.ts with formatDate', '');
      if (task) await terminal.runCommand(`agent ${task}`);
    } },
  ]);

  function applyTheme(name: ThemeName): void {
    if (!THEME_LIST.includes(name)) return;
    void settings.set('theme', name);
    document.documentElement.dataset.theme = name;
    editorManager.applyTheme(name);
  }
  bus.on('shell:theme', (name) => applyTheme(String(name) as ThemeName));

  // settings side-effects
  bus.on<{ key: string }>('settings:change', ({ key }) => {
    if (key === 'theme') {
      document.documentElement.dataset.theme = settings.get('theme');
      editorManager.applyTheme(settings.get('theme'));
    } else if (key === 'wordWrap' || key === 'tabSize') {
      editorManager.applySettings();
    }
  });
  initSettingsSync();
  installShortcuts();

  // shell open command → editor
  bus.on('shell:open', (p) => {
    void editorManager.open(String(p)).catch(() => undefined);
  });
  bus.on('agent:requested', (task) => {
    agentPanel.open();
    const input = document.querySelector<HTMLTextAreaElement>('.agent-input');
    if (input) {
      input.value = String(task);
      input.focus();
    }
  });

  // ---- plugins & session restore ------------------------------------------------
  try {
    await plugins.loadInstalled();
  } catch (err) {
    console.warn('plugins load failed', err);
  }
  await editorManager.restoreSession();

  console.info(`XCoder ${VERSION} ready — ${commands.list().length} commands, ${fs.listRoots().length} root(s)`);
}

/** Tab strip renderer bound to editorManager events. */
class TabsRenderer {
  constructor(private list: HTMLElement, private host: HTMLElement) {
    bus.on('editor:open', () => this.render());
    bus.on('editor:close', () => this.render());
    bus.on('editor:active', () => this.render());
    bus.on('editor:change', () => this.render());
    bus.on('editor:save', () => this.render());
    this.render();
  }

  render(): void {
    this.list.innerHTML = '';
    const sessions = editorManager.order.map((id) => editorManager.sessions.get(id)!);
    if (!sessions.length) {
      this.host.querySelector('.editor-placeholder')?.remove();
      if (!editorManager.view || editorManager.view.dom.parentElement !== this.host) {
        // view exists but hidden behind placeholder
      }
      this.host.appendChild(
        el('div', { class: 'editor-placeholder' }, 'Ctrl+K commands · Ctrl+P files · 🤖 AI agent'),
      );
      return;
    }
    this.host.querySelector('.editor-placeholder')?.remove();
    for (const session of sessions) {
      const name = session.path.split('/').pop() ?? session.path;
      const tab = el(
        'div',
        { class: `tab${session.id === editorManager.activeId ? ' active' : ''}` },
        icon('file', 14),
        el('span', {}, name),
        session.dirty ? el('span', { class: 'dirty-dot' }) : '',
        el('button', { class: 'close icon-btn' }, icon('close', 12)),
      );
      (tab.querySelector('.close') as HTMLElement).addEventListener('click', (e) => {
        e.stopPropagation();
        editorManager.close(session.id);
      });
      tab.addEventListener('click', () => editorManager.setActive(session.id));
      this.list.appendChild(tab);
    }
  }
}

void boot().catch((err) => {
  console.error('boot failed', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '';
    root.appendChild(
      el(
        'div',
        { class: 'boot-splash' },
        el('div', { class: 'boot-logo' }, 'X'),
        el('div', { class: 'boot-title' }, 'XCoder'),
        el('div', { class: 'boot-hint', style: 'color:#f38ba8' }, `boot failed: ${(err as Error).message}`),
      ),
    );
  }
});
