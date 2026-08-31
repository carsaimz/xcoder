import { describe, expect, it, beforeEach } from 'vitest';
import { Workspace } from '../src/core/file';
import { MemoryBackend } from '../src/core/file/memory';
import { Shell } from '../src/core/terminal/shell';
import { TOOL_MAP } from '../src/core/agent/tools';
import { ToolContext } from '../src/core/agent/types';
import { analyzeFile } from '../src/core/agent/analyze';

let ctxSeq = 0;

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  ctxSeq++;
  const root = `file:///proj-${ctxSeq}-${Math.random().toString(36).slice(2, 7)}`;
  const ws = new Workspace();
  ws.mount(new MemoryBackend(), { root, label: 'proj' });
  const shell = new Shell(ws);
  return {
    fs: ws,
    shell,
    cwd: root,
    confirm: async () => true,
    emit: () => undefined,
    spawn: async () => 'ok',
    ...overrides,
  };
}

describe('agent tools — fs', () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = makeCtx();
  });

  it('fs.write + fs.read roundtrip', async () => {
    await TOOL_MAP.get('fs.write')!.run({ path: 'src/a.ts', content: 'export const a = 1;' }, ctx);
    const text = await TOOL_MAP.get('fs.read')!.run({ path: 'src/a.ts' }, ctx);
    expect(text).toContain('export const a = 1;');
  });

  it('fs.list marks dirs and files', async () => {
    await TOOL_MAP.get('fs.write')!.run({ path: 'x/f.txt', content: 'hi' }, ctx);
    await TOOL_MAP.get('fs.mkdir')!.run({ path: 'x/sub' }, ctx);
    const out = await TOOL_MAP.get('fs.list')!.run({ path: 'x' }, ctx);
    expect(out).toContain('[file] f.txt');
    expect(out).toContain('[dir] sub');
  });

  it('fs.delete respects recursive flag', async () => {
    await TOOL_MAP.get('fs.write')!.run({ path: 'd/f.txt', content: 'x' }, ctx);
    await expect(
      TOOL_MAP.get('fs.delete')!.run({ path: 'd' }, ctx),
    ).rejects.toThrow();
    await TOOL_MAP.get('fs.delete')!.run({ path: 'd', recursive: true }, ctx);
    expect((await ctx.fs.exists(ctx.cwd + '/d'))).toBe(false);
  });

  it('fs.search finds matches', async () => {
    await TOOL_MAP.get('fs.write')!.run({ path: 'a.txt', content: 'needle here' }, ctx);
    const out = await TOOL_MAP.get('fs.search')!.run({ query: 'needle' }, ctx);
    expect(out).toContain('a.txt:1');
  });
});

describe('agent tools — code.edit', () => {
  let ctx: ToolContext;
  beforeEach(async () => {
    ctx = makeCtx();
    await ctx.fs.writeFile(ctx.cwd + '/app.js', 'function add(a,b){return a+b;}\n// TODO improve\n');
  });

  it('applies find/replace edits', async () => {
    const out = await TOOL_MAP.get('code.edit')!.run(
      { path: 'app.js', edits: [{ find: 'function add', replace: 'const add =' }] },
      ctx,
    );
    expect(out).toContain('1 change');
    const text = await ctx.fs.readText(ctx.cwd + '/app.js');
    expect(text).toContain('const add =');
  });

  it('fails cleanly when pattern not found (no partial writes)', async () => {
    await expect(
      TOOL_MAP.get('code.edit')!.run(
        { path: 'app.js', edits: [{ find: 'DOES NOT EXIST', replace: 'x' }] },
        ctx,
      ),
    ).rejects.toThrow(/pattern not found/);
    const text = await ctx.fs.readText(ctx.cwd + '/app.js');
    expect(text).toContain('function add');
  });

  it('replaceAll handles multiple occurrences', async () => {
    await TOOL_MAP.get('code.edit')!.run(
      { path: 'app.js', edits: [{ find: 'a', replace: 'X', replaceAll: true }] },
      ctx,
    );
    const text = await ctx.fs.readText(ctx.cwd + '/app.js');
    expect(text).toContain('function Xdd(X,b)');
  });
});

describe('agent tools — git', () => {
  let ctx: ToolContext;
  beforeEach(async () => {
    ctx = makeCtx();
    await ctx.shell.run('git init');
  });

  it('status → add → commit → log', async () => {
    await ctx.fs.writeFile(ctx.cwd + '/index.js', 'console.log(1)');
    const statusEmpty = await TOOL_MAP.get('git.status')!.run({}, ctx);
    expect(statusEmpty).toContain('Untracked files');
    await TOOL_MAP.get('git.add')!.run({ paths: ['.'] }, ctx);
    const commit = await TOOL_MAP.get('git.commit')!.run({ message: 'feat: index' }, ctx);
    expect(commit).toContain('feat: index');
    const log = await TOOL_MAP.get('git.log')!.run({ limit: 5 }, ctx);
    expect(log).toContain('feat: index');
  });

  it('git ops fail outside a repository', async () => {
    const bare = makeCtx();
    await expect(TOOL_MAP.get('git.status')!.run({}, bare)).rejects.toThrow(/not a git repository/);
  });

  it('exec.run bash uses the virtual shell', async () => {
    const out = await TOOL_MAP.get('exec.run')!.run({ runtime: 'bash', command: 'echo agent-shell' }, ctx);
    expect(out).toContain('agent-shell');
  });

  it('exec.run js sandbox returns computed values', async () => {
    const out = await TOOL_MAP.get('exec.run')!.run({ runtime: 'js', code: 'console.log(21*2)' }, ctx);
    expect(out).toContain('42');
  });

  it('exec.run rejects unknown runtimes', async () => {
    await expect(TOOL_MAP.get('exec.run')!.run({ runtime: 'ruby' }, ctx)).rejects.toThrow(/unknown runtime/);
  });
});

describe('code analyzer', () => {
  it('extracts imports, functions, classes and TODOs from TS', async () => {
    const ws = new Workspace();
    ws.mount(new MemoryBackend(), { root: 'file:///', label: 'x' });
    await ws.writeFile(
      'file:///mod.ts',
      [
        "import { readText } from './lib';",
        'export class Parser {',
        '  parse() { return 1; }',
        '}',
        'export function helper(x: number) {',
        '  // TODO: validate x',
        '  return x;',
        '}',
      ].join('\n'),
    );
    const outline = await analyzeFile(ws, 'file:///mod.ts');
    expect(outline.language).toBe('ts');
    expect(outline.imports).toContain('./lib');
    expect(outline.classes).toContain('Parser');
    expect(outline.functions).toContain('helper');
    expect(outline.exports).toContain('Parser');
    expect(outline.todos.some((td) => td.includes('validate x'))).toBe(true);
  });

  it('handles unknown languages (only TODO scan)', async () => {
    const ws = new Workspace();
    ws.mount(new MemoryBackend(), { root: 'file:///', label: 'x' });
    await ws.writeFile('file:///notes.xyz', 'TODO find out\n');
    const outline = await analyzeFile(ws, 'file:///notes.xyz');
    expect(outline.language).toBe('xyz');
    expect(outline.todos).toHaveLength(1);
  });
});
