/**
 * JSON-RPC 2.0 codec used by the LSP client.
 * Transport-agnostic: whatever `send` does (WebSocket, Worker, pipe).
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

type MethodHandler = (params: unknown) => unknown | Promise<unknown>;

export class JsonRpcConnection {
  private nextId = 1;
  private pending = new Map<number | string, { resolve: (v: unknown) => void; reject: (e: JsonRpcError) => void }>();
  private handlers = new Map<string, MethodHandler>();
  private closed = false;

  constructor(private send: (data: string) => void) {}

  /** Register a handler for server→client requests/notifications. */
  on(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  /** Feed one raw JSON message (from the transport). */
  handleMessage(raw: string): void {
    let msg: JsonRpcRequest & JsonRpcResponse;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if ('id' in msg && ('result' in msg || 'error' in msg)) {
      // response
      const pending = this.pending.get(msg.id as number | string);
      if (!pending) return;
      this.pending.delete(msg.id as number | string);
      if (msg.error) pending.reject(msg.error);
      else pending.resolve(msg.result);
      return;
    }
    if ('method' in msg) {
      // request or notification from server
      const handler = this.handlers.get(msg.method);
      if (!handler) return;
      Promise.resolve()
        .then(() => handler(msg.params))
        .then((result) => {
          if (msg.id !== undefined && msg.id !== null) {
            this.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: result ?? null }));
          }
        })
        .catch((err: JsonRpcError) => {
          if (msg.id !== undefined && msg.id !== null) {
            this.send(
              JSON.stringify({
                jsonrpc: '2.0',
                id: msg.id,
                error: { code: err.code ?? -32603, message: err.message ?? 'internal error' }
              })
            );
          }
        });
    }
  }

  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) return Promise.reject({ code: -32000, message: 'connection closed' });
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  sendNotification(method: string, params?: unknown): void {
    if (this.closed) return;
    this.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }

  /** Reject all pending requests (transport died). */
  close(): void {
    this.closed = true;
    for (const [, p] of this.pending) {
      p.reject({ code: -32000, message: 'connection closed' });
    }
    this.pending.clear();
  }
}
