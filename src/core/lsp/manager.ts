/**
 * LSP server lifecycle: one session per language id, started lazily from
 * settings (`lsp.servers`).
 */
import type { LspSession, LspServerConfig } from './client';
import { createSession } from './client';
import { WebSocketTransport, WorkerTransport, type Transport } from './transport';
import { settings } from '@api/settings';

type Status = 'starting' | 'ready' | 'error' | 'stopped';

const sessions = new Map<string, LspSession>();
const starting = new Map<string, Promise<LspSession | null>>();
const statuses = new Map<string, Status>();

export function registerServer(languageId: string, config: LspServerConfig): void {
  const current = settings.get('lsp.servers');
  current[languageId] = config;
  void settings.set('lsp.servers', current);
}

function buildTransport(config: LspServerConfig): Transport {
  if (config.transport === 'worker') {
    if (!config.workerUrl) throw new Error('lsp: worker transport requires workerUrl');
    return new WorkerTransport(config.workerUrl);
  }
  if (!config.url) throw new Error('lsp: websocket transport requires url');
  return new WebSocketTransport(config.url);
}

export async function getSession(languageId: string): Promise<LspSession | null> {
  const existing = sessions.get(languageId);
  if (existing) return existing;

  const pending = starting.get(languageId);
  if (pending) return pending;

  const config = settings.get('lsp.servers')[languageId];
  if (!config) return null;

  const promise = (async () => {
    statuses.set(languageId, 'starting');
    try {
      const transport = buildTransport(config);
      const session = await createSession(languageId, transport, config.rootUrl ?? 'memory:///home');
      sessions.set(languageId, session);
      statuses.set(languageId, 'ready');
      return session;
    } catch (err) {
      statuses.set(languageId, 'error');
      console.warn(`[lsp] failed to start server for ${languageId}`, err);
      return null;
    } finally {
      starting.delete(languageId);
    }
  })();
  starting.set(languageId, promise);
  return promise;
}

export function status(): Record<string, Status> {
  const out: Record<string, Status> = {};
  for (const [id, s] of statuses) out[id] = s;
  for (const id of sessions.keys()) out[id] = 'ready';
  return out;
}

export async function stop(languageId: string): Promise<void> {
  const session = sessions.get(languageId);
  if (!session) return;
  sessions.delete(languageId);
  statuses.set(languageId, 'stopped');
  await session.dispose();
}

export async function stopAll(): Promise<void> {
  for (const id of [...sessions.keys()]) await stop(id);
}
