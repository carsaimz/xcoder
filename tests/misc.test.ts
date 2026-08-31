import { describe, expect, it } from 'vitest';
import { encodeMessage, decodeLines, MessageDecoder, RpcError, ErrorCodes } from '../src/core/lsp/jsonrpc';
import { createLoopbackPair } from '../src/core/lsp/transport';
import { EditorManager } from '../src/core/editor/editorManager';

describe('jsonrpc', () => {
  it('encodes with Content-Length framing', () => {
    const frame = encodeMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(frame).toMatch(/^Content-Length: \d+\r\n\r\n\{/);
  });

  it('decoder reassembles split frames', () => {
    const decoder = new MessageDecoder();
    const msg = JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'x', params: [1, 2, 3] });
    const frame = `Content-Length: ${msg.length}\r\n\r\n${msg}`;
    const first = decoder.push(frame.slice(0, 20));
    expect(first).toHaveLength(0);
    const rest = decoder.push(frame.slice(20));
    expect(rest).toHaveLength(1);
    expect(rest[0].id).toBe(7);
  });

  it('decodes newline-delimited json (worker mode)', () => {
    const msgs = decodeLines('{"jsonrpc":"2.0","id":1,"result":4}\n\n{"jsonrpc":"2.0","method":"exit"}');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].result).toBe(4);
  });

  it('RpcError carries code', () => {
    const err = new RpcError(ErrorCodes.MethodNotFound, 'no method');
    expect(err.code).toBe(-32601);
  });
});

describe('loopback transport pair', () => {
  it('delivers messages both directions', async () => {
    const [a, b] = createLoopbackPair();
    const gotA: unknown[] = [];
    const gotB: unknown[] = [];
    a.onData((m) => gotA.push(m));
    b.onData((m) => gotB.push(m));
    await a.start();
    await b.start();
    a.send({ jsonrpc: '2.0', method: 'ping' });
    b.send({ jsonrpc: '2.0', method: 'pong' });
    await new Promise((r) => setTimeout(r, 10));
    expect(gotB.map((m) => (m as { method: string }).method)).toContain('ping');
    expect(gotA.map((m) => (m as { method: string }).method)).toContain('pong');
  });
});

describe('editor manager (formatters registry)', () => {
  it('knows parsers for common file types', () => {
    expect(EditorManager.FORMATTERS['ts']).toBe('typescript');
    expect(EditorManager.FORMATTERS['js']).toBe('babel');
    expect(EditorManager.FORMATTERS['css']).toBe('css');
    expect(EditorManager.FORMATTERS['md']).toBe('markdown');
    expect(EditorManager.FORMATTERS['yaml']).toBe('yaml');
    expect(EditorManager.FORMATTERS['exe']).toBeUndefined();
  });
});
