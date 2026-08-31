/**
 * AgentOrchestrator — the reasoning loop.
 *
 *   user task → [LLM ⇄ tools]* → final answer
 *
 * Works with any configured provider (OpenAI-compatible, Anthropic, Gemini).
 * Dangerous tools require user confirmation through the PermissionManager.
 */

import { AgentEvent, AgentResult, AgentRunOptions, ToolContext, PermissionRequest } from './types';
import { TOOL_MAP } from './tools';
import { SUBAGENT_MAP, SUBAGENTS } from './subagents';
import { ChatMessage, ToolDef } from '../ai/types';
import { Workspace } from '../file';
import { Shell } from '../terminal/shell';
import { truncate } from '../../lib/helpers';

export interface OrchestratorDeps {
  fs: Workspace;
  shell: Shell;
  /** returns the client for the active provider, or null */
  getClient: () => { chat(opts: { messages: ChatMessage[]; tools?: ToolDef[]; signal?: AbortSignal }): Promise<ChatMessage> } | null;
  getActiveModel: () => string | null;
  confirm(req: PermissionRequest): Promise<boolean>;
  cwd(): string;
}

const MAX_TOOL_OUTPUT = 6000;

export class AgentOrchestrator {
  private runs = 0;

  constructor(private deps: OrchestratorDeps) {}

  listTools(): ToolDef[] {
    return [...TOOL_MAP.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  listSubagents(): Array<{ name: string; description: string }> {
    return SUBAGENTS.map((s) => ({ name: s.name, description: s.description }));
  }

  private systemPrompt(subagentName: string | undefined): string {
    const cwd = this.deps.cwd();
    if (subagentName) {
      const def = SUBAGENT_MAP.get(subagentName);
      return `${def?.system ?? ''}\n\nWorking directory: ${cwd}`;
    }
    return [
      'You are XCoder Agent, an autonomous AI coding agent running inside a mobile code editor.',
      'You have tools to read and write files, edit code precisely, run git commands,',
      'and execute bash (virtual shell), JavaScript and Python locally.',
      '',
      'Operating rules:',
      '1. Plan briefly, then act with tools. One concise thought between tool calls is enough.',
      '2. Read files (fs.read) before editing; use code.edit for surgical changes, fs.write only for new files or full rewrites.',
      '3. Verify your changes when possible (read the file back, run exec.run with js/bash).',
      '4. Use git.commit only when the user asks for it, with conventional-commit messages.',
      '5. Delegate well-scoped subtasks with agent.spawn (coder/analyzer/ops).',
      '6. If a tool fails, adapt; do not repeat the identical call more than once.',
      '7. Final answer: a compact summary in plain text — what you did, files touched, next steps.',
      '',
      `Working directory: ${cwd}`,
      `Model: ${this.deps.getActiveModel() ?? 'unknown'}`,
    ].join('\n');
  }

  private makeCtx(runId: string, agent: string, opts: AgentRunOptions): ToolContext {
    return {
      fs: this.deps.fs,
      shell: this.deps.shell,
      cwd: this.deps.cwd(),
      confirm: (req) => this.deps.confirm(req),
      emit: (evt) => {
        const full = { ...evt, runId, agent } as AgentEvent;
        opts.onEvent?.(full);
      },
      spawn: async (subagent, task) => {
        const res = await this.run(task, { ...opts, subagent });
        return res.output;
      },
      signal: opts.signal,
    };
  }

  async run(task: string, opts: AgentRunOptions = {}): Promise<AgentResult> {
    const runId = `run-${++this.runs}-${Date.now().toString(36)}`;
    const agent = opts.subagent ?? 'main';
    const client = this.deps.getClient();
    if (!client) {
      const msg = 'no AI provider configured';
      opts.onEvent?.({ type: 'error', runId, agent, data: msg });
      return { ok: false, output: msg, steps: 0, agent, messages: [] };
    }
    const def = opts.subagent ? SUBAGENT_MAP.get(opts.subagent) : undefined;
    const tools = (def ? def.tools : [...TOOL_MAP.keys()])
      .map((name) => TOOL_MAP.get(name))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    const toolDefs: ToolDef[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
    const maxSteps = opts.maxSteps ?? def?.maxSteps ?? 25;
    const ctx = this.makeCtx(runId, agent, opts);

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt(opts.subagent) },
      { role: 'user', content: task },
    ];

    ctx.emit({ type: 'run-start', data: { task, agent, maxSteps } });
    let steps = 0;
    let finalOutput = '';

    try {
      for (steps = 1; steps <= maxSteps; steps++) {
        if (opts.signal?.aborted) throw new Error('aborted by user');
        const assistant = await client.chat({ messages, tools: toolDefs, signal: opts.signal });
        messages.push(assistant);

        if (assistant.content) {
          ctx.emit({ type: 'message', data: { role: 'assistant', content: assistant.content } });
        }
        const calls = assistant.toolCalls ?? [];
        if (!calls.length) {
          finalOutput = assistant.content;
          break;
        }
        for (const call of calls) {
          const tool = TOOL_MAP.get(call.name);
          ctx.emit({ type: 'tool-call', data: { id: call.id, name: call.name, args: safeJson(call.arguments) } });
          if (!tool) {
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.name,
              content: `error: unknown tool "${call.name}"`,
            });
            ctx.emit({ type: 'tool-result', data: { id: call.id, name: call.name, ok: false, result: 'unknown tool' } });
            continue;
          }
          let permitted = true;
          if (tool.danger) {
            const args = safeJson(call.arguments);
            ctx.emit({ type: 'permission', data: { tool: tool.name, args } });
            permitted = await this.deps.confirm({
              tool: tool.name,
              action: 'run',
              path: typeof args?.path === 'string' ? args.path : undefined,
              summary: describeCall(tool.name, args),
            });
          }
          let resultText: string;
          let ok = true;
          if (!permitted) {
            resultText = 'denied by user';
            ok = false;
          } else {
            try {
              resultText = await tool.run(safeJson(call.arguments) ?? {}, ctx);
              resultText = truncate(resultText, MAX_TOOL_OUTPUT);
            } catch (err) {
              resultText = `error: ${(err as Error).message}`;
              ok = false;
            }
          }
          messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: resultText });
          ctx.emit({ type: 'tool-result', data: { id: call.id, name: call.name, ok, result: resultText } });
        }
      }
      if (!finalOutput && steps > maxSteps) {
        finalOutput = `Stopped after ${maxSteps} steps (max steps reached).`;
        ctx.emit({ type: 'error', data: 'max steps reached' });
      }
    } catch (err) {
      const msg = (err as Error).message;
      ctx.emit({ type: 'error', data: msg });
      finalOutput = finalOutput || `Agent failed: ${msg}`;
      const failed = true;
      ctx.emit({ type: 'run-end', data: { ok: !failed, steps } });
      return {
        ok: false,
        output: `Agent failed: ${msg}`,
        steps,
        agent,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      };
    }

    ctx.emit({ type: 'run-end', data: { ok: true, steps } });
    return {
      ok: true,
      output: finalOutput || '(no final message)',
      steps,
      agent,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
  }
}

function safeJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw || '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function describeCall(tool: string, args: Record<string, unknown> | null): string {
  if (!args) return tool;
  const parts: string[] = [];
  if (typeof args.path === 'string') parts.push(args.path);
  if (typeof args.command === 'string') parts.push(truncate(args.command, 60));
  if (typeof args.message === 'string') parts.push(`"${truncate(args.message, 40)}"`);
  if (typeof args.runtime === 'string') parts.push(`(${args.runtime})`);
  if (typeof args.subagent === 'string') parts.push(args.subagent);
  return parts.length ? parts.join(' · ') : tool;
}
