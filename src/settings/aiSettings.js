import settingsPage from "components/settingsPage";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import {
	activeBot,
	deleteUserBot,
	listBots,
	saveUserBot,
	setActiveBot,
} from "lib/ai/bots";
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

/** Short summary shown as the value of the Bots row. */
function botsSummary() {
	const bots = listBots().length;
	const active = activeBot();
	return active
		? `${active.icon} ${active.name}`
		: `${strings["ai bots count"] || "bots"}: ${bots}`;
}

/** Bot picker/manager dialog (select + create + delete). */
async function manageBots() {
	const bots = listBots();
	const noneLabel = strings["ai bot none"] || "Nenhum (bot desligado)";
	const newLabel = strings["ai bot new"] || "+ Criar bot";
	const items = [
		{ text: noneLabel, value: "__none__" },
		...bots.map((bot) => ({
			text: `${bot.icon} ${bot.name} — ${bot.description || ""}`,
			value: bot.id,
		})),
		{ text: newLabel, value: "__new__" },
		...bots
			.filter((bot) => bot.id.startsWith("user-"))
			.map((bot) => ({
				text: `${strings["ai bot delete"] || "Apagar"}: ${bot.name}`,
				value: `__del__${bot.id}`,
			})),
	];
	const choice = await select(strings["ai bots"] || "Bots", items);
	if (!choice) return;
	if (choice === "__none__") {
		await setActiveBot("");
		toast(strings["ai bot cleared"] || "Bot desligado");
		return;
	}
	if (choice === "__new__") {
		const name = await prompt(
			strings["ai bot name"] || "Nome do bot",
			"",
			"text",
			{ required: true },
		);
		if (!name) return;
		const icon = await prompt(
			strings["ai bot icon"] || "Ícone (emoji)",
			"🤖",
			"text",
		);
		const description = await prompt(
			strings["ai bot desc"] || "Descrição curta",
			"",
			"text",
		);
		const botPrompt = await prompt(
			strings["ai bot prompt"] || "Instruções da persona",
			"",
			"textarea",
			{ required: true },
		);
		if (!botPrompt) return;
		try {
			const bot = await saveUserBot({
				name,
				icon,
				description,
				prompt: botPrompt,
			});
			await setActiveBot(bot.id);
			toast(`${bot.icon} ${bot.name}`);
		} catch (error) {
			helpers.error(error);
		}
		return;
	}
	if (choice.startsWith("__del__")) {
		await deleteUserBot(choice.slice(7));
		toast(strings["ai bot deleted"] || "Bot removido");
		return;
	}
	const bot = await setActiveBot(choice);
	if (bot) toast(`${bot.icon} ${bot.name}`);
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
			key: "aiWebTools",
			text: strings["ai web tools"] || "Web search (agent tools)",
			checkbox: values.aiWebTools !== false,
			info:
				strings["settings-info-ai-web-tools"] ||
				"Let the assistant search the web (web_search / read_url). Also available as a quick toggle in the chat.",
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
			key: "aiBots",
			text: strings["ai bots"] || "Bots",
			value: botsSummary(),
			chevron: true,
			info:
				strings["settings-info-ai-bots"] ||
				"Assistant personas (reviewer, teacher, translator…) applied to new chats. Create your own too.",
		},
		{
			key: "localModels",
			text: strings["local models title"] || "Modelos locais",
			chevron: true,
			info:
				strings["settings-info-local-models"] ||
				"Download LLM, speech-to-text and text-to-speech models to run fully offline on this device (56MB – 1.2GB).",
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
				if (key === "aiWebTools") {
					await settings.update({ aiWebTools: Boolean(value) });
					return;
				}
				if (key === "aiSkills") {
					const { default: showSkillsSettings } = await import(
						"./aiSkillsSettings"
					);
					showSkillsSettings();
					return;
				}
				if (key === "localModels") {
					const { default: modelsPage } = await import("pages/models");
					modelsPage();
					return;
				}
				if (key === "aiBots") {
					await manageBots();
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
