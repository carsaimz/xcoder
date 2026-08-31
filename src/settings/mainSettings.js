import settingsPage from "components/settingsPage";
import confirm from "dialogs/confirm";
import actionStack from "lib/actionStack";
import appSettings from "lib/settings";
import settings from "lib/settings";
import Changelog from "pages/changelog/changelog";
import plugins from "pages/plugins";
import themeSetting from "pages/themeSetting";
import openFile from "lib/openFile";
import About from "../pages/about";
import aiSettings from "./aiSettings";
import otherSettings from "./appSettings";
import backupRestore from "./backupRestore";
import editorSettings from "./editorSettings";
import filesSettings from "./filesSettings";
import formatterSettings from "./formatterSettings";
import lspSettings from "./lspSettings";
import previewSettings from "./previewSettings";
import scrollSettings from "./scrollSettings";
import searchSettings from "./searchSettings";
import terminalSettings from "./terminalSettings";

export default function mainSettings() {
	const title = strings.settings.capitalize();
	const categories = {
		core: strings["settings-category-core"],
		customizationTools: strings["settings-category-customization-tools"],
		maintenance: strings["settings-category-maintenance"],
		aboutXCoder: strings["settings-category-about-xcoder"],
	};
	const items = [
		{
			key: "app-settings",
			text: strings["app settings"],
			icon: "tune",
			info: strings["settings-info-main-app-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "editor-settings",
			text: strings["editor settings"],
			icon: "text_format",
			info: strings["settings-info-main-editor-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "terminal-settings",
			text: `${strings["terminal settings"]}`,
			icon: "terminal",
			info: strings["settings-info-main-terminal-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "preview-settings",
			text: strings["preview settings"],
			icon: "public",
			info: strings["settings-info-main-preview-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "formatter",
			text: strings.formatter,
			icon: "spellcheck",
			info: strings["settings-info-main-formatter"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "theme",
			text: strings.theme,
			icon: "color_lenspalette",
			info: strings["settings-info-main-theme"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "plugins",
			text: strings["plugins"],
			icon: "extension",
			info: strings["settings-info-main-plugins"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "lsp-settings",
			text:
				strings?.lsp_settings ||
				strings["language servers"] ||
				"Language servers",
			icon: "zap",
			info: strings["settings-info-main-lsp-settings"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "ai-settings",
			text: strings["ai settings"] || "AI assistant",
			icon: "psychology",
			info:
				strings["settings-info-main-ai"] ||
				"Configure AI providers and agent behavior.",
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "backup-restore",
			text: `${strings.backup.capitalize()} & ${strings.restore.capitalize()}`,
			icon: "cached",
			info: strings["settings-info-main-backup-restore"],
			category: categories.maintenance,
			chevron: true,
		},
		{
			key: "editSettings",
			text: `${strings["edit"]} settings.json`,
			icon: "edit",
			info: strings["settings-info-main-edit-settings"],
			category: categories.maintenance,
			chevron: true,
		},
		{
			key: "reset",
			text: strings["restore default settings"],
			icon: "historyrestore",
			info: strings["settings-info-main-reset"],
			category: categories.maintenance,
			chevron: true,
		},
		{
			key: "about",
			text: strings.about,
			icon: "info",
			info: `Version ${BuildInfo.version}`,
			category: categories.aboutXCoder,
			chevron: true,
		},
		{
			key: "changeLog",
			text: `${strings["changelog"]}`,
			icon: "update",
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
	async function callback(key) {
		switch (key) {
			case "app-settings":
			case "backup-restore":
			case "editor-settings":
			case "preview-settings":
			case "terminal-settings":
			case "lsp-settings":
			case "ai-settings":
				appSettings.uiSettings[key].show();
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
		"backup-restore": backupRestore,
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
