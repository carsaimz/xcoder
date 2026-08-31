/**
 * Tests for agent tools — file CRUD, edit semantics, listing, search and the
 * git command builder, over an in-memory backend.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { executeTool, gitActionRisk, toolRisk, AI_TOOLS, type AgentToolEnv } from '../src/core/ai/tools';
import { MemoryBackend } from '../src/core/file/backend-memory';
import { registerBackend } from '../src/core/file/fs';
import { workspace } from '../src/core/file/workspace';

const env: AgentToolEnv = {
  async runCommand(line: string) {
    return { code: 0, output: `RAN:${line}` };
  },
  async askUser() {
    return 'user-answer';
  },
  async spawnSubagent(agentId: string, task: string) {
    return `SUB:${agentId}:${task}`;
  },
  cwdUrl: () => 'memory:///home',
  activeUrl: () => 'memory:///home/proj/main.ts',
  activeSelection: () => 'const x = 1;'
};

beforeAll(async () => {
  const mem = new MemoryBackend();
  mem.seed({
    '/home/proj/main.ts': 'function a() {\n  return 1;\n}\n\nfunction b() {\n  return a();\n}\n',
    '/home/proj/README.md': '# demo\nhello world',
    '/home/proj/src/deep/util.ts': 'export const k = 2;\n'
  });
  registerBackend(mem);
  if (!workspace.listFolders().includes('memory:///home')) {
    await workspace.addFolder('memory:///home');
  }
});

describe('tools catalogue', () => {
  it('defines schemas with required fields and risks', () => {
    expect(AI_TOOLS.length).toBeGreaterThanOrEqual(12);
    for (const t of AI_TOOLS) {
      expect(t.spec.name).toMatch(/^[a-z_]+$/);
      expect(['safe', 'write', 'exec', 'danger']).toContain(t.risk);
      expect((t.spec.parameters as { type: string }).type).toBe('object');
    }
    expect(toolRisk('delete_path')).toBe('danger');
    expect(toolRisk('run_command')).toBe('exec');
    expect(gitActionRisk('status')).toBe('safe');
    expect(gitActionRisk('commit')).toBe('write');
    expect(gitActionRisk('push')).toBe('exec');
  });
});

describe('file tools', () => {
  it('reads files with numbered lines and pagination', async () => {
    const out = await executeTool('read_file', { path: 'proj/main.ts', limit: 5 }, env);
    expect(out).toContain('memory:///home/proj/main.ts (7 lines)');
    expect(out).toContain('1| function a() {');
    expect(out).toContain('… (2 more lines — use offset)');

    const page2 = await executeTool('read_file', { path: 'proj/main.ts', offset: 5 }, env);
    expect(page2).toContain('5| function b() {');
  });

  it('lists a directory tree skipping heavy folders', async () => {
    const tree = await executeTool('list_dir', { path: 'proj', depth: 3 }, env);
    expect(tree).toContain('proj');
    expect(tree).toContain('src/');
    expect(tree).toContain('util.ts');
  });

  it('searches names and contents', async () => {
    const hits = await executeTool('search_code', { query: 'util' }, env);
    expect(hits).toContain('util.ts');
    const content = await executeTool('search_code', { query: 'hello world' }, env);
    expect(content).toContain('README.md');
  });

  it('creates files and fails on duplicates', async () => {
    const out = await executeTool('create_file', { path: 'proj/new.ts', content: 'export {};' }, env);
    expect(out).toContain('Created memory:///home/proj/new.ts');
    await expect(
      executeTool('create_file', { path: 'proj/new.ts', content: '' }, env)
    ).rejects.toThrow();
  });

  it('edits with exact replacement and uniqueness guard', async () => {
    const ok = await executeTool(
      'edit_file',
      { path: 'proj/main.ts', old_text: 'function a() {', new_text: 'function alpha() {' },
      env
    );
    expect(ok).toMatch(/\+1 -1 lines/);

    const miss = await executeTool(
      'edit_file',
      { path: 'proj/main.ts', old_text: 'NOT PRESENT', new_text: 'x' },
      env
    );
    expect(miss).toContain('ERROR: old_text not found');

    // two identical occurrences → must refuse without replace_all
    await executeTool(
      'create_file',
      { path: 'proj/twice.txt', content: 'dup\nmid\ndup' },
      env
    );
    const ambiguous = await executeTool(
      'edit_file',
      { path: 'proj/twice.txt', old_text: 'dup', new_text: 'x' },
      env
    );
    expect(ambiguous).toContain('matches multiple locations');

    const all = await executeTool(
      'edit_file',
      { path: 'proj/twice.txt', old_text: 'dup', new_text: 'x', replace_all: true },
      env
    );
    expect(all).toMatch(/Edited/);
  });

  it('moves and deletes paths', async () => {
    await executeTool('create_file', { path: 'proj/mv.txt', content: 'm' }, env);
    const moved = await executeTool('move_path', { from: 'proj/mv.txt', to: 'proj/mv2.txt' }, env);
    expect(moved).toContain('→');
    const del = await executeTool('delete_path', { path: 'proj/mv2.txt' }, env);
    expect(del).toContain('Deleted');
  });
});

describe('command & delegation tools', () => {
  it('runs shell commands through the env runner', async () => {
    const out = await executeTool('run_command', { command: 'echo hi' }, env);
    expect(out).toContain('exit code: 0');
    expect(out).toContain('RAN:echo hi');
  });

  it('builds git commands; commit uses -m flag', async () => {
    const out = await executeTool('git', { action: 'status' }, env);
    expect(out).toContain('RAN:git status');

    const commit = await executeTool('git', { action: 'commit', message: 'fix(core): bug' }, env);
    expect(commit).toContain('RAN:git commit -m "fix(core): bug"');

    const withArgs = await executeTool('git', { action: 'log', args: '--oneline' }, env);
    expect(withArgs).toContain('RAN:git log --oneline');
  });

  it('delegates to subagents and asks the user', async () => {
    const sub = await executeTool('spawn_subagent', { agent: 'reader', task: 'map repo' }, env);
    expect(sub).toBe('SUB:reader:map repo');

    const ans = await executeTool('ask_user', { question: 'which?' }, env);
    expect(ans).toBe('user-answer');
  });

  it('reads the editor selection', async () => {
    const out = await executeTool('read_selection', {}, env);
    expect(out).toContain('const x = 1;');
  });
});
