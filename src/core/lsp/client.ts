/** LSP client — lifecycle, document sync and common requests. */

import { RpcMessage, RpcError, ErrorCodes } from './jsonrpc';
import { Transport } from './transport';
import { bus } from '../../lib/events';

export interface Diagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  message: string;
  severity: number;
  source?: string;
}

export interface HoverResult {
  contents: string;
  range?: unknown;
}

let nextId = 1;

export class LSPClient {
  private pending = new Map<number | string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private capabilities: Record<string, unknown> = {};
  private _running = false;

  constructor(
    private transport: Transport,
    readonly serverName: string,
  ) {
    transport.onData((msg) => this.handle(msg));
  }

  get running(): boolean {
    return this._running;
  }

  private handle(msg: RpcMessage): void {
    if (msg.id !== undefined && msg.id !== null && ('result' in msg || 'error' in msg)) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new RpcError(msg.error.code, msg.error.message, msg.error.data));
      else p.resolve(msg.result);
    } else if (msg.method) {
      this.onNotification?.(msg.method, msg.params);
    }
  }

  onNotification: ((method: string, params: unknown) => void) | null = (method, params) => {
    if (method === 'textDocument/publishDiagnostics') {
      bus.emit('lsp:diagnostics', { server: this.serverName, params });
    }
  };

  private sendRaw(msg: RpcMessage): void {
    this.transport.send(msg);
  }

  async start(rootUri: string, capabilities: Record<string, unknown> = {}): Promise<void> {
    await this.transport.start();
    this._running = true;
    this.capabilities = (await this.request('initialize', {
      processId: null,
      rootUri,
      capabilities,
    })) as Record<string, unknown>;
    this.notify('initialized', {});
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new RpcError(ErrorCodes.ServerError, `LSP request timeout: ${method}`));
        }
      }, 15000);
      this.pending.set(id, {
        resolve: (v: unknown) => {
          clearTimeout(timer);
          resolve(v as T);
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.sendRaw({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method: string, params: unknown): void {
    this.sendRaw({ jsonrpc: '2.0', method, params });
  }

  // ---- document sync -------------------------------------------------------

  didOpen(uri: string, languageId: string, version: number, text: string): void {
    this.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version, text },
    });
  }

  didChange(uri: string, version: number, text: string): void {
    this.notify('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  didClose(uri: string): void {
    this.notify('textDocument/didClose', { textDocument: { uri } });
  }

  // ---- language features ----------------------------------------------------

  hover(uri: string, line: number, character: number): Promise<HoverResult | null> {
    return this.request<HoverResult | null>('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  completion(uri: string, line: number, character: number): Promise<unknown> {
    return this.request('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  definition(uri: string, line: number, character: number): Promise<unknown> {
    return this.request('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  formatting(uri: string, tabSize = 4): Promise<unknown> {
    return this.request('textDocument/formatting', {
      textDocument: { uri },
      options: { tabSize, insertSpaces: true },
    });
  }

  capabilitiesOf(): Record<string, unknown> {
    return this.capabilities;
  }

  stop(): void {
    try {
      this.notify('shutdown', null);
      this.notify('exit', null);
    } catch {
      /* ignore */
    }
    this.transport.stop();
    this._running = false;
    bus.emit('lsp:stopped', this.serverName);
  }
}
