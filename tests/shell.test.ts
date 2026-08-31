import { describe, expect, it, beforeEach } from 'vitest';
import { Workspace } from '../src/core/file';
import { MemoryBackend } from '../src/core/file/memory';
import { Shell } from '../src/core/terminal/shell';

function makeShell(): Shell {
  const ws = new Workspace();
  ws.mount(new MemoryBackend(), { root: 'file:///proj', label: 'proj' });
  return new Shell(ws);
}

describe('virtual shell — basic commands', () => {
  let sh: Shell;
  beforeEach(() => {
    sh = makeShell();
  });

  it('pwd/cd/echo/ls/cat flow', async () => {
    await sh.run('mkdir -p docs');
    await sh.run('echo "hello world" > docs/a.txt');
    let out = await sh.run('ls docs');
    expect(out.stdout).toBe('a.txt');
    out = await sh.run('cat docs/a.txt');
    expect(out.stdout.trim()).toBe('hello world');
    expect((await sh.run('pwd')).stdout).toBe('file:///proj');
  });

  it('pipes: cat | grep | wc', async () => {
    await sh.run('echo "alpha\nbeta\ngamma" > p.txt');
    const out = await sh.run('cat p.txt | grep a | wc');
    const [lines] = out.stdout.trim().split(' ');
    expect(Number(lines)).toBe(3);
  });

  it('append redirect >>', async () => {
    await sh.run('echo one > f.txt');
    await sh.run('echo two >> f.txt');
    const out = await sh.run('cat f.txt');
    expect(out.stdout.trim().split('\n')).toEqual(['one', 'two']);
  });

  it('node -e runs sandboxed js with captured console', async () => {
    const out = await sh.run('node -e console.log(40+2)');
    expect(out.stdout.trim()).toBe('42');
  });

  it('unknown command fails with hint', async () => {
    const out = await sh.run('definitelynotacommand');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('command not found');
  });

  it('history records executed lines', async () => {
    await sh.run('echo hi');
    expect(sh.history).toContain('echo hi');
  });
});

describe('virtual shell — git state machine', () => {
  let sh: Shell;
  beforeEach(() => {
    sh = makeShell();
  });

  it('status before init fails, init succeeds', async () => {
    expect((await sh.run('git status')).code).toBe(1);
    const init = await sh.run('git init');
    expect(init.code).toBe(0);
    expect(init.stdout).toContain('Initialized');
  });

  it('add + commit + log + status clean', async () => {
    await sh.run('git init');
    await sh.run('echo "print(1)" > app.py');
    await sh.run('git add .');
    const st = await sh.run('git status');
    expect(st.stdout).toContain('new file:   app.py');
    const commit = await sh.run('git commit -m "feat: first commit"');
    expect(commit.stdout).toMatch(/\[main [0-9a-f]{7}\] feat: first commit/);
    const log = await sh.run('git log --oneline');
    expect(log.stdout).toContain('feat: first commit');
    const st2 = await sh.run('git status');
    expect(st2.stdout).toContain('nothing to commit, working tree clean');
  });

  it('commit without -m errors (regression: flag parsing)', async () => {
    await sh.run('git init');
    await sh.run('echo x > f.txt');
    await sh.run('git add .');
    const out = await sh.run('git commit');
    expect(out.code).toBe(1);
    expect(out.stderr).toContain('no message');
  });

  it('tracks modifications and diff', async () => {
    await sh.run('git init');
    await sh.run('echo v1 > f.txt');
    await sh.run('git add .');
    await sh.run('git commit -m "c1"');
    await sh.run('echo v2 > f.txt');
    const st = await sh.run('git status');
    expect(st.stdout).toContain('modified:   f.txt');
    const diff = await sh.run('git diff');
    expect(diff.stdout).toContain('+ v2');
  });

  it('branch + checkout materializes files', async () => {
    await sh.run('git init');
    await sh.run('echo base > base.txt');
    await sh.run('git add .');
    await sh.run('git commit -m "base"');
    await sh.run('git checkout -b feature');
    await sh.run('echo feat > feat.txt');
    await sh.run('git add .');
    await sh.run('git commit -m "feat commit"');
    await sh.run('git checkout main');
    const ls = await sh.run('ls');
    expect(ls.stdout).toContain('base.txt');
    expect(ls.stdout).not.toContain('feat.txt');
    await sh.run('git checkout feature');
    expect((await sh.run('ls')).stdout).toContain('feat.txt');
  });

  it('merge fast-forwards and reports up-to-date', async () => {
    await sh.run('git init');
    await sh.run('echo a > a.txt');
    await sh.run('git add .');
    await sh.run('git commit -m "a"');
    await sh.run('git checkout -b dev');
    await sh.run('echo b > b.txt');
    await sh.run('git add .');
    await sh.run('git commit -m "b"');
    await sh.run('git checkout main');
    const merge = await sh.run('git merge dev');
    expect(merge.stdout).toContain('Fast-forward');
    expect((await sh.run('ls')).stdout).toContain('b.txt');
    const again = await sh.run('git merge dev');
    expect(again.stdout).toContain('Already up to date');
  });

  it('remote/push/pull/clone mocks', async () => {
    await sh.run('git init');
    await sh.run('git remote add origin https://github.com/carsaimz/xcoder.git');
    const remotes = await sh.run('git remote -v');
    expect(remotes.stdout).toContain('origin');
    const push = await sh.run('git push');
    expect(push.stdout).toContain('Pushed');
    const clone = await sh.run('git clone https://github.com/x/y.git');
    expect(clone.stdout).toContain("Cloned into 'y'");
  });

  it('git state persists across shell instances (xcoder-git.json)', async () => {
    await sh.run('git init');
    await sh.run('echo data > d.txt');
    await sh.run('git add .');
    await sh.run('git commit -m "persist me"');
    const sh2 = new Shell((sh as unknown as { workspace: Workspace }).workspace);
    const log = await sh2.run('git log --oneline');
    expect(log.stdout).toContain('persist me');
  });
});
