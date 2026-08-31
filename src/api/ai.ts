/**
 * Facade — AI agents (chat, providers, sessions).
 * Exposed as `xcoder.require('ai')` for plugins.
 */
import { aiManager, type AiSessionMeta, type ApprovalMode, type ApprovalDecision, type SendMessageContext } from '@core/ai/manager';
import { AGENTS, type AgentId } from '@core/ai/agents';
import {
  BUILTIN_PROVIDERS,
  TIER_LABELS,
  TIER_ORDER,
  providersByTier,
  type ProviderTier
} from '@core/ai/providers';
import { AI_TOOLS, type ToolRisk } from '@core/ai/tools';
import { settings } from './settings';

export const ai = {
  // configuration -----------------------------------------------------------
  providers: () => providersByTier(settings.get('ai.customProviders')),
  builtinProviders: () => BUILTIN_PROVIDERS,
  tierLabels: () => TIER_LABELS,
  tiers: () => TIER_ORDER,
  agents: () => AGENTS.map((a) => ({ id: a.id as string, name: a.name, emoji: a.emoji, description: a.description })),
  tools: () => AI_TOOLS.map((t) => ({ name: t.spec.name, risk: t.risk, label: t.label })),
  // sessions ----------------------------------------------------------------
  listSessions: () => aiManager.listSessions(),
  openSession: (id: string) => aiManager.openSession(id),
  newSession: (agentId?: AgentId) => aiManager.newSession(agentId),
  deleteSession: (id: string) => aiManager.deleteSession(id),
  renameSession: (id: string, title: string) => aiManager.renameSession(id, title),
  exportMarkdown: (id: string) => aiManager.exportMarkdown(id),
  get activeSessionId(): string | null {
    return aiManager.activeSessionId;
  },
  // chat / agents -----------------------------------------------------------
  send: (text: string, ctx?: SendMessageContext) => aiManager.send(text, ctx),
  runAgent: (agentId: AgentId, task: string) => aiManager.runOneShot(agentId, task),
  abort: (sessionId?: string) => aiManager.abort(sessionId),
  isRunning: (sessionId?: string) => aiManager.isRunning(sessionId),
  events: aiManager.events,
  on: aiManager.events.on.bind(aiManager.events)
};

export type { AiSessionMeta, ApprovalMode, ApprovalDecision, ProviderTier, ToolRisk, AgentId, SendMessageContext };
