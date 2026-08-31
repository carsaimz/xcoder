import { describe, expect, it, beforeEach } from 'vitest';
import { CommandRegistry } from '../src/api/commands';
import { settings } from '../src/api/settings';
import { buildFacade } from '../src/api/registry';
import { Workspace } from '../src/core/file';
import { MemoryBackend } from '../src/core/file/memory';
import { Shell } from '../src/core/terminal/shell';
import { PRESETS } from '../src/core/ai/presets';
import { providers } from '../src/core/ai';

describe('command registry', () => {
  it('register/execute/list/unregister', async () => {
    const reg = new CommandRegistry();
    let ran = 0;
    reg.register({ id: 'test.hello', label: 'Hello', run: () => { ran++; } });
    expect(reg.has('test.hello')).toBe(true);
    await reg.execute('test.hello');
    expect(ran).toBe(1);
    expect(reg.list()).toHaveLength(1);
    reg.unregister('test.hello');
    await expect(reg.execute('test.hello')).rejects.toThrow('not found');
  });

  it('when() filters list', () => {
    const reg = new CommandRegistry();
    reg.register({ id: 'a', label: 'A', run: () => undefined, when: () => false });
    reg.register({ id: 'b', label: 'B', run: () => undefined });
    expect(reg.list().map((c) => c.id)).toEqual(['b']);
  });
});

describe('settings', () => {
  beforeEach(async () => {
    await settings.reset();
  });

  it('defaults and set()', async () => {
    expect(settings.get('theme')).toBe('dark');
    await settings.set('tabSize', 2);
    expect(settings.get('tabSize')).toBe(2);
    expect(settings.get('wordWrap')).toBe(true);
  });

  it('agent settings shape', async () => {
    await settings.set('agent', { permissionMode: 'auto', maxSteps: 12, activeProfileId: null });
    expect(settings.get('agent').permissionMode).toBe('auto');
    expect(settings.get('agent').maxSteps).toBe(12);
  });
});

describe('xcoder.require facade', () => {
  let shell: Shell;

  beforeEach(() => {
    const ws = new Workspace();
    ws.mount(new MemoryBackend(), { root: 'file:///', label: 'test' });
    shell = new Shell(ws);
  });

  it('exposes the facade object with core modules', () => {
    const reg = buildFacade({ shell });
    for (const name of ['path', 'fs', 'editor', 'shell', 'agents', 'ai', 'commands', 'settings', 'plugins', 'version']) {
      expect(reg.modules()).toContain(name);
    }
  });

  it('require returns the module (not a namespace) — regression fix', () => {
    const reg = buildFacade({ shell });
    const path = reg.require('path') as typeof import('../src/lib/path');
    expect(typeof path.join).toBe('function');
    const fsModule = reg.require('fs') as Workspace;
    expect(typeof fsModule.readFile).toBe('function');
  });

  it('unknown module throws with helpful list', () => {
    const reg = buildFacade({ shell });
    expect(() => reg.require('nope')).toThrow(/unknown module "nope"/);
  });

  it('ai facade exposes presets grouped in 3 sets', () => {
    const reg = buildFacade({ shell });
    const ai = reg.require('ai') as { presets: typeof PRESETS; providers: typeof providers };
    const groups = new Set(ai.presets.map((p) => p.group));
    expect(groups).toEqual(new Set(['free', 'freemium', 'premium']));
    expect(ai.providers).toBe(providers);
  });
});
