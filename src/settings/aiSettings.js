import settingsPage from "components/settingsPage";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import { listModels } from "lib/ai/client";
import {
	badgeLabel,
	byGroup,
	DEFAULT_PROVIDER_ID,
	PROVIDER_MAP,
	resolveApiKey,
	resolveBaseUrl,
	resolveModel,
	setProviderModel,
} from "lib/ai/providers";
import settings from "lib/settings";
import helpers from "utils/helpers";
import aiProviders from "./aiProviders";

/** Short summary shown as the value of the Skills row. */
function skillsSummary(values) {
	const disabled = Array.isArray(values.aiDisabledSkills)
		? values.aiDisabledSkills.length
		: 0;
	if (!disabled) return strings["ai skills all on"] || "todas ativas";
	return `${disabled} ${strings["ai skills off"] || "desativada(s)"}`;
}

/**
 * XCoder AI assistant settings page.
 */
export default function aiSettings() {
	const title = strings["ai settings"] || "AI assistant";
	const values = settings.value;

	const currentProviderId = values.aiProvider || DEFAULT_PROVIDER_ID;
	const currentProvider = PROVIDER_MAP[currentProviderId];

	const items = [
		{
			key: "providers",
			text: strings["ai providers"] || "Providers",
			value: currentProvider ? currentProvider.name : currentProviderId,
			info:
				strings["settings-info-ai-providers"] ||
				"Cards for every provider: status, key, max tokens and autonomy per provider.",
			chevron: true,
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
				"Global fallback key. Each provider can have its own key on the Providers page.",
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
				"Global fallback URL. Each provider can have its own URL on the Providers page.",
		},
		{
			key: "aiModel",
			text: "Model",
			value: resolveModel(currentProviderId) || "",
			prompt: "Model id",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-ai-model"] ||
				"Model id for the active provider (e.g. llama-3.3-70b-versatile). Each provider remembers its own model.",
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
			key: "aiSubagents",
			text: strings["ai subagents"] || "Enable subagents",
			checkbox: values.aiSubagents !== false,
			info:
				strings["settings-info-ai-subagents"] ||
				"Let the main agent spawn read-only research subagents.",
		},
		{
			key: "aiShowThinking",
			text: strings["ai thinking toggle"] || "Show thinking process",
			checkbox: values.aiShowThinking !== false,
			info:
				strings["settings-info-ai-thinking"] ||
				"Display the model's reasoning steps (when the provider sends them). Turn off for cleaner answers.",
		},
		{
			key: "aiSkills",
			text: strings["ai skills"] || "Skills",
			value: skillsSummary(values),
			chevron: true,
			info:
				strings["settings-info-ai-skills"] ||
				"Bundled and user skills (markdown playbooks) the agent can load on demand.",
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
				if (key === "providers") {
					aiProviders();
					return;
				}
				if (key === "fetchModels") {
					await pickModel();
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
				if (key === "aiSubagents") {
					await settings.update({ aiSubagents: Boolean(value) });
					return;
				}
				if (key === "aiShowThinking") {
					await settings.update({ aiShowThinking: Boolean(value) });
					return;
				}
				if (key === "aiSkills") {
					const { default: showSkillsSettings } = await import(
						"./aiSkillsSettings"
					);
					showSkillsSettings();
					return;
				}
				if (key === "aiModel") {
					// per-provider model memory
					await setProviderModel(currentProviderId, value || "");
					return;
				}
				// aiBaseUrl / aiSystemPrompt: verbatim
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
		const providerId = settings.value.aiProvider || DEFAULT_PROVIDER_ID;
		const provider = PROVIDER_MAP[providerId];
		toast(strings["loading..."] || "Loading...", 3000);
		try {
			// ONLY the selected provider: its own key/URL overrides first,
			// then the global fallbacks — and the provider id is forwarded
			// so per-provider auth headers are applied.
			const models = await listModels({
				baseURL: resolveBaseUrl(providerId) || provider?.baseURL || "",
				apiKey: resolveApiKey(providerId),
				providerId,
			});
			if (!models.length) {
				toast(
					strings["ai no models"] ||
						"No models found — set the model manually.",
					4000,
				);
				return;
			}
			const current = resolveModel(providerId);
			const items = [
				{
					text: `${provider?.name || providerId} · ${Math.min(
						models.length,
						300,
					)} ${strings["ai models count"] || "models available"}`,
					className: "group-header",
				},
				...models.slice(0, 300).map((model) => ({
					value: model,
					text: model === current ? `✓ ${model}` : model,
				})),
			];
			const selected = await select(
				`${strings["ai model"] || "Model"} — ${provider?.name || providerId}`,
				items,
			);
			if (selected) {
				await setProviderModel(providerId, selected);
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
