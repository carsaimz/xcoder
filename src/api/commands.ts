/**
 * Command registry — the backbone of the Command Palette, keybindings and
 * context menus. See docs/api-reference.md for the public contract.
 */

export interface Command {
  name: string; // namespaced: 'file.save', 'meu-plugin.ping'
  description: string;
  icon?: string;
  bindKey?: { win?: string; mac?: string };
  exec(...args: unknown[]): unknown | Promise<unknown>;
}

const registry = new Map<string, Command>();

export function addCommand(cmd: Command): void {
  if (!cmd.name || !cmd.name.includes('.') || /\s/.test(cmd.name)) {
    throw new Error(`[commands] invalid name "${cmd.name}" — use 'namespace.action'`);
  }
  if (typeof cmd.exec !== 'function') {
    throw new Error(`[commands] "${cmd.name}" must provide exec()`);
  }
  registry.set(cmd.name, { ...cmd });
}

export function removeCommand(name: string): void {
  registry.delete(name);
}

export function has(name: string): boolean {
  return registry.has(name);
}

export function list(): Command[] {
  return [...registry.values()];
}

export async function exec(name: string, ...args: unknown[]): Promise<unknown> {
  const cmd = registry.get(name);
  if (!cmd) throw new Error(`[commands] not found: ${name}`);
  return cmd.exec(...args);
}

// ---------------------------------------------------------------------------
// Keybinding matching (CodeMirror chord syntax: 'Ctrl-Shift-P', 'Command-Alt-M')
// ---------------------------------------------------------------------------

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright'
};

export function parseChord(chord: string): {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
} {
  let ctrl = false;
  let meta = false;
  let alt = false;
  let shift = false;
  let key = '';
  for (const partRaw of chord.split('-')) {
    const part = partRaw.toLowerCase();
    if (part === 'ctrl' || part === 'control') ctrl = true;
    else if (part === 'cmd' || part === 'command' || part === 'meta') meta = true;
    else if (part === 'alt' || part === 'option') alt = true;
    else if (part === 'shift') shift = true;
    else key = part;
  }
  return { ctrl, meta, alt, shift, key: KEY_ALIASES[key] ?? key };
}

/** Resolve a KeyboardEvent to a registered command with a matching bindKey. */
export function matchKeybinding(e: KeyboardEvent): Command | undefined {
  const key = KEY_ALIASES[e.key.toLowerCase()] ?? e.key.toLowerCase();
  for (const cmd of registry.values()) {
    if (!cmd.bindKey) continue;
    const chords = [cmd.bindKey.win, cmd.bindKey.mac].filter(Boolean) as string[];
    for (const chord of chords) {
      const p = parseChord(chord);
      if (
        p.key === key &&
        p.ctrl === e.ctrlKey &&
        p.meta === e.metaKey &&
        p.alt === e.altKey &&
        p.shift === e.shiftKey
      ) {
        return cmd;
      }
    }
  }
  return undefined;
}

/** Test-only: drop all commands. */
export function reset(): void {
  registry.clear();
}

/** Named API object (consumers: `import { commands } from '@api/commands'`). */
export const commands = { addCommand, removeCommand, exec, list, has };
