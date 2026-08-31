/**
 * LLM client — OpenAI-compatible chat completions + Anthropic Messages API,
 * with SSE streaming, tool calls, retries and usage accounting.
 *
 * The agent loop is provider-agnostic: both adapters normalize to the same
 * AiMessage / ToolCallReq shapes.
 */

export interface ToolCallReq {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** assistant messages: tool calls requested by the model */
  toolCalls?: ToolCallReq[];
  /** tool messages */
  toolCallId?: string;
  toolName?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the `parameters` object */
  parameters: Record<string, unknown>;
}

export interface ChatDelta {
  text?: string;
}

export interface ChatParams {
  messages: AiMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolSpec[];
  stream?: boolean;
  signal?: AbortSignal;
  onDelta?: (d: ChatDelta) => void;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatResult {
  text: string;
  toolCalls: ToolCallReq[];
  usage?: ChatUsage;
}

export class AIError extends Error {
  readonly status: number;
  readonly providerId: string;
  readonly retryable: boolean;

  constructor(providerId: string, status: number, message: string) {
    super(`[${providerId}] ${status || 'network'}: ${message}`);
    this.name = 'AIError';
    this.providerId = providerId;
    this.status = status;
    this.retryable = status === 429 || status === 408 || status >= 500;
  }
}

export interface ClientOptions {
  providerId: string;
  baseURL: string;
  apiKey?: string;
  apiStyle: 'openai' | 'anthropic';
  /** extra HTTP headers (custom providers / auth gateways) */
  headers?: Record<string, string>;
}

const RETRY_DELAYS = [800, 2000];

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

interface RawResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  body: ReadableStream<Uint8Array> | null;
}

async function doFetch(
  url: string,
  init: RequestInit,
  providerId: string
): Promise<RawResponse> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new AIError(providerId, 0, err instanceof Error ? err.message : 'network error');
  }
  return res as unknown as RawResponse;
}

async function parseErrorBody(res: RawResponse): Promise<string> {
  let detail = '';
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof json.error === 'string') detail = json.error;
      else detail = json.error?.message ?? json.message ?? text;
    } catch {
      detail = text;
    }
  } catch {
    detail = res.status === 401 ? 'unauthorized' : 'unreachable';
  }
  return (detail || 'unknown error').slice(0, 500);
}

// ── OpenAI-compatible adapter ────────────────────────────────────────────────

interface OpenAIToolCallChunk {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAIChunk {
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

function toOpenAIMessages(params: ChatParams): Record<string, unknown>[] {
  return params.messages.map((msg) => {
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      return {
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) }
        }))
      };
    }
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: msg.toolCallId ?? '',
        content: msg.content
      };
    }
    return { role: msg.role, content: msg.content };
  });
}

async function chatOpenAI(
  opts: ClientOptions,
  params: ChatParams
): Promise<ChatResult> {
  const url = `${opts.baseURL.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
    ...opts.headers
  };
  const body: Record<string, unknown> = {
    model: params.model,
    messages: toOpenAIMessages(params),
    stream: params.stream ?? false
  };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
  if (params.tools?.length) {
    body.tools = params.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }));
  }

  const stream = params.stream ?? false;
  const res = await doFetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: params.signal }, opts.providerId);

  if (!res.ok) {
    throw new AIError(opts.providerId, res.status, await parseErrorBody(res));
  }

  if (!stream || !res.body) {
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const msg = json.choices?.[0]?.message;
    return {
      text: msg?.content ?? '',
      toolCalls: (msg?.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: safeJson(tc.function.arguments)
      })),
      usage: json.usage
        ? { promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0 }
        : undefined
    };
  }

  // SSE streaming
  let text = '';
  const toolAcc = new Map<number, { id: string; name: string; args: string }>();
  let usage: ChatUsage | undefined;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleChunk = (json: OpenAIChunk) => {
    if (json.usage) {
      usage = { promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0 };
    }
    for (const choice of json.choices ?? []) {
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        params.onDelta?.({ text: delta.content });
      }
      for (const tc of (delta as { tool_calls?: OpenAIToolCallChunk[] } | undefined)?.tool_calls ?? []) {
        const acc = toolAcc.get(tc.index) ?? { id: '', name: '', args: '' };
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.name += tc.function.name;
        if (tc.function?.arguments) acc.args += tc.function.arguments;
        toolAcc.set(tc.index, acc);
      }
    }
  };

  // read loop with backpressure-safe parsing
  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        done = true;
        break;
      }
      try {
        handleChunk(JSON.parse(payload) as OpenAIChunk);
      } catch {
        // ignore malformed keepalive chunks
      }
    }
  }
  // flush a trailing frame that lacks its final newline
  const tail = buffer.trim();
  if (tail.startsWith('data:')) {
    const tailPayload = tail.slice(5).trim();
    if (tailPayload === '[DONE]') done = true;
    else {
      try {
        handleChunk(JSON.parse(tailPayload) as OpenAIChunk);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    text,
    toolCalls: [...toolAcc.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((acc) => ({ id: acc.id || `call_${acc.name}`, name: acc.name, args: safeJson(acc.args || '{}') })),
    usage
  };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ── Anthropic adapter ────────────────────────────────────────────────────────

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

function toAnthropicMessages(params: ChatParams): {
  system: string | undefined;
  messages: Array<{ role: 'user' | 'assistant'; content: AnthropicBlock[] }>;
} {
  let system: string | undefined;
  const out: Array<{ role: 'user' | 'assistant'; content: AnthropicBlock[] }> = [];
  const pushBlock = (role: 'user' | 'assistant', block: AnthropicBlock) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };

  for (const msg of params.messages) {
    if (msg.role === 'system') {
      system = system ? `${system}\n\n${msg.content}` : msg.content;
    } else if (msg.role === 'assistant') {
      if (msg.content) pushBlock('assistant', { type: 'text', text: msg.content });
      for (const tc of msg.toolCalls ?? []) {
        pushBlock('assistant', { type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
      }
    } else if (msg.role === 'tool') {
      pushBlock('user', {
        type: 'tool_result',
        tool_use_id: msg.toolCallId ?? '',
        content: msg.content
      });
    } else {
      pushBlock('user', { type: 'text', text: msg.content });
    }
  }
  return { system, messages: out };
}

async function chatAnthropic(
  opts: ClientOptions,
  params: ChatParams
): Promise<ChatResult> {
  const url = `${opts.baseURL.replace(/\/+$/, '')}/messages`;
  const { system, messages } = toAnthropicMessages(params);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': opts.apiKey ?? '',
    'anthropic-version': '2023-06-01',
    // required for direct browser/webview calls
    'anthropic-dangerous-direct-browser-access': 'true',
    ...opts.headers
  };
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    messages,
    stream: params.stream ?? false
  };
  if (system) body.system = system;
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.tools?.length) {
    body.tools = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
  }

  const stream = params.stream ?? false;
  const res = await doFetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: params.signal }, opts.providerId);
  if (!res.ok) {
    throw new AIError(opts.providerId, res.status, await parseErrorBody(res));
  }

  if (!stream || !res.body) {
    const json = (await res.json()) as {
      content?: AnthropicBlock[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (json.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const toolCalls = (json.content ?? [])
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id ?? '', name: b.name ?? '', args: b.input ?? {} }));
    return {
      text,
      toolCalls,
      usage: json.usage
        ? { promptTokens: json.usage.input_tokens ?? 0, completionTokens: json.usage.output_tokens ?? 0 }
        : undefined
    };
  }

  let text = '';
  const toolCalls: ToolCallReq[] = [];
  let currentTool: { id: string; name: string; json: string } | null = null;
  let usage: ChatUsage | undefined;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleEvent = (json: Record<string, unknown>) => {
    const type = json.type as string;
    if (type === 'content_block_start') {
      const block = json.content_block as AnthropicBlock;
      if (block?.type === 'tool_use') {
        currentTool = { id: block.id ?? '', name: block.name ?? '', json: '' };
      }
    } else if (type === 'content_block_delta') {
      const delta = json.delta as { type: string; text?: string; partial_json?: string };
      if (delta.type === 'text_delta' && delta.text) {
        text += delta.text;
        params.onDelta?.({ text: delta.text });
      } else if (delta.type === 'input_json_delta' && currentTool) {
        currentTool.json += delta.partial_json ?? '';
      }
    } else if (type === 'content_block_stop') {
      if (currentTool) {
        toolCalls.push({ id: currentTool.id, name: currentTool.name, args: safeJson(currentTool.json || '{}') });
        currentTool = null;
      }
    } else if (type === 'message_delta') {
      const u = (json as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
      if (u) usage = { promptTokens: u.input_tokens ?? 0, completionTokens: u.output_tokens ?? 0 };
    }
  };

  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as Record<string, unknown>;
        if (json.type === 'message_stop') done = true;
        handleEvent(json);
      } catch {
        // ignore
      }
    }
  }

  return {
    text,
    toolCalls,
    usage
  };
}

// ── public factory ───────────────────────────────────────────────────────────

export function createClient(opts: ClientOptions): {
  chat: (params: ChatParams) => Promise<ChatResult>;
  listModels: () => Promise<string[]>;
} {
  const impl = opts.apiStyle === 'anthropic' ? chatAnthropic : chatOpenAI;

  async function chat(params: ChatParams): Promise<ChatResult> {
    let attempt = 0;
    // retries for rate limits / transient server errors
    for (;;) {
      try {
        return await impl(opts, params);
      } catch (err) {
        if (err instanceof AIError && err.retryable && attempt < RETRY_DELAYS.length) {
          await sleep(RETRY_DELAYS[attempt], params.signal);
          attempt++;
          continue;
        }
        throw err;
      }
    }
  }

  async function listModels(): Promise<string[]> {
    if (opts.apiStyle !== 'openai') return [];
    const res = await doFetch(
      `${opts.baseURL.replace(/\/+$/, '')}/models`,
      {
        headers: {
          ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
          ...opts.headers
        }
      },
      opts.providerId
    );
    if (!res.ok) throw new AIError(opts.providerId, res.status, await parseErrorBody(res));
    const json = (await res.json()) as { data?: Array<{ id: string }> };
    return (json.data ?? []).map((d) => d.id).sort();
  }

  return { chat, listModels };
}
