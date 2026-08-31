import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend } from '../src/core/file/backend-memory';
import * as fs from '../src/core/file/fs';
import { registerBackend } from '../src/core/file/fs';
import { VirtualShell, tokenize, parseInput, type ShellContext } from '../src/core/terminal/shell';

const TEST_SCHEME = 'memtest';

function makeShell(): { shell: VirtualShell; out: string[]; err: string[]; ctx: ShellContext } {
  const out: string[] = [];
  const err: string[] = [];
  const shell = new VirtualShell(`${TEST_SCHEME}:///home`);
  const ctx: ShellContext = {
    cwd: () => shell.cwd,
    setCwd: (u) => shell.setCwd(u),
    print: (t) => out.push(t),
    printErr: (t) => err.push(t),
    env: {}
  };
  return { shell, out, err, ctx };
}

let backend: MemoryBackend;

beforeEach(() => {
  backend = new MemoryBackend(TEST_SCHEME, 'Test FS');
  registerBackend(backend);
  backend.seed({
    '/home/README.md': '# Test\n',
    '/home/project/index.js': 'console.log("hi");\n',
    '/home/project/src/main.py': 'print("x")\n',
    '/home/project/package.json': '{"name":"project","scripts":{"start":"node index.js"},"dependencies":{}}'
  });
});

describe('tokenizer & parser', () => {
  it('tokenizes quotes', () => {
    expect(tokenize('echo "hello  world" x')).toEqual(['echo', 'hello  world', 'x']);
    expect(tokenize("git commit -m 'my message'")).toEqual(['git', 'commit', '-m', 'my message']);
  });

  it('parses boolean + value flags', () => {
    const parsed = parseInput(['ls', '-l', 'src'], new Set());
    expect(parsed).toEqual({ cmd: 'ls', args: ['src'], flags: { l: true } });

    const parsed2 = parseInput(['git', 'commit', '-m', 'msg'], new Set(['m']));
    expect(parsed2?.flags).toEqual({ m: 'msg' });

    const parsed3 = parseInput(['rm', '-rf', 'dir'], new Set());
    expect(parsed3?.flags).toEqual({ r: true, f: true });
  });
});

describe('virtual shell', () => {
  it('pwd / cd walk directories', async () => {
    const { shell, out, ctx } = makeShell();
    await shell.execute('pwd', ctx);
    expect(out[0]).toBe('memtest:///home');
    await shell.execute('cd project', ctx);
    await shell.execute('pwd', ctx);
    expect(out[1]).toBe('memtest:///home/project');
  });

  it('ls lists entries', async () => {
    const { shell, out, ctx } = makeShell();
    await shell.execute('ls', ctx);
    expect(out.join('\n')).toContain('project');
    expect(out.join('\n')).toContain('README.md');
  });

  it('cat reads files', async () => {
    const { shell, out, ctx } = makeShell();
    await shell.execute('cat README.md', ctx);
    expect(out[0]).toBe('# Test\n');
  });

  it('echo redirect writes files', async () => {
    const { shell, out, ctx } = makeShell();
    await shell.execute('echo hello world > /home/project/out.txt', ctx);
    const content = await backend.read('memtest:///home/project/out.txt');
    expect(content).toBe('hello world\n');
    await shell.execute('echo more >> /home/project/out.txt', ctx);
    expect(await backend.read('memtest:///home/project/out.txt')).toBe('hello world\nmore\n');
    void out;
  });

  it('mkdir + touch + rm lifecycle', async () => {
    const { shell, ctx } = makeShell();
    await shell.execute('mkdir /home/newdir', ctx);
    expect((await backend.stat('memtest:///home/newdir')).isDir).toBe(true);
    await shell.execute('touch /home/newdir/a.txt', ctx);
    expect(await fs.exists('memtest:///home/newdir/a.txt')).toBe(true);
    await shell.execute('rm /home/newdir/a.txt', ctx);
    expect(await fs.exists('memtest:///home/newdir/a.txt')).toBe(false);
    await shell.execute('rm -r /home/newdir', ctx);
    expect(await fs.exists('memtest:///home/newdir')).toBe(false);
  });

  it('grep finds lines with numbers', async () => {
    const { shell, out, ctx } = makeShell();
    const code = await shell.execute('grep log project/index.js', ctx);
    expect(code).toBe(0);
    expect(out[0]).toContain('project/index.js:1');
  });

  it('git init/add/commit/log roundtrip', async () => {
    const { out, ctx, shell } = makeShell();
    await shell.execute('cd project', ctx);
    await shell.execute('git init', ctx);
    await shell.execute('git add .', ctx);
    await shell.execute('git commit -m "first commit"', ctx);
    expect(out.join('\n')).toContain('first commit'); // ANSI-safe (branch name is bold)
    await shell.execute('git log', ctx);
    expect(out.join('\n')).toContain('first commit');
    // state persisted inside the repo
    expect(await fs.exists('memtest:///home/project/.git/xcoder-git.json')).toBe(true);
  });

  it('git status shows untracked vs clean', async () => {
    const { shell, out, err, ctx } = makeShell();
    await shell.execute('cd project', ctx);
    await shell.execute('git status', ctx);
    expect(err.join('\n')).toContain('not a git repository');
    out.length = 0;
    await shell.execute('git init', ctx);
    await shell.execute('git add .', ctx);
    await shell.execute('git commit -m x', ctx);
    out.length = 0;
    await shell.execute('git status', ctx);
    expect(out.join('\n')).toContain('working tree clean');
  });

  it('npm init/install/run', async () => {
    const { out, ctx, shell } = makeShell();
    await shell.execute('cd project', ctx);
    await shell.execute('npm install left-pad', ctx);
    expect(out.join('\n')).toContain('package(s) to dependencies');
    const pkg = JSON.parse(await backend.read('memtest:///home/project/package.json'));
    expect(pkg.dependencies['left-pad']).toBe('^1.0.0');
    await shell.execute('npm run start', ctx);
    expect(out.join('\n')).toContain('hi');
  });

  it('node -e evaluates JS', async () => {
    const { shell, out, ctx } = makeShell();
    await shell.execute('node -e "console.log(1+1)"', ctx);
    expect(out.join('\n')).toContain('2');
  });

  it('unknown commands return 127', async () => {
    const { err, ctx } = makeShell();
    const code = await makeShell().shell.execute('definitely-not-a-cmd', ctx);
    expect(code).toBe(127);
    expect(err.join(' ')).toContain('command not found');
  });

  it('history records lines', async () => {
    const { shell, ctx } = makeShell();
    await shell.execute('pwd', ctx);
    await shell.execute('date', ctx);
    expect(shell.getHistory()).toEqual(['pwd', 'date']);
  });
});
