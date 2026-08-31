/**
 * Tests for the Task 3 feature modules: global search engine,
 * markdown renderer and the git summary structured API.
 */

import { describe, it, expect } from 'vitest';
import {
  compilePattern,
  findInContent,
  replaceInContent,
  searchWorkspace,
  groupByFile,
  DEFAULT_SEARCH_OPTIONS,
} from '../src/lib/searchEngine';
import { renderMarkdown, escapeHtml } from '../src/lib/markdown';
import { MemoryBackend, Workspace } from '../src/core/file';
import { Shell } from '../src/core/terminal/shell';

// ---- search engine ------------------------------------------------------------

describe('searchEngine', () => {
  it('compiles plain-text patterns case-insensitively by default', () => {
    const re = compilePattern('Hello', DEFAULT_SEARCH_OPTIONS)!;
    expect(re.test('say hello world')).toBe(true);
  });

  it('honors case sensitivity', () => {
    const re = compilePattern('Hello', { ...DEFAULT_SEARCH_OPTIONS, caseSensitive: true })!;
    expect(re.test('hello')).toBe(false);
    expect(re.test('Hello')).toBe(true);
  });

  it('escapes regex metacharacters in plain mode', () => {
    const re = compilePattern('a.b', DEFAULT_SEARCH_OPTIONS)!;
    expect(re.test('a.b')).toBe(true);
    expect(re.test('axb')).toBe(false);
  });

  it('supports user regex mode', () => {
    const re = compilePattern('a\\.b', { ...DEFAULT_SEARCH_OPTIONS, regex: true })!;
    expect(re.test('a.b')).toBe(true);
    expect(re.test('axb')).toBe(false);
  });

  it('rejects invalid regex', () => {
    expect(compilePattern('([unclosed', { ...DEFAULT_SEARCH_OPTIONS, regex: true })).toBeNull();
    expect(compilePattern('', DEFAULT_SEARCH_OPTIONS)).toBeNull();
  });

  it('supports whole-word matching', () => {
    const re = compilePattern('cat', { ...DEFAULT_SEARCH_OPTIONS, wholeWord: true })!;
    expect(re.test('cat')).toBe(true);
    expect(re.test('category')).toBe(false);
  });

  it('finds matches with line/column info', () => {
    const text = 'first line\nsecond line here\nthird';
    const re = compilePattern('line', DEFAULT_SEARCH_OPTIONS)!;
    const hits = findInContent(text, re);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ line: 1, column: 6 });
    expect(hits[1]).toMatchObject({ line: 2, column: 7 });
  });

  it('replaces all occurrences', () => {
    const re = compilePattern('foo', DEFAULT_SEARCH_OPTIONS)!;
    expect(replaceInContent('foo bar foo', re, 'baz')).toBe('baz bar baz');
  });

  it('walks a workspace and groups hits by file', async () => {
    const ws = new Workspace();
    ws.mount(new MemoryBackend(), { root: 'file:///', label: 'test' });
    await ws.writeFile('file:///src/a.ts', 'const alpha = 1;\n// alpha again');
    await ws.writeFile('file:///src/deep/b.ts', 'const beta = alpha;');
    await ws.writeFile('file:///README.md', '# alpha doc');
    await ws.ensureDir('file:///node_modules/pkg');
    await ws.writeFile('file:///node_modules/pkg/index.js', 'const alpha = "should be skipped";');

    const re = compilePattern('alpha', DEFAULT_SEARCH_OPTIONS)!;
    const hits = await searchWorkspace(ws, 'file:///', re);
    expect(hits.length).toBe(4);
    const groups = groupByFile(hits);
    expect(groups.size).toBe(3);
    expect(groups.get('file:///src/a.ts')).toHaveLength(2);
    expect(groups.get('file:///README.md')).toHaveLength(1);
    // node_modules must never be walked
    expect(hits.some((h) => h.file.includes('node_modules'))).toBe(false);
  });

  it('respects the abort signal', async () => {
    const ws = new Workspace();
    ws.mount(new MemoryBackend(), { root: 'file:///', label: 'test' });
    await ws.writeFile('file:///x.ts', 'needle');
    const re = compilePattern('needle', DEFAULT_SEARCH_OPTIONS)!;
    const hits = await searchWorkspace(ws, 'file:///', re, { signal: { aborted: true } });
    expect(hits).toHaveLength(0);
  });
});

// ---- markdown renderer ----------------------------------------------------------

describe('markdown renderer', () => {
  it('renders headings, emphasis and code', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** and *italic* and `code`');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('escapes raw HTML (XSS-safe)', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders fenced code blocks with language class', () => {
    const html = renderMarkdown('```ts\nconst x = 1 < 2;\n```');
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain('const x = 1 &lt; 2;');
  });

  it('renders lists including task lists', () => {
    const html = renderMarkdown('- one\n- [x] done\n- [ ] todo\n\n1. first\n2. second');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<input type="checkbox" disabled checked>');
    expect(html).toContain('<input type="checkbox" disabled>');
  });

  it('renders links and images with safe protocols only', () => {
    const html = renderMarkdown('[site](https://example.com) and ![pic](javascript:alert(1))');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).not.toContain('<img src="javascript:');
    expect(html).toContain('![pic](javascript:alert(1))'); // left as text
  });

  it('renders blockquotes recursively without double-escaping', () => {
    const html = renderMarkdown('> quote with <b>html</b>');
    expect(html).toContain('<blockquote>');
    expect(html).not.toContain('&amp;lt;');
    expect(html).toContain('&lt;b&gt;');
  });

  it('renders tables', () => {
    const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>a</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('escapeHtml covers all dangerous characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

// ---- git summary (visual git panel backend) ---------------------------------------

describe('GitStore.summary', () => {
  it('returns isRepo:false when there is no repository', async () => {
    const ws = new Workspace();
    ws.mount(new MemoryBackend(), { root: 'file:///', label: 'test' });
    const shell = new Shell(ws);
    const summary = await shell.git('file:///').summary();
    expect(summary.isRepo).toBe(false);
  });

  it('reports branch, staged, unstaged and untracked files', async () => {
    const ws = new Workspace();
    ws.mount(new MemoryBackend(), { root: 'file:///', label: 'test' });
    const shell = new Shell(ws);
    await ws.writeFile('file:///initial.txt', 'base');
    await shell.run('git init');
    await shell.run('git add .');
    await shell.run('git commit -m "chore: initial"');

    let summary = await shell.git('file:///').summary();
    expect(summary.isRepo).toBe(true);
    expect(summary.branch).toBe('main');
    expect(summary.commits).toBe(1);
    expect(summary.staged).toHaveLength(0);
    expect(summary.untracked).toHaveLength(0);

    // modify tracked file → unstaged
    await ws.writeFile('file:///initial.txt', 'base v2');
    // create new file → untracked
    await ws.writeFile('file:///new.ts', 'export {};');
    summary = await shell.git('file:///').summary();
    expect(summary.unstaged).toEqual([{ path: 'initial.txt', kind: 'modified' }]);
    expect(summary.untracked).toEqual(['new.ts']);

    // stage everything → staged, no unstaged/untracked
    await shell.run('git add .');
    summary = await shell.git('file:///').summary();
    expect(summary.staged.map((s) => s.path).sort()).toEqual(['initial.txt', 'new.ts']);
    expect(summary.unstaged).toHaveLength(0);
    expect(summary.untracked).toHaveLength(0);

    // commit → clean tree
    await shell.run('git commit -m "feat: update initial + add new"');
    summary = await shell.git('file:///').summary();
    expect(summary.commits).toBe(2);
    expect(summary.staged).toHaveLength(0);
    expect(summary.unstaged).toHaveLength(0);
    expect(summary.untracked).toHaveLength(0);
  });
});
