/**
 * Virtual shell — a POSIX-flavoured shell over the FS abstraction.
 *
 * Runs identically in the browser, the Android WebView and Node (tests):
 * the only platform dependency is `@core/file/fs`, which is backend-neutral.
 * Terminal UI (xterm.js) sits on top of this module; nothing here touches DOM.
 */
import * as fs from '@core/file/fs';
import { FsError } from '@core/file/fs';
import { resolve as resolveUrl, basename, dirname, parseUrl, buildUrl, normalize } from '@lib/path';

export interface ShellContext {
  cwd(): string;
  setCwd(url: string): void;
  print(text: string): void;
  printErr(text: string): void;
  env: Record<string, string>;
  exit?(): void;
  /** set by the terminal layer → opens a file in the editor (`open` command) */
  openFile?(url: string): void;
}

export interface ShellCommand {
  name: string;
  description: string;
  usage?: string;
  /** short flags that take a value (e.g. head: ['n'], git commit: ['m']) */
  valueFlags?: string[];
  run(
    ctx: ShellContext,
    args: string[],
    flags: Record<string, boolean | string>
  ): number | Promise<number>;
}

// -- ANSI helpers ------------------------------------------------------------

const ansi = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`
};

export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

interface ParsedInput {
  cmd: string;
  args: string[];
  flags: Record<string, boolean | string>;
}

export function parseInput(tokens: string[], valueFlags: Set<string> = new Set()): ParsedInput | null {
  if (!tokens.length) return null;
  const flags: Record<string, boolean | string> = {};
  const positional: string[] = [];
  const cmd = tokens[0];
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith('--') && tok.length > 2) {
      const key = tok.slice(2);
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (tok.startsWith('-') && tok.length > 1) {
      // short flags: clusterable booleans, value flags per command
      const body = tok.slice(1);
      if (valueFlags.has(body)) {
        const next = tokens[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags[body] = next;
          i++;
          continue;
        }
      }
      for (const ch of body) flags[ch] = true;
    } else {
      positional.push(tok);
    }
  }
  return { cmd, args: positional, flags };
}

function djb2(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------

export class VirtualShell {
  private commands = new Map<string, ShellCommand>();
  private cwdUrl: string;
  private history: string[] = [];
  /** injected by terminal layer */
  openFileHook: ((url: string) => void) | null = null;
  exitHook: (() => void) | null = null;

  constructor(initialCwd = 'memory:///home') {
    this.cwdUrl = initialCwd;
    registerBuiltins(this);
  }

  registerCommand(cmd: ShellCommand): void {
    this.commands.set(cmd.name, cmd);
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  listCommands(): ShellCommand[] {
    return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get cwd(): string {
    return this.cwdUrl;
  }

  setCwd(url: string): void {
    this.cwdUrl = url;
  }

  pushHistory(line: string): void {
    if (line.trim()) this.history.push(line.trim());
    if (this.history.length > 200) this.history.shift();
  }

  getHistory(): string[] {
    return [...this.history];
  }

  /** Resolve a user path (absolute, relative, ~, ..) against cwd. */
  path(p: string): string {
    if (!p || p === '~') return this.env('HOME');
    if (p.startsWith('~/')) return resolveUrl(this.env('HOME'), p.slice(2));
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(p)) return p;
    if (p.startsWith('/')) {
      // absolute path: keep the cwd scheme, replace the path entirely
      return buildUrl(parseUrl(this.cwdUrl).scheme, normalize(p));
    }
    return resolveUrl(this.cwdUrl, p);
  }

  private env(key: string): string {
    const defaults: Record<string, string> = {
      HOME: 'memory:///home',
      USER: 'xcoder',
      SHELL: 'xsh',
      TERM: 'xterm-256color'
    };
    return defaults[key] ?? '';
  }

  /** Execute one command line. Returns the exit code. */
  async execute(line: string, ctx: ShellContext): Promise<number> {
    const raw = line.trim();
    if (!raw) return 0;
    this.pushHistory(raw);

    // output redirection:  cmd ... > file   |   cmd ... >> file
    const redirectMatch = /\s(>>|>)\s*(\S+)\s*$/.exec(raw);
    let captured = '';
    let effective = raw;
    let redirectUrl: string | null = null;
    let append = false;
    if (redirectMatch) {
      effective = raw.slice(0, redirectMatch.index);
      redirectUrl = this.path(redirectMatch[2]);
      append = redirectMatch[1] === '>>';
    }

    const printingCtx: ShellContext = redirectUrl
      ? {
          ...ctx,
          print: (t: string) => {
            captured += t + '\n';
          },
          printErr: ctx.printErr
        }
      : ctx;

    const tokens = tokenize(effective);
    if (!tokens.length) return 0;

    if (tokens[0] === 'exit') {
      ctx.exit?.();
      return 0;
    }

    const cmd = this.commands.get(tokens[0]);
    if (!cmd) {
      ctx.printErr(ansi.red(`${tokens[0]}: command not found (try 'help')`));
      return 127;
    }

    const parsed = parseInput(tokens, new Set(cmd.valueFlags ?? []));
    if (!parsed) return 0;

    const fullCtx: ShellContext = {
      ...printingCtx,
      openFile: (url) => {
        if (printingCtx.openFile) printingCtx.openFile(url);
        else if (this.openFileHook) this.openFileHook(url);
      },
      exit: () => ctx.exit?.()
    };

    let code = 0;
    try {
      code = await cmd.run(fullCtx, parsed.args, parsed.flags);
    } catch (err) {
      const msg = err instanceof FsError ? err.message : err instanceof Error ? err.message : String(err);
      ctx.printErr(ansi.red(`${parsed.cmd}: ${msg}`));
      return 1;
    }

    if (redirectUrl && captured) {
      const prev = append && (await fs.exists(redirectUrl)) ? await fs.read(redirectUrl) : '';
      await fs.write(redirectUrl, prev + captured);
    }
    return code;
  }
}

// ---------------------------------------------------------------------------
// Built-in commands
// ---------------------------------------------------------------------------

export function registerBuiltins(shell: VirtualShell): void {
  const reg = (c: ShellCommand) => shell.registerCommand(c);

  reg({
    name: 'help',
    description: 'List available commands',
    usage: 'help [command]',
    run: (ctx, args) => {
      if (args[0]) {
        const cmd = shell.listCommands().find((c) => c.name === args[0]);
        if (!cmd) {
          ctx.printErr(`no help for '${args[0]}'`);
          return 1;
        }
        ctx.print(`${ansi.bold(cmd.name)} — ${cmd.description}`);
        if (cmd.usage) ctx.print(ansi.gray(`  usage: ${cmd.usage}`));
        return 0;
      }
      ctx.print(ansi.bold('XCoder virtual shell — available commands:'));
      for (const c of shell.listCommands()) {
        ctx.print(`  ${ansi.cyan(c.name.padEnd(10))} ${c.description}`);
      }
      return 0;
    }
  });

  reg({
    name: 'clear',
    description: 'Clear the terminal screen',
    run: (ctx) => {
      ctx.print('\x1b[2J\x1b[H');
      return 0;
    }
  });

  reg({
    name: 'pwd',
    description: 'Print working directory',
    run: (ctx) => {
      ctx.print(ctx.cwd());
      return 0;
    }
  });

  reg({
    name: 'cd',
    description: 'Change directory',
    usage: 'cd [path|~|..]',
    run: async (ctx, args) => {
      const target = shell.path(args[0] ?? '~');
      const entry = await fs.stat(target);
      if (!entry.isDir) throw new FsError('ENOTDIR', target);
      ctx.setCwd(target);
      return 0;
    }
  });

  reg({
    name: 'ls',
    description: 'List directory contents',
    usage: 'ls [-l] [path]',
    run: async (ctx, args, flags) => {
      const target = shell.path(args[0] ?? '.');
      const entries = await fs.list(target);
      if (flags.l) {
        for (const e of entries) {
          const type = e.isDir ? 'd' : '-';
          const size = String(e.size ?? '').padStart(8);
          const date = e.mtime ? new Date(e.mtime).toISOString().slice(0, 16).replace('T', ' ') : '';
          ctx.print(`${type} ${size}  ${date}  ${e.isDir ? ansi.blue(e.name + '/') : e.name}`);
        }
      } else if (entries.length) {
        const names = entries.map((e) => (e.isDir ? ansi.blue(e.name + '/') : e.name));
        ctx.print(names.join('   '));
      }
      return 0;
    }
  });

  reg({
    name: 'cat',
    description: 'Print file contents',
    usage: 'cat <file...>',
    run: async (ctx, args) => {
      if (!args.length) throw new Error('missing file operand');
      for (const a of args) ctx.print(await fs.read(shell.path(a)));
      return 0;
    }
  });

  reg({
    name: 'echo',
    description: 'Print text',
    usage: 'echo <text...>',
    run: (ctx, args) => {
      ctx.print(args.join(' '));
      return 0;
    }
  });

  reg({
    name: 'mkdir',
    description: 'Create directories',
    usage: 'mkdir <dir...>',
    run: async (_ctx, args) => {
      if (!args.length) throw new Error('missing operand');
      for (const a of args) await fs.createDir(shell.path(a));
      return 0;
    }
  });

  reg({
    name: 'touch',
    description: 'Create empty files (or update mtime)',
    usage: 'touch <file...>',
    run: async (_ctx, args) => {
      if (!args.length) throw new Error('missing operand');
      for (const a of args) {
        const url = shell.path(a);
        if (await fs.exists(url)) continue;
        await fs.createFile(url, '');
      }
      return 0;
    }
  });

  reg({
    name: 'rm',
    description: 'Remove files or directories',
    usage: 'rm [-r] <path...>',
    run: async (_ctx, args, flags) => {
      if (!args.length) throw new Error('missing operand');
      for (const a of args) {
        const url = shell.path(a);
        const entry = await fs.stat(url);
        if (entry.isDir && !flags.r && !flags.rf) {
          throw new Error(`${a}: is a directory (use -r)`);
        }
        await fs.deletePath(url);
      }
      return 0;
    }
  });

  reg({
    name: 'mv',
    description: 'Move/rename files',
    usage: 'mv <src> <dst>',
    run: async (_ctx, args) => {
      if (args.length < 2) throw new Error('usage: mv <src> <dst>');
      const src = shell.path(args[0]);
      let dst = shell.path(args[1]);
      let dstEntry;
      try {
        dstEntry = await fs.stat(dst);
      } catch {
        /* destination doesn't exist */
      }
      if (dstEntry?.isDir) dst = dst.endsWith('/') ? dst + basename(src) : dst + '/' + basename(src);
      await fs.rename(src, dst);
      return 0;
    }
  });

  reg({
    name: 'cp',
    description: 'Copy files or directories',
    usage: 'cp [-r] <src> <dst>',
    run: async (_ctx, args) => {
      if (args.length < 2) throw new Error('usage: cp <src> <dst>');
      const src = shell.path(args[0]);
      let dst = shell.path(args[1]);
      let dstEntry;
      try {
        dstEntry = await fs.stat(dst);
      } catch {
        /* destination doesn't exist */
      }
      if (dstEntry?.isDir) dst = dst.endsWith('/') ? dst + basename(src) : dst + '/' + basename(src);
      await fs.copy(src, dst);
      return 0;
    }
  });

  reg({
    name: 'grep',
    description: 'Search text in files',
    usage: 'grep [-i] <pattern> <file...>',
    run: async (ctx, args, flags) => {
      if (args.length < 2) throw new Error('usage: grep [-i] <pattern> <file...>');
      const pattern = args[0];
      const needle = flags.i ? pattern.toLowerCase() : pattern;
      let matches = 0;
      for (const fileArg of args.slice(1)) {
        const url = shell.path(fileArg);
        const text = await fs.read(url);
        text.split('\n').forEach((l, i) => {
          const hay = flags.i ? l.toLowerCase() : l;
          if (hay.includes(needle)) {
            matches++;
            ctx.print(ansi.gray(`${fileArg}:${i + 1}:`) + l.trim());
          }
        });
      }
      return matches ? 0 : 1;
    }
  });

  reg({
    name: 'wc',
    description: 'Count lines, words and chars',
    usage: 'wc <file>',
    run: async (ctx, args) => {
      if (!args[0]) throw new Error('missing file operand');
      const text = await fs.read(shell.path(args[0]));
      const lines = text.split('\n').length;
      const words = (text.match(/\S+/g) ?? []).length;
      ctx.print(`${lines} ${words} ${text.length} ${args[0]}`);
      return 0;
    }
  });

  reg({
    name: 'head',
    description: 'First lines of a file',
    usage: 'head [-n N] <file>',
    run: async (ctx, args, flags) => {
      const n = Number(flags.n ?? 10);
      if (!args[0]) throw new Error('missing file operand');
      const text = await fs.read(shell.path(args[0]));
      ctx.print(text.split('\n').slice(0, n).join('\n'));
      return 0;
    }
  });

  reg({
    name: 'find',
    description: 'Find files under a path',
    usage: 'find [path] [-name pattern]',
    run: async (ctx, args, flags) => {
      const root = shell.path(args[0] ?? '.');
      const pattern = String(flags.name ?? '');
      const files = await fs.walkFiles(root);
      for (const f of files) {
        const name = basename(f);
        if (pattern && !name.toLowerCase().includes(pattern.toLowerCase().replace(/\*/g, ''))) continue;
        ctx.print(f);
      }
      return 0;
    }
  });

  reg({
    name: 'open',
    description: 'Open a file in the XCoder editor',
    usage: 'open <file>',
    run: async (ctx, args) => {
      if (!args[0]) throw new Error('missing file operand');
      const url = shell.path(args[0]);
      await fs.stat(url);
      if (ctx.openFile) ctx.openFile(url);
      else ctx.print(ansi.yellow('no editor attached to this shell'));
      return 0;
    }
  });

  reg({
    name: 'date',
    description: 'Show current date/time',
    run: (ctx) => {
      ctx.print(new Date().toString());
      return 0;
    }
  });

  reg({
    name: 'whoami',
    description: 'Print current user',
    run: (ctx) => {
      ctx.print('xcoder');
      return 0;
    }
  });

  reg({
    name: 'uname',
    description: 'System information',
    usage: 'uname [-a]',
    run: (ctx, _args, flags) => {
      ctx.print(
        flags.a
          ? 'XCoderOS 1.0.0 xsh virtual-shell cordova-available:yes'
          : 'XCoderOS'
      );
      return 0;
    }
  });

  reg({
    name: 'history',
    description: 'Show command history',
    run: (ctx) => {
      shell.getHistory().forEach((h, i) => ctx.print(ansi.gray(String(i + 1).padStart(4)) + '  ' + h));
      return 0;
    }
  });

  reg({
    name: 'xcoder',
    description: 'XCoder app info',
    usage: 'xcoder <version|about>',
    run: (ctx, args) => {
      const sub = args[0] ?? 'about';
      if (sub === 'version') ctx.print('xcoder 1.0.0');
      else {
        ctx.print(ansi.bold('XCoder 1.0.0') + ' — mobile-first IDE');
        ctx.print('CodeMirror 6 engine · plugin extensible · LSP ready');
        ctx.print(ansi.gray('XCoder virtual shell'));
      }
      return 0;
    }
  });

  registerGit(shell);
  registerNpm(shell);
  registerApk(shell);
  registerNode(shell);
  registerPython(shell);
}

// ---------------------------------------------------------------------------
// git (state machine persisted as .git/xcoder-git.json inside the repo root)
// ---------------------------------------------------------------------------

interface GitCommit {
  hash: string;
  message: string;
  time: number;
  branch: string;
  files: Record<string, string>; // relPath → content hash
}

interface GitState {
  branch: string;
  branches: Record<string, string | null>; // name → head hash
  commits: GitCommit[];
  index: Record<string, string>; // staged relPath → content hash
}

const GIT_STATE_FILE = '.git/xcoder-git.json';

async function findRepoRoot(startUrl: string): Promise<string | null> {
  let dir = startUrl;
  for (let i = 0; i < 32; i++) {
    if (await fs.exists(resolveUrl(dir, GIT_STATE_FILE))) return dir;
    if (parseUrl(dir).path === '/') return null;
    dir = dirname(dir);
  }
  return null;
}

async function loadGitState(rootUrl: string): Promise<GitState> {
  const raw = await fs.read(resolveUrl(rootUrl, GIT_STATE_FILE));
  return JSON.parse(raw) as GitState;
}

async function saveGitState(rootUrl: string, state: GitState): Promise<void> {
  await fs.write(resolveUrl(rootUrl, GIT_STATE_FILE), JSON.stringify(state, null, 2));
}

async function hashWorkingTree(rootUrl: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const urls = await fs.walkFiles(resolveUrl(rootUrl, '.'));
  for (const url of urls) {
    const rel = url.slice(rootUrl.replace(/\/+$/, '').length + 1);
    if (rel.startsWith('.git/')) continue;
    try {
      files[rel] = djb2(await fs.read(url));
    } catch {
      /* skip unreadable */
    }
  }
  return files;
}

function getHead(state: GitState): GitCommit | null {
  const head = state.branches[state.branch] ?? null;
  return head ? (state.commits.find((c) => c.hash === head) ?? null) : null;
}

function registerGit(shell: VirtualShell): void {
  shell.registerCommand({
    name: 'git',
    description: 'Version control (init, status, add, commit, log, branch, checkout, diff)',
    usage: 'git <init|status|add|commit|log|branch|checkout|diff> [args]',
    valueFlags: ['m'],
    run: async (ctx, args, flags) => {
      const sub = args[0] ?? 'status';
      const rootUrl = await findRepoRoot(ctx.cwd());

      switch (sub) {
        case 'init': {
          if (rootUrl) {
            ctx.print(`Reinitialized existing Git repository in ${rootUrl}`);
            return 0;
          }
          const state: GitState = { branch: 'main', branches: { main: null }, commits: [], index: {} };
          await fs.createDir(resolveUrl(ctx.cwd(), '.git'));
          await saveGitState(ctx.cwd(), state);
          ctx.print(ansi.green(`Initialized empty Git repository in ${ctx.cwd()}`));
          return 0;
        }
        case 'status': {
          if (!rootUrl) throw new Error('not a git repository (run: git init)');
          const state = await loadGitState(rootUrl);
          const head = getHead(state);
          const tree = await hashWorkingTree(rootUrl);
          ctx.print(`On branch ${ansi.bold(state.branch)}`);
          if (state.index && Object.keys(state.index).length) {
            ctx.print(ansi.green('Changes to be committed:'));
            for (const p of Object.keys(state.index)) ctx.print(`  ${ansi.green('staged:')}   ${p}`);
          }
          const modified: string[] = [];
          const untracked: string[] = [];
          for (const [p, hash] of Object.entries(tree)) {
            if (state.index[p] !== undefined) continue;
            if (head) {
              if (head.files[p] === undefined) untracked.push(p);
              else if (head.files[p] !== hash) modified.push(p);
            } else {
              untracked.push(p);
            }
          }
          if (modified.length) {
            ctx.print(ansi.red('Changes not staged for commit:'));
            for (const p of modified) ctx.print(`  ${ansi.red('modified:')} ${p}`);
          }
          if (untracked.length) {
            ctx.print(ansi.red('Untracked files:'));
            for (const p of untracked) ctx.print(`  ${p}`);
          }
          if (!modified.length && !untracked.length && !Object.keys(state.index).length) {
            ctx.print('nothing to commit, working tree clean');
          }
          return 0;
        }
        case 'add': {
          if (!rootUrl) throw new Error('not a git repository');
          const state = await loadGitState(rootUrl);
          const tree = await hashWorkingTree(rootUrl);
          const target = args[1];
          if (!target) throw new Error('nothing specified, nothing added');
          if (target === '.' || target === '-A' || target === '--all') {
            Object.assign(state.index, tree);
          } else {
            const rel = shell.path(target).slice(rootUrl.replace(/\/+$/, '').length + 1);
            if (tree[rel] === undefined) throw new Error(`pathspec '${target}' did not match any files`);
            state.index[rel] = tree[rel];
          }
          await saveGitState(rootUrl, state);
          return 0;
        }
        case 'commit': {
          if (!rootUrl) throw new Error('not a git repository');
          const state = await loadGitState(rootUrl);
          const msgText =
            typeof flags.m === 'string' && flags.m
              ? flags.m
              : extractCommitMessage(args);
          if (!msgText) throw new Error('empty commit message (git commit -m "message")');
          const head = getHead(state);
          const tree = await hashWorkingTree(rootUrl);
          const files: Record<string, string> = { ...(head?.files ?? {}) };
          // staged files come from the index; unchanged files inherit HEAD
          for (const [p, hash] of Object.entries(tree)) {
            if (state.index[p] !== undefined || head?.files[p] === undefined) files[p] = hash;
          }
          for (const [p, hash] of Object.entries(state.index)) files[p] = hash;
          const commit: GitCommit = {
            hash: djb2(JSON.stringify(files) + Date.now()),
            message: msgText,
            time: Date.now(),
            branch: state.branch,
            files
          };
          state.commits.push(commit);
          state.branches[state.branch] = commit.hash;
          state.index = {};
          await saveGitState(rootUrl, state);
          const count = Object.keys(files).length;
          ctx.print(`[${ansi.bold(state.branch)} ${commit.hash}] ${msgText}`);
          ctx.print(` ${count} file(s) tracked`);
          return 0;
        }
        case 'log': {
          if (!rootUrl) throw new Error('not a git repository');
          const state = await loadGitState(rootUrl);
          const head = getHead(state);
          if (!head) {
            ctx.print(`fatal: your current branch '${state.branch}' does not have any commits yet`);
            return 128;
          }
          let current: GitCommit | null = head;
          while (current) {
            ctx.print(`${ansi.yellow('commit ' + current.hash)}${ansi.gray(` (${current.branch})`)}`);
            ctx.print(`Date:   ${new Date(current.time).toDateString()}`);
            ctx.print('');
            ctx.print(`    ${current.message}`);
            ctx.print('');
            current = current.hash === (state.branches[current.branch] ?? '') && state.commits.length > 1
              ? null
              : null; // single-parent chain simplified: stop at head (mock)
            break;
          }
          for (const c of [...state.commits].reverse().slice(1)) {
            if (c.branch !== state.branch) continue;
            ctx.print(`${ansi.yellow('commit ' + c.hash)}`);
            ctx.print(`Date:   ${new Date(c.time).toDateString()}`);
            ctx.print(`    ${c.message}`);
            ctx.print('');
          }
          return 0;
        }
        case 'branch': {
          if (!rootUrl) throw new Error('not a git repository');
          const state = await loadGitState(rootUrl);
          if (!args[1]) {
            for (const name of Object.keys(state.branches)) {
              ctx.print(name === state.branch ? `* ${ansi.green(name)}` : `  ${name}`);
            }
            return 0;
          }
          state.branches[args[1]] = state.branches[state.branch] ?? null;
          await saveGitState(rootUrl, state);
          return 0;
        }
        case 'checkout': {
          if (!rootUrl) throw new Error('not a git repository');
          const state = await loadGitState(rootUrl);
          const target = args[1];
          if (!target) throw new Error('checkout <branch>');
          if (!(target in state.branches)) throw new Error(`branch '${target}' not found`);
          const head = getHead(state);
          if (head) {
            // restore tracked contents of the previous head (mock behavior)
            for (const [rel, hash] of Object.entries(head.files)) {
              const url = resolveUrl(rootUrl, rel);
              try {
                if ((await fs.exists(url)) && djb2(await fs.read(url)) !== hash) {
                  // working tree differs — keep it (checkout does not discard changes in this mock)
                }
              } catch {
                /* ignore */
              }
            }
          }
          state.branch = target;
          await saveGitState(rootUrl, state);
          ctx.print(`Switched to branch '${ansi.bold(target)}'`);
          return 0;
        }
        case 'diff': {
          if (!rootUrl) throw new Error('not a git repository');
          const state = await loadGitState(rootUrl);
          const head = getHead(state);
          const tree = await hashWorkingTree(rootUrl);
          const base = head?.files ?? {};
          let any = false;
          for (const [p, hash] of Object.entries(tree)) {
            if (base[p] !== hash) {
              any = true;
              ctx.print(ansi.bold(`modified: ${p}`));
              try {
                const before = base[p];
                void before;
                ctx.print(ansi.gray('  (line-level diff not available in virtual shell — file differs from HEAD)'));
              } catch {
                /* ignore */
              }
            }
          }
          for (const p of Object.keys(base)) {
            if (!(p in tree)) ctx.print(ansi.red(`deleted:  ${p}`));
          }
          if (!any) ctx.print('no changes');
          return 0;
        }
        default:
          throw new Error(`git: '${sub}' is not a git command`);
      }
    }
  });
}

function extractCommitMessage(args: string[]): string {
  // accepts: commit -m "msg" | commit msg
  if (args[1] === '-m') return args.slice(2).join(' ').replace(/^["']|["']$/g, '');
  return args.slice(1).join(' ').replace(/^["']|["']$/g, '');
}

// ---------------------------------------------------------------------------
// npm (package.json-aware mock)
// ---------------------------------------------------------------------------

async function readPackageJson(cwd: string): Promise<Record<string, unknown> | null> {
  const url = resolveUrl(cwd, 'package.json');
  if (!(await fs.exists(url))) return null;
  return JSON.parse(await fs.read(url)) as Record<string, unknown>;
}

function registerNpm(shell: VirtualShell): void {
  shell.registerCommand({
    name: 'npm',
    description: 'Node package manager (init, install, run, test, ls)',
    usage: 'npm <init|install|run|test|ls> [args]',
    run: async (ctx, args) => {
      const sub = args[0] ?? 'ls';
      const pkgUrl = resolveUrl(ctx.cwd(), 'package.json');

      switch (sub) {
        case 'init': {
          if (await fs.exists(pkgUrl)) {
            ctx.print('package.json already exists');
            return 1;
          }
          const name = basename(ctx.cwd()).replace(/[^\w-]/g, '-') || 'project';
          await fs.write(
            pkgUrl,
            JSON.stringify(
              {
                name,
                version: '1.0.0',
                description: '',
                main: 'index.js',
                scripts: { test: 'echo "no test specified" && exit 0' },
                dependencies: {}
              },
              null,
              2
            )
          );
          ctx.print(ansi.green(`created package.json (${name})`));
          return 0;
        }
        case 'install': {
          let pkg = await readPackageJson(ctx.cwd());
          if (!pkg) {
            await shell.execute('npm init -y', ctx);
            pkg = (await readPackageJson(ctx.cwd())) ?? {};
          }
          const deps = (pkg.dependencies as Record<string, string>) ?? {};
          const wanted = args.slice(1).filter((a) => !a.startsWith('-'));
          if (!wanted.length) {
            ctx.print(`up to date, audited ${Object.keys(deps).length || 1} package(s)`);
            return 0;
          }
          for (const p of wanted) deps[p] = '^1.0.0';
          pkg.dependencies = deps;
          await fs.write(pkgUrl, JSON.stringify(pkg, null, 2));
          ctx.print(`${ansi.green('added')} ${wanted.length} package(s) to dependencies`);
          return 0;
        }
        case 'run': {
          const script = args[1];
          const pkg = await readPackageJson(ctx.cwd());
          const scripts = (pkg?.scripts as Record<string, string>) ?? {};
          if (!script || !scripts[script]) {
            ctx.print(`missing script: ${script ?? '<name>'}`);
            return 1;
          }
          for (const part of scripts[script].split('&&')) {
            const code = await shell.execute(part.trim(), ctx);
            if (code !== 0) return code;
          }
          return 0;
        }
        case 'test': {
          return shell.execute('npm run test', ctx);
        }
        case 'ls': {
          const pkg = await readPackageJson(ctx.cwd());
          const deps = Object.entries(((pkg?.dependencies as Record<string, string>) ?? {}));
          if (!deps.length) {
            ctx.print('(empty)');
            return 0;
          }
          for (const [name, ver] of deps) ctx.print(`${ansi.cyan(name)}@${ver}`);
          return 0;
        }
        default:
          throw new Error(`npm: '${sub}' is not supported in the virtual shell`);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// apk (Alpine package manager mock — real apk runs under Proot on Android)
// ---------------------------------------------------------------------------

const APK_CATALOG: Record<string, string> = {
  python3: '3.12', nodejs: '22.11', git: '2.47', vim: '9.1', curl: '8.11',
  openssh: '10.0', make: '4.4', gcc: '14.2', ripgrep: '14.1', jq: '1.7',
  zip: '3.0', unzip: '6.0', nano: '8.1', htop: '3.3', tree: '2.1'
};

function registerApk(shell: VirtualShell): void {
  const installed = new Set<string>(['git', 'nodejs']);
  shell.registerCommand({
    name: 'apk',
    description: 'Alpine package manager (mock; real apk available under Proot)',
    usage: 'apk <add|remove|list|search> [pkg]',
    run: (ctx, args) => {
      const sub = args[0] ?? 'list';
      const pkg = args[1];
      switch (sub) {
        case 'add': {
          if (!pkg || !APK_CATALOG[pkg]) {
            ctx.printErr(`apk: package '${pkg ?? ''}' not found in catalog`);
            return 1;
          }
          installed.add(pkg);
          ctx.print(`(1/1) Installing ${pkg} (${APK_CATALOG[pkg]})`);
          ctx.print(ansi.green(`OK: ${installed.size} packages installed`));
          return 0;
        }
        case 'remove': {
          if (!installed.delete(pkg ?? '')) {
            ctx.printErr(`apk: '${pkg}' is not installed`);
            return 1;
          }
          ctx.print(`Removing ${pkg}`);
          return 0;
        }
        case 'search': {
          const q = (pkg ?? '').toLowerCase();
          for (const [name, ver] of Object.entries(APK_CATALOG)) {
            if (name.includes(q)) ctx.print(`${ansi.cyan(name)}-${ver}`);
          }
          return 0;
        }
        case 'list':
        default: {
          ctx.print(ansi.bold('Installed packages:'));
          for (const name of [...installed].sort()) ctx.print(`  ${name} ${APK_CATALOG[name]}`);
          return 0;
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// node / python
// ---------------------------------------------------------------------------

function registerNode(shell: VirtualShell): void {
  shell.registerCommand({
    name: 'node',
    description: 'Run JavaScript (node -e <expr> | node <file.js>)',
    usage: 'node [-e expr | file.js]',
    valueFlags: ['e'],
    run: async (ctx, args, flags) => {
      let source = '';
      if (flags.e) {
        source = String(flags.e);
      } else if (args[0]) {
        source = await fs.read(shell.path(args[0]));
      } else {
        ctx.print(ansi.yellow('interactive REPL is not available in the virtual shell; use: node -e "expr"'));
        return 1;
      }
      const logs: string[] = [];
      const fakeConsole = {
        log: (...parts: unknown[]) => logs.push(parts.map((p) => (typeof p === 'object' ? JSON.stringify(p) : String(p))).join(' ')),
        error: fakeConsoleLogErr(logs),
        warn: (...parts: unknown[]) => logs.push('WARN: ' + parts.map(String).join(' '))
      };
      try {
        const result = Function('console', `"use strict"; return (function(){ ${source} })();`)(fakeConsole);
        for (const l of logs) ctx.print(l);
        if (result !== undefined) ctx.print(ansi.gray('=> ' + String(result)));
        return 0;
      } catch (err) {
        for (const l of logs) ctx.print(l);
        ctx.printErr(`${err instanceof Error ? err.name : 'Error'}: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }
    }
  });
}

function fakeConsoleLogErr(logs: string[]) {
  return (...parts: unknown[]) => logs.push('ERR: ' + parts.map(String).join(' '));
}

function registerPython(shell: VirtualShell): void {
  shell.registerCommand({
    name: 'python',
    description: 'Python via Proot (Android) — shows status elsewhere',
    usage: 'python [--version]',
    run: (ctx, _args, flags) => {
      if (flags.version) {
        ctx.print('Python 3.12 (via Proot/Alpine on Android builds)');
        return 0;
      }
      ctx.print(ansi.yellow('Python runs through Proot + Alpine Linux on Android builds.'));
      ctx.print(ansi.gray('In the browser/virtual shell, only the interpreter status is reported.'));
      ctx.print(ansi.gray('Install it with: apk add python3  (on an Android device)'));
      return 0;
    }
  });
}
