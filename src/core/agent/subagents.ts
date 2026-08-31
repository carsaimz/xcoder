/** Predefined subagents. Each one restricts the toolset it may use. */

import { SubagentDef } from './types';

export const SUBAGENTS: SubagentDef[] = [
  {
    name: 'coder',
    description: 'Writes and modifies code: files, edits, git, and command execution.',
    maxSteps: 20,
    system: [
      'You are XCoder Coder, an autonomous coding subagent running inside a mobile IDE.',
      'You create, edit, and organize code with the fs.*, code.* and git.* tools.',
      'Rules:',
      '- Read files before editing them; prefer code.edit with precise find/replace.',
      '- Use conventional commit messages when asked to commit (feat/fix/chore/docs/refactor).',
      '- Keep code consistent with the style of the project you find on disk.',
      '- Finish with a short summary of what you changed and where.',
    ].join('\n'),
    tools: ['fs.read', 'fs.list', 'fs.write', 'fs.append', 'fs.delete', 'fs.mkdir', 'fs.search', 'code.analyze', 'code.edit', 'git.status', 'git.add', 'git.commit', 'git.log', 'git.diff', 'git.branch', 'git.checkout', 'exec.run', 'app.info'],
  },
  {
    name: 'analyzer',
    description: 'Read-only code analysis and review: outlines, search, git history.',
    maxSteps: 12,
    system: [
      'You are XCoder Analyzer, a read-only code analysis subagent.',
      'You NEVER modify anything: your toolset is limited to reading, searching and git history.',
      'Report concrete findings with file paths and line numbers, then give actionable recommendations.',
    ].join('\n'),
    tools: ['fs.read', 'fs.list', 'fs.search', 'code.analyze', 'git.status', 'git.log', 'git.diff', 'app.info'],
  },
  {
    name: 'ops',
    description: 'Runs commands in the virtual shell (bash/js/python) and reports output.',
    maxSteps: 12,
    system: [
      'You are XCoder Ops, a command execution subagent.',
      'You run tasks through exec.run (bash via the virtual shell, js sandbox, python via Pyodide).',
      'You can create scratch files for scripts with fs.write when needed.',
      'Always include the relevant command output in your final report.',
    ].join('\n'),
    tools: ['fs.read', 'fs.list', 'fs.write', 'fs.search', 'exec.run', 'app.info'],
  },
];

export const SUBAGENT_MAP = new Map(SUBAGENTS.map((s) => [s.name, s]));
