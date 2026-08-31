/**
 * XCoder AI provider catalog.
 *
 * All providers speak the OpenAI-compatible Chat Completions API
 * (`POST {baseURL}/chat/completions`). Custom endpoints are supported via
 * the "custom" provider (user supplies base URL + key + model).
 *
 * Groups:
 *  - free:     services with genuinely free tiers (no credit card)
 *  - freetier: paid services that include a free tier
 *  - premium:  paid/enterprise-grade services
 */

export const GROUPS = /** @type {const} */ ({
	free: "Free",
	freetier: "Paid (free tier available)",
	premium: "Premium",
});

/**
 * @typedef {object} AIProvider
 * @property {string} id
 * @property {string} name
 * @property {keyof typeof GROUPS} group
 * @property {string} baseURL
 * @property {string[]} models default model ids
 * @property {string} [docs] where to get an API key
 * @property {string} [note]
 */

/** @type {AIProvider[]} */
export const PROVIDERS = [
	// ---------------------------------------------------------------- free
	{
		id: "groq",
		name: "Groq Cloud",
		group: "free",
		baseURL: "https://api.groq.com/openai/v1",
		models: [
			"llama-3.3-70b-versatile",
			"llama-3.1-8b-instant",
			"openai/gpt-oss-120b",
			"openai/gpt-oss-20b",
		],
		docs: "https://console.groq.com/keys",
		note: "Generous free tier, very fast inference.",
	},
	{
		id: "openrouter-free",
		name: "OpenRouter (free models)",
		group: "free",
		baseURL: "https://openrouter.ai/api/v1",
		models: [
			"deepseek/deepseek-chat-v3.1:free",
			"meta-llama/llama-3.3-70b-instruct:free",
			"qwen/qwen3-coder:free",
			"google/gemma-3-27b-it:free",
		],
		docs: "https://openrouter.ai/keys",
		note: "Models suffixed with :free are free to use.",
	},
	{
		id: "cerebras",
		name: "Cerebras Inference",
		group: "free",
		baseURL: "https://api.cerebras.ai/v1",
		models: ["llama-3.3-70b", "llama3.1-8b", "qwen-3-coder-480b"],
		docs: "https://cloud.cerebras.ai",
		note: "Free API tier with blazing fast tokens/s.",
	},
	{
		id: "huggingface",
		name: "Hugging Face Inference",
		group: "free",
		baseURL: "https://router.huggingface.co/v1",
		models: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen2.5-Coder-32B-Instruct"],
		docs: "https://huggingface.co/settings/tokens",
		note: "Free monthly inference credits.",
	},
	{
		id: "cloudflare",
		name: "Cloudflare Workers AI",
		group: "free",
		baseURL: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
		models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct"],
		docs: "https://developers.cloudflare.com/workers-ai/",
		note: "Replace {account_id} in the base URL with your Cloudflare account id.",
	},
	// ------------------------------------------------------------ freetier
	{
		id: "google",
		name: "Google Gemini",
		group: "freetier",
		baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
		models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
		docs: "https://aistudio.google.com/apikey",
		note: "Free tier available in AI Studio.",
	},
	{
		id: "openai",
		name: "OpenAI",
		group: "freetier",
		baseURL: "https://api.openai.com/v1",
		models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
		docs: "https://platform.openai.com/api-keys",
	},
	{
		id: "mistral",
		name: "Mistral AI",
		group: "freetier",
		baseURL: "https://api.mistral.ai/v1",
		models: ["mistral-large-latest", "codestral-latest", "mistral-small-latest"],
		docs: "https://console.mistral.ai/api-keys",
		note: "Free experiment tier available.",
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		group: "freetier",
		baseURL: "https://api.deepseek.com/v1",
		models: ["deepseek-chat", "deepseek-reasoner"],
		docs: "https://platform.deepseek.com/api_keys",
	},
	{
		id: "together",
		name: "Together AI",
		group: "freetier",
		baseURL: "https://api.together.xyz/v1",
		models: [
			"meta-llama/Llama-3.3-70B-Instruct-Turbo",
			"Qwen/Qwen2.5-Coder-32B-Instruct",
		],
		docs: "https://api.together.ai/settings/api-keys",
		note: "Free tier for select models.",
	},
	{
		id: "cohere",
		name: "Cohere",
		group: "freetier",
		baseURL: "https://api.cohere.ai/compatibility/v1",
		models: ["command-a-03-2025", "command-r7b-12-2024"],
		docs: "https://dashboard.cohere.com/api-keys",
		note: "Free trial keys available.",
	},
	{
		id: "github-models",
		name: "GitHub Models",
		group: "freetier",
		baseURL: "https://models.github.ai/inference",
		models: ["openai/gpt-4.1-mini", "meta/Llama-3.3-70B-Instruct"],
		docs: "https://github.com/settings/tokens",
		note: "Free tier with a GitHub personal access token.",
	},
	{
		id: "fireworks",
		name: "Fireworks AI",
		group: "freetier",
		baseURL: "https://api.fireworks.ai/inference/v1",
		models: ["accounts/fireworks/models/llama4-maverick-instruct-basic"],
		docs: "https://fireworks.ai/account/api-keys",
		note: "$1 free credit at signup.",
	},
	// ------------------------------------------------------------- premium
	{
		id: "anthropic",
		name: "Anthropic Claude",
		group: "premium",
		baseURL: "https://api.anthropic.com/v1",
		models: [
			"claude-sonnet-4-5-20250929",
			"claude-opus-4-1-20250805",
			"claude-3-5-haiku-20241022",
		],
		docs: "https://console.anthropic.com/settings/keys",
		note: "Claude models via Anthropic-compatible endpoint.",
	},
	{
		id: "xai",
		name: "xAI Grok",
		group: "premium",
		baseURL: "https://api.x.ai/v1",
		models: ["grok-4", "grok-3-mini"],
		docs: "https://console.x.ai",
	},
	{
		id: "perplexity",
		name: "Perplexity",
		group: "premium",
		baseURL: "https://api.perplexity.ai",
		models: ["sonar-pro", "sonar-reasoning-pro"],
		docs: "https://www.perplexity.ai/settings/api",
	},
	{
		id: "azure-openai",
		name: "Azure OpenAI",
		group: "premium",
		baseURL: "https://{resource}.openai.azure.com/openai/v1",
		models: ["gpt-4.1", "gpt-4o"],
		docs: "https://portal.azure.com",
		note: "Replace {resource} with your Azure resource name.",
	},
	{
		id: "nvidia",
		name: "NVIDIA NIM",
		group: "premium",
		baseURL: "https://integrate.api.nvidia.com/v1",
		models: ["meta/llama-3.3-70b-instruct", "nvidia/llama-3.3-nemotron-super-49b-v1"],
		docs: "https://build.nvidia.com",
	},
	{
		id: "openrouter-paid",
		name: "OpenRouter (all models)",
		group: "premium",
		baseURL: "https://openrouter.ai/api/v1",
		models: [
			"anthropic/claude-sonnet-4.5",
			"openai/gpt-4.1",
			"google/gemini-2.5-pro",
		],
		docs: "https://openrouter.ai/keys",
		note: "Pay-as-you-go access to every model.",
	},
	{
		id: "custom",
		name: "Custom (OpenAI-compatible)",
		group: "premium",
		baseURL: "",
		models: [],
		docs: "",
		note: "Point to any OpenAI-compatible /v1 endpoint (Ollama, LM Studio, vLLM, LiteLLM...).",
	},
];

export const PROVIDER_MAP = Object.fromEntries(
	PROVIDERS.map((provider) => [provider.id, provider]),
);

/**
 * @param {keyof typeof GROUPS} group
 * @returns {AIProvider[]}
 */
export function byGroup(group) {
	return PROVIDERS.filter((provider) => provider.group === group);
}
