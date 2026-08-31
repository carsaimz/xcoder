import { describe, expect, it } from 'vitest';
import { PRESETS, getPreset, presetsByGroup } from '../src/core/ai/presets';
import { createClient, OpenAIClient, AnthropicClient, GeminiClient } from '../src/core/ai/clients';
import { ProviderProfile } from '../src/core/ai/types';

describe('provider presets', () => {
  it('contains the 3 required groups', () => {
    const groups = new Set(PRESETS.map((p) => p.group));
    expect([...groups].sort()).toEqual(['free', 'freemium', 'premium']);
  });

  it('every preset has valid required fields', () => {
    for (const preset of PRESETS) {
      expect(preset.id).toMatch(/^[a-z0-9-]+$/);
      expect(preset.label).toBeTruthy();
      expect(preset.baseURL).toMatch(/^https?:\/\//);
      expect(preset.models.length).toBeGreaterThan(0);
      for (const model of preset.models) expect(model.id).toBeTruthy();
    }
  });

  it('ids are unique', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });

  it('free group includes groq/openrouter/ollama; premium includes azure/bedrock/vertex', () => {
    const freeIds = presetsByGroup('free').map((p) => p.id);
    expect(freeIds).toContain('groq');
    expect(freeIds).toContain('openrouter-free');
    expect(freeIds).toContain('ollama');
    const premiumIds = presetsByGroup('premium').map((p) => p.id);
    expect(premiumIds).toContain('azure-openai');
    expect(premiumIds).toContain('aws-bedrock');
    expect(premiumIds).toContain('google-vertex');
  });

  it('ollama works without a key; others require one', () => {
    expect(getPreset('ollama')!.requiresKey).toBe(false);
    expect(getPreset('groq')!.requiresKey).toBe(true);
  });

  it('getPreset returns undefined for unknown ids', () => {
    expect(getPreset('nope')).toBeUndefined();
  });
});

const profile = (over: Partial<ProviderProfile> = {}): ProviderProfile => ({
  id: 'p1',
  presetId: 'custom',
  label: 'Test',
  api: 'openai',
  baseURL: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'test-model',
  ...over,
});

describe('OpenAI client', () => {
  it('sends the openai chat shape and maps tool_calls back', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'calling tool',
                tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'fs.read', arguments: '{"path":"a.txt"}' } }],
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const client = createClient(profile(), fetchImpl) as OpenAIClient;
    const res = await client.chat({
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'fs.read', arguments: '{"path":"a.txt"}' }] },
        { role: 'tool', toolCallId: 'call_1', content: 'file body' },
      ],
      tools: [{ name: 'fs.read', description: 'd', parameters: { type: 'object', properties: {} } }],
    });
    const body = JSON.parse(String(captured!.init.body));
    expect(captured!.url).toBe('https://api.example.com/v1/chat/completions');
    expect(body.model).toBe('test-model');
    expect(body.tools[0].function.name).toBe('fs.read');
    expect(body.messages[2].tool_calls[0].function.name).toBe('fs.read');
    expect(body.messages[3]).toEqual({ role: 'tool', tool_call_id: 'call_1', content: 'file body' });
    expect(res.toolCalls?.[0]).toEqual({ id: 'call_1', name: 'fs.read', arguments: '{"path":"a.txt"}' });
  });

  it('uses Authorization bearer header', async () => {
    let headers: HeadersInit | undefined;
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      headers = init?.headers;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    }) as typeof fetch;
    const client = createClient(profile(), fetchImpl);
    await client.chat({ messages: [{ role: 'user', content: 'x' }] });
    expect((headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });
});

describe('Anthropic client', () => {
  it('maps system+tools+tool_result to the messages API', async () => {
    let captured: { url: string; body: Record<string, unknown> } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), body: JSON.parse(String(init?.body)) };
      return new Response(
        JSON.stringify({
          content: [
            { type: 'text', text: 'using tool' },
            { type: 'tool_use', id: 'tu_1', name: 'fs.read', input: { path: 'a.txt' } },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const client = createClient(profile({ api: 'anthropic' }), fetchImpl) as AnthropicClient;
    const res = await client.chat({
      messages: [
        { role: 'system', content: 'be nice' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'tu_1', name: 'fs.read', arguments: '{"path":"a.txt"}' }] },
        { role: 'tool', toolCallId: 'tu_1', content: 'data' },
      ],
      tools: [{ name: 'fs.read', description: 'd', parameters: { type: 'object', properties: {} } }],
    });
    expect(captured!.url).toBe('https://api.example.com/v1/messages');
    expect(captured!.body.system).toBe('be nice');
    expect(captured!.body.max_tokens).toBeDefined();
    const tools = captured!.body.tools as Array<Record<string, unknown>>;
    expect(tools[0].input_schema).toBeDefined();
    // tool result grouped as user message with tool_result block
    const msgs = captured!.body.messages as Array<{ role: string; content: unknown }>;
    const last = msgs[msgs.length - 1];
    expect(last.role).toBe('user');
    expect(JSON.stringify(last.content)).toContain('tool_result');
    expect(JSON.stringify(last.content)).toContain('tu_1');
    // response mapping
    expect(res.content).toBe('using tool');
    expect(res.toolCalls?.[0].name).toBe('fs.read');
  });
});

describe('Gemini client', () => {
  it('maps contents/functionDeclarations and parses functionCalls', async () => {
    let captured: { url: string; body: Record<string, unknown> } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), body: JSON.parse(String(init?.body)) };
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'thinking' },
                  { functionCall: { name: 'fs.read', args: { path: 'a.txt' } } },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const client = createClient(profile({ api: 'gemini' }), fetchImpl) as GeminiClient;
    const res = await client.chat({
      messages: [
        { role: 'system', content: 'sys prompt' },
        { role: 'user', content: 'do it' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'g1', name: 'fs.read', arguments: '{"path":"a.txt"}' }] },
        { role: 'tool', toolCallId: 'g1', name: 'fs.read', content: 'file data' },
      ],
      tools: [{ name: 'fs.read', description: 'd', parameters: { type: 'object', properties: {} } }],
    });
    expect(captured!.url).toContain('/models/test-model:generateContent');
    expect(captured!.body.systemInstruction).toBeDefined();
    expect(captured!.body.tools).toBeDefined();
    const contents = captured!.body.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    const fnResponse = contents.find((c) => c.parts.some((p) => p.functionResponse));
    expect(fnResponse?.parts[0].functionResponse).toMatchObject({ name: 'fs.read' });
    expect(res.toolCalls?.[0].name).toBe('fs.read');
    expect(res.content).toBe('thinking');
  });
});

describe('provider errors', () => {
  it('surfaces HTTP errors with status', async () => {
    const fetchImpl = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;
    const client = createClient(profile(), fetchImpl);
    await expect(client.chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(/429/);
  });
});
