import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCommand,
  removeCommand,
  exec,
  list,
  has,
  matchKeybinding,
  parseChord,
  reset
} from '../src/api/commands';
import type { Command } from '../src/api/commands';

describe('api/commands', () => {
  beforeEach(() => reset());

  it('rejects invalid names', () => {
    expect(() => addCommand({ name: 'noseconds', description: 'x', exec: () => 0 })).toThrow();
    expect(() => addCommand({ name: 'has space', description: 'x', exec: () => 0 })).toThrow();
  });

  it('registers, lists, executes, removes', async () => {
    const cmd: Command = {
      name: 'test.ping',
      description: 'Ping',
      exec: () => 'pong'
    };
    addCommand(cmd);
    expect(has('test.ping')).toBe(true);
    expect(list().map((c) => c.name)).toContain('test.ping');
    await expect(exec('test.ping')).resolves.toBe('pong');
    removeCommand('test.ping');
    expect(has('test.ping')).toBe(false);
    await expect(exec('test.ping')).rejects.toThrow('not found');
  });

  it('re-registering replaces', async () => {
    addCommand({ name: 'test.x', description: 'a', exec: () => 1 });
    addCommand({ name: 'test.x', description: 'b', exec: () => 2 });
    expect(list().filter((c) => c.name === 'test.x')).toHaveLength(1);
    await expect(exec('test.x')).resolves.toBe(2);
  });

  it('parses chords', () => {
    expect(parseChord('Ctrl-Shift-P')).toEqual({ ctrl: true, meta: false, alt: false, shift: true, key: 'p' });
    expect(parseChord('Command-Alt-M')).toEqual({ ctrl: false, meta: true, alt: true, shift: false, key: 'm' });
    expect(parseChord('Ctrl-`').key).toBe('`');
  });

  it('matches keybindings from events', () => {
    addCommand({
      name: 'test.save',
      description: 'Save',
      bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
      exec: () => 0
    });
    const event = (overrides: Partial<KeyboardEvent>) =>
      ({
        key: 's',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        ...overrides
      }) as KeyboardEvent;
    expect(matchKeybinding(event({}))?.name).toBe('test.save');
    expect(matchKeybinding(event({ key: 'S', shiftKey: true }))).toBeUndefined(); // shift not in chord
    expect(matchKeybinding(event({ ctrlKey: false }))).toBeUndefined();
    expect(matchKeybinding(event({ metaKey: true, ctrlKey: false }))?.name).toBe('test.save'); // mac chord
    expect(matchKeybinding(event({ ctrlKey: false, metaKey: false }))).toBeUndefined();
  });
});
