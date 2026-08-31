/** Transport layer: WebSocket, Worker, and in-memory loopback for tests. */

import { RpcMessage, encodeMessage, MessageDecoder, decodeLines } from './jsonrpc';

export interface Transport {
  start(): Promise<void>;
  send(msg: RpcMessage): void;
  onData(cb: (msg: RpcMessage) => void): void;
  onClose(cb: () => void): void;
  stop(): void;
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private dataCb: ((msg: RpcMessage) => void) | null = null;
  private decoder = new MessageDecoder();

  constructor(private url: string) {}

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error(`LSP websocket failed: ${this.url}`));
      this.ws.onmessage = (ev) => {
        const text = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data);
        for (const msg of this.decoder.push(text)) this.dataCb?.(msg);
      };
    });
  }

  send(msg: RpcMessage): void {
    this.ws?.send(encodeMessage(msg));
  }

  onData(cb: (msg: RpcMessage) => void): void {
    this.dataCb = cb;
  }

  onClose(cb: () => void): void {
    if (this.ws) this.ws.onclose = cb;
  }

  stop(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export class WorkerTransport implements Transport {
  private dataCb: ((msg: RpcMessage) => void) | null = null;
  private decoder = new MessageDecoder();

  constructor(private worker: Worker) {}

  async start(): Promise<void> {
    this.worker.onmessage = (ev) => {
      const text = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data);
      // accept both framed and newline-delimited JSON from workers
      for (const msg of [...this.decoder.push(text), ...decodeLines(text)]) this.dataCb?.(msg);
    };
  }

  send(msg: RpcMessage): void {
    this.worker.postMessage(JSON.stringify(msg));
  }

  onData(cb: (msg: RpcMessage) => void): void {
    this.dataCb = cb;
  }

  onClose(cb: () => void): void {
    this.worker.onmessage = (ev) => {
      if (ev.data === '__lsp_closed__') cb();
    };
  }

  stop(): void {
    this.worker.terminate();
  }
}

/** In-memory pipe pair — useful for tests and embedded servers. */
export function createLoopbackPair(): [Transport, Transport] {
  let cbA: ((m: RpcMessage) => void) | null = null;
  let cbB: ((m: RpcMessage) => void) | null = null;
  const tA: Transport = {
    async start() {},
    send(msg) {
      queueMicrotask(() => cbB?.(msg));
    },
    onData(cb) {
      cbA = cb;
    },
    onClose() {},
    stop() {},
  };
  const tB: Transport = {
    async start() {},
    send(msg) {
      queueMicrotask(() => cbA?.(msg));
    },
    onData(cb) {
      cbB = cb;
    },
    onClose() {},
    stop() {},
  };
  return [tA, tB];
}
