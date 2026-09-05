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
 *
 * Providers marked `noKeyRequired: true` work without ANY API key — they
 * are the out-of-the-box experience (zero configuration, zero 401s).
 */

import { isPremium, maxTokensLimit } from "lib/premium";
import settings from "lib/settings";

/** Provider used when the user never picked one (zero-config chat). */
export const DEFAULT_PROVIDER_ID = "pollinations";
export const GROUPS = /** @type {const} */ ({
	free: "Built-in",
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
 * @property {boolean} [noKeyRequired] works with no API key at all
 */

/** @type {AIProvider[]} */
export const PROVIDERS = [
	// ---------------------------------------------------------------- free
	{
		id: "pollinations",
		name: "Built-in (Pollinations)",
		group: "free",
		baseURL: "https://text.pollinations.ai/openai",
		// VERIFIED (2026-09): the legacy API exposes exactly one
		// anonymous model — openai-fast (GPT-OSS 20B, aliases:
		// "openai", "gpt-oss", "gpt-oss-20b"). Anything else
		// (mistral, qwen-coder, openai-large, z-ai…) answers 404
		// "Model not found" — that was the source of the
		// "inválido" errors on the free provider.
		models: ["openai-fast", "openai"],
		docs: "https://pollinations.ai",
		note: "Built-in: sem API key, funciona de cara (GPT-OSS 20B com raciocínio). NÃO é ilimitado: ~1 req/s por IP — erros 429 são repetidos automaticamente. Para qualidade melhor e de graça, adicione uma chave Groq (llama-3.3-70b).",
		noKeyRequired: true,
	},
	{
		id: "duckduckgo",
		name: "DuckDuckGo AI (experimental)",
		group: "free",
		baseURL: "https://duckduckgo.com/duckchat/v1",
		// duck.ai rotates its anonymous catalog — these four have been
		// stable; unknown ids fall back server-side to gpt-4o-mini.
		models: [
			"gpt-4o-mini",
			"claude-3-haiku-20240307",
			"llama-3.3-70b",
			"mistral-small-3-24b-instruct-2501",
		],
		docs: "https://duck.ai",
		note: "Experimental e sem key: GPT-4o-mini, Claude Haiku, Llama 3.3 70B e Mistral via duck.ai. A disponibilidade dos modelos gira sem aviso e há limite por IP — se falhar, use o Integrado (Pollinations) ou uma chave Groq grátis. Só chat (sem ferramentas/imagens).",
		noKeyRequired: true,
	},
	{
		id: "zai",
		name: "Z.AI (GLM)",
		group: "freetier",
		baseURL: "https://api.z.ai/api/paas/v4",
		models: ["glm-4.5-flash", "glm-4.6", "glm-4.5-air"],
		docs: "https://z.ai/manage-apikey/apikey-list",
		note: "glm-4.5-flash é gratuito (chave necessária); os demais são pagos.",
	},
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
		models: [
			"meta-llama/Llama-3.3-70B-Instruct",
			"Qwen/Qwen2.5-Coder-32B-Instruct",
		],
		docs: "https://huggingface.co/settings/tokens",
		note: "Free monthly inference credits.",
	},
	{
		id: "cloudflare",
		name: "Cloudflare Workers AI",
		group: "free",
		baseURL: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
		models: [
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			"@cf/qwen/qwen2.5-coder-32b-instruct",
		],
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
		models: [
			"mistral-large-latest",
			"codestral-latest",
			"mistral-small-latest",
		],
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
		models: [
			"meta/llama-3.3-70b-instruct",
			"nvidia/llama-3.3-nemotron-super-49b-v1",
		],
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

const BADGE_FALLBACKS = /** @type {const} */ ({
	free: "Built-in",
	freetier: "Free tier",
	premium: "Premium",
});

/**
 * Localized short badge label for a provider group (e.g. Grátis / Premium).
 * @param {keyof typeof GROUPS} group
 * @returns {string}
 */
export function badgeLabel(group) {
	return (
		window.strings?.[`ai badge ${group}`] || BADGE_FALLBACKS[group] || group
	);
}

// ------------- per-provider preferences (advanced card config) ----------

/**
 * Per-provider preferences (API key, base URL, max tokens, autonomy and
 * the last connection-test status) stored under settings.aiProviderPrefs.
 * @param {string} providerId
 * @returns {{apiKey?: string, baseUrl?: string, maxTokens?: number, autonomy?: string, status?: string}}
 */
export function getProviderPrefs(providerId) {
	try {
		const all = settings.value?.aiProviderPrefs;
		const prefs = all?.[providerId];
		return prefs && typeof prefs === "object" ? prefs : {};
	} catch {
		return {};
	}
}

/**
 * Merges a patch into the preferences of one provider.
 * @param {string} providerId
 * @param {object} patch
 * @returns {Promise<void>}
 */
export async function updateProviderPrefs(providerId, patch) {
	const all = { ...(settings.value.aiProviderPrefs || {}) };
	all[providerId] = { ...(all[providerId] || {}), ...patch };
	for (const key of Object.keys(all[providerId])) {
		if (all[providerId][key] === undefined) delete all[providerId][key];
	}
	if (!Object.keys(all[providerId]).length) delete all[providerId];
	await settings.update({ aiProviderPrefs: all });
}

/**
 * API key for a provider: per-provider override first, then global.
 * @param {string} providerId
 * @returns {string}
 */
export function resolveApiKey(providerId) {
	return (
		getProviderPrefs(providerId).apiKey ||
		String(settings.value?.aiApiKey || "")
	);
}

/**
 * Base URL override for a provider (per-provider first, then global).
 * @param {string} providerId
 * @returns {string}
 */
export function resolveBaseUrl(providerId) {
	return (
		getProviderPrefs(providerId).baseUrl ||
		String(settings.value?.aiBaseUrl || "")
	);
}

/**
 * Effective max tokens: per-provider override, then the legacy global
 * value, then 4096.
 * @param {string} providerId
 * @returns {number}
 */
export function resolveMaxTokens(providerId) {
	const prefs = getProviderPrefs(providerId);
	const value = Number(prefs.maxTokens ?? settings.value?.aiMaxTokens ?? 4096);
	// premium cap enforced at runtime too: prefs stored while premium was
	// active degrade gracefully when the grant expires
	return Number.isFinite(value)
		? Math.max(256, Math.min(maxTokensLimit(), Math.round(value)))
		: 4096;
}

/**
 * Effective autonomy level: per-provider override, then legacy global.
 * "auto" (the highest autonomy) is a Premium perk — free accounts run at
 * "safe" even when a stored pref says otherwise.
 * @param {string} providerId
 * @returns {"ask" | "safe" | "auto"}
 */
export function resolveAutonomy(providerId) {
	const value =
		getProviderPrefs(providerId).autonomy || settings.value?.aiAutonomy;
	if (value === "auto" && !isPremium()) return "safe";
	return value === "ask" || value === "auto" ? value : "safe";
}

// -------------------- enable / disable (activation) ----------------------

/**
 * Whether a provider is enabled ("active"). An explicit toggle wins;
 * otherwise legacy behaviour applies: the selected provider and any
 * provider with its own key are considered enabled.
 * @param {string} providerId
 * @returns {boolean}
 */
export function isProviderEnabled(providerId) {
	const prefs = getProviderPrefs(providerId);
	if (typeof prefs.enabled === "boolean") return prefs.enabled;
	return (
		(settings.value?.aiProvider || DEFAULT_PROVIDER_ID) === providerId ||
		Boolean(prefs.apiKey)
	);
}

/**
 * Enables or disables a provider.
 * @param {string} providerId
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
export async function setProviderEnabled(providerId, enabled) {
	await updateProviderPrefs(providerId, { enabled: Boolean(enabled) });
}

/**
 * All providers currently enabled, in catalog order.
 * @returns {AIProvider[]}
 */
export function enabledProviders() {
	return PROVIDERS.filter((provider) => isProviderEnabled(provider.id));
}

// ------------------------ per-provider model -----------------------------

/**
 * Effective model for a provider: the per-provider choice first, then the
 * legacy global selection when it belongs to the selected provider, then
 * the provider default.
 * @param {string} providerId
 * @returns {string}
 */
export function resolveModel(providerId) {
	const provider = PROVIDER_MAP[providerId];
	const own = getProviderPrefs(providerId).model;
	if (own) return own;
	if ((settings.value?.aiProvider || DEFAULT_PROVIDER_ID) === providerId) {
		const legacy = String(settings.value?.aiModel || "");
		if (legacy) return legacy;
	}
	return provider?.models?.[0] || "";
}

/**
 * Remembers the model chosen for a provider. When it is the selected
 * provider the legacy global setting is kept in sync.
 * @param {string} providerId
 * @param {string} model
 * @returns {Promise<void>}
 */
export async function setProviderModel(providerId, model) {
	const patch = { model: String(model || "") || undefined };
	await updateProviderPrefs(providerId, patch);
	if ((settings.value.aiProvider || DEFAULT_PROVIDER_ID) === providerId) {
		await settings.update({ aiModel: String(model || "") });
	}
}

// --------------------------- capabilities --------------------------------

/**
 * @typedef {object} ModelCapabilities
 * @property {boolean} text always true for chat models
 * @property {boolean} image accepts image inputs (vision)
 * @property {boolean} video accepts video inputs
 * @property {boolean} agents supports OpenAI-style tool calling
 */

/** Model-id substrings that accept image input (vision). */
const VISION_PATTERNS = [
	"gpt-4o",
	"gpt-4.1",
	"gpt-4-turbo",
	"gpt-4.5",
	"o4-mini",
	"gemini",
	"claude-3",
	"claude-sonnet",
	"claude-opus",
	"claude-haiku-4",
	"claude-sonnet-4",
	"grok-4",
	"grok-3",
	"gemma-3",
	"llama-3.2",
	"llama-4",
	"pixtral",
	"qwen2.5-vl",
	"qwen-vl",
	"qwen3-vl",
	"glm-4v",
	"sonar-pro",
	"llama-3.3-70b-versatile",
];

/** Model-id substrings that accept video input. */
const VIDEO_PATTERNS = ["gemini-2.5", "gemini-2.0", "grok-4-video"];

/** Known model families WITHOUT tool-calling support. */
const NO_TOOLS_PATTERNS = ["gemma", "deepseek-reasoner"];

/**
 * Best-effort capability map for a provider/model pair. Unknown models
 * fall back to text + agents (the common case for chat endpoints).
 * @param {string} providerId
 * @param {string} model
 * @returns {ModelCapabilities}
 */
export function modelCapabilities(providerId, model) {
	const id = String(model || resolveModel(providerId) || "").toLowerCase();
	// duck.ai is text-only chat: no vision and no tool calling
	if (providerId === "duckduckgo") {
		return { text: true, image: false, video: false, agents: false };
	}
	const image = VISION_PATTERNS.some((pattern) => id.includes(pattern));
	const video = VIDEO_PATTERNS.some((pattern) => id.includes(pattern));
	const noTools = NO_TOOLS_PATTERNS.some((pattern) => id.includes(pattern));
	return {
		text: true,
		image: image || video,
		video,
		agents: !noTools,
	};
}

/**
 * Short type label for a model of a provider: "free" or "paid".
 * OpenRouter marks free models with a ":free" suffix; otherwise the
 * provider group decides.
 * @param {AIProvider} provider
 * @param {string} model
 * @returns {"free" | "paid"}
 */
export function modelType(provider, model) {
	const id = String(model || "").toLowerCase();
	if (id.endsWith(":free")) return "free";
	if (provider?.group === "free") return "free";
	return "paid";
}

// ------------------------- key shape diagnostics -------------------------

/** Known API key prefixes -> owning provider family. */
const KEY_PREFIXES = [
	["gsk_", "groq"],
	["sk-or-", "openrouter"],
	["sk-ant-", "anthropic"],
	["xai-", "xai"],
	["AIza", "google"],
	["hf_", "huggingface"],
	["csk-", "cerebras"],
	["r8_", "replicate"],
];

// ------------------------- model normalization ----------------------------

/**
 * Pollinations models that stopped existing on the legacy API (404
 * "Model not found") — mapped to the only anonymous model left.
 */
const POLLINATIONS_DEAD_MODELS = new Set([
	"openai-large",
	"openai-large-reasoning",
	"mistral",
	"mistral-nemo",
	"qwen-coder",
	"llama",
	"llamascout",
	"deepseek",
	"deepseek-reasoning",
	"gemini",
	"gemini-search",
	"searchgpt",
	"evil",
	"unity",
	"z-ai",
	"zai",
]);

/**
 * Normalizes a model id for a provider. Fixes the classic "the free
 * provider answers 'inválido' for every model" trap: stale model ids
 * saved before the provider changed its catalog are silently remapped to
 * a known-good default (once, with a warning from the agent).
 * @param {string} providerId
 * @param {string} model
 * @returns {string} a usable model id
 */
export function normalizeModel(providerId, model) {
	const value = String(model || "").trim();
	if (providerId === "pollinations") {
		if (!value) return "openai-fast";
		const lower = value.toLowerCase();
		if (POLLINATIONS_DEAD_MODELS.has(lower)) return "openai-fast";
		if (lower === "openai-large" || lower === "openai-fast-reasoning") {
			return "openai-fast";
		}
		return value;
	}
	return value || PROVIDER_MAP[providerId]?.models?.[0] || "";
}

/**
 * Whether a model id is part of the provider's static catalog (or an
 * accepted alias). Custom endpoints (baseUrl override / custom provider)
 * accept any model, so the check is skipped there.
 * @param {string} providerId
 * @param {string} model
 * @returns {boolean}
 */
export function isCatalogModel(providerId, model) {
	const value = String(model || "")
		.trim()
		.toLowerCase();
	if (!value) return false;
	const provider = PROVIDER_MAP[providerId];
	if (!provider) return true;
	if (provider.id === "custom") return true;
	if (
		getProviderPrefs(providerId).baseUrl ||
		getProviderPrefs(providerId).apiKey
	) {
		// custom base URL: the endpoint defines the model list
		return true;
	}
	if ((provider.models || []).some((m) => m.toLowerCase() === value))
		return true;
	if (providerId === "pollinations") {
		return ["openai", "openai-fast", "gpt-oss", "gpt-oss-20b"].includes(value);
	}
	if (providerId === "duckduckgo") {
		// duck.ai accepts its known aliases and falls back
		// to the default model for anything else
		return true;
	}
	return true; // unknown to the catalog but let the provider decide
}

/**
 * Detects keys that look like they belong to a DIFFERENT provider
 * (e.g. a gsk_… Groq key pasted into the Gemini card) — the #1 real-world
 * cause of "falha de autenticação". Returns a short warning or "".
 * @param {string} providerId
 * @param {string} key
 * @returns {string}
 */
export function keyShapeWarning(providerId, key) {
	const value = String(key || "");
	if (!value) return "";
	const openrouterSelf = providerId.startsWith("openrouter");
	const OWNER_NAMES = { openrouter: "OpenRouter", google: "Google" };
	for (const [prefix, owner] of KEY_PREFIXES) {
		if (!value.startsWith(prefix)) continue;
		if (owner === providerId) return "";
		if (openrouterSelf && owner === "openrouter") return "";
		const ownerName = OWNER_NAMES[owner] || PROVIDER_MAP[owner]?.name || owner;
		return `⚠️ ${prefix}… key looks like a ${ownerName} key`;
	}
	return "";
}
