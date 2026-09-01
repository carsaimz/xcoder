import settingsPage from "components/settingsPage";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import { listModels } from "lib/ai/client";
import { badgeLabel, byGroup, PROVIDER_MAP, PROVIDERS } from "lib/ai/providers";
import settings from "lib/settings";
import helpers from "utils/helpers";

/**
 * XCoder AI assistant settings page.
 */
export default function aiSettings() {
	const title = strings["ai settings"] || "AI assistant";
	const values = settings.value;

	const providerOptions = [
		...byGroup("free").map((provider) => [
			`group:free:${provider.id}`,
			`${provider.name} · ${badgeLabel("free")}`,
		]),
		...byGroup("freetier").map((provider) => [
			`group:freetier:${provider.id}`,
			`${provider.name} · ${badgeLabel("freetier")}`,
		]),
		...byGroup("premium").map((provider) => [
			`group:premium:${provider.id}`,
			`${provider.name} · ${badgeLabel("premium")}`,
		]),
	];

	const currentProviderId = values.aiProvider || "groq";

	/** @param {string} value */
	function providerIdFromValue(value) {
		return String(value || "").replace(/^group:[^:]+:/, "") || "groq";
	}

	const items = [
		{
			key: "aiProvider",
			text: strings["ai provider"] || "Provider",
			value: `group:${PROVIDER_MAP[currentProviderId]?.group || "free"}:${currentProviderId}`,
			valueText: (value) => {
				const provider = PROVIDER_MAP[providerIdFromValue(value)];
				return provider ? provider.name : value;
			},
			valueBadge: (value) => {
				const provider = PROVIDER_MAP[providerIdFromValue(value)];
				if (!provider) return null;
				return { label: badgeLabel(provider.group), tone: provider.group };
			},
			select: providerOptions,
			info:
				strings["settings-info-ai-provider"] ||
				"Free providers, paid providers with a free tier and premium providers.",
		},
		{
			key: "aiApiKey",
			text: strings["ai api key"] || "API key",
			value: values.aiApiKey ? "••••••••" : "",
			prompt: strings["ai api key"] || "API key",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-ai-api-key"] ||
				"Stored locally on this device only.",
		},
		{
			key: "aiBaseUrl",
			text: "Base URL",
			value: values.aiBaseUrl || "",
			prompt: "Base URL",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-ai-base-url"] ||
				"Leave empty to use the provider default. Useful for custom OpenAI-compatible endpoints (Ollama, LM Studio...).",
		},
		{
			key: "aiModel",
			text: "Model",
			value: values.aiModel || "",
			prompt: "Model id",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-ai-model"] ||
				"Model id from the provider (e.g. llama-3.3-70b-versatile).",
		},
		{
			key: "fetchModels",
			text: strings["ai fetch models"] || "Fetch available models",
			button: "primary",
			info:
				strings["settings-info-ai-fetch-models"] ||
				"Query /models at the endpoint and pick one.",
		},
		{
			key: "aiTemperature",
			text: "Temperature",
			value: values.aiTemperature ?? 0.3,
			prompt: "Temperature (0 - 2)",
			promptType: "number",
			promptOptions: { test: (value) => value >= 0 && value <= 2 },
			info:
				strings["settings-info-ai-temperature"] ||
				"Lower values are more deterministic.",
		},
		{
			key: "aiMaxTokens",
			text: "Max tokens",
			value: values.aiMaxTokens ?? 4096,
			slider: { min: 256, max: 8192, step: 128 },
			info:
				strings["settings-info-ai-max-tokens"] || "Maximum response length.",
		},
		{
			key: "aiAutonomy",
			text: strings["ai autonomy"] || "Autonomy",
			value: values.aiAutonomy || "safe",
			segment: [
				["ask", strings["ai autonomy low"] || "Baixo", "low"],
				["safe", strings["ai autonomy medium"] || "Médio", "medium"],
				["auto", strings["ai autonomy high"] || "Alto", "high"],
			],
			info:
				strings["settings-info-ai-autonomy"] ||
				"How much the agent can do without confirmation.",
		},
		{
			key: "aiSubagents",
			text: strings["ai subagents"] || "Enable subagents",
			checkbox: values.aiSubagents !== false,
			info:
				strings["settings-info-ai-subagents"] ||
				"Let the main agent spawn read-only research subagents.",
		},
		{
			key: "aiSystemPrompt",
			text: strings["ai system prompt"] || "System prompt",
			value: values.aiSystemPrompt || "",
			prompt: "System prompt",
			promptType: "textarea",
			promptOptions: { required: false },
			info:
				strings["settings-info-ai-system-prompt"] ||
				"Extra instructions appended to the agent persona.",
		},
	];

	/** @type {import("components/settingsPage").Page} */
	const page = settingsPage(
		title,
		items,
		async (key, value) => {
			try {
				if (key === "fetchModels") {
					await pickModel();
					return;
				}
				if (key === "aiProvider") {
					const providerId = providerIdFromValue(value);
					await settings.update({ aiProvider: providerId, aiModel: "" });
					toast(`${PROVIDER_MAP[providerId]?.name || providerId}`, 2000);
					return;
				}
				if (key === "aiApiKey") {
					// value is the raw key typed in the prompt dialog
					await settings.update({ aiApiKey: value || "" });
					return;
				}
				if (key === "aiTemperature") {
					await settings.update({
						aiTemperature: Math.min(
							2,
							Math.max(0, Number.parseFloat(value) || 0.3),
						),
					});
					return;
				}
				if (key === "aiMaxTokens") {
					await settings.update({
						aiMaxTokens: Math.max(
							256,
							Math.min(8192, Number.parseInt(value, 10) || 4096),
						),
					});
					return;
				}
				if (key === "aiSubagents") {
					await settings.update({ aiSubagents: Boolean(value) });
					return;
				}
				// aiBaseUrl / aiModel / aiAutonomy / aiSystemPrompt: verbatim
				await settings.update({ [key]: value ?? "" });
			} catch (error) {
				helpers.error(error);
			}
		},
		undefined,
		{
			preserveOrder: true,
			pageClassName: "detail-settings-page",
			listClassName: "detail-settings-list",
			valueInTail: true,
		},
	);

	async function pickModel() {
		const providerId = settings.value.aiProvider || "groq";
		const provider = PROVIDER_MAP[providerId];
		toast(strings["loading..."] || "Loading...", 3000);
		try {
			const models = await listModels({
				baseURL: settings.value.aiBaseUrl || provider?.baseURL || "",
				apiKey: settings.value.aiApiKey || "",
			});
			if (!models.length) {
				toast(
					strings["ai no models"] ||
						"No models found — set the model manually.",
					4000,
				);
				return;
			}
			const selected = await select(
				"Model",
				models.slice(0, 200).map((model) => [model, model]),
			);
			if (selected) {
				await settings.update({ aiModel: selected });
				toast(selected, 2000);
			}
		} catch (error) {
			helpers.error(error);
		} finally {
			/* done */
		}
	}

	page.show();
	return page;
}
