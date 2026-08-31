/**
 * Agent contracts. Tools are provider-agnostic (JSON schema parameters);
 * the orchestrator maps them onto whichever LLM dialect is configured.
 */

import { Workspace } from '../file';
import { Shell } from '../terminal/shell';
import { ToolDef } from '../ai/types';

/** What a tool is allowed to do — used for permission prompts. */
export interface PermissionRequest {
  tool: string;
  action: string;
  path?: string;
  summary: string;
}

export type AgentEventType =
  | 'run-start'
  | 'thought'
  | 'tool-call'
  | 'tool-result'
  | 'message'
  | 'permission'
  | 'subagent'
  | 'error'
  | 'run-end';

export interface AgentEvent {
  type: AgentEventType;
  /** unique for the originating run */
  runId: string;
  agent: string;
  data?: unknown;
}

export interface ToolContext {
  fs: Workspace;
  shell: Shell;
  /** current working directory URL */
  cwd: string;
  /** ask the user for permission (auto-allowed depending on settings) */
  confirm(req: PermissionRequest): Promise<boolean>;
  emit(evt: Omit<AgentEvent, 'runId' | 'agent'>): void;
  /** spawn a named subagent */
  spawn(subagent: string, task: string): Promise<string>;
  signal?: AbortSignal;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolDef['parameters'];
  /** requires explicit user confirmation */
  danger?: boolean;
  /** never mutates anything */
  readOnly?: boolean;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export interface SubagentDef {
  name: string;
  description: string;
  system: string;
  tools: string[];
  maxSteps: number;
}

export interface AgentRunOptions {
  subagent?: string;
  maxSteps?: number;
  onEvent?: (evt: AgentEvent) => void;
  signal?: AbortSignal;
}

export interface AgentResult {
  ok: boolean;
  output: string;
  steps: number;
  agent: string;
  messages: Array<{ role: string; content: string }>;
}
