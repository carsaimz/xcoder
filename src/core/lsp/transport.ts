/**
 * LSP transports. The client is transport-agnostic; servers can be reached
 * over a WebSocket (external host process) or inside a Web Worker
 * (bundled server, e.g. a wasm build).
 */
import { JsonRpcConnection } from './jsonrpc';

export interface Transport {
  start(): Promise<void>;
  send(data: string): void;
  onData(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  dispose(): void;
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private dataCb: ((data: string) => void) | null = null;
  private closeCb: (() => void) | null = null;

  constructor(private url: string) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error(`lsp: websocket error (${this.url})`));
      this.ws.onmessage = (ev) => this.dataCb?.(String(ev.data));
      this.ws.onclose = () => this.closeCb?.();
    });
  }

  send(data: string): void {
    this.ws?.send(data);
  }

  onData(cb: (data: string) => void): void {
    this.dataCb = cb;
  }

  onClose(cb: () => void): void {
    this.closeCb = cb;
  }

  dispose(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export class WorkerTransport implements Transport {
  private worker: Worker | null = null;
  private dataCb: ((data: string) => void) | null = null;
  private closeCb: (() => void) | null = null;

  constructor(private workerUrl: string) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(this.workerUrl);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('lsp: worker creation failed'));
        return;
      }
      this.worker.onmessage = (ev) => this.dataCb?.(String(ev.data));
      this.worker.onerror = () => reject(new Error(`lsp: worker error (${this.workerUrl})`));
      this.worker.onmessageerror = () => this.closeCb?.();
      // worker script signals readiness with its first ping
      const ready = (ev: MessageEvent) => {
        if (ev.data === '__ready__') {
          this.worker?.removeEventListener('message', ready);
          resolve();
        }
      };
      this.worker.addEventListener('message', ready);
    });
  }

  send(data: string): void {
    this.worker?.postMessage(data);
  }

  onData(cb: (data: string) => void): void {
    this.dataCb = cb;
  }

  onClose(cb: () => void): void {
    this.closeCb = cb;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

/** Wire a transport to a JsonRpcConnection. */
export function connect(transport: Transport): JsonRpcConnection {
  const conn = new JsonRpcConnection((data) => transport.send(data));
  transport.onData((data) => conn.handleMessage(data));
  transport.onClose(() => conn.close());
  void transport.start().catch((err) => {
    conn.close();
    throw err;
  });
  return conn;
}
