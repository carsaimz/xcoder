/**
 * Built-in provider presets, organized in three groups:
 *
 *  - free     : no card, no trial — genuinely free to use
 *  - freemium : commercial APIs that include a free tier or trial credits
 *  - premium  : enterprise-grade clouds (SSO, VPC, compliance, SLAs)
 *
 * Presets are a catalog only — users can also register a fully custom
 * OpenAI-compatible endpoint from the settings screen.
 */

import { ProviderPreset } from './types';

export const PRESETS: ProviderPreset[] = [
  // ---------------------------------------------------------------- free ----
  {
    id: 'groq',
    label: 'Groq Cloud',
    group: 'free',
    api: 'openai',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyURL: 'https://console.groq.com/keys',
    requiresKey: true,
    note: 'Free tier with generous rate limits. Blazing fast LPU inference.',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', contextK: 128, tools: true },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', contextK: 128, tools: true },
      { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', contextK: 128, tools: true },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B', contextK: 128, tools: true },
    ],
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    group: 'free',
    api: 'openai',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKeyURL: 'https://cloud.cerebras.ai',
    requiresKey: true,
    note: 'Free API key, extremely high tokens/second.',
    models: [
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', contextK: 128, tools: true },
      { id: 'llama3.1-8b', label: 'Llama 3.1 8B', contextK: 128, tools: true },
      { id: 'qwen-3-32b', label: 'Qwen 3 32B', contextK: 128, tools: true },
    ],
  },
  {
    id: 'openrouter-free',
    label: 'OpenRouter (free models)',
    group: 'free',
    api: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyURL: 'https://openrouter.ai/keys',
    requiresKey: true,
    note: 'Key is free; models with the ":free" suffix cost nothing.',
    models: [
      { id: 'deepseek/deepseek-chat-v3.1:free', label: 'DeepSeek V3.1', contextK: 128, tools: true },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder', contextK: 128, tools: true },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', contextK: 128, tools: true },
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash', contextK: 128, tools: true },
    ],
  },
  {
    id: 'huggingface',
    label: 'Hugging Face Router',
    group: 'free',
    api: 'openai',
    baseURL: 'https://router.huggingface.co/v1',
    apiKeyURL: 'https://huggingface.co/settings/tokens',
    requiresKey: true,
    note: 'Free monthly inference credits with any HF account.',
    models: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5 Coder 32B', contextK: 32, tools: true },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B', contextK: 128, tools: true },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B', contextK: 32, tools: true },
    ],
  },
  {
    id: 'github-models',
    label: 'GitHub Models',
    group: 'free',
    api: 'openai',
    baseURL: 'https://models.github.ai/inference',
    apiKeyURL: 'https://github.com/settings/tokens',
    requiresKey: true,
    note: 'Free with a GitHub PAT — great for prototyping.',
    models: [
      { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 mini', contextK: 128, tools: true },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini', contextK: 128, tools: true },
      { id: 'meta/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B', contextK: 128, tools: true },
      { id: 'mistral-ai/mistral-small-2503', label: 'Mistral Small', contextK: 128, tools: true },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    group: 'free',
    api: 'openai',
    baseURL: 'http://localhost:11434/v1',
    requiresKey: false,
    note: 'Runs on your own machine. No key, no cloud, fully private.',
    models: [
      { id: 'qwen2.5-coder:7b', label: 'Qwen2.5 Coder 7B', contextK: 32, tools: true },
      { id: 'llama3.2:3b', label: 'Llama 3.2 3B', contextK: 128, tools: true },
      { id: 'deepseek-r1:8b', label: 'DeepSeek R1 8B', contextK: 128, tools: true },
    ],
  },

  // ------------------------------------------------------------ freemium ----
  {
    id: 'openai',
    label: 'OpenAI',
    group: 'freemium',
    api: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKeyURL: 'https://platform.openai.com/api-keys',
    requiresKey: true,
    note: 'Paid with trial credits for new accounts.',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', contextK: 128, tools: true },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', contextK: 128, tools: true },
      { id: 'gpt-4.1', label: 'GPT-4.1', contextK: 1000, tools: true },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', contextK: 1000, tools: true },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    group: 'freemium',
    api: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    apiKeyURL: 'https://console.anthropic.com/settings/keys',
    requiresKey: true,
    note: 'Trial credits for new accounts; best-in-class coding quality.',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', contextK: 200, tools: true },
      { id: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1', contextK: 200, tools: true },
      { id: 'claude-3-5-haiku-latest', label: 'Claude Haiku 3.5', contextK: 200, tools: true },
    ],
  },
  {
    id: 'gemini',
    label: 'Google AI Studio (Gemini)',
    group: 'freemium',
    api: 'gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyURL: 'https://aistudio.google.com/apikey',
    requiresKey: true,
    note: 'Free tier with daily quotas, then pay-as-you-go.',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextK: 1000, tools: true },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextK: 1000, tools: true },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', contextK: 1000, tools: true },
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral La Plateforme',
    group: 'freemium',
    api: 'openai',
    baseURL: 'https://api.mistral.ai/v1',
    apiKeyURL: 'https://console.mistral.ai/api-keys',
    requiresKey: true,
    note: 'Free "Experiment" plan available.',
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large', contextK: 128, tools: true },
      { id: 'mistral-small-latest', label: 'Mistral Small', contextK: 128, tools: true },
      { id: 'codestral-latest', label: 'Codestral', contextK: 256, tools: true },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    group: 'freemium',
    api: 'openai',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyURL: 'https://platform.deepseek.com/api_keys',
    requiresKey: true,
    note: 'Very low pricing; trial credits on signup.',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3 (chat)', contextK: 128, tools: true },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (reasoner)', contextK: 128, tools: true },
    ],
  },
  {
    id: 'together',
    label: 'Together AI',
    group: 'freemium',
    api: 'openai',
    baseURL: 'https://api.together.xyz/v1',
    apiKeyURL: 'https://api.together.ai/settings/api-keys',
    requiresKey: true,
    note: 'Free tier includes several open models.',
    models: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5 Coder 32B', contextK: 128, tools: true },
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo', contextK: 128, tools: true },
    ],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    group: 'freemium',
    api: 'openai',
    baseURL: 'https://api.cohere.ai/compatibility/v1',
    apiKeyURL: 'https://dashboard.cohere.com/api-keys',
    requiresKey: true,
    note: 'Trial keys are free (rate limited).',
    models: [
      { id: 'command-a-03-2025', label: 'Command A', contextK: 256, tools: true },
      { id: 'command-r-plus-08-2024', label: 'Command R+', contextK: 128, tools: true },
    ],
  },

  // -------------------------------------------------------------- premium ----
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    group: 'premium',
    api: 'openai',
    baseURL: 'https://YOUR-RESOURCE.openai.azure.com/openai/v1',
    apiKeyURL: 'https://portal.azure.com',
    requiresKey: true,
    note: 'Enterprise SLA, Entra ID, regional deployments. Use your resource URL + deployment name.',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o (deployment)', contextK: 128, tools: true },
      { id: 'gpt-4.1', label: 'GPT-4.1 (deployment)', contextK: 1000, tools: true },
    ],
  },
  {
    id: 'aws-bedrock',
    label: 'AWS Bedrock',
    group: 'premium',
    api: 'openai',
    baseURL: 'https://YOUR-GATEWAY.example.com/bedrock',
    apiKeyURL: 'https://console.aws.amazon.com/bedrock',
    requiresKey: true,
    note: 'Point baseURL at an OpenAI-compatible gateway (e.g. Bedrock Access Gateway or LiteLLM).',
    models: [
      { id: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (Bedrock)', contextK: 200, tools: true },
      { id: 'meta.llama3-3-70b-instruct-v1:0', label: 'Llama 3.3 70B (Bedrock)', contextK: 128, tools: true },
    ],
  },
  {
    id: 'google-vertex',
    label: 'Google Vertex AI',
    group: 'premium',
    api: 'gemini',
    baseURL: 'https://aiplatform.googleapis.com/v1/projects/YOUR-PROJECT/locations/us-central1/publishers/google',
    apiKeyURL: 'https://console.cloud.google.com/apis/library/aiplatform.googleapis.com',
    requiresKey: true,
    note: 'Gemini models on GCP with IAM/Quota policies. Needs an OAuth proxy for browser use.',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextK: 1000, tools: true },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', contextK: 1000, tools: true },
    ],
  },
  {
    id: 'ibm-watsonx',
    label: 'IBM watsonx.ai',
    group: 'premium',
    api: 'openai',
    baseURL: 'https://YOUR-REGION.ml.cloud.ibm.com/ml/v1',
    apiKeyURL: 'https://dataplatform.cloud.ibm.com',
    requiresKey: true,
    note: 'Enterprise governance & AI lifecycle. Use an OpenAI-compatible inference gateway.',
    models: [
      { id: 'meta-llama/llama-3-3-70b-instruct', label: 'Llama 3.3 70B', contextK: 128, tools: true },
      { id: 'mistralai/mistral-large', label: 'Mistral Large', contextK: 128, tools: true },
    ],
  },
];

export const PRESET_GROUPS = [
  { id: 'free' as const, labelKey: 'providers.group.free' },
  { id: 'freemium' as const, labelKey: 'providers.group.freemium' },
  { id: 'premium' as const, labelKey: 'providers.group.premium' },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function presetsByGroup(group: ProviderPreset['group']): ProviderPreset[] {
  return PRESETS.filter((p) => p.group === group);
}
