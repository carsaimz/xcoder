/**
 * AI provider contracts. XCoder speaks three API dialects:
 *  - `openai`    : POST /chat/completions (works for Groq, OpenRouter, Ollama,
 *                  Mistral, DeepSeek, Together, Cerebras, Azure, …)
 *  - `anthropic` : POST /v1/messages (Claude)
 *  - `gemini`    : POST {model}:generateContent (Google AI Studio / Vertex)
 */

export type ProviderGroup = 'free' | 'freemium' | 'premium';
export type ApiStyle = 'openai' | 'anthropic' | 'gemini';

export interface ModelInfo {
  id: string;
  label?: string;
  /** approximate context window in thousands of tokens */
  contextK?: number;
  /** supports function/tool calling */
  tools?: boolean;
}

export interface ProviderPreset {
  id: string;
  label: string;
  group: ProviderGroup;
  api: ApiStyle;
  baseURL: string;
  /** page where the user can obtain an API key */
  apiKeyURL?: string;
  models: ModelInfo[];
  /** short note shown in the settings UI */
  note?: string;
  /** true when the API works without any key (e.g. local Ollama) */
  requiresKey: boolean;
}

/** A configured (possibly customized) provider instance stored in settings. */
export interface ProviderProfile {
  id: string;
  presetId: string;
  label: string;
  api: ApiStyle;
  baseURL: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
}

/** JSON-schema description of an agent tool, provider agnostic. */
export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Provider-agnostic tool call request coming back from the model. */
export interface ToolCallReq {
  id: string;
  name: string;
  /** arguments as a JSON string (OpenAI convention) */
  arguments: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** assistant: tool calls requested by the model */
  toolCalls?: ToolCallReq[];
  /** tool: id of the tool call this message answers */
  toolCallId?: string;
  /** tool: name of the tool that produced this result */
  name?: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMClient {
  readonly profile: ProviderProfile;
  /** Single completion; returns the assistant message (may contain toolCalls). */
  chat(opts: ChatOptions): Promise<ChatMessage>;
  /** Optional token streaming. Falls back to chat() when unsupported. */
  stream?(opts: ChatOptions, onDelta: (text: string) => void): Promise<ChatMessage>;
  /** Quick connectivity check. */
  testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
