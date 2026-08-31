/**
 * Agent module facade — wires the orchestrator to settings + providers and
 * owns the permission manager used by the UI.
 */

import { bus } from '../../lib/events';
import { settings } from '../../api/settings';
import { providers } from '../ai';
import { fs } from '../file';
import { Shell } from '../terminal/shell';
import { AgentOrchestrator, OrchestratorDeps } from './orchestrator';
import { AgentResult, AgentRunOptions, AgentEvent, PermissionRequest } from './types';
import { TOOL_MAP } from './tools';

class PermissionManager {
  private remembered = new Set<string>();

  async request(req: PermissionRequest): Promise<boolean> {
    const mode = settings.get('agent').permissionMode;
    if (mode === 'auto') return true;
    if (this.remembered.has(req.tool)) return true;
    // The UI intercepts 'agent:permission' and answers via resolvePermission().
    const response = await busEmitPermission(req);
    if (response === 'always') {
      this.remembered.add(req.tool);
      return true;
    }
    return response === 'allow';
  }

  forget(): void {
    this.remembered.clear();
  }
}

function busEmitPermission(req: PermissionRequest): Promise<'allow' | 'always' | 'deny'> {
  return new Promise((resolve) => {
    bus.emit('agent:permission', { req, resolve });
  });
}

let shellRef: Shell | null = null;

const permissions = new PermissionManager();

/** Called once by main.ts after the shell is created. */
export function bindShell(shell: Shell): void {
  shellRef = shell;
}

function deps(): OrchestratorDeps {
  return {
    fs,
    get shell() {
      return shellRef as Shell;
    },
    getClient: () => providers.client(),
    getActiveModel: () => providers.active?.model ?? null,
    confirm: (req) => permissions.request(req),
    cwd: () => fs.cwd(),
  };
}

const orchestrator = new AgentOrchestrator(deps());

export const agents = {
  /** Run a task with the main agent or a named subagent. */
  run(task: string, opts: AgentRunOptions = {}): Promise<AgentResult> {
    return orchestrator.run(task, opts);
  },
  listTools(): Array<{ name: string; description: string }> {
    return orchestrator.listTools().map((t) => ({ name: t.name, description: t.description }));
  },
  listSubagents(): Array<{ name: string; description: string }> {
    return orchestrator.listSubagents();
  },
  hasProvider(): boolean {
    return providers.active !== null;
  },
  activeModel(): string | null {
    return providers.active?.model ?? null;
  },
  permissions,
  abortController: null as AbortController | null,

  /** Convenience for UI: create an AbortController for the next run. */
  newAbort(): AbortController {
    this.abortController = new AbortController();
    return this.abortController;
  },
};

/** Global event stream for UI panels (chat log, tool cards, permission prompts). */
export function onAgentEvent(cb: (evt: AgentEvent) => void): () => void {
  return bus.on('agent:event', cb);
}

export type { AgentEvent, AgentResult, AgentRunOptions };
export { TOOL_MAP };
