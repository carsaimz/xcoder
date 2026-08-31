/**
 * Concrete LLM clients. Each maps the provider-agnostic ChatMessage/ToolDef
 * contract onto the vendor wire format and back. A `fetchImpl` can be injected
 * for testing.
 */

import {
  ApiStyle,
  ChatMessage,
  ChatOptions,
  LLMClient,
  ProviderError,
  ProviderProfile,
  ToolCallReq,
  ToolDef,
} from './types';

type FetchImpl = typeof fetch;

function baseHeaders(profile: ProviderProfile): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(profile.headers ?? {}) };
  return headers;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

function toolDefsOpenAI(tools?: ToolDef[]): unknown[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/* ------------------------------------------------------------------ OpenAI ---- */

export class OpenAIClient implements LLMClient {
  constructor(
    readonly profile: ProviderProfile,
    private fetchImpl: FetchImpl = (...args) => fetch(...args),
  ) {}

  private body(opts: ChatOptions, stream: boolean): Record<string, unknown> {
    const messages = opts.messages.map((m) => {
      if (m.role === 'assistant') {
        if (m.toolCalls?.length) {
          return {
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.toolCalls.map((c) => ({
              id: c.id,
              type: 'function',
              function: { name: c.name, arguments: c.arguments },
            })),
          };
        }
        return { role: 'assistant', content: m.content };
      }
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      return { role: m.role, content: m.content };
    });
    return {
      model: this.profile.model,
      messages,
      tools: toolDefsOpenAI(opts.tools),
      tool_choice: opts.tools?.length ? 'auto' : undefined,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream,
    };
  }

  async chat(opts: ChatOptions): Promise<ChatMessage> {
    const res = await this.fetchImpl(joinUrl(this.profile.baseURL, '/chat/completions'), {
      method: 'POST',
      headers: { ...baseHeaders(this.profile), Authorization: `Bearer ${this.profile.apiKey}` },
      body: JSON.stringify(this.body(opts, false)),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`OpenAI API ${res.status}: ${text.slice(0, 300)}`, res.status, 'openai');
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    };
    const msg = data.choices?.[0]?.message ?? {};
    return {
      role: 'assistant',
      content: msg.content ?? '',
      toolCalls: (msg.tool_calls ?? []).map(
        (c): ToolCallReq => ({ id: c.id, name: c.function.name, arguments: c.function.arguments }),
      ),
    };
  }

  /** SSE streaming (OpenAI style). */
  async stream(opts: ChatOptions, onDelta: (text: string) => void): Promise<ChatMessage> {
    const res = await this.fetchImpl(joinUrl(this.profile.baseURL, '/chat/completions'), {
      method: 'POST',
      headers: { ...baseHeaders(this.profile), Authorization: `Bearer ${this.profile.apiKey}` },
      body: JSON.stringify(this.body(opts, true)),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const text = res.body ? await res.text().catch(() => '') : `status ${res.status}`;
      throw new ProviderError(`OpenAI stream ${res.status}: ${text.slice(0, 300)}`, res.status, 'openai');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const toolAcc = new Map<number, { id: string; name: string; args: string }>();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }>;
          };
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            content += delta.content;
            onDelta(delta.content);
          }
          for (const tc of delta?.tool_calls ?? []) {
            const acc = toolAcc.get(tc.index) ?? { id: '', name: '', args: '' };
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name += tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
            toolAcc.set(tc.index, acc);
          }
        } catch {
          /* ignore malformed keep-alive lines */
        }
      }
    }
    return {
      role: 'assistant',
      content,
      toolCalls: [...toolAcc.values()]
        .filter((t) => t.name)
        .map((t) => ({ id: t.id || `call_${t.name}`, name: t.name, arguments: t.args || '{}' })),
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
    try {
      const res = await this.fetchImpl(joinUrl(this.profile.baseURL, '/models'), {
        headers: { ...baseHeaders(this.profile), Authorization: `Bearer ${this.profile.apiKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const models = (data.data ?? []).map((m) => m.id).slice(0, 8);
      return { ok: true, message: 'ok', models };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

/* --------------------------------------------------------------- Anthropic ---- */

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

export class AnthropicClient implements LLMClient {
  constructor(
    readonly profile: ProviderProfile,
    private fetchImpl: FetchImpl = (...args) => fetch(...args),
  ) {}

  private build(opts: ChatOptions): { system: string; messages: Array<{ role: 'user' | 'assistant'; content: AnthropicBlock[] }> } {
    const systemParts: string[] = [];
    const out: Array<{ role: 'user' | 'assistant'; content: AnthropicBlock[] }> = [];

    const flushToolResults = (items: ChatMessage[]) => {
      out.push({
        role: 'user',
        content: items.map((m) => ({
          type: 'tool_result',
          tool_use_id: m.toolCallId,
          content: m.content,
        })),
      });
    };

    let pendingTools: ChatMessage[] = [];
    for (const m of opts.messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      } else if (m.role === 'tool') {
        pendingTools.push(m);
      } else {
        if (pendingTools.length) {
          flushToolResults(pendingTools);
          pendingTools = [];
        }
        if (m.role === 'user') {
          out.push({ role: 'user', content: [{ type: 'text', text: m.content }] });
        } else {
          const blocks: AnthropicBlock[] = [];
          if (m.content) blocks.push({ type: 'text', text: m.content });
          for (const call of m.toolCalls ?? []) {
            let input: Record<string, unknown> = {};
            try {
              input = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
            } catch {
              input = {};
            }
            blocks.push({ type: 'tool_use', id: call.id, name: call.name, input });
          }
          out.push({ role: 'assistant', content: blocks });
        }
      }
    }
    if (pendingTools.length) flushToolResults(pendingTools);
    return { system: systemParts.join('\n\n'), messages: out };
  }

  private endpoint(): string {
    const base = this.profile.baseURL.replace(/\/+$/, '');
    return joinUrl(base, base.endsWith('/v1') ? '/messages' : '/v1/messages');
  }

  async chat(opts: ChatOptions): Promise<ChatMessage> {
    const { system, messages } = this.build(opts);
    const body: Record<string, unknown> = {
      model: this.profile.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature,
      messages,
    };
    if (system) body.system = system;
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }
    const res = await this.fetchImpl(this.endpoint(), {
      method: 'POST',
      headers: {
        ...baseHeaders(this.profile),
        'x-api-key': this.profile.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Anthropic API ${res.status}: ${text.slice(0, 300)}`, res.status, 'anthropic');
    }
    const data = (await res.json()) as { content?: AnthropicBlock[] };
    const blocks = data.content ?? [];
    const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const calls = blocks
      .filter((b) => b.type === 'tool_use')
      .map((b): ToolCallReq => ({ id: b.id ?? '', name: b.name ?? '', arguments: JSON.stringify(b.input ?? {}) }));
    return { role: 'assistant', content: text, toolCalls: calls };
  }

  async testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
    try {
      const res = await this.fetchImpl(this.endpoint(), {
        method: 'POST',
        headers: {
          ...baseHeaders(this.profile),
          'x-api-key': this.profile.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.profile.model,
          max_tokens: 8,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, message: 'ok' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

/* ------------------------------------------------------------------ Gemini ---- */

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export class GeminiClient implements LLMClient {
  constructor(
    readonly profile: ProviderProfile,
    private fetchImpl: FetchImpl = (...args) => fetch(...args),
  ) {}

  private build(opts: ChatOptions): { system?: { parts: GeminiPart[] }; contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> } {
    let system: { parts: GeminiPart[] } | undefined;
    const contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = [];
    let pendingToolResults: ChatMessage[] = [];

    const flush = () => {
      if (!pendingToolResults.length) return;
      contents.push({
        role: 'user',
        parts: pendingToolResults.map((m) => ({
          functionResponse: { name: m.name ?? m.toolCallId ?? 'tool', response: { result: m.content } },
        })),
      });
      pendingToolResults = [];
    };

    for (const m of opts.messages) {
      if (m.role === 'system') {
        system = { parts: [{ text: m.content }] };
      } else if (m.role === 'tool') {
        pendingToolResults.push(m);
      } else if (m.role === 'user') {
        flush();
        contents.push({ role: 'user', parts: [{ text: m.content }] });
      } else {
        flush();
        const parts: GeminiPart[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const call of m.toolCalls ?? []) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
          } catch {
            args = {};
          }
          parts.push({ functionCall: { name: call.name, args } });
        }
        contents.push({ role: 'model', parts });
      }
    }
    flush();
    return { system, contents };
  }

  async chat(opts: ChatOptions): Promise<ChatMessage> {
    const { system, contents } = this.build(opts);
    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature: opts.temperature, maxOutputTokens: opts.maxTokens },
    };
    if (system) body.systemInstruction = system;
    if (opts.tools?.length) {
      body.tools = [
        {
          functionDeclarations: opts.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }
    const url = `${this.profile.baseURL.replace(/\/+$/, '')}/models/${this.profile.model}:generateContent`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { ...baseHeaders(this.profile), 'x-goog-api-key': this.profile.apiKey },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Gemini API ${res.status}: ${text.slice(0, 300)}`, res.status, 'gemini');
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p) => p.text !== undefined).map((p) => p.text).join('');
    let callIndex = 0;
    const calls = parts
      .filter((p) => p.functionCall)
      .map((p): ToolCallReq => {
        callIndex++;
        return {
          id: `gem-call-${callIndex}-${Date.now().toString(36)}`,
          name: p.functionCall!.name,
          arguments: JSON.stringify(p.functionCall!.args ?? {}),
        };
      });
    return { role: 'assistant', content: text, toolCalls: calls };
  }

  async testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
    try {
      const url = `${this.profile.baseURL.replace(/\/+$/, '')}/models`;
      const res = await this.fetchImpl(url, {
        headers: { ...baseHeaders(this.profile), 'x-goog-api-key': this.profile.apiKey },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const models = (data.models ?? []).map((m) => m.name.replace('models/', '')).slice(0, 8);
      return { ok: true, message: 'ok', models };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

/* ------------------------------------------------------------------ factory ---- */

export function createClient(profile: ProviderProfile, fetchImpl: FetchImpl = (...args) => fetch(...args)): LLMClient {
  switch (profile.api) {
    case 'anthropic':
      return new AnthropicClient(profile, fetchImpl);
    case 'gemini':
      return new GeminiClient(profile, fetchImpl);
    case 'openai':
    default:
      return new OpenAIClient(profile, fetchImpl);
  }
}

export function apiStyleFor(api: ApiStyle): string {
  return api;
}
