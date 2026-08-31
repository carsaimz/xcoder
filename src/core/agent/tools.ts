/**
 * Built-in agent tools. Groups:
 *   fs.*     — read / list / write / delete / mkdir on the workspace
 *   code.*   — analyze structure / apply search-replace edits
 *   git.*    — status / add / commit / log / diff / branch / checkout
 *   exec.*   — run bash (virtual shell), javascript (sandbox) or python (pyodide)
 *   agent.*  — spawn subagents
 *   app.*    — workspace introspection
 */

import * as path from '../../lib/path';
import { truncate } from '../../lib/helpers';
import { FsError } from '../file/types';
import { runJsSandbox } from '../terminal/shell';
import { runPython } from './python';
import { analyzeFile } from './analyze';
import { AgentTool, ToolContext } from './types';

function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string') throw new FsError(`missing string argument: ${key}`, 'EINVAL');
  return v;
}

/** Resolve agent paths against the working directory. */
export function resolveAgentPath(ctx: ToolContext, p: string): string {
  if (!p) throw new FsError('empty path', 'EINVAL');
  return path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(ctx.cwd, p));
}

async function requireRepo(ctx: ToolContext): Promise<void> {
  const git = ctx.shell.git(ctx.cwd);
  if (!(await git.isRepo())) {
    throw new Error(`not a git repository: ${ctx.cwd} (run git init first)`);
  }
}

export const BUILTIN_TOOLS: AgentTool[] = [
  // ---------------------------------------------------------------- fs ----
  {
    name: 'fs.read',
    description: 'Read a text file from the workspace and return its content.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'file path (absolute or relative to the workspace root)' } },
      required: ['path'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      const text = (await ctx.fs.readText(p)) as string;
      return truncate(text, 24_000);
    },
  },
  {
    name: 'fs.list',
    description: 'List the direct children of a directory.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'directory path' } },
      required: ['path'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      const entries = await ctx.fs.listdir(p);
      return entries.map((e) => `${e.isDir ? '[dir] ' : '[file] '}${path.basename(e.path)}`).join('\n') || '(empty)';
    },
  },
  {
    name: 'fs.write',
    description:
      'Create or overwrite a file with the given content. Parent directories are created automatically. Prefer code.edit for small changes to existing files.',
    danger: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'file path' },
        content: { type: 'string', description: 'full file content' },
      },
      required: ['path', 'content'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      const content = str(args, 'content');
      await ctx.fs.writeFile(p, content);
      return `wrote ${content.split('\n').length} lines to ${p}`;
    },
  },
  {
    name: 'fs.append',
    description: 'Append text to the end of a file (created if missing).',
    danger: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      await ctx.fs.writeFile(p, str(args, 'content'), { append: true });
      return `appended to ${p}`;
    },
  },
  {
    name: 'fs.delete',
    description: 'Delete a file or directory from the workspace.',
    danger: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        recursive: { type: 'boolean', description: 'allow deleting non-empty directories' },
      },
      required: ['path'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      await ctx.fs.delete(p, Boolean(args.recursive));
      return `deleted ${p}`;
    },
  },
  {
    name: 'fs.mkdir',
    description: 'Create a directory (and parents).',
    danger: true,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      await ctx.fs.ensureDir(p);
      return `created ${p}`;
    },
  },
  {
    name: 'fs.search',
    description: 'Search file contents under the current workspace for a case-insensitive substring. Returns path:line:text matches.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number', description: 'default 80' },
      },
      required: ['query'],
    },
    run: async (args, ctx) => {
      const q = str(args, 'query');
      const results = await ctx.fs.search(ctx.cwd, q, { maxResults: Number(args.maxResults) || 80 });
      if (!results.length) return `no matches for "${q}"`;
      return results.map((r) => `${r.path}:${r.line}: ${r.text}`).join('\n');
    },
  },

  // -------------------------------------------------------------- code ----
  {
    name: 'code.analyze',
    description:
      'Static outline of a source file: language, line count, imports, classes, functions, exports and TODO/FIXME markers. No execution.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      const outline = await analyzeFile(ctx.fs, p);
      return JSON.stringify(outline, null, 1);
    },
  },
  {
    name: 'code.edit',
    description:
      'Apply exact find→replace edits to a file. Each edit is applied in order; "find" must occur in the file (or after previous edits) or the whole operation fails without changes.',
    danger: true,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        edits: {
          type: 'array',
          description: 'list of {find, replace, replaceAll?}',
          items: {
            type: 'object',
            properties: {
              find: { type: 'string' },
              replace: { type: 'string' },
              replaceAll: { type: 'boolean' },
            },
            required: ['find', 'replace'],
          },
        },
      },
      required: ['path', 'edits'],
    },
    run: async (args, ctx) => {
      const p = resolveAgentPath(ctx, str(args, 'path'));
      const edits = args.edits as Array<{ find: string; replace: string; replaceAll?: boolean }>;
      if (!Array.isArray(edits) || !edits.length) throw new FsError('edits must be a non-empty array', 'EINVAL');
      let text = (await ctx.fs.readText(p)) as string;
      let changes = 0;
      for (const [i, edit] of edits.entries()) {
        const count = text.split(edit.find).length - 1;
        if (count === 0) {
          throw new Error(
            `edit #${i + 1}: pattern not found in ${p}: ${truncate(edit.find, 80)}`,
          );
        }
        if (edit.replaceAll || count > 1) {
          text = text.split(edit.find).join(edit.replace);
          changes += count;
        } else {
          text = text.replace(edit.find, edit.replace);
          changes += 1;
        }
      }
      await ctx.fs.writeFile(p, text);
      return `applied ${changes} change(s) to ${p}`;
    },
  },

  // --------------------------------------------------------------- git ----
  {
    name: 'git.status',
    description: 'Show the git working tree status (branch, staged, modified, untracked).',
    readOnly: true,
    parameters: { type: 'object', properties: {}, required: [] },
    run: async (_args, ctx) => {
      await requireRepo(ctx);
      return (await ctx.shell.git(ctx.cwd).status()).stdout || '(clean)';
    },
  },
  {
    name: 'git.add',
    description: 'Stage files for commit. Use path "." to stage everything.',
    danger: true,
    parameters: {
      type: 'object',
      properties: { paths: { type: 'array', items: { type: 'string' } } },
      required: ['paths'],
    },
    run: async (args, ctx) => {
      await requireRepo(ctx);
      const paths = (args.paths as string[]) ?? [];
      return (await ctx.shell.git(ctx.cwd).add(paths)).stdout;
    },
  },
  {
    name: 'git.commit',
    description: 'Commit staged changes with a conventional-commit message, e.g. "feat(auth): add login".',
    danger: true,
    parameters: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
    run: async (args, ctx) => {
      await requireRepo(ctx);
      return (await ctx.shell.git(ctx.cwd).commit({ message: str(args, 'message') })).stdout;
    },
  },
  {
    name: 'git.log',
    description: 'Show recent commit history.',
    readOnly: true,
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      required: [],
    },
    run: async (args, ctx) => {
      await requireRepo(ctx);
      const res = await ctx.shell.git(ctx.cwd).log(['--oneline', '-n', String(Number(args.limit) || 15)]);
      return res.stdout || '(no commits yet)';
    },
  },
  {
    name: 'git.diff',
    description: 'Show unstaged changes versus HEAD.',
    readOnly: true,
    parameters: { type: 'object', properties: {}, required: [] },
    run: async (_args, ctx) => {
      await requireRepo(ctx);
      return (await ctx.shell.git(ctx.cwd).diff()).stdout;
    },
  },
  {
    name: 'git.branch',
    description: 'List branches, or create one when "name" is given.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: [],
    },
    run: async (args, ctx) => {
      await requireRepo(ctx);
      const git = ctx.shell.git(ctx.cwd);
      return args.name ? (await git.branch([String(args.name)])).stdout : (await git.branch([])).stdout;
    },
  },
  {
    name: 'git.checkout',
    description: 'Switch branches (creates with "create": true). Materializes the branch files into the workspace.',
    danger: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        create: { type: 'boolean' },
      },
      required: ['name'],
    },
    run: async (args, ctx) => {
      await requireRepo(ctx);
      const flags = args.create ? ['-b'] : [];
      return (await ctx.shell.git(ctx.cwd).checkout([...flags, str(args, 'name')])).stdout;
    },
  },

  // -------------------------------------------------------------- exec ----
  {
    name: 'exec.run',
    description:
      'Execute code locally. runtime "bash" runs lines in the XCoder virtual shell (ls, cat, git, npm…). runtime "js" evaluates JavaScript in a sandbox with captured console. runtime "python" runs Pyodide (first call downloads the runtime).',
    danger: true,
    parameters: {
      type: 'object',
      properties: {
        runtime: { type: 'string', enum: ['bash', 'js', 'python'] },
        command: { type: 'string', description: 'bash: a single command line' },
        code: { type: 'string', description: 'js/python: source code to run' },
      },
      required: ['runtime'],
    },
    run: async (args, ctx) => {
      const runtime = str(args, 'runtime');
      if (ctx.signal?.aborted) throw new Error('aborted');
      if (runtime === 'bash') {
        const command = str(args, 'command');
        const out = command.includes('\n')
          ? await ctx.shell.runScript(command)
          : await ctx.shell.run(command);
        const text = [out.stdout, out.stderr].filter(Boolean).join('\n').trim();
        return truncate(text || '(no output)', 8000);
      }
      if (runtime === 'js') {
        const res = await runJsSandbox(str(args, 'code'));
        return truncate([res.stdout, res.stderr].filter(Boolean).join('\n') || '(no output)', 8000);
      }
      if (runtime === 'python') {
        const res = await runPython(str(args, 'code'));
        return truncate(res.output || '(no output)', 8000);
      }
      throw new FsError(`unknown runtime: ${runtime} (use bash|js|python)`, 'EINVAL');
    },
  },

  // ------------------------------------------------------------ agent ----
  {
    name: 'agent.spawn',
    description:
      'Delegate a task to a subagent. Available: "coder" (writes code, uses fs/code/git/exec), "analyzer" (read-only analysis), "ops" (runs commands). Returns the subagent final report.',
    parameters: {
      type: 'object',
      properties: {
        subagent: { type: 'string', enum: ['coder', 'analyzer', 'ops'] },
        task: { type: 'string' },
      },
      required: ['subagent', 'task'],
    },
    run: async (args, ctx) => ctx.spawn(str(args, 'subagent'), str(args, 'task')),
  },

  // --------------------------------------------------------------- app ----
  {
    name: 'app.info',
    description: 'Introspect the app: workspace roots, current directory, open editor tabs and active AI provider.',
    readOnly: true,
    parameters: { type: 'object', properties: {}, required: [] },
    run: async (_args, ctx) => {
      const { editorManager } = await import('../editor/editorManager');
      const { providers } = await import('../ai');
      const info = {
        cwd: ctx.cwd,
        roots: ctx.fs.listRoots(),
        openFiles: editorManager.order.map((id) => editorManager.sessions.get(id)!.path),
        activeFile: editorManager.activePath(),
        provider: providers.active
          ? { label: providers.active.label, model: providers.active.model, api: providers.active.api }
          : null,
      };
      return JSON.stringify(info, null, 1);
    },
  },
];

export const TOOL_MAP = new Map(BUILTIN_TOOLS.map((t) => [t.name, t]));
