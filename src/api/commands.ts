/** Global command registry feeding the command palette. */

import { bus } from '../lib/events';
import { t } from '../lib/i18n';

export interface Command {
  id: string;
  /** i18n key or literal; resolved at render time */
  label: string;
  icon?: string;
  keybinding?: string;
  /** hide from palette when false */
  when?: () => boolean;
  run: (...args: unknown[]) => void | Promise<void>;
}

export class CommandRegistry {
  private map = new Map<string, Command>();

  register(cmd: Command): () => void {
    if (this.map.has(cmd.id)) {
      console.warn(`[commands] duplicate id "${cmd.id}" overwritten`);
    }
    this.map.set(cmd.id, cmd);
    bus.emit('commands:changed', cmd);
    return () => this.unregister(cmd.id);
  }

  registerMany(cmds: Command[]): void {
    cmds.forEach((c) => this.register(c));
  }

  unregister(id: string): void {
    this.map.delete(id);
    bus.emit('commands:changed', null);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  get(id: string): Command | undefined {
    return this.map.get(id);
  }

  async execute(id: string, ...args: unknown[]): Promise<void> {
    const cmd = this.map.get(id);
    if (!cmd) throw new Error(`command not found: ${id}`);
    await cmd.run(...args);
  }

  list(): Command[] {
    return [...this.map.values()].filter((c) => !c.when || c.when());
  }

  /** Resolve the human label for palette rendering. */
  labelOf(cmd: Command): string {
    if (cmd.label.includes('.')) {
      const translated = t(cmd.label);
      if (translated !== cmd.label) return translated;
    }
    return cmd.label;
  }
}

export const commands = new CommandRegistry();
