/**
 * Terminal host — xterm.js instances + the virtual shell, wired together.
 * The panel element is provided by the UI (`mountPanel`).
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { uuid } from '@lib/helpers';
import { parseUrl } from '@lib/path';
import { VirtualShell, type ShellContext, type ShellCommand } from './shell';
import { settings } from '@api/settings';
import { events } from '@api/events';
// xterm.css is copied to www/css/ by the build (see rspack.env.js)

export interface TerminalTab {
  id: string;
  title: string;
  term: Terminal;
  shell: VirtualShell;
  fit: FitAddon;
}

const BANNER = [
  '\x1b[1;35m',
  '  ██  ██  ██████  ██████  ██████  ███████\n',
  '  ██  ██ ██    ██ ██   ██ ██   ██ ██     \n',
  '  ██████ ██    ██ ██████  ██████  █████  \n',
  '  ██  ██ ██    ██ ██   ██ ██   ██ ██     \n',
  '  ██  ██  ██████  ██████  ██████  ███████\n',
  '\x1b[0m',
  '  XCoder virtual shell (xsh) — type ',
  '\x1b[36mhelp\x1b[0m',
  ' for commands\n\n'
].join('');

class TerminalHostImpl {
  private panel: HTMLElement | null = null;
  private tabBar: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private tabs: TerminalTab[] = [];
  private active: TerminalTab | null = null;
  private visible = false;
  /** shell commands registered before/without tabs — replayed into every new tab */
  private shellCommands: ShellCommand[] = [];

  registerShellCommand(cmd: ShellCommand): void {
    this.shellCommands.push(cmd);
    for (const tab of this.tabs) tab.shell.registerCommand(cmd);
  }

  mountPanel(panel: HTMLElement, tabBar: HTMLElement, body: HTMLElement): void {
    this.panel = panel;
    this.tabBar = tabBar;
    this.body = body;
  }

  get isOpen(): boolean {
    return this.visible;
  }

  get openTabs(): readonly TerminalTab[] {
    return this.tabs;
  }

  open(): void {
    if (!this.panel) return;
    this.visible = true;
    this.panel.classList.remove('hidden');
    if (!this.tabs.length) this.createTab();
    this.active?.fit.fit();
    events.emit('terminal:open', {});
  }

  close(): void {
    if (!this.panel) return;
    this.visible = false;
    this.panel.classList.add('hidden');
    events.emit('terminal:close', {});
  }

  toggle(): void {
    if (this.visible) this.close();
    else this.open();
  }

  createTab(title?: string): TerminalTab {
    if (!this.body || !this.tabBar) throw new Error('[terminal] panel not mounted');

    const term = new Terminal({
      fontSize: settings.get('terminal.fontSize'),
      fontFamily: "'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace",
      cursorBlink: true,
      theme: {
        background: '#12151c',
        foreground: '#d4d4d4',
        cursor: '#7c5cff',
        selectionBackground: '#264f78'
      },
      scrollback: 2000
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    const tab: TerminalTab = {
      id: uuid(),
      title: title ?? `xsh ${this.tabs.length + 1}`,
      term,
      shell: new VirtualShell(),
      fit
    };
    for (const cmd of this.shellCommands) tab.shell.registerCommand(cmd);
    this.tabs.push(tab);

    const pane = document.createElement('div');
    pane.className = 'terminal-pane';
    pane.dataset.tabId = tab.id;
    this.body.append(pane);
    term.open(pane);
    this.attachShellIo(tab);
    term.write(BANNER);
    this.printPrompt(tab);

    this.activate(tab);
    return tab;
  }

  closeTab(id: string): void {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const tab = this.tabs[idx];
    tab.term.dispose();
    this.body?.querySelector(`[data-tab-id="${id}"]`)?.remove();
    this.tabs.splice(idx, 1);
    if (this.active === tab) {
      this.active = null;
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      if (next) this.activate(next);
      else if (this.visible) this.close();
    }
  }

  activate(tab: TerminalTab): void {
    this.active = tab;
    for (const t of this.tabs) {
      const pane = this.body?.querySelector(`[data-tab-id="${t.id}"]`);
      pane?.classList.toggle('active', t === tab);
    }
    tab.term.focus();
    if (this.visible) tab.fit.fit();
  }

  get activeTab(): TerminalTab | null {
    return this.active;
  }

  /** Headless execution (public API `terminal.exec`). */
  async exec(line: string, opts: { cwdUrl?: string } = {}): Promise<{ code: number; output: string }> {
    const shell = new VirtualShell(opts.cwdUrl ?? this.active?.shell.cwd ?? 'memory:///home');
    let output = '';
    const ctx: ShellContext = {
      cwd: () => shell.cwd,
      setCwd: (u) => shell.setCwd(u),
      print: (t) => {
        output += t + '\n';
      },
      printErr: (t) => {
        output += t + '\n';
      },
      env: {}
    };
    shell.openFileHook = (url) => this.openFileHook?.(url);
    const code = await shell.execute(line, ctx);
    return { code, output };
  }

  /** set by main.ts → editorManager.openFile (shell `open` command) */
  openFileHook: ((url: string) => void) | null = null;

  // -- interactive I/O --------------------------------------------------------

  private promptText(tab: TerminalTab): string {
    const { path } = parseUrl(tab.shell.cwd);
    const home = '/home';
    const shown = path.startsWith(home) ? '~' + path.slice(home.length) : path;
    return `\r\n\x1b[1;32mxcoder\x1b[0m:\x1b[1;34m${shown}\x1b[0m$ `;
  }

  private printPrompt(tab: TerminalTab): void {
    tab.term.write(this.promptText(tab));
  }

  private attachShellIo(tab: TerminalTab): void {
    let buffer = '';
    let historyIdx = -1;
    const ctx: ShellContext = {
      cwd: () => tab.shell.cwd,
      setCwd: (u) => tab.shell.setCwd(u),
      print: (t) => tab.term.writeln(t),
      printErr: (t) => tab.term.writeln(t),
      env: {}
    };
    ctx.openFile = (url) => this.openFileHook?.(url);
    ctx.exit = () => {
      tab.term.writeln('exit');
      this.closeTab(tab.id);
    };

    tab.term.onData(async (data) => {
      switch (data) {
        case '\r': {
          const line = buffer;
          buffer = '';
          tab.term.write('\r\n');
          if (line.trim()) {
            historyIdx = -1;
            await tab.shell.execute(line, ctx); // execute() records history
          }
          this.printPrompt(tab);
          break;
        }
        case '\x7f': // backspace
          if (buffer.length) {
            buffer = buffer.slice(0, -1);
            tab.term.write('\b \b');
          }
          break;
        case '\t': {
          this.complete(tab, buffer);
          break;
        }
        case '\x1b[A': // up
        case '\x1b[B': { // down
          const hist = tab.shell.getHistory();
          if (!hist.length) break;
          if (data === '\x1b[A') historyIdx = historyIdx === -1 ? hist.length - 1 : Math.max(0, historyIdx - 1);
          else historyIdx = historyIdx === -1 ? -1 : Math.min(hist.length - 1, historyIdx + 1);
          const entry = historyIdx >= 0 ? hist[historyIdx] ?? '' : '';
          // clear current line and repaint prompt with the history entry
          tab.term.write('\r\x1b[2K' + this.promptText(tab).replace(/^\r\n/, '') + entry);
          buffer = entry;
          break;
        }
        case '\x03': // Ctrl+C
          buffer = '';
          tab.term.write('^C');
          this.printPrompt(tab);
          break;
        default:
          if (data >= ' ' || data === '\n') {
            buffer += data;
            tab.term.write(data);
          }
      }
    });
  }

  private complete(tab: TerminalTab, buffer: string): void {
    const tokens = buffer.split(/\s+/);
    const last = tokens[tokens.length - 1] ?? '';
    // v1 completes command names only (path completion is on the roadmap)
    if (tokens.length > 1) return;
    const candidates = tab.shell.listCommands().map((c) => c.name);
    const matches = candidates.filter((c) => c.startsWith(last));
    if (matches.length === 1) {
      const rest = matches[0].slice(last.length);
      buffer += rest;
      tab.term.write(rest + ' ');
    } else if (matches.length > 1) {
      tab.term.write('\r\n' + matches.join('   '));
      this.printPrompt(tab);
      tab.term.write(buffer);
    }
  }

  /** Apply terminal settings changes. */
  applySettings(): void {
    for (const t of this.tabs) {
      t.term.options.fontSize = settings.get('terminal.fontSize');
      t.fit.fit();
    }
  }
}

export const terminal = new TerminalHostImpl();
