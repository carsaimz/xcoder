/**
 * Virtual shell — a sandboxed terminal running on top of the workspace FS.
 * Includes a full git state machine persisted per repository root, output
 * redirection and pipes, and an extensible command registry (plugins and the
 * AI agent add their own commands).
 */

import { storage } from '../../lib/storage';
import * as path from '../../lib/path';
import { FsError } from '../file/types';
import { Workspace } from '../file';

export interface ShellOutput {
  stdout: string;
  stderr: string;
  code: number;
}

const OK = (stdout = ''): ShellOutput => ({ stdout, stderr: '', code: 0 });
const FAIL = (stderr: string, code = 1): ShellOutput => ({ stdout: '', stderr, code });

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/* ------------------------------------------------------------------ git ---- */

interface CommitNode {
  id: string;
  message: string;
  ts: number;
  parents: string[];
  /** path → file content (null value = file was deleted in this tree) */
  tree: Record<string, string>;
}

interface GitState {
  version: 1;
  root: string;
  branch: string;
  branches: Record<string, { head: string | null }>;
  commits: Record<string, CommitNode>;
  /** staged changes: path → new content; null = deletion staged */
  staged: Record<string, string | null>;
  remote: { name: string; url: string } | null;
  pushed: boolean;
  config: { 'user.name'?: string; 'user.email'?: string };
}

const DELETED = null;

export class GitStore {
  private state: GitState | null = null;
  constructor(private workspace: Workspace, private root: string) {}

  get key(): string {
    return `git:${path.stripScheme(this.root)}`;
  }

  async load(): Promise<GitState | null> {
    if (this.state) return this.state;
    this.state = (await storage.get<GitState>(this.key)) ?? null;
    return this.state;
  }

  private async save(): Promise<void> {
    if (this.state) await storage.set(this.key, this.state);
  }

  async isRepo(): Promise<boolean> {
    return (await this.load()) !== null;
  }

  async init(opts?: { defaultBranch?: string }): Promise<ShellOutput> {
    if (await this.isRepo()) return OK(`Reinitialized existing Git repository in ${this.root}`);
    const branch = opts?.defaultBranch ?? 'main';
    this.state = {
      version: 1,
      root: this.root,
      branch,
      branches: { [branch]: { head: null } },
      commits: {},
      staged: {},
      remote: null,
      pushed: false,
      config: { 'user.name': 'XCoder User', 'user.email': 'user@xcoder.local' },
    };
    await this.save();
    return OK(`Initialized empty Git repository in ${this.root} (.git/xcoder-git.json)\nbranch: ${branch}`);
  }

  private require(): GitState {
    if (!this.state) throw new Error(`not a git repository: ${this.root}`);
    return this.state;
  }

  /** List workspace files under root (relative POSIX paths). */
  async worktreeFiles(): Promise<string[]> {
    const out: string[] = [];
    const rootPath = path.stripScheme(this.root).replace(/\/+$/, '');
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 10) return;
      let entries;
      try {
        entries = await this.workspace.listdir(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (path.basename(entry.path) === '.git' && depth === 0) continue;
        if (entry.isDir) {
          if (['node_modules', '.git', 'www', 'dist', 'coverage'].includes(path.basename(entry.path))) continue;
          await walk(entry.path, depth + 1);
        } else {
          const abs = path.stripScheme(entry.path);
          out.push(rootPath ? abs.slice(rootPath.length + 1) : abs.slice(1));
        }
      }
    };
    await walk(this.root, 0);
    return out.sort();
  }

  async status(): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL(`fatal: not a git repository (${this.root})`);
    const head = st.branches[st.branch]?.head;
    const headTree = head ? st.commits[head]?.tree ?? {} : {};
    const files = await this.worktreeFiles();
    const lines: string[] = [`On branch ${st.branch}`];
    if (st.remote && !st.pushed) lines.push(`Your branch is ahead of '${st.remote.name}/${st.branch}' (use git push to publish)`);
    const stagedEntries: string[] = [];
    const unstagedEntries: string[] = [];
    const untracked: string[] = [];

    for (const [p, content] of Object.entries(st.staged)) {
      if (content === DELETED) {
        stagedEntries.push(`deleted:    ${p}`);
      } else if (!(p in headTree)) {
        stagedEntries.push(`new file:   ${p}`);
      } else if (hash(headTree[p]) !== hash(content)) {
        stagedEntries.push(`modified:   ${p}`);
      } else {
        delete st.staged[p];
      }
    }
    const indexed = new Set([...Object.keys(headTree), ...Object.keys(st.staged).filter((k) => st.staged[k] !== DELETED)]);
    for (const p of indexed) {
      const stagedContent = st.staged[p] ?? (p in headTree ? headTree[p] : undefined);
      let workContent: string | undefined;
      try {
        workContent = (await this.workspace.readText(path.join(this.root, p))) as string;
      } catch {
        workContent = undefined;
      }
      if (workContent === undefined) {
        if (st.staged[p] === undefined) unstagedEntries.push(`deleted:    ${p}`);
      } else if (stagedContent !== undefined && hash(stagedContent) !== hash(workContent)) {
        unstagedEntries.push(`modified:   ${p}`);
      }
    }
    for (const p of files) {
      if (!(p in headTree) && !(p in st.staged)) untracked.push(p);
    }

    if (stagedEntries.length) {
      lines.push('Changes to be committed:');
      stagedEntries.forEach((l) => lines.push(`        ${l}`));
    }
    if (unstagedEntries.length) {
      lines.push('Changes not staged for commit:');
      unstagedEntries.forEach((l) => lines.push(`        ${l}`));
    }
    if (untracked.length) {
      lines.push('Untracked files:');
      untracked.forEach((l) => lines.push(`        ${l}`));
    }
    if (!stagedEntries.length && !unstagedEntries.length && !untracked.length) {
      lines.push('nothing to commit, working tree clean');
    }
    await this.save();
    return OK(lines.join('\n'));
  }

  async add(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const targets = args.filter((a) => !a.startsWith('-'));
    if (!targets.length) return FAIL('Nothing specified, nothing added. Usage: git add <path|.|--all>');
    const addAll = targets.includes('.') || targets.includes('--all') || targets.includes('-A');
    const files = await this.worktreeFiles();
    let count = 0;
    for (const rel of files) {
      const match =
        addAll ||
        targets.some((t) => rel === t || rel.startsWith(`${t}/`) || new RegExp(`^${t.replace(/\*/g, '.*')}$`).test(rel));
      if (!match) continue;
      try {
        const content = (await this.workspace.readText(path.join(this.root, rel))) as string;
        st.staged[rel] = content;
        count++;
      } catch {
        st.staged[rel] = DELETED;
      }
    }
    if (!addAll) {
      // staged deletions: targets that no longer exist in the worktree
      const headTree = st.commits[st.branches[st.branch]?.head ?? '']?.tree ?? {};
      for (const rel of Object.keys(headTree)) {
        if (targets.some((t) => rel === t || rel.startsWith(`${t}/`)) && !files.includes(rel)) {
          st.staged[rel] = DELETED;
          count++;
        }
      }
    }
    await this.save();
    if (!count) return FAIL(`pathspec '${targets.join(' ')}' did not match any files`, 0);
    return OK(`staged ${count} file(s)`);
  }

  async rm(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const targets = args.filter((a) => !a.startsWith('-'));
    let count = 0;
    for (const t of targets) {
      try {
        await this.workspace.delete(path.join(this.root, t), args.includes('-r'));
        st.staged[t] = DELETED;
        count++;
      } catch (err) {
        return FAIL(`git rm: ${(err as Error).message}`);
      }
    }
    await this.save();
    return count ? OK(`removed ${count} file(s)`) : FAIL(`pathspec '${targets.join(' ')}' did not match any files`);
  }

  async commit(opts: { message?: string; flags?: Record<string, string | boolean> }): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const message = opts.message ?? (typeof opts.flags?.m === 'string' ? opts.flags.m : undefined);
    if (!message) return FAIL('Aborting commit: no message provided (use git commit -m "message")');
    const stagedEntries = Object.entries(st.staged);
    if (!stagedEntries.length) return FAIL('nothing to commit, working tree clean (use git add first)', 0);
    const head = st.branches[st.branch]?.head ?? null;
    const baseTree: Record<string, string> = head ? { ...st.commits[head].tree } : {};
    for (const [p, content] of stagedEntries) {
      if (content === DELETED) delete baseTree[p];
      else baseTree[p] = content;
    }
    const id = hash(`${message}:${Date.now()}:${JSON.stringify(Object.keys(baseTree))}`);
    st.commits[id] = {
      id,
      message,
      ts: Date.now(),
      parents: head ? [head] : [],
      tree: baseTree,
    };
    st.branches[st.branch].head = id;
    st.staged = {};
    await this.save();
    const files = stagedEntries.length;
    return OK(
      `[${st.branch} ${id.slice(0, 7)}] ${message}\n ${files} file(s) changed`,
    );
  }

  async log(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const head = st.branches[st.branch]?.head;
    if (!head) return FAIL('fatal: your current branch does not have any commits yet', 0);
    const oneline = args.includes('--oneline');
    const limitFlag = args.indexOf('-n');
    const limit = limitFlag >= 0 ? Number(args[limitFlag + 1]) || 20 : 20;
    const lines: string[] = [];
    let cur: string | null = head;
    while (cur && lines.length < limit * 3) {
      const commit: CommitNode | undefined = st.commits[cur];
      if (!commit) break;
      if (oneline) {
        lines.push(`${commit.id.slice(0, 7)} ${commit.message}`);
      } else {
        lines.push(`commit ${commit.id}`);
        lines.push(`Author: ${st.config['user.name'] ?? 'unknown'} <${st.config['user.email'] ?? ''}>`);
        lines.push(`Date:   ${new Date(commit.ts).toISOString()}`);
        lines.push('');
        commit.message.split('\n').forEach((l: string) => lines.push(`    ${l}`));
        lines.push('');
      }
      cur = commit.parents[0] ?? null;
    }
    return OK(lines.join('\n'));
  }

  async diff(): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const head = st.branches[st.branch]?.head;
    const headTree: Record<string, string> = head ? st.commits[head].tree : {};
    const out: string[] = [];
    const files = await this.worktreeFiles();
    const all = new Set([...Object.keys(headTree), ...files]);
    for (const rel of [...all].sort()) {
      const oldContent = headTree[rel];
      let newContent: string | undefined;
      try {
        newContent = (await this.workspace.readText(path.join(this.root, rel))) as string;
      } catch {
        newContent = undefined;
      }
      if (oldContent === newContent) continue;
      out.push(`diff --git a/${rel} b/${rel}`);
      if (oldContent === undefined) {
        out.push(`new file\n+++ ${newContent?.split('\n').length ?? 0} lines added`);
      } else if (newContent === undefined) {
        out.push(`deleted file\n--- ${oldContent.split('\n').length} lines removed`);
      } else {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        let changes = 0;
        for (let i = 0; i < Math.max(oldLines.length, newLines.length) && changes < 8; i++) {
          if (oldLines[i] !== newLines[i]) {
            if (oldLines[i] !== undefined) out.push(`- ${oldLines[i]}`);
            if (newLines[i] !== undefined) out.push(`+ ${newLines[i]}`);
            changes++;
          }
        }
        if (changes >= 8) out.push('  …');
      }
    }
    return OK(out.length ? out.join('\n') : 'no changes');
  }

  async branch(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const create = args.find((a) => !a.startsWith('-'));
    if (!create) {
      const lines = Object.keys(st.branches).map((b) => (b === st.branch ? `* ${b}` : `  ${b}`));
      return OK(lines.join('\n'));
    }
    if (st.branches[create]) return FAIL(`fatal: a branch named '${create}' already exists`);
    st.branches[create] = { head: st.branches[st.branch].head };
    await this.save();
    return OK(`created branch ${create}`);
  }

  async checkout(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    let name = args.find((a) => !a.startsWith('-'));
    const createFlag = args.includes('-b');
    if (!name) return FAIL('usage: git checkout [-b] <branch>');
    if (createFlag && !st.branches[name]) {
      st.branches[name] = { head: st.branches[st.branch].head };
    }
    if (!st.branches[name]) return FAIL(`error: pathspec '${name}' did not match any branch`);
    const target = st.branches[name].head;
    if (target) {
      const tree = st.commits[target].tree;
      // materialize the branch tree into the workspace
      const current = await this.worktreeFiles();
      for (const rel of current) {
        if (!(rel in tree)) {
          try {
            await this.workspace.delete(path.join(this.root, rel));
          } catch {
            /* ignore */
          }
        }
      }
      for (const [rel, content] of Object.entries(tree)) {
        await this.workspace.writeFile(path.join(this.root, rel), content);
      }
    }
    st.branch = name;
    st.staged = {};
    await this.save();
    return OK(`Switched to branch '${name}'`);
  }

  async merge(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const name = args.find((a) => !a.startsWith('-'));
    if (!name || !st.branches[name]) return FAIL(`merge: ${name ?? ''} - not something we can merge`);
    const theirs = st.branches[name].head;
    const ours = st.branches[st.branch].head;
    if (!theirs) return FAIL(`branch '${name}' has no commits`);
    if (!ours) return FAIL(`branch '${st.branch}' has no commits`);
    if (theirs === ours) return OK('Already up to date.');
    const isAncestor = (ancestor: string, of: string): boolean => {
      let cur: string | null = of;
      while (cur) {
        if (cur === ancestor) return true;
        cur = st.commits[cur]?.parents[0] ?? null;
      }
      return false;
    };
    if (isAncestor(theirs, ours)) return OK('Already up to date.');
    if (isAncestor(ours, theirs)) {
      // fast-forward: materialize the target tree into the worktree
      const tree = st.commits[theirs].tree;
      const current = await this.worktreeFiles();
      for (const rel of current) {
        if (!(rel in tree)) {
          try {
            await this.workspace.delete(path.join(this.root, rel));
          } catch {
            /* ignore */
          }
        }
      }
      for (const [rel, content] of Object.entries(tree)) {
        await this.workspace.writeFile(path.join(this.root, rel), content);
      }
      st.branches[st.branch].head = theirs;
      st.staged = {};
      await this.save();
      return OK(`Fast-forward to ${theirs.slice(0, 7)}`);
    }
    // three-way-ish merge: union of trees, conflicts keep HEAD content
    const ourTree = st.commits[ours].tree;
    const theirTree = st.commits[theirs].tree;
    const merged: Record<string, string> = { ...ourTree };
    let conflicts = 0;
    for (const [p, content] of Object.entries(theirTree)) {
      if (p in ourTree && ourTree[p] !== content) {
        conflicts++;
        continue;
      }
      merged[p] = content;
    }
    const id = hash(`merge:${theirs}:${ours}:${Date.now()}`);
    st.commits[id] = {
      id,
      message: `Merge branch '${name}'${conflicts ? ` (with ${conflicts} conflict(s) resolved keeping HEAD)` : ''}`,
      ts: Date.now(),
      parents: [ours, theirs],
      tree: merged,
    };
    st.branches[st.branch].head = id;
    await this.save();
    return OK(`Merge made by 'ort' strategy.${conflicts ? ` ${conflicts} conflict(s) resolved keeping HEAD.` : ''}`);
  }

  async remote(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const [sub, name, url] = args;
    if (!sub || sub === '-v') {
      return st.remote ? OK(`${st.remote.name}\t${st.remote.url} (fetch/push)`) : OK('(no remotes configured)');
    }
    if (sub === 'add' && name && url) {
      st.remote = { name, url };
      st.pushed = false;
      await this.save();
      return OK(`added remote ${name} → ${url}`);
    }
    return FAIL('usage: git remote add <name> <url>');
  }

  async push(): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    if (!st.remote) return FAIL('fatal: no configured push destination (git remote add origin <url>)');
    st.pushed = true;
    await this.save();
    return OK(`Pushed ${st.branch} → ${st.remote.name}/${st.branch} (sandboxed)`);
  }

  async pull(): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    return OK('Everything up to date. (sandboxed pull)');
  }

  async clone(url: string): Promise<ShellOutput> {
    const name = (url.split('/').pop() ?? 'repo').replace(/\.git$/, '') || 'repo';
    const target = path.join(this.root, name);
    try {
      await this.workspace.mkdir(target);
    } catch (err) {
      if ((err as FsError).code !== 'EEXIST') return FAIL(`clone failed: ${(err as Error).message}`);
    }
    const sub = new GitStore(this.workspace, target);
    await sub.init();
    const readme = path.join(target, 'README.md');
    await this.workspace.writeFile(readme, `# ${name}\n\nCloned (sandboxed) from ${url}\n`);
    await sub.add(['.']);
    await sub.commit({ message: 'initial commit (sandboxed clone)' });
    await sub.remote(['add', 'origin', url]);
    return OK(`Cloned into '${name}' (sandboxed — content is not fetched)`);
  }

  async config(args: string[]): Promise<ShellOutput> {
    const st = await this.load();
    if (!st) return FAIL('fatal: not a git repository');
    const [key, value] = args.filter((a) => !a.startsWith('-'));
    if (!key) {
      return OK(
        Object.entries(st.config)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n'),
      );
    }
    if (value) {
      st.config[key as 'user.name'] = value;
      await this.save();
      return OK(`set ${key} = ${value}`);
    }
    const current = st.config[key as 'user.name'];
    return current ? OK(current) : FAIL(`undefined config key: ${key}`, 0);
  }
}

/* ----------------------------------------------------------------- shell ---- */

type CommandHandler = (
  args: string[],
  flags: Record<string, string | boolean>,
  raw: string,
  input?: string,
) => Promise<ShellOutput>;

export class Shell {
  cwd = '/';
  history: string[] = [];
  private commands = new Map<string, CommandHandler>();
  private gitCache = new Map<string, GitStore>();

  constructor(private workspace: Workspace) {
    this.registerBuiltins();
    this.cwd = workspace.cwd();
  }

  async init(): Promise<void> {
    const saved = await storage.get<string>('shell:cwd');
    const exists = saved ? await this.workspace.exists(saved).catch(() => false) : false;
    this.cwd = saved && exists ? saved : this.workspace.cwd();
  }

  /** Resolve a user path against the cwd (scheme aware). */
  resolveTarget(p: string): string {
    if (!p) return this.cwd;
    if (path.isAbsolute(p)) return path.normalize(p);
    return path.normalize(path.join(this.cwd, p));
  }

  git(root?: string): GitStore {
    const r = root ?? this.cwd;
    let store = this.gitCache.get(r);
    if (!store) {
      store = new GitStore(this.workspace, r);
      this.gitCache.set(r, store);
    }
    return store;
  }

  registerCommand(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler);
  }

  listCommands(): string[] {
    return [...this.commands.keys()].sort();
  }

  /** Tokenize respecting quotes, pipes and redirects. */
  private static tokenize(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let quote: '"' | "'" | null = null;
    for (const ch of line) {
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (/\s/.test(ch)) {
        if (cur) out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  private static splitPipes(line: string): string[] {
    const parts: string[] = [];
    let cur = '';
    let quote: string | null = null;
    for (const ch of line) {
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
      } else if (ch === '|') {
        parts.push(cur);
        cur = '';
      } else {
        cur += ch;
        if (ch === '"' || ch === "'") quote = ch;
      }
    }
    parts.push(cur);
    return parts.map((p) => p.trim()).filter(Boolean);
  }

  private static extractRedirect(tokens: string[]): { args: string[]; flags: Record<string, string | boolean>; redirect: { op: '>' | '>>'; target: string } | null } {
    const args: string[] = [];
    const flags: Record<string, string | boolean> = {};
    let redirect: { op: '>' | '>>'; target: string } | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === '>' || tok === '>>') {
        redirect = { op: tok, target: tokens[++i] ?? '' };
      } else if (tok.startsWith('--')) {
        const [, key, inlineValue] = tok.match(/^--([\w-]+)(?:=(.*))?$/) ?? [];
        if (!key) continue;
        if (inlineValue !== undefined) flags[key] = inlineValue;
        else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) flags[key] = tokens[++i];
        else flags[key] = true;
      } else {
        // short flags (-r, -i, -m …) stay in args; commands parse them like real getopt
        args.push(tok);
      }
    }
    return { args, flags, redirect };
  }

  async run(line: string): Promise<ShellOutput> {
    const trimmed = line.trim();
    if (trimmed) {
      this.history.push(trimmed);
      if (this.history.length > 200) this.history.shift();
    }
    if (!trimmed) return OK();
    if (trimmed === 'clear') return OK('__CLEAR__');
    const stages = Shell.splitPipes(trimmed);
    let input: ShellOutput = OK();
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const tokens = Shell.tokenize(stage);
      if (!tokens.length) continue;
      const [name, ...rest] = tokens;
      const { args, flags, redirect } = Shell.extractRedirect(rest);
      const handler = this.commands.get(name);
      if (!handler) {
        input = FAIL(`${name}: command not found (try 'help')`);
        break;
      }
      input = await handler(args, flags, stage, i > 0 ? input.stdout : undefined).catch((err: Error) =>
        FAIL(`${name}: ${err.message}`),
      );
      if (input.code !== 0 && input.stdout === '' && i < stages.length - 1) break;
      if (redirect && i === stages.length - 1) {
        const target = this.resolveTarget(redirect.target);
        try {
          await this.workspace.writeFile(target, input.stdout || input.stderr, { append: redirect.op === '>>', mkdirs: true });
          input = OK();
        } catch (err) {
          input = FAIL(`redirect failed: ${(err as Error).message}`);
        }
      }
    }
    return input;
  }

  /** Execute a multi-line script, stopping at the first non-zero exit. */
  async runScript(script: string): Promise<ShellOutput> {
    const lines = script.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    let last: ShellOutput = OK();
    for (const line of lines) {
      last = await this.run(line);
      if (last.code !== 0) return last;
    }
    return last;
  }

  /* --------------------------------------------------------- builtins ------ */

  private registerBuiltins(): void {
    const ws = this.workspace;

    this.registerCommand('help', async () => {
      const lines = [
        'XCoder shell — available commands:',
        '',
        '  files      ls cd pwd cat head tail grep wc touch mkdir rm cp mv open find',
        '  git        git init status add rm commit log diff branch checkout merge remote push pull clone config',
        '  tools      node python npm curl apk agent theme locale history whoami uname date echo',
        '  shell      help clear',
        '',
        'Redirect output with > and >>, pipe with | (grep, wc, head, tail).',
      ];
      return OK(lines.join('\n'));
    });

    this.registerCommand('echo', async (args) => OK(args.join(' ') + '\n'));
    this.registerCommand('pwd', async () => OK(this.cwd));

    this.registerCommand('cd', async (args) => {
      const target = this.resolveTarget(args[0] ?? '~');
      try {
        const stat = await ws.stat(target);
        if (!stat.isDir) return FAIL(`cd: ${target}: Not a directory`);
        this.cwd = target;
        await storage.set('shell:cwd', this.cwd);
        return OK();
      } catch {
        return FAIL(`cd: ${args[0]}: No such directory`);
      }
    });

    this.registerCommand('ls', async (args, flags) => {
      const target = this.resolveTarget(args[0] ?? '.');
      try {
        const entries = await ws.listdir(target);
        const showAll = args.includes('-a') || args.includes('-la');
        const long = args.includes('-l') || args.includes('-la');
        const visible = entries.filter((e) => showAll || !path.basename(e.path).startsWith('.'));
        if (long) {
          return OK(
            visible.map((e) => `${e.isDir ? 'd' : '-'}  ${String(e.size).padStart(8)}  ${path.basename(e.path)}`).join('\n'),
          );
        }
        return OK(visible.map((e) => (e.isDir ? `${path.basename(e.path)}/` : path.basename(e.path))).join('\n'));
      } catch {
        return FAIL(`ls: cannot access '${args[0] ?? '.'}': No such directory`);
      }
    });

    this.registerCommand('cat', async (args) => {
      if (!args.length) return FAIL('usage: cat <file>');
      const parts: string[] = [];
      for (const a of args) {
        try {
          parts.push((await ws.readText(this.resolveTarget(a))) as string);
        } catch {
          return FAIL(`cat: ${a}: No such file`);
        }
      }
      return OK(parts.join(''));
    });

    this.registerCommand('head', async (args, _flags, _raw, input) => {
      const n = Number(args.find((a) => /^-?\d+$/.test(a))) || 10;
      const file = args.find((a) => !/^-/.test(a) && !/^\d+$/.test(a)) ?? '';
      try {
        const text = file ? ((await ws.readText(this.resolveTarget(file))) as string) : (input ?? '');
        return OK(text.split('\n').slice(0, n).join('\n'));
      } catch {
        return FAIL(`head: ${file}: No such file`);
      }
    });

    this.registerCommand('tail', async (args, _flags, _raw, input) => {
      const n = Number(args.find((a) => /^-?\d+$/.test(a))) || 10;
      const file = args.find((a) => !/^-/.test(a) && !/^\d+$/.test(a)) ?? '';
      try {
        const text = file ? ((await ws.readText(this.resolveTarget(file))) as string) : (input ?? '');
        return OK(text.split('\n').slice(-n).join('\n'));
      } catch {
        return FAIL(`tail: ${file}: No such file`);
      }
    });

    this.registerCommand('grep', async (args, _flags, _raw, input) => {
      const pattern = args.find((a) => !a.startsWith('-'));
      if (!pattern) return FAIL('usage: grep <pattern> [file]');
      const files = args.filter((a) => a !== pattern && !a.startsWith('-'));
      const i = args.includes('-i');
      const re = new RegExp(pattern, i ? 'i' : '');
      const emit = (text: string, label?: string): string => {
        const lines = text.split('\n');
        return lines
          .map((l, idx) => ({ l, n: idx + 1 }))
          .filter(({ l }) => re.test(l))
          .map(({ l, n }) => (label ? `${label}:${n}: ${l}` : l))
          .join('\n');
      };
      if (files.length) {
        const chunks: string[] = [];
        for (const f of files) {
          try {
            chunks.push(emit((await ws.readText(this.resolveTarget(f))) as string, f));
          } catch {
            return FAIL(`grep: ${f}: No such file`);
          }
        }
        return OK(chunks.filter(Boolean).join('\n'));
      }
      return OK(emit(input ?? ''));
    });

    this.registerCommand('wc', async (args, _flags, _raw, input) => {
      const file = args.find((a) => !a.startsWith('-'));
      const text = file ? ((await ws.readText(this.resolveTarget(file)).catch(() => '')) as string) : (input ?? '');
      const lines = text ? text.split('\n').length : 0;
      const words = text.split(/\s+/).filter(Boolean).length;
      return OK(`${lines} ${words} ${text.length}`);
    });

    this.registerCommand('touch', async (args) => {
      for (const a of args) {
        const target = this.resolveTarget(a);
        if (!(await ws.exists(target))) await ws.writeFile(target, '');
      }
      return OK();
    });

    this.registerCommand('mkdir', async (args) => {
      for (const a of args.filter((x) => !x.startsWith('-'))) {
        try {
          await ws.mkdir(this.resolveTarget(a));
        } catch (err) {
          if ((err as FsError).code !== 'EEXIST' || !args.includes('-p')) return FAIL(`mkdir: ${a}: ${(err as Error).message}`);
        }
      }
      return OK();
    });

    this.registerCommand('rm', async (args) => {
      const targets = args.filter((a) => !a.startsWith('-'));
      const recursive = args.includes('-r') || args.includes('-rf');
      for (const a of targets) {
        try {
          await ws.delete(this.resolveTarget(a), recursive);
        } catch (err) {
          return FAIL(`rm: ${a}: ${(err as Error).message}`);
        }
      }
      return OK();
    });

    this.registerCommand('cp', async (args) => {
      const [src, dst] = args;
      if (!src || !dst) return FAIL('usage: cp <src> <dst>');
      try {
        const data = await ws.readText(this.resolveTarget(src));
        await ws.writeFile(this.resolveTarget(dst), data);
        return OK();
      } catch {
        return FAIL(`cp: cannot copy ${src}`);
      }
    });

    this.registerCommand('mv', async (args) => {
      const [src, dst] = args;
      if (!src || !dst) return FAIL('usage: mv <src> <dst>');
      try {
        const target = this.resolveTarget(dst);
        const srcStat = await ws.stat(this.resolveTarget(src));
        if (srcStat.isDir && (await ws.exists(target))) {
          await ws.rename(this.resolveTarget(src), path.join(target, path.basename(src)));
        } else {
          await ws.rename(this.resolveTarget(src), target);
        }
        return OK();
      } catch {
        return FAIL(`mv: cannot move ${src}`);
      }
    });

    this.registerCommand('open', async (args) => {
      const target = this.resolveTarget(args[0] ?? '');
      try {
        await ws.stat(target);
        const { bus } = await import('../../lib/events');
        bus.emit('shell:open', target);
        return OK(`opening ${target}`);
      } catch {
        return FAIL(`open: ${args[0]}: No such file`);
      }
    });

    this.registerCommand('date', async () => OK(new Date().toString()));
    this.registerCommand('whoami', async () => OK('xcoder'));
    this.registerCommand('uname', async () => OK('XCoder 1.1.0 web/x Siddhartha'));

    this.registerCommand('history', async () => OK(this.history.map((h, i) => `${i + 1}  ${h}`).join('\n')));

    this.registerCommand('node', async (args, flags, _raw, input) => {
      let code = '';
      if (args[0] === '-e') code = args.slice(1).join(' ');
      else if (flags.e) code = args.join(' ');
      else if (args[0]) {
        try {
          code = (await ws.readText(this.resolveTarget(args[0]))) as string;
        } catch {
          return FAIL(`node: cannot find module '${args[0]}'`);
        }
      } else if (input) code = input;
      else return FAIL('usage: node -e <code> | node <script.js>');
      return runJsSandbox(code);
    });

    this.registerCommand('python', async (args, flags, _raw, input) => {
      const { runPython } = await import('../agent/python');
      let code = '';
      if (args[0] === '-c') code = args.slice(1).join(' ');
      else if (flags.c) code = args.join(' ');
      else if (args[0]) {
        try {
          code = (await ws.readText(this.resolveTarget(args[0]))) as string;
        } catch {
          return FAIL(`python: cannot open file '${args[0]}'`);
        }
      } else if (input) code = input;
      else return OK('XCoder python sandbox (Pyodide). Usage: python -c "<code>"');
      const res = await runPython(code);
      return res.ok ? OK(res.output) : FAIL(res.output);
    });

    this.registerCommand('npm', async (args) => {
      const [sub, pkg] = args;
      if (sub === 'install' || sub === 'i') {
        return OK(pkg ? `added ${Math.floor(Math.random() * 120) + 12} packages in 1.4s (${pkg})\n sandboxed npm — no network access` : 'up to date, audited 0 packages');
      }
      if (sub === 'run' || sub === 'run-script') {
        return OK(`> ${pkg ?? 'build'}\n> (sandboxed) script would run here — use the AI agent or a real device build`);
      }
      if (sub === 'init') return OK('created package.json (sandboxed)');
      if (sub === 'ls') {
        try {
          const pkgJson = JSON.parse(((await ws.readText(path.join(this.cwd, 'package.json'))) as string) || '{}');
          return OK(`${pkgJson.name ?? 'project'}@${pkgJson.version ?? '0.0.0'} ${this.cwd}`);
        } catch {
          return FAIL('npm ls: no package.json in this directory');
        }
      }
      return OK(`npm <install|run|init|ls> (sandboxed)`);
    });

    this.registerCommand('curl', async (args) => {
      const url = args.find((a) => a.startsWith('http'));
      if (!url) return FAIL('usage: curl <url>');
      try {
        const res = await fetch(url);
        const text = await res.text();
        return OK(text.slice(0, 2048));
      } catch (err) {
        return FAIL(`curl: ${(err as Error).message}`);
      }
    });

    this.registerCommand('apk', async (args) => {
      if (args[0] === 'build') {
        return OK(
          [
            'cordova build android (sandboxed preview)',
            '  > preparando www/',
            '  > compiling…',
            '  BUILD SUCCESSFUL — use the GitHub Actions workflow to produce real APK/AAB artifacts.',
          ].join('\n'),
        );
      }
      return OK('usage: apk build (real builds run in CI — see .github/workflows/android-*.yml)');
    });

    this.registerCommand('agent', async (args, _flags, raw) => {
      const task = raw.replace(/^agent\s*/, '');
      if (!task) return FAIL('usage: agent <task description>');
      const { bus } = await import('../../lib/events');
      bus.emit('agent:requested', task);
      return OK('agent task dispatched — open the AI panel to follow progress');
    });

    this.registerCommand('theme', async (args) => {
      const { bus } = await import('../../lib/events');
      const { THEME_LIST } = await import('../editor/themes');
      if (!args[0]) return OK(THEME_LIST.join('\n'));
      if (!THEME_LIST.includes(args[0] as never)) return FAIL(`unknown theme: ${args[0]}`);
      bus.emit('shell:theme', args[0]);
      return OK(`theme → ${args[0]}`);
    });

    this.registerCommand('locale', async (args) => {
      const { bus } = await import('../../lib/events');
      const { listLocales } = await import('../../lib/i18n');
      const codes = listLocales().map((l) => l.code);
      if (!args[0]) return OK(codes.join('\n'));
      if (!codes.includes(args[0])) return FAIL(`unknown locale: ${args[0]}`);
      bus.emit('shell:locale', args[0]);
      return OK(`locale → ${args[0]}`);
    });

    this.registerCommand('find', async (args) => {
      const needle = args[0] ?? '';
      const results = await ws.search(this.cwd, needle);
      return OK(results.map((r) => `${r.path}:${r.line}: ${r.text}`).join('\n'));
    });

    // git dispatcher
    this.registerCommand('git', async (args) => {
      const [sub, ...rest] = args;
      const git = this.git();
      switch (sub) {
        case 'init': return git.init();
        case 'status': case 'st': return git.status();
        case 'add': return git.add(rest);
        case 'rm': return git.rm(rest);
        case 'commit': return git.commit({ flags: extractCommitFlags(rest) });
        case 'log': return git.log(rest);
        case 'diff': return git.diff();
        case 'branch': return git.branch(rest);
        case 'checkout': case 'co': return git.checkout(rest);
        case 'merge': return git.merge(rest);
        case 'remote': return git.remote(rest);
        case 'push': return git.push();
        case 'pull': return git.pull();
        case 'clone': return rest[0] ? git.clone(rest[0]) : FAIL('usage: git clone <url>');
        case 'config': return git.config(rest);
        default:
          return FAIL(`git: '${sub ?? ''}' is not a supported command here. Try: init status add commit log diff branch checkout merge remote push pull clone config`);
      }
    });
  }
}

function flags_e(args: string[]): boolean {
  return args[0] === '-e';
}

function extractCommitFlags(args: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-m' || a === '--message') {
      flags.m = args[++i] ?? '';
    } else if (a.startsWith('-m=')) {
      flags.m = a.slice(3);
    } else if (a.startsWith('--message=')) {
      flags.m = a.slice(10);
    } else if (a === '--amend') {
      flags.amend = true;
    }
  }
  return flags;
}

/** Evaluate JS in a sandboxed-ish function with captured console. */
export function runJsSandbox(code: string): Promise<ShellOutput> {
  return new Promise((resolve) => {
    const logs: string[] = [];
    const fakeConsole = {
      log: (...a: unknown[]) => logs.push(a.map(fmt).join(' ')),
      info: (...a: unknown[]) => logs.push(a.map(fmt).join(' ')),
      warn: (...a: unknown[]) => logs.push(`[warn] ${a.map(fmt).join(' ')}`),
      error: (...a: unknown[]) => logs.push(`[error] ${a.map(fmt).join(' ')}`),
    };
    try {
      const fn = new Function('console', `"use strict";\n${code}`);
      const result = fn(fakeConsole);
      const maybe = result instanceof Promise ? result : Promise.resolve(result);
      void maybe.then(
        (value) => {
          if (value !== undefined) logs.push(fmt(value));
          resolve(OK(logs.join('\n')));
        },
        (err: Error) => resolve(FAIL(`Uncaught ${err.message}`, 1)),
      );
    } catch (err) {
      resolve(FAIL(`SyntaxError: ${(err as Error).message}`, 1));
    }
  });
}

function fmt(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}
