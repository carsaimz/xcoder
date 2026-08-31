/** JSON-RPC 2.0 message encoding/decoding (Content-Length framing + raw JSON). */

export interface RpcMessage {
  jsonrpc: '2.0';
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ServerError: -32000,
  RequestCancelled: -32800,
} as const;

/** Frame a message with Content-Length headers (byte length, UTF-8). */
export function encodeMessage(msg: RpcMessage): string {
  const json = JSON.stringify(msg);
  return `Content-Length: ${new TextEncoder().encode(json).length}\r\n\r\n${json}`;
}

/** Incremental parser for Content-Length framed streams. */
export class MessageDecoder {
  private buffer = '';

  push(chunk: string): RpcMessage[] {
    this.buffer += chunk;
    const messages: RpcMessage[] = [];
    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const body = this.buffer.slice(headerEnd + 4);
      // JSON is ASCII-safe here (LSP requires ASCII headers; body escapes non-ASCII)
      if (body.length < length) break;
      try {
        messages.push(JSON.parse(body.slice(0, length)) as RpcMessage);
      } catch {
        /* skip malformed frame */
      }
      this.buffer = body.slice(length);
    }
    return messages;
  }
}

/** Decode newline-delimited JSON (used by worker transport). */
export function decodeLines(chunk: string): RpcMessage[] {
  return chunk
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l) as RpcMessage;
      } catch {
        return null;
      }
    })
    .filter((m): m is RpcMessage => m !== null);
}
