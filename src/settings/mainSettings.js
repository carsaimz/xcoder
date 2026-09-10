import settingsPage from "components/settingsPage";
import confirm from "dialogs/confirm";
import actionStack from "lib/actionStack";
import openFile from "lib/openFile";
import { getPremiumStatus } from "lib/premium";
import { openSupportPage } from "lib/premiumUI";
import appSettings from "lib/settings";
import settings from "lib/settings";
import Changelog from "pages/changelog/changelog";
import plugins from "pages/plugins";
import themeSetting from "pages/themeSetting";
import About from "../pages/about";
import aiSettings from "./aiSettings";
import otherSettings from "./appSettings";
import editorSettings from "./editorSettings";
import filesSettings from "./filesSettings";
import fontSettings from "./fontSettings";
import formatterSettings from "./formatterSettings";
import ghSettings from "./ghSettings";
import lspSettings from "./lspSettings";
import previewSettings from "./previewSettings";
import scrollSettings from "./scrollSettings";
import searchSettings from "./searchSettings";
import sshSettings from "./sshSettings";
import terminalSettings from "./terminalSettings";

export default function mainSettings() {
	const title = strings.settings.capitalize();
	// Grouped so related options sit together and the list scans fast:
	// Core → Appearance → Code & tools → Connections → Data → About.
	const categories = {
		core: strings["settings-category-core"],
		appearance: strings["settings-category-appearance"],
		code: strings["settings-category-code"],
		connections: strings["settings-category-connections"],
		// "Maintenance" was renamed to "Data & backup" to keep dev-ish wording
		// out of the user-facing UI (dev actions live in the hidden developer
		// menu, opened by tapping the version number in About).
		maintenance:
			strings["settings-category-data"] ||
			strings["settings-category-maintenance"],
		aboutXCoder: strings["settings-category-about-xcoder"],
	};
	const items = [
		// --- Core ---------------------------------------------------------
		{
			key: "app-settings",
			text: strings["app settings"],
			icon: "svg:sliders-horizontal",
			info: strings["settings-info-main-app-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "editor-settings",
			text: strings["editor settings"],
			icon: "svg:file-code",
			info: strings["settings-info-main-editor-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "terminal-settings",
			text: `${strings["terminal settings"]}`,
			icon: "svg:square-terminal",
			info: strings["settings-info-main-terminal-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "preview-settings",
			text: strings["preview settings"],
			icon: "svg:globe",
			info: strings["settings-info-main-preview-settings"],
			category: categories.core,
			chevron: true,
		},
		// --- Appearance ----------------------------------------------------
		{
			key: "theme",
			text: strings.theme,
			icon: "svg:palette",
			info: strings["settings-info-main-theme"],
			category: categories.appearance,
			chevron: true,
		},
		{
			key: "font-settings",
			text: strings["font manager"] || "Fontes",
			icon: "svg:type",
			info:
				strings["settings-info-main-fonts"] ||
				"Instale fontes por URL e escolha a fonte do editor e do app.",
			category: categories.appearance,
			chevron: true,
		},
		// --- Code & tools --------------------------------------------------
		{
			key: "formatter",
			text: strings.formatter,
			icon: "svg:braces",
			info: strings["settings-info-main-formatter"],
			category: categories.code,
			chevron: true,
		},
		{
			key: "lsp-settings",
			text:
				strings?.lsp_settings ||
				strings["language servers"] ||
				"Language servers",
			icon: "svg:zap",
			info: strings["settings-info-main-lsp-settings"],
			category: categories.code,
			chevron: true,
		},
		{
			key: "ai-settings",
			text: strings["ai settings"] || "AI assistant",
			icon: "svg:bot",
			info:
				strings["settings-info-main-ai"] ||
				"Configure AI providers and agent behavior.",
			category: categories.code,
			chevron: true,
		},
		{
			key: "plugins",
			text: strings["plugins"],
			icon: "svg:puzzle",
			info: strings["settings-info-main-plugins"],
			category: categories.code,
			chevron: true,
		},
		{
			key: "marketplaceUrl",
			text: strings["marketplace url"] || "Plugin marketplace URL",
			value: appSettings.value.marketplaceUrl || "",
			valueText: (value) => value || "Default",
			prompt: strings["marketplace url"] || "Plugin marketplace URL",
			promptType: "url",
			promptOptions: { required: false },
			info:
				strings["settings-info-marketplace-url"] ||
				"Fetch the plugin list from your own marketplace (JSON). Leave empty to use the default Xcoder marketplace.",
			category: categories.code,
		},
		// --- Connections ----------------------------------------------------
		{
			key: "gh-settings",
			text: strings["github settings"] || "GitHub",
			icon: "svg:github",
			info:
				strings["settings-info-main-gh"] ||
				"GitHub account, personal access token, repositories and branch.",
			category: categories.connections,
			chevron: true,
		},
		{
			key: "ssh-settings",
			text: strings["ssh sessions"] || "Sessões SSH",
			icon: "svg:server",
			info:
				strings["settings-info-main-ssh"] ||
				"Sessões SSH salvas: abra um terminal remoto com um toque.",
			category: categories.connections,
			chevron: true,
		},
		// --- Data & backup ---------------------------------------------------
		{
			key: "editSettings",
			text: `${strings["edit"]} settings.json`,
			icon: "svg:file-cog",
			info: strings["settings-info-main-edit-settings"],
			category: categories.maintenance,
			chevron: true,
		},
		{
			key: "reset",
			text: strings["restore default settings"],
			icon: "svg:rotate-ccw",
			info: strings["settings-info-main-reset"],
			category: categories.maintenance,
			chevron: true,
		},
		// --- About XCoder -----------------------------------------------------
		{
			key: "support",
			text: getPremiumStatus()?.active
				? strings["support premium active"] || "Premium ativo ✓"
				: strings["support the project"] || "Apoie o projeto",
			icon: "svg:heart",
			info:
				strings["settings-info-support"] ||
				"Doe para ativar o Premium: sem anúncios, temas exclusivos e agente IA ilimitado.",
			category: categories.aboutXCoder,
			chevron: true,
		},
		{
			key: "about",
			text: strings.about,
			icon: "svg:info",
			info: `Version ${BuildInfo.version}`,
			category: categories.aboutXCoder,
			chevron: true,
		},
		{
			key: "changeLog",
			text: `${strings["changelog"]}`,
			icon: "svg:history",
			info: strings["settings-info-main-changelog"],
			category: categories.aboutXCoder,
			chevron: true,
		},
	];

	/**
	 * Callback for settings page for handling click event
	 * @this {HTMLElement}
	 * @param {string} key
	 */
	async function callback(key, value) {
		switch (key) {
			case "app-settings":
			case "editor-settings":
			case "preview-settings":
			case "terminal-settings":
			case "lsp-settings":
			case "ai-settings":
				appSettings.uiSettings[key].show();
				break;

			case "gh-settings":
				ghSettings();
				break;

			case "ssh-settings":
				sshSettings();
				break;

			case "font-settings":
				fontSettings();
				break;

			case "marketplaceUrl":
				await appSettings.update({ marketplaceUrl: value ?? "" });
				break;

			case "support":
				openSupportPage();
				break;

			case "theme":
				themeSetting();
				break;

			case "about":
				About();
				break;

			case "plugins":
				plugins();
				break;

			case "formatter":
				formatterSettings();
				break;

			case "editSettings": {
				actionStack.pop();
				openFile(settings.settingsFile);
				break;
			}

			case "reset":
				const confirmation = await confirm(
					strings.warning,
					strings["restore default settings"],
				);
				if (confirmation) {
					await appSettings.reset();
					location.reload();
				}
				break;

			case "changeLog":
				Changelog();
				break;

			default:
				break;
		}
	}

	const page = settingsPage(title, items, callback, undefined, {
		preserveOrder: true,
		pageClassName: "main-settings-page",
		listClassName: "main-settings-list",
	});
	page.show();

	appSettings.uiSettings["main-settings"] = page;

	const lazyPages = {
		"app-settings": otherSettings,
		"file-settings": filesSettings,
		"editor-settings": editorSettings,
		"scroll-settings": scrollSettings,
		"search-settings": searchSettings,
		"preview-settings": previewSettings,
		"terminal-settings": terminalSettings,
		"lsp-settings": lspSettings,
		"ai-settings": aiSettings,
	};

	const instantiated = {};

	for (const [key, initializer] of Object.entries(lazyPages)) {
		delete appSettings.uiSettings[key];
		Object.defineProperty(appSettings.uiSettings, key, {
			get() {
				if (!(key in instantiated)) {
					instantiated[key] = initializer();
					Object.defineProperty(appSettings.uiSettings, key, {
						value: instantiated[key],
						writable: true,
						configurable: true,
						enumerable: true,
					});
				}
				return instantiated[key];
			},
			set(val) {
				instantiated[key] = val;
				Object.defineProperty(appSettings.uiSettings, key, {
					value: val,
					writable: true,
					configurable: true,
					enumerable: true,
				});
			},
			configurable: true,
			enumerable: false,
		});
	}
}
