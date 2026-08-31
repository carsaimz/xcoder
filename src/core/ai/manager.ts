/**
 * AI manager — sessions, configuration, the agent tool-loop and subagent
 * delegation. Emits `ai:*` events for the chat UI.
 *
 * Permission model (settings `ai.approval`):
 *   careful  — read-only tools run free; every write/exec/danger asks
 *   balanced — read+write run free; exec/danger ask
 *   auto     — everything runs free (user explicitly opted in)
 */

import { KVStore } from '@lib/storage';
import { uuid } from '@lib/helpers';
import { Emitter } from '@lib/events';
import { settings } from '@api/settings';
import * as fs from '@core/file/fs';
import { workspace } from '@core/file/workspace';
import { createClient, AIError, type AiMessage, type ChatResult } from './client';
import type { CustomProvider } from './providers';
import { AGENTS, getAgent, toolSpecsFor, type AgentDef, type AgentId } from './agents';
import {
  AI_TOOLS,
  executeTool,
  gitActionRisk,
  toolRisk,
  type AgentToolEnv,
  type ToolRisk
} from './tools';
import { resolveProvider, DEFAULT_PROVIDER_ID, DEFAULT_MODEL } from './providers';

export interface AiSessionMeta {
  id: string;
  title: string;
  agentId: AgentId;
  providerId: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  usage: { promptTokens: number; completionTokens: number };
}

export interface AiSession extends AiSessionMeta {
  messages: AiMessage[];
}

export type ApprovalMode = 'careful' | 'balanced' | 'auto';

export type ApprovalDecision = 'allow' | 'deny' | 'always';

export interface ApprovalRequest {
  sessionId: string;
  tool: string;
  label: string;
  risk: ToolRisk;
  /** human-readable summary of what will happen (path / command…) */
  detail: string;
  resolve(decision: ApprovalDecision): void;
}

export interface AiEventMap {
  [key: string]: unknown;
  'ai:run-start': { sessionId: string; runId: string; agentId: string; depth: number };
  'ai:delta': { sessionId: string; runId: string; depth: number; text: string };
  'ai:tool-start': {
    sessionId: string;
    runId: string;
    depth: number;
    callId: string;
    name: string;
    args: Record<string, unknown>;
    risk: ToolRisk;
  };
  'ai:tool-end': {
    sessionId: string;
    runId: string;
    depth: number;
    callId: string;
    ok: boolean;
    result: string;
  };
  'ai:note': { sessionId: string; depth: number; text: string };
  'ai:approval': { request: ApprovalRequest };
  'ai:run-end': { sessionId: string; runId: string; depth: number; ok: boolean; error?: string };
  'ai:session-changed': { id: string };
  'ai:sessions-changed': Record<string, never>;
}

export interface SendMessageContext {
  file?: boolean;
  selection?: boolean;
  tree?: boolean;
}

interface RunOptions {
  sessionId: string;
  runId: string;
  messages: AiMessage[];
  agent: AgentDef;
  depth: number;
}

const MAX_RESULT_CHARS = 16 * 1024;
const MAX_DEPTH = 2;

const store = new KVStore('kv', 'ai:');
const indexKey = 'index';

class AiManager {
  readonly events = new Emitter<AiEventMap>();

  private sessions = new Map<string, AiSession>();
  private index: AiSessionMeta[] = [];
  private loaded = false;
  private activeId: string | null = null;
  private controllers = new Map<string, AbortController>();
  private runs = new Map<string, Promise<string>>();
  /** tools approved with "always" for the current app run */
  private alwaysAllowed = new Set<string>();

  /** UI installs this to render permission cards. */
  approvalHandler: ((req: ApprovalRequest) => void) | null = null;
  /** UI installs this to answer `ask_user`. */
  askHandler: ((question: string) => Promise<string | null>) | null = null;
  /** boot wiring: returns the active editor snapshot (url + text) or null. */
  activeEditorProvider: (() => { url: string; text: string } | null) | null = null;
  /** boot wiring: returns the text selected in the active editor or null. */
  activeSelectionProvider: (() => string | null) | null = null;
  /** test/extension hook: override client construction. */
  clientFactory: ((opts: {
    providerId: string;
    baseURL: string;
    apiKey?: string;
    apiStyle: 'openai' | 'anthropic';
  }) => ReturnType<typeof createClient>) | null = null;

  // ── configuration ──────────────────────────────────────────────────────────

  private clientConfig(): {
    client: ReturnType<typeof createClient>;
    providerId: string;
    model: string;
  } {
    const providerId = (settings.get('ai.provider') as string) || DEFAULT_PROVIDER_ID;
    const custom = settings.get('ai.customProviders') as CustomProvider[];
    const provider = resolveProvider(providerId, custom);
    if (!provider) throw new AIError(providerId, 0, `unknown provider "${providerId}"`);
    const model = (settings.get('ai.model') as string) || DEFAULT_MODEL;
    const keys = (settings.get('ai.keys') as Record<string, string>) ?? {};
    const apiKey = keys[providerId] ?? '';
    if (provider.needsKey && !apiKey) {
      throw new AIError(providerId, 401, `no API key for ${provider.name} — open Settings → AI`);
    }
    const client = this.clientFactory
      ? this.clientFactory({ providerId: provider.id, baseURL: provider.baseURL, apiKey, apiStyle: provider.apiStyle })
      : createClient({
          providerId: provider.id,
          baseURL: provider.baseURL,
          apiKey,
          apiStyle: provider.apiStyle
        });
    return { client, providerId, model };
  }

  get temperature(): number {
    return settings.get('ai.temperature') as number;
  }

  get maxTokens(): number {
    return settings.get('ai.maxTokens') as number;
  }

  get streaming(): boolean {
    return settings.get('ai.streaming') as boolean;
  }

  get approvalMode(): ApprovalMode {
    return (settings.get('ai.approval') as ApprovalMode) ?? 'careful';
  }

  // ── sessions ───────────────────────────────────────────────────────────────

  async load(): Promise<void> {
    if (this.loaded) return;
    this.index = (await store.get<AiSessionMeta[]>(indexKey)) ?? [];
    this.loaded = true;
  }

  async listSessions(): Promise<AiSessionMeta[]> {
    await this.load();
    return [...this.index].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get activeSessionId(): string | null {
    return this.activeId;
  }

  async openSession(id: string): Promise<AiSession> {
    await this.load();
    let s = this.sessions.get(id);
    if (!s) {
      const messages = (await store.get<AiMessage[]>(`session:${id}`)) ?? [];
      const meta = this.index.find((m) => m.id === id);
      if (!meta) throw new Error(`[ai] unknown session ${id}`);
      s = { ...meta, messages };
      this.sessions.set(id, s);
    }
    this.activeId = id;
    this.events.emit('ai:session-changed', { id });
    return s;
  }

  async newSession(agentId: AgentId = 'chat'): Promise<AiSession> {
    await this.load();
    const { providerId, model } = this.safeMeta();
    const meta: AiSessionMeta = {
      id: uuid(),
      title: 'New chat',
      agentId,
      providerId,
      model,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usage: { promptTokens: 0, completionTokens: 0 }
    };
    const session: AiSession = { ...meta, messages: [] };
    this.index.push(meta);
    this.sessions.set(meta.id, session);
    this.activeId = meta.id;
    await this.persist(session);
    this.events.emit('ai:sessions-changed', {});
    this.events.emit('ai:session-changed', { id: meta.id });
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    await this.load();
    this.index = this.index.filter((m) => m.id !== id);
    this.sessions.delete(id);
    await store.set(indexKey, this.index);
    await store.set(`session:${id}`, []);
    if (this.activeId === id) this.activeId = null;
    this.events.emit('ai:sessions-changed', {});
  }

  async renameSession(id: string, title: string): Promise<void> {
    const s = await this.getSession(id);
    s.title = title.slice(0, 60) || s.title;
    this.touchMeta(s);
    await this.persist(s);
    this.events.emit('ai:sessions-changed', {});
  }

  /** Change the agent that handles a session (keeps history). */
  async setSessionAgent(id: string, agentId: AgentId): Promise<void> {
    const s = await this.getSession(id);
    s.agentId = agentId;
    const meta = this.index.find((m) => m.id === id);
    if (meta) meta.agentId = agentId;
    await this.persist(s);
    this.events.emit('ai:session-changed', { id });
  }

  async getSession(id: string): Promise<AiSession> {
    await this.load();
    const s = this.sessions.get(id);
    if (s) return s;
    return this.openSession(id);
  }

  async exportMarkdown(id: string): Promise<string> {
    const s = await this.getSession(id);
    const agent = getAgent(s.agentId);
    const lines = [
      `# XCoder AI chat — ${s.title}`,
      '',
      `- agent: ${agent.name} · model: ${s.model} · provider: ${s.providerId}`,
      `- exported: ${new Date().toISOString()}`,
      ''
    ];
    for (const msg of s.messages) {
      if (msg.role === 'system') continue;
      if (msg.role === 'tool') continue;
      lines.push(`## ${msg.role === 'user' ? 'User' : 'Assistant'}`, '', msg.content || '(tool calls)');
      for (const tc of msg.toolCalls ?? []) {
        lines.push(`> 🔧 \`${tc.name}\` — \`${JSON.stringify(tc.args).slice(0, 200)}\``);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  // ── sending / the agent loop ───────────────────────────────────────────────

  /** Send a user message to the active (or new) session. */
  async send(text: string, ctx: SendMessageContext = {}): Promise<void> {
    if (!text.trim()) return;
    const session = this.activeId
      ? await this.getSession(this.activeId)
      : await this.newSession('chat');
    const userMsg: AiMessage = { role: 'user', content: this.composeUserMessage(text, ctx) };
    session.messages.push(userMsg);
    if (session.title === 'New chat') {
      session.title = text.trim().slice(0, 42);
    }
    this.touchMeta(session);
    await this.persist(session);

    const runId = uuid();
    await this.runLoop({ sessionId: session.id, runId, messages: session.messages, agent: getAgent(session.agentId), depth: 0 });
  }

  /** Run an agent one-shot against a fresh message list (used by commands). */
  async runOneShot(agentId: AgentId, task: string): Promise<string> {
    const messages: AiMessage[] = [{ role: 'user', content: task }];
    const runId = uuid();
    const sessionId = this.activeId ?? 'oneshot';
    return this.runLoop({ sessionId, runId, messages, agent: getAgent(agentId), depth: 0 });
  }

  abort(sessionId?: string): void {
    if (sessionId) this.controllers.get(sessionId)?.abort();
    else for (const c of this.controllers.values()) c.abort();
  }

  isRunning(sessionId?: string): boolean {
    if (sessionId) return this.controllers.has(sessionId);
    return this.controllers.size > 0;
  }

  private async runLoop(opts: RunOptions): Promise<string> {
    const { sessionId, runId, agent, depth } = opts;
    if (this.controllers.has(sessionId)) {
      throw new Error('[ai] a run is already active in this session — stop it first');
    }
    const controller = new AbortController();
    this.controllers.set(sessionId, controller);

    this.events.emit('ai:run-start', { sessionId, runId, agentId: agent.id, depth });

    try {
      const { client, model } = this.clientConfig();
      const messages = opts.messages;
      const tools = toolSpecsFor(agent, AI_TOOLS.map((t) => t.spec));
      const system: AiMessage = {
        role: 'system',
        content: `${agent.systemPrompt}\n\n${await this.workspaceContext()}`
      };
      const wire = [system, ...messages];

      const alwaysAllowed = new Set<string>();
      const env = this.toolEnv(agent, depth, sessionId, runId, alwaysAllowed);

      let finalText = '';
      const maxTurns = Math.max(4, (settings.get('ai.maxTurns') as number) || agent.maxTurns);

      for (let turn = 0; turn < maxTurns; turn++) {
        const res: ChatResult = await client.chat({
          messages: wire,
          model,
          temperature: this.temperature,
          maxTokens: this.maxTokens,
          tools,
          stream: this.streaming,
          signal: controller.signal,
          onDelta: (d) => {
            if (d.text) this.events.emit('ai:delta', { sessionId, runId, depth, text: d.text });
          }
        });
        if (res.usage) {
          const s0 = this.sessions.get(sessionId);
          if (s0) {
            s0.usage.promptTokens += res.usage.promptTokens;
            s0.usage.completionTokens += res.usage.completionTokens;
          }
        }

        const assistantMsg: AiMessage = {
          role: 'assistant',
          content: res.text,
          toolCalls: res.toolCalls.length ? res.toolCalls : undefined
        };
        wire.push(assistantMsg);
        // persist a copy without the system prompt
        messages.push(assistantMsg);

        if (!res.toolCalls.length) {
          finalText = res.text;
          break;
        }

        for (const call of res.toolCalls) {
          const allowed = await this.gate(call.name, call.args, agent, alwaysAllowed, sessionId);
          const toolMsg: AiMessage = {
            role: 'tool',
            toolCallId: call.id,
            toolName: call.name,
            content: ''
          };
          if (!allowed) {
            toolMsg.content = 'DENIED by user — do not retry this action without asking why.';
          } else {
            this.events.emit('ai:tool-start', {
              sessionId, runId, depth, callId: call.id, name: call.name,
              args: call.args, risk: this.riskOf(call.name, call.args)
            });
            try {
              const result = await executeTool(call.name, call.args, env);
              toolMsg.content = result.slice(0, MAX_RESULT_CHARS);
              this.events.emit('ai:tool-end', { sessionId, runId, depth, callId: call.id, ok: !result.startsWith('ERROR'), result: toolMsg.content });
            } catch (err) {
              toolMsg.content = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
              this.events.emit('ai:tool-end', { sessionId, runId, depth, callId: call.id, ok: false, result: toolMsg.content });
            }
          }
          wire.push(toolMsg);
          messages.push(toolMsg);
        }
      }

      if (!finalText) {
        finalText = 'Stopped: reached the maximum number of turns for this agent.';
      }
      const s = this.sessions.get(sessionId);
      if (s) await this.persist(s);
      this.events.emit('ai:run-end', { sessionId, runId, depth, ok: true });
      return finalText;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      this.events.emit('ai:run-end', { sessionId, runId, depth, ok: aborted, error: aborted ? 'aborted' : message });
      if (aborted) return '(stopped by user)';
      throw err;
    } finally {
      this.controllers.delete(sessionId);
    }
  }

  private composeUserMessage(text: string, ctx: SendMessageContext): string {
    if (!ctx.file && !ctx.selection && !ctx.tree) return text;
    const parts: string[] = [text];
    const extras: string[] = [];
    if (ctx.file) {
      const ed = this.activeEditorProvider?.() ?? null;
      extras.push(ed ? `Active file: ${ed.url}\n\`\`\`\n${ed.text.slice(0, 6000)}\n\`\`\`` : '(no active file)');
    }
    if (ctx.selection) {
      const sel = this.activeSelectionProvider?.() ?? null;
      extras.push(sel ? `Selected text:\n\`\`\`\n${sel.slice(0, 3000)}\n\`\`\`` : '(no selection)');
    }
    if (ctx.tree) {
      const folders = workspace.listFolders();
      extras.push(`Workspace roots: ${folders.join(', ') || '(empty)'}`);
    }
    return `${parts.join('\n')}\n\n--- context ---\n${extras.join('\n\n')}`;
  }

  private async workspaceContext(): Promise<string> {
    const folders = workspace.listFolders();
    const lines = [
      `Workspace roots: ${folders.length ? folders.join(', ') : '(none)'}`,
      `Shell cwd: ${await this.shellCwd()}`
    ];
    const ed = this.activeEditorProvider?.() ?? null;
    if (ed) lines.push(`Active file: ${ed.url}`);
    return lines.join('\n');
  }

  private async shellCwd(): Promise<string> {
    try {
      const { terminal } = await import('@core/terminal/terminal');
      return terminal.activeTab?.shell.cwd ?? 'memory:///home';
    } catch {
      return 'memory:///home';
    }
  }

  private toolEnv(
    agent: AgentDef,
    depth: number,
    sessionId: string,
    runId: string,
    alwaysAllowed: Set<string>
  ): AgentToolEnv {
    const self = this;
    return {
      cwdUrl(): string {
        return workspace.listFolders()[0] ?? 'memory:///home';
      },
      activeUrl(): string | null {
        return self.activeEditorProvider?.()?.url ?? null;
      },
      activeSelection(): string | null {
        return self.activeSelectionProvider?.() ?? null;
      },
      async runCommand(line: string): Promise<{ code: number; output: string }> {
        const { terminal } = await import('@core/terminal/terminal');
        return terminal.exec(line);
      },
      async askUser(question: string): Promise<string | null> {
        if (self.askHandler) return self.askHandler(question);
        return null;
      },
      async spawnSubagent(subAgentId: string, task: string): Promise<string> {
        if (depth >= MAX_DEPTH) return '(subagent depth limit reached — handle this task yourself)';
        if (!agent.canSpawn.includes(subAgentId as AgentId)) {
          return `(agent ${agent.id} is not allowed to spawn ${subAgentId})`;
        }
        self.events.emit('ai:note', {
          sessionId,
          depth: depth + 1,
          text: `▸ subagent ${getAgent(subAgentId).name} started`
        });
        try {
          const subMessages: AiMessage[] = [{ role: 'user', content: task }];
          const subRunId = uuid();
          const result = await self.runLoop({
            sessionId,
            runId: subRunId,
            messages: subMessages,
            agent: getAgent(subAgentId),
            depth: depth + 1
          });
          self.events.emit('ai:note', { sessionId, depth: depth + 1, text: `▸ subagent finished` });
          return result;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          self.events.emit('ai:note', { sessionId, depth: depth + 1, text: `▸ subagent failed: ${msg}` });
          return `subagent failed: ${msg}`;
        }
      }
    };
  }

  private riskOf(name: string, args: Record<string, unknown>): ToolRisk {
    if (name === 'git') return gitActionRisk(String(args['action'] ?? ''));
    return toolRisk(name);
  }

  private async gate(
    name: string,
    args: Record<string, unknown>,
    agent: AgentDef,
    alwaysAllowed: Set<string>,
    sessionId: string
  ): Promise<boolean> {
    if (!agent.tools.includes(name)) return false;
    if (alwaysAllowed.has(name)) return true;
    const risk = this.riskOf(name, args);
    if (risk === 'safe') return true;
    const mode = this.approvalMode;
    if (mode === 'auto') return true;
    if (mode === 'balanced' && risk === 'write') return true;

    const detail = this.describeCall(name, args);
    const decision = await this.askApproval({
      sessionId,
      tool: name,
      label: name,
      risk,
      detail
    });
    if (decision === 'always') {
      alwaysAllowed.add(name);
      return true;
    }
    return decision === 'allow';
  }

  private describeCall(name: string, args: Record<string, unknown>): string {
    switch (name) {
      case 'create_file':
        return `create ${String(args['path'] ?? '')} (${String(args['content'] ?? '').length} bytes)`;
      case 'edit_file':
        return `edit ${String(args['path'] ?? '')}`;
      case 'delete_path':
        return `delete ${String(args['path'] ?? '')}`;
      case 'move_path':
        return `move ${String(args['from'] ?? '')} → ${String(args['to'] ?? '')}`;
      case 'run_command':
        return `$ ${String(args['command'] ?? '')}`;
      case 'git':
        return `git ${String(args['action'] ?? '')} ${String(args['args'] ?? '')}`.trim();
      default:
        return JSON.stringify(args).slice(0, 120);
    }
  }

  private askApproval(req: Omit<ApprovalRequest, 'resolve'>): Promise<ApprovalDecision> {
    return new Promise((resolve) => {
      const request: ApprovalRequest = { ...req, resolve };
      if (this.approvalHandler) {
        this.events.emit('ai:approval', { request });
        this.approvalHandler(request);
      } else {
        // headless (tests/plugins): follow policy strictly — deny non-safe
        resolve('deny');
      }
    });
  }

  resetAlwaysAllowed(): void {
    this.alwaysAllowed.clear();
  }

  // ── persistence ────────────────────────────────────────────────────────────

  private safeMeta(): { providerId: string; model: string } {
    try {
      return {
        providerId: (settings.get('ai.provider') as string) || DEFAULT_PROVIDER_ID,
        model: (settings.get('ai.model') as string) || DEFAULT_MODEL
      };
    } catch {
      return { providerId: DEFAULT_PROVIDER_ID, model: DEFAULT_MODEL };
    }
  }

  private touchMeta(s: AiSession | null): void {
    if (!s) return;
    s.updatedAt = Date.now();
    const meta = this.index.find((m) => m.id === s.id);
    if (meta) {
      meta.updatedAt = s.updatedAt;
      meta.title = s.title;
      meta.usage = { ...s.usage };
    }
  }

  private async persist(s: AiSession): Promise<void> {
    this.touchMeta(s);
    await store.set(indexKey, this.index);
    // cap stored messages to the last 200
    const trimmed = s.messages.length > 200 ? s.messages.slice(-200) : s.messages;
    await store.set(`session:${s.id}`, trimmed);
  }
}

export const aiManager = new AiManager();
