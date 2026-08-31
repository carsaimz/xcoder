/**
 * Facade — terminal host + virtual shell.
 */
import { terminal, type TerminalTab } from '@core/terminal/terminal';
import { proot } from '@core/terminal/proot';
import type { ShellCommand, ShellContext } from '@core/terminal/shell';

export type { TerminalTab, ShellCommand, ShellContext };

export const shell = {
  /** Register a shell command on every open tab and all future tabs. */
  registerCommand: (cmd: ShellCommand) => terminal.registerShellCommand(cmd),
  commands: () => terminal.activeTab?.shell.listCommands() ?? [],
  get cwd(): string {
    return terminal.activeTab?.shell.cwd ?? 'memory:///home';
  }
};

export const terminalApi = {
  open: () => terminal.open(),
  close: () => terminal.close(),
  toggle: () => terminal.toggle(),
  createTab: (title?: string): TerminalTab => terminal.createTab(title),
  closeTab: (id: string) => terminal.closeTab(id),
  get tabs(): readonly TerminalTab[] {
    return terminal.openTabs;
  },
  exec: (line: string, opts?: { cwdUrl?: string }) => terminal.exec(line, opts),
  shell,
  proot: {
    get status() {
      return proot.current;
    },
    install: () => proot.install()
  }
};
