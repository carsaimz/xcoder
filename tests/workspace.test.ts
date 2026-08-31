import { describe, expect, it } from 'vitest';
import { Workspace } from '../src/core/file';
import { MemoryBackend } from '../src/core/file/memory';
import { BrowserBackend } from '../src/core/file/browser';
import { FsError } from '../src/core/file/types';

function makeWs(): Workspace {
  const ws = new Workspace();
  ws.mount(new MemoryBackend(), { root: 'file:///', label: 'test' });
  return ws;
}

describe('memory backend', () => {
  it('write/read/list/delete with mkdirs', async () => {
    const ws = makeWs();
    await ws.writeFile('file:///src/main.ts', 'console.log(1)');
    expect(await ws.readText('file:///src/main.ts')).toBe('console.log(1)');
    const entries = await ws.listdir('file:///src');
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('file:///src/main.ts');
    await ws.delete('file:///src/main.ts');
    expect(await ws.exists('file:///src/main.ts')).toBe(false);
    expect(await ws.exists('file:///src')).toBe(true);
  });

  it('mkdir + delete recursive + ENOTEMPTY', async () => {
    const ws = makeWs();
    await ws.mkdir('file:///a/b');
    await ws.writeFile('file:///a/b/f.txt', 'x');
    await expect(ws.delete('file:///a/b')).rejects.toMatchObject({ code: 'ENOTEMPTY' });
    await ws.delete('file:///a/b', true);
    expect(await ws.exists('file:///a')).toBe(true);
  });

  it('rename moves file, errors on missing source (ENOENT)', async () => {
    const ws = makeWs();
    await ws.writeFile('file:///old.txt', 'hi');
    await ws.rename('file:///old.txt', 'file:///new.txt');
    expect(await ws.exists('file:///old.txt')).toBe(false);
    expect(await ws.readText('file:///new.txt')).toBe('hi');
    await expect(ws.rename('file:///nope', 'file:///x')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('delete missing throws ENOENT; read dir throws EISDIR', async () => {
    const ws = makeWs();
    await expect(ws.delete('file:///ghost')).rejects.toMatchObject({ code: 'ENOENT' });
    await ws.mkdir('file:///d');
    await expect(ws.readText('file:///d')).rejects.toMatchObject({ code: 'EISDIR' });
  });

  it('FsError carries codes', () => {
    const err = new FsError('x', 'ENOENT');
    expect(err.code).toBe('ENOENT');
    expect(err.name).toBe('FsError');
  });
});

describe('workspace (multi-root)', () => {
  it('routes by scheme and supports multiple roots', async () => {
    const ws = makeWs();
    const mem = new MemoryBackend('mem');
    ws.mount(mem, { root: 'mem:///', label: 'mem' });
    await ws.writeFile('file:///f.txt', 'primary');
    await ws.writeFile('mem://g.txt', 'secondary');
    expect(await ws.readText('file:///f.txt')).toBe('primary');
    expect(await ws.readText('mem://g.txt')).toBe('secondary');
    expect(ws.listRoots().map((r) => r.label).sort()).toEqual(['mem', 'test']);
  });

  it('resolve falls back to primary backend for unknown scheme', async () => {
    const ws = makeWs();
    const resolved = ws.resolve('weird://x/y');
    expect(resolved.backend).toBeInstanceOf(MemoryBackend);
  });

  it('ensureDir creates nested parents', async () => {
    const ws = makeWs();
    await ws.ensureDir('file:///deep/nested/dir');
    expect(await ws.exists('file:///deep/nested/dir')).toBe(true);
    await ws.writeFile('file:///deep/nested/dir/file.txt', '1');
    expect(await ws.exists('file:///deep/nested/dir/file.txt')).toBe(true);
  });

  it('search finds content matches with line numbers', async () => {
    const ws = makeWs();
    await ws.writeFile('file:///a.txt', 'hello world\nFOO bar\n');
    const hits = await ws.search('file:///', 'foo');
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
  });
});

describe('browser backend (IndexedDB KV emulation)', () => {
  it('behaves like a posix fs on top of the kv store', async () => {
    const ws = new Workspace();
    ws.mount(new BrowserBackend('test-fs'), { root: 'file:///', label: 'kv' });
    await ws.writeFile('file:///docs/readme.md', '# hi');
    expect(await ws.readText('file:///docs/readme.md')).toBe('# hi');
    const entries = await ws.listdir('file:///docs');
    expect(entries[0].path).toBe('file:///docs/readme.md');
    await ws.rename('file:///docs/readme.md', 'file:///docs/new.md');
    expect(await ws.exists('file:///docs/readme.md')).toBe(false);
    expect(await ws.readText('file:///docs/new.md')).toBe('# hi');
  });
});
