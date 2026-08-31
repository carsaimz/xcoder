/**
 * Tests for the LLM client — mocked fetch, both API styles, streaming,
 * tool-call accumulation and retry policy.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient, AIError } from '../src/core/ai/client';
import type { ChatParams } from '../src/core/ai/client';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function sseResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      // SSE frames are newline-terminated (spec: "data: <payload>\n\n")
      for (const l of lines) controller.enqueue(enc.encode(l + '\n\n'));
      controller.close();
    }
  });
  return new Response(body, { status: 200 });
}

function jsonBody(obj: unknown): Response {
  return new Response(JSON.stringify(obj), { status: 200 });
}

const baseParams = (over: Partial<ChatParams> = {}): ChatParams => ({
  messages: [{ role: 'user', content: 'hi' }],
  model: 'test-model',
  ...over
});

afterEach(() => {
  fetchMock.mockReset();
});

describe('openai adapter', () => {
  it('parses non-stream responses with tool calls', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonBody({
        choices: [
          {
            message: {
              content: 'Let me check.',
              tool_calls: [
                { id: 'call_1', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } }
              ]
            }
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      })
    );

    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiKey: 'k', apiStyle: 'openai' });
    const res = await c.chat(baseParams());

    expect(res.text).toBe('Let me check.');
    expect(res.toolCalls).toEqual([{ id: 'call_1', name: 'read_file', args: { path: 'a.ts' } }]);
    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 5 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe('test-model');
    expect(body.tools).toBeUndefined();
  });

  it('accumulates streamed tool-call argument chunks', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}',
        'data: {"choices":[{"delta":{"content":"lo"}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"edit_","arguments":"{\\"path\\":"}}]}}]}',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"f.ts\\"}"}}]}}]}',
        'data: [DONE]'
      ])
    );

    const deltas: string[] = [];
    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiStyle: 'openai' });
    const res = await c.chat(baseParams({ stream: true, onDelta: (d) => deltas.push(d.text ?? '') }));

    expect(res.text).toBe('Hello');
    expect(res.toolCalls).toEqual([{ id: 'c1', name: 'edit_', args: { path: 'f.ts' } }]);
    expect(deltas.join('')).toBe('Hello');
  });

  it('sends tool definitions and tool messages in openai wire format', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonBody({ choices: [{ message: { content: 'ok' } }] })
    );
    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiStyle: 'openai' });
    await c.chat(
      baseParams({
        tools: [{ name: 't1', description: 'd', parameters: { type: 'object', properties: {} } }],
        messages: [
          { role: 'user', content: 'go' },
          { role: 'assistant', content: '', toolCalls: [{ id: 'c9', name: 't1', args: { a: 1 } }] },
          { role: 'tool', toolCallId: 'c9', toolName: 't1', content: 'result' }
        ]
      })
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      tools: unknown[];
      messages: Array<Record<string, unknown>>;
    };
    expect((body.tools[0] as { type: string }).type).toBe('function');
    const toolMsg = body.messages[2];
    expect(toolMsg).toMatchObject({ role: 'tool', tool_call_id: 'c9', content: 'result' });
    const asst = body.messages[1];
    expect((asst.tool_calls as Array<{ function: { name: string } }>)[0].function.name).toBe('t1');
  });

  it('lists models via GET /models', async () => {
    fetchMock.mockResolvedValueOnce(jsonBody({ data: [{ id: 'b' }, { id: 'a' }] }));
    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiStyle: 'openai' });
    expect(await c.listModels()).toEqual(['a', 'b']);
  });
});

describe('anthropic adapter', () => {
  it('maps tool_use blocks and system prompt', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonBody({
        content: [
          { type: 'text', text: 'Working' },
          { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'x' } }
        ],
        usage: { input_tokens: 7, output_tokens: 3 }
      })
    );
    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiKey: 'k', apiStyle: 'anthropic' });
    const res = await c.chat(
      baseParams({ messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }] })
    );

    expect(res.text).toBe('Working');
    expect(res.toolCalls[0]).toMatchObject({ id: 'tu_1', name: 'read_file', args: { path: 'x' } });
    expect(res.usage).toEqual({ promptTokens: 7, completionTokens: 3 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('k');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(String(init.body)) as { system: string; max_tokens: number; messages: unknown[] };
    expect(body.system).toBe('be brief');
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  it('streams text and input_json deltas', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"tu9","name":"git"}}',
        'data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{\\"action\\":"}}',
        'data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"\\"status\\"}"}}',
        'data: {"type":"content_block_stop"}',
        'data: {"type":"content_block_start","content_block":{"type":"text"}}',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"done"}}',
        'data: {"type":"message_stop"}'
      ])
    );
    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiKey: 'k', apiStyle: 'anthropic' });
    const res = await c.chat(baseParams({ stream: true }));
    expect(res.text).toBe('done');
    expect(res.toolCalls).toEqual([{ id: 'tu9', name: 'git', args: { action: 'status' } }]);
  });
});

describe('errors & retries', () => {
  it('surfaces provider error messages', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 })
    );
    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiStyle: 'openai' });
    await expect(c.chat(baseParams())).rejects.toMatchObject({ status: 401, retryable: false });
  });

  it('retries 429 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":{"message":"rate limited"}}', { status: 429 }))
      .mockResolvedValueOnce(jsonBody({ choices: [{ message: { content: 'ok' } }] }));

    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiStyle: 'openai' });
    const res = await c.chat(baseParams());
    expect(res.text).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('network failures become AIError(status 0)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('failed to fetch'));
    const c = createClient({ providerId: 'p', baseURL: 'https://x/v1', apiStyle: 'openai' });
    await expect(c.chat(baseParams())).rejects.toBeInstanceOf(AIError);
  });
});
