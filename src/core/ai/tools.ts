/**
 * Agent tools — the executable capabilities an AI agent can call:
 * file CRUD, code search, repo map, virtual shell commands, git operations
 * and subagent delegation.
 *
 * Tools receive an `AgentToolEnv` (injected by the manager) so they are fully
 * testable in Node without the terminal/UI stack.
 */

import * as fs from '@core/file/fs';
import { resolve, basename } from '@lib/path';
import type { ToolSpec } from './client';

export type ToolRisk = 'safe' | 'write' | 'exec' | 'danger';

export interface AgentToolEnv {
  /** run a line in the virtual shell (or a test double) */
  runCommand(line: string): Promise<{ code: number; output: string }>;
  /** ask the human a question (UI dialog); null = cancelled */
  askUser(question: string): Promise<string | null>;
  /** delegate a task to a subagent */
  spawnSubagent(agentId: string, task: string): Promise<string>;
  /** base directory URL used to resolve relative paths */
  cwdUrl(): string;
  /** active editor URL, if any */
  activeUrl?(): string | null;
  /** text selected in the active editor, if any */
  activeSelection?(): string | null;
}

export interface AiToolDef {
  spec: ToolSpec;
  risk: ToolRisk;
  /** short human-readable description for permission cards */
  label: string;
}

const JSON_STR = { type: 'string' } as const;
const JSON_NUM = { type: 'number' } as const;
const JSON_BOOL = { type: 'boolean' } as const;

const GIT_READ_ACTIONS = ['status', 'log', 'diff', 'branch', 'show'];
const GIT_WRITE_ACTIONS = ['add', 'commit', 'checkout', 'switch', 'tag', 'stash', 'restore', 'rm', 'mv', 'init'];
const GIT_NET_ACTIONS = ['push', 'pull', 'fetch', 'clone', 'remote'];

export const AI_TOOLS: AiToolDef[] = [
  {
    label: 'List directory',
    risk: 'safe',
    spec: {
      name: 'list_dir',
      description:
        'List files/directories as a tree. Use it to explore the workspace before reading files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory URL or path relative to the workspace root. Omit for the root.' },
          depth: { ...JSON_NUM, description: 'Tree depth (default 2, max 4)' }
        }
      }
    }
  },
  {
    label: 'Read file',
    risk: 'safe',
    spec: {
      name: 'read_file',
      description:
        'Read a text file with numbered lines (max 400 lines / 48 KB per call). Use offset to page through large files.',
      parameters: {
        type: 'object',
        properties: {
          path: { ...JSON_STR, description: 'File URL or relative path' },
          offset: { ...JSON_NUM, description: '1-based first line (default 1)' },
          limit: { ...JSON_NUM, description: 'Max lines (default 400)' }
        },
        required: ['path']
      }
    }
  },
  {
    label: 'Search code',
    risk: 'safe',
    spec: {
      name: 'search_code',
      description: 'Search filenames and file contents (case-insensitive substring) across the workspace.',
      parameters: {
        type: 'object',
        properties: {
          query: { ...JSON_STR, description: 'Search text' },
          path: { ...JSON_STR, description: 'Root to search from (default workspace root)' }
        },
        required: ['query']
      }
    }
  },
  {
    label: 'Read editor selection',
    risk: 'safe',
    spec: {
      name: 'read_selection',
      description: 'Read the text currently selected in the open editor.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    label: 'Create file',
    risk: 'write',
    spec: {
      name: 'create_file',
      description: 'Create a new file with content (parent folders are created automatically). Fails if it already exists.',
      parameters: {
        type: 'object',
        properties: {
          path: { ...JSON_STR, description: 'File URL or relative path' },
          content: { ...JSON_STR, description: 'Full file content' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    label: 'Edit file',
    risk: 'write',
    spec: {
      name: 'edit_file',
      description:
        'Edit an existing file by exact text replacement. `old_text` must match the file exactly (copy it from read_file, including indentation). Fails when not found or not unique unless replace_all is true.',
      parameters: {
        type: 'object',
        properties: {
          path: { ...JSON_STR, description: 'File URL or relative path' },
          old_text: { ...JSON_STR, description: 'Exact text to replace' },
          new_text: { ...JSON_STR, description: 'Replacement text' },
          replace_all: { ...JSON_BOOL, description: 'Replace every occurrence (default false)' }
        },
        required: ['path', 'old_text', 'new_text']
      }
    }
  },
  {
    label: 'Move / rename',
    risk: 'write',
    spec: {
      name: 'move_path',
      description: 'Move or rename a file or directory.',
      parameters: {
        type: 'object',
        properties: {
          from: { ...JSON_STR, description: 'Source URL or relative path' },
          to: { ...JSON_STR, description: 'Destination URL or relative path' }
        },
        required: ['from', 'to']
      }
    }
  },
  {
    label: 'Delete file/folder',
    risk: 'danger',
    spec: {
      name: 'delete_path',
      description: 'Permanently delete a file or directory. Requires explicit user approval.',
      parameters: {
        type: 'object',
        properties: { path: { ...JSON_STR, description: 'Path to delete' } },
        required: ['path']
      }
    }
  },
  {
    label: 'Run command',
    risk: 'exec',
    spec: {
      name: 'run_command',
      description:
        'Run a shell command in the virtual shell (xsh): ls, cat, git, npm, node -e, python (when proot is available), echo, grep… Returns stdout/stderr and the exit code.',
      parameters: {
        type: 'object',
        properties: {
          command: { ...JSON_STR, description: 'The command line to execute' }
        },
        required: ['command']
      }
    }
  },
  {
    label: 'Git operation',
    risk: 'safe',
    spec: {
      name: 'git',
      description:
        'Run a git command in the repository. Read actions (status, log, diff, branch, show) run without approval; write actions (add, commit, checkout, tag…) and network actions (push, pull, clone) require approval.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: [...GIT_READ_ACTIONS, ...GIT_WRITE_ACTIONS, ...GIT_NET_ACTIONS] },
          args: { ...JSON_STR, description: 'Extra arguments, e.g. "--stat" or "main" or "."' },
          message: { ...JSON_STR, description: 'Commit message (for action=commit, used as -m)' }
        },
        required: ['action']
      }
    }
  },
  {
    label: 'Spawn subagent',
    risk: 'safe',
    spec: {
      name: 'spawn_subagent',
      description:
        'Delegate a self-contained task to a specialist subagent (developer, analyzer, reader, file-ops, git, runner). Returns the subagent final report.',
      parameters: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            enum: ['developer', 'analyzer', 'reader', 'file-ops', 'git', 'runner']
          },
          task: { ...JSON_STR, description: 'Full, self-contained task description for the subagent' }
        },
        required: ['agent', 'task']
      }
    }
  },
  {
    label: 'Ask the user',
    risk: 'safe',
    spec: {
      name: 'ask_user',
      description: 'Ask the human one clarifying question. Use when the task is ambiguous.',
      parameters: {
        type: 'object',
        properties: { question: { ...JSON_STR } },
        required: ['question']
      }
    }
  }
];

export function toolByName(name: string): AiToolDef | undefined {
  return AI_TOOLS.find((t) => t.spec.name === name);
}

export function toolRisk(name: string): ToolRisk {
  if (name === 'git') return 'safe'; // refined per-action in executeTool
  return toolByName(name)?.risk ?? 'exec';
}

/** git sub-action risk (exported for the permission gate). */
export function gitActionRisk(action: string): ToolRisk {
  if (GIT_READ_ACTIONS.includes(action)) return 'safe';
  if (GIT_WRITE_ACTIONS.includes(action)) return 'write';
  if (GIT_NET_ACTIONS.includes(action)) return 'exec';
  return 'exec';
}

// ── helpers ──────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'platforms', 'plugins', '.gradle', 'build', 'dist', '__pycache__']);

function resolvePath(p: string | undefined, env: AgentToolEnv): string {
  if (!p || !p.trim()) return env.cwdUrl();
  return resolve(env.cwdUrl(), p.trim());
}

const MAX_LIST = 300;
const MAX_READ_LINES = 400;
const MAX_READ_BYTES = 48 * 1024;
const MAX_CMD_OUTPUT = 8 * 1024;

async function listTree(root: string, maxDepth: number): Promise<string> {
  const lines: string[] = [];
  let count = 0;
  async function walk(url: string, depth: number, prefix: string): Promise<void> {
    if (depth > maxDepth || count >= MAX_LIST) return;
    let entries: fs.FileEntry[];
    try {
      entries = await fs.list(url);
    } catch {
      lines.push(`${prefix}(unreadable)`);
      return;
    }
    const dirs = entries.filter((e) => e.isDir && !SKIP_DIRS.has(e.name));
    const files = entries.filter((e) => !e.isDir);
    for (const d of dirs) {
      if (count++ >= MAX_LIST) {
        lines.push(`${prefix}… (truncated)`);
        return;
      }
      lines.push(`${prefix}${d.name}/`);
      await walk(d.url, depth + 1, `${prefix}  `);
    }
    for (const f of files) {
      if (count++ >= MAX_LIST) {
        lines.push(`${prefix}… (truncated)`);
        return;
      }
      lines.push(`${prefix}${f.name}`);
    }
  }
  lines.push(`${basename(root) || root}`);
  await walk(root, 1, '  ');
  return lines.join('\n');
}

function lineDiffSummary(oldText: string, newText: string): { added: number; removed: number } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const oldSet = new Map<string, number>();
  for (const l of oldLines) oldSet.set(l, (oldSet.get(l) ?? 0) + 1);
  let kept = 0;
  for (const l of newLines) {
    const n = oldSet.get(l) ?? 0;
    if (n > 0) {
      oldSet.set(l, n - 1);
      kept++;
    }
  }
  return { added: newLines.length - kept, removed: oldLines.length - kept };
}

// ── executor ─────────────────────────────────────────────────────────────────

/** Execute one tool call and return a text result for the model. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  env: AgentToolEnv
): Promise<string> {
  const str = (k: string): string => String(args[k] ?? '');
  const num = (k: string): number | undefined =>
    args[k] === undefined ? undefined : Number(args[k]);

  switch (name) {
    case 'list_dir': {
      const root = resolvePath(str('path') || undefined, env);
      const depth = Math.min(4, Math.max(1, num('depth') ?? 2));
      return listTree(root, depth);
    }

    case 'read_file': {
      const url = resolvePath(str('path'), env);
      const content = await fs.read(url);
      // a single trailing newline is a POSIX terminator, not an extra line
      const body = content.endsWith('\n') ? content.slice(0, -1) : content;
      const allLines = body.split('\n');
      const offset = Math.max(1, num('offset') ?? 1);
      const limit = Math.min(MAX_READ_LINES, Math.max(1, num('limit') ?? MAX_READ_LINES));
      const slice = allLines.slice(offset - 1, offset - 1 + limit);
      let out = slice.map((line, i) => `${offset + i}| ${line}`).join('\n');
      if (content.length > MAX_READ_BYTES) {
        out = out.slice(0, MAX_READ_BYTES) + '\n… (output truncated)';
      }
      const more = offset - 1 + limit < allLines.length;
      return `${url} (${allLines.length} lines)\n${out}${more ? `\n… (${allLines.length - (offset - 1 + limit)} more lines — use offset)` : ''}`;
    }

    case 'search_code': {
      const root = resolvePath(str('path') || undefined, env);
      const hits = await fs.search(root, str('query'), { maxResults: 60 });
      if (!hits.length) return 'No matches.';
      return hits
        .map((h) => {
          const preview = h.preview ? ` — ${h.preview.trim().slice(0, 120)}` : '';
          return `${h.url}${preview}`;
        })
        .join('\n');
    }

    case 'read_selection': {
      const sel = env.activeSelection?.();
      if (!sel) return 'No active selection. Ask the user to select code, or use read_file.';
      return `Selection from ${env.activeUrl?.() ?? 'editor'}:\n${sel}`;
    }

    case 'create_file': {
      const url = resolvePath(str('path'), env);
      await fs.createFile(url, str('content'));
      return `Created ${url} (${str('content').length} bytes).`;
    }

    case 'edit_file': {
      const url = resolvePath(str('path'), env);
      const content = await fs.read(url);
      const oldText = str('old_text');
      const newText = str('new_text');
      if (!content.includes(oldText)) {
        return (
          `ERROR: old_text not found in ${url}. Read the file again and copy the exact text ` +
          `(whitespace matters).`
        );
      }
      const replaceAll = args['replace_all'] === true;
      if (!replaceAll) {
        const first = content.indexOf(oldText);
        if (content.indexOf(oldText, first + 1) !== -1) {
          return `ERROR: old_text matches multiple locations in ${url}. Include more surrounding text to make it unique, or set replace_all=true.`;
        }
      }
      const next = replaceAll
        ? content.split(oldText).join(newText)
        : content.replace(oldText, newText);
      const { added, removed } = lineDiffSummary(content, next);
      await fs.write(url, next);
      return `Edited ${url} (+${added} -${removed} lines).`;
    }

    case 'move_path': {
      const from = resolvePath(str('from'), env);
      const to = resolvePath(str('to'), env);
      await fs.rename(from, to);
      return `Moved ${from} → ${to}.`;
    }

    case 'delete_path': {
      const url = resolvePath(str('path'), env);
      await fs.deletePath(url);
      return `Deleted ${url}.`;
    }

    case 'run_command': {
      const { code, output } = await env.runCommand(str('command'));
      const trimmed =
        output.length > MAX_CMD_OUTPUT ? output.slice(0, MAX_CMD_OUTPUT) + '\n… (truncated)' : output;
      return `exit code: ${code}\n${trimmed || '(no output)'}`;
    }

    case 'git': {
      const action = str('action');
      const parts = ['git', action];
      if (action === 'commit' && str('message')) {
        parts.push('-m', JSON.stringify(str('message')));
      }
      if (str('args')) parts.push(str('args'));
      const { code, output } = await env.runCommand(parts.join(' '));
      const trimmed =
        output.length > MAX_CMD_OUTPUT ? output.slice(0, MAX_CMD_OUTPUT) + '\n… (truncated)' : output;
      return `git ${action} → exit code: ${code}\n${trimmed || '(no output)'}`;
    }

    case 'spawn_subagent': {
      return env.spawnSubagent(str('agent'), str('task'));
    }

    case 'ask_user': {
      const answer = await env.askUser(str('question'));
      return answer === null ? '(user dismissed the question)' : answer;
    }

    default:
      return `ERROR: unknown tool "${name}"`;
  }
}
