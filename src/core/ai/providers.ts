/**
 * AI provider registry.
 *
 * Providers are grouped into three tiers so users can pick a sensible default
 * without reading marketing pages:
 *
 *   - `free`     — genuinely free endpoints (community free models, local runtimes)
 *   - `freemium` — paid services with a usable free tier / trial credit
 *   - `premium`  — paid, high-end frontier models
 *
 * Every OpenAI-compatible provider works out of the box; Anthropic has a
 * dedicated adapter (see client.ts). Users can add unlimited custom providers
 * (Ollama, LM Studio, LiteLLM, Azure OpenAI, corporate gateways…).
 */

export type ProviderTier = 'free' | 'freemium' | 'premium';

export type ApiStyle = 'openai' | 'anthropic';

export interface AiModelDef {
  id: string;
  name: string;
  /** short capability tags shown in the picker */
  tags?: string[];
}

export interface ProviderDef {
  id: string;
  name: string;
  tier: ProviderTier;
  /** base URL — chat completions are appended as `/chat/completions` or `/messages` */
  baseURL: string;
  apiStyle: ApiStyle;
  /** false only for local runtimes (Ollama, LM Studio…) and keyless endpoints */
  needsKey: boolean;
  models: AiModelDef[];
  /** console/dashboard URL where the user obtains a key */
  keyUrl?: string;
  /** one-line note shown in Settings */
  note?: string;
  /** whether the endpoint is reachable from a browser/WebView (CORS-friendly) */
  browserOk: boolean;
}

/** A provider definition created by the user in Settings. */
export interface CustomProvider {
  id: string;
  name: string;
  baseURL: string;
  apiStyle: ApiStyle;
  needsKey: boolean;
  models: string[];
}

const m = (id: string, name: string, tags?: string[]): AiModelDef => ({ id, name, tags });

export const BUILTIN_PROVIDERS: ProviderDef[] = [
  // ── free ──────────────────────────────────────────────────────────────────
  {
    id: 'openrouter-free',
    name: 'OpenRouter (free models)',
    tier: 'free',
    baseURL: 'https://openrouter.ai/api/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Free community models, paid credits optional.',
    models: [
      m('deepseek/deepseek-chat-v3.1:free', 'DeepSeek Chat v3.1 (free)', ['chat', 'code']),
      m('meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B (free)', ['chat']),
      m('qwen/qwen-2.5-coder-32b-instruct:free', 'Qwen2.5 Coder 32B (free)', ['code']),
      m('google/gemma-3-27b-it:free', 'Gemma 3 27B (free)', ['chat']),
      m('mistralai/mistral-small-3.2-24b-instruct:free', 'Mistral Small 3.2 (free)', ['chat'])
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    tier: 'free',
    baseURL: 'https://api.groq.com/openai/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://console.groq.com/keys',
    note: 'Free tier with generous rate limits, blazing fast inference.',
    models: [
      m('llama-3.3-70b-versatile', 'Llama 3.3 70B Versatile', ['chat']),
      m('meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout 17B', ['chat', 'fast']),
      m('qwen/qwen3-32b', 'Qwen 3 32B', ['chat', 'code']),
      m('deepseek-r1-distill-llama-70b', 'DeepSeek R1 Distill 70B', ['reasoning'])
    ]
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    tier: 'free',
    baseURL: 'https://api.cerebras.ai/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://cloud.cerebras.ai',
    note: 'Free tier — fastest tokens/sec in the industry.',
    models: [
      m('llama-3.3-70b', 'Llama 3.3 70B', ['chat']),
      m('qwen-3-32b', 'Qwen 3 32B', ['code']),
      m('gpt-oss-120b', 'GPT-OSS 120B', ['open'])
    ]
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    tier: 'free',
    baseURL: 'https://models.github.ai/inference',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://github.com/settings/personal-access-tokens',
    note: 'Free for GitHub users with rate limits — use a GitHub PAT.',
    models: [
      m('openai/gpt-4.1-mini', 'GPT-4.1 mini', ['chat', 'code']),
      m('openai/gpt-4o', 'GPT-4o', ['chat']),
      m('meta/Llama-4-Scout-17B-16E-Instruct', 'Llama 4 Scout', ['chat']),
      m('mistral-ai/mistral-small-2503', 'Mistral Small 3.1', ['fast'])
    ]
  },
  {
    id: 'pollinations',
    name: 'Pollinations (keyless)',
    tier: 'free',
    baseURL: 'https://text.pollinations.ai/openai',
    apiStyle: 'openai',
    needsKey: false,
    browserOk: true,
    keyUrl: 'https://auth.pollinations.ai',
    note: 'No API key required — best-effort community endpoint.',
    models: [
      m('openai', 'OpenAI (proxy)', ['chat']),
      m('openai-large', 'OpenAI large (proxy)', ['chat'])
    ]
  },
  {
    id: 'ollama-local',
    name: 'Ollama (local)',
    tier: 'free',
    baseURL: 'http://localhost:11434/v1',
    apiStyle: 'openai',
    needsKey: false,
    browserOk: false,
    note: 'Local models on your machine/localhost. Enable cleartext for Android.',
    models: [
      m('qwen2.5-coder:7b', 'Qwen2.5 Coder 7B', ['code', 'local']),
      m('llama3.3:70b', 'Llama 3.3 70B', ['local']),
      m('deepseek-r1:8b', 'DeepSeek R1 8B', ['reasoning', 'local'])
    ]
  },
  {
    id: 'lmstudio-local',
    name: 'LM Studio (local)',
    tier: 'free',
    baseURL: 'http://localhost:1234/v1',
    apiStyle: 'openai',
    needsKey: false,
    browserOk: false,
    note: 'LM Studio local server (enable CORS in its server tab).',
    models: [m('local-model', 'Loaded model', ['local'])]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Router',
    tier: 'free',
    baseURL: 'https://router.huggingface.co/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://huggingface.co/settings/tokens',
    note: 'Monthly free inference credits with an HF account.',
    models: [
      m('Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen2.5 Coder 32B', ['code']),
      m('meta-llama/Llama-3.3-70B-Instruct', 'Llama 3.3 70B', ['chat'])
    ]
  },

  // ── freemium ──────────────────────────────────────────────────────────────
  {
    id: 'google',
    name: 'Google AI Studio (Gemini)',
    tier: 'freemium',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Free tier on AI Studio; pay-as-you-go beyond limits.',
    models: [
      m('gemini-2.5-flash', 'Gemini 2.5 Flash', ['fast', 'code']),
      m('gemini-2.5-pro', 'Gemini 2.5 Pro', ['frontier', 'code']),
      m('gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', ['fast', 'cheap'])
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral La Plateforme',
    tier: 'freemium',
    baseURL: 'https://api.mistral.ai/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://console.mistral.ai/api-keys',
    note: 'Free experimental tier; paid plans scale up.',
    models: [
      m('mistral-large-latest', 'Mistral Large', ['frontier']),
      m('mistral-small-latest', 'Mistral Small', ['fast']),
      m('codestral-latest', 'Codestral', ['code'])
    ]
  },
  {
    id: 'together',
    name: 'Together AI',
    tier: 'freemium',
    baseURL: 'https://api.together.xyz/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://api.together.ai/settings/api-keys',
    note: 'Sign-up credit; cheap open models afterwards.',
    models: [
      m('Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen2.5 Coder 32B', ['code']),
      m('meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Llama 3.3 70B Turbo', ['chat']),
      m('deepseek-ai/DeepSeek-V3', 'DeepSeek V3', ['chat'])
    ]
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    tier: 'freemium',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://fireworks.ai/account/api-keys',
    note: '$1 free credit to start.',
    models: [
      m('accounts/fireworks/models/qwen2p5-coder-32b-instruct', 'Qwen2.5 Coder 32B', ['code']),
      m('accounts/fireworks/models/llama-v3p3-70b-instruct', 'Llama 3.3 70B', ['chat'])
    ]
  },
  {
    id: 'cohere',
    name: 'Cohere',
    tier: 'freemium',
    baseURL: 'https://api.cohere.ai/compatibility/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    note: 'Free trial keys, production keys paid.',
    models: [
      m('command-a-03-2025', 'Command A', ['chat']),
      m('command-r-plus-08-2024', 'Command R+', ['chat'])
    ]
  },

  // ── premium ───────────────────────────────────────────────────────────────
  {
    id: 'openai',
    name: 'OpenAI',
    tier: 'premium',
    baseURL: 'https://api.openai.com/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      m('gpt-5.1', 'GPT-5.1', ['frontier', 'code']),
      m('gpt-5.1-mini', 'GPT-5.1 mini', ['fast']),
      m('gpt-4.1', 'GPT-4.1', ['code']),
      m('o4-mini', 'o4-mini', ['reasoning'])
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    tier: 'premium',
    baseURL: 'https://api.anthropic.com/v1',
    apiStyle: 'anthropic',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      m('claude-sonnet-4-5', 'Claude Sonnet 4.5', ['frontier', 'code']),
      m('claude-opus-4-1', 'Claude Opus 4.1', ['frontier']),
      m('claude-haiku-4-5', 'Claude Haiku 4.5', ['fast'])
    ]
  },
  {
    id: 'xai',
    name: 'xAI',
    tier: 'premium',
    baseURL: 'https://api.x.ai/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://console.x.ai',
    models: [
      m('grok-4', 'Grok 4', ['frontier', 'reasoning']),
      m('grok-code-fast-1', 'Grok Code Fast', ['code', 'fast'])
    ]
  },
  {
    id: 'zai',
    name: 'Z.ai (GLM)',
    tier: 'premium',
    baseURL: 'https://api.z.ai/api/paas/v4',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://z.ai/model-api',
    models: [
      m('glm-4.6', 'GLM-4.6', ['frontier', 'code']),
      m('glm-4.5-air', 'GLM-4.5 Air', ['fast'])
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tier: 'premium',
    baseURL: 'https://api.deepseek.com/v1',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'Paid-only, very low price per token.',
    models: [
      m('deepseek-chat', 'DeepSeek Chat', ['code']),
      m('deepseek-reasoner', 'DeepSeek Reasoner', ['reasoning'])
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    tier: 'premium',
    baseURL: 'https://api.perplexity.ai',
    apiStyle: 'openai',
    needsKey: true,
    browserOk: true,
    keyUrl: 'https://www.perplexity.ai/settings/api',
    note: 'Search-grounded answers.',
    models: [
      m('sonar-pro', 'Sonar Pro', ['search']),
      m('sonar-reasoning-pro', 'Sonar Reasoning Pro', ['reasoning', 'search'])
    ]
  }
];

export const TIER_ORDER: ProviderTier[] = ['free', 'freemium', 'premium'];

export const TIER_LABELS: Record<ProviderTier, string> = {
  free: 'Free',
  freemium: 'Paid · free tier',
  premium: 'Paid · premium'
};

// ── lookups ──────────────────────────────────────────────────────────────────

export function getBuiltinProvider(id: string): ProviderDef | undefined {
  return BUILTIN_PROVIDERS.find((p) => p.id === id);
}

export function providersByTier(custom?: CustomProvider[]): Record<ProviderTier, ProviderDef[]> {
  const out: Record<ProviderTier, ProviderDef[]> = { free: [], freemium: [], premium: [] };
  for (const p of BUILTIN_PROVIDERS) out[p.tier].push(p);
  if (custom && custom.length) {
    out.free.push(...custom.map(toProviderDef));
  }
  return out;
}

export function toProviderDef(c: CustomProvider): ProviderDef {
  return {
    id: `custom:${c.id}`,
    name: `${c.name} (custom)`,
    tier: 'free',
    baseURL: c.baseURL.replace(/\/+$/, ''),
    apiStyle: c.apiStyle,
    needsKey: c.needsKey,
    browserOk: true,
    note: 'Custom provider',
    models: c.models.map((id) => m(id, id))
  };
}

export function resolveProvider(id: string, custom?: CustomProvider[]): ProviderDef | undefined {
  if (id.startsWith('custom:')) {
    return (custom ?? []).map(toProviderDef).find((p) => p.id === id);
  }
  return getBuiltinProvider(id);
}

/** Default provider/model pair used on first launch. */
export const DEFAULT_PROVIDER_ID = 'openrouter-free';
export const DEFAULT_MODEL = 'deepseek/deepseek-chat-v3.1:free';

/** Registry sanity checks (used by unit tests). */
export function validateRegistry(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const p of BUILTIN_PROVIDERS) {
    if (ids.has(p.id)) errors.push(`duplicate provider id: ${p.id}`);
    ids.add(p.id);
    if (!/^https?:\/\//.test(p.baseURL)) errors.push(`${p.id}: baseURL must be http(s)`);
    if (p.models.length === 0) errors.push(`${p.id}: no models`);
  }
  return errors;
}
