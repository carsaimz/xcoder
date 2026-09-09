import settingsPage from "components/settingsPage";
import toast from "components/toast";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import fonts from "lib/fonts";
import settings from "lib/settings";

/**
 * Font manager (roadmap v1.6.x item 3) — install custom fonts from a
 * URL, then use them as the editor or app font. The heavy lifting
 * (download → cache under DATA/fonts → @font-face injection) already
 * lives in lib/fonts.js; this page is the UI the library was missing.
 */
export default function fontSettings() {
	const title = strings["font manager"] || "Fontes";

	const page = settingsPage(title, buildItems(), handleCallback, "united", {
		pageClassName: "detail-settings-page",
	});
	page.show();
	return page;

	/**
	 * Builds the item list from current font state.
	 * @returns {Array<object>}
	 */
	function buildItems() {
		const items = [
			{
				key: "install-url",
				text: strings["font install url"] || "Instalar fonte por URL",
				info:
					strings["settings-info-font-install"] ||
					"Baixe uma fonte (.ttf/.otf/.woff2) de um link e instale-a no aplicativo.",
				chevron: true,
			},
			{
				key: "set-editor",
				text: strings["font set editor"] || "Fonte do editor",
				value: settings.value.editorFont || "Roboto Mono",
				info:
					strings["settings-info-font-editor"] ||
					"Escolha a fonte usada no editor de código (inclui as suas fontes instaladas).",
				chevron: true,
			},
			{
				key: "set-app",
				text: strings["font set app"] || "Fonte do aplicativo",
				value: settings.value.appFont || "",
				info:
					strings["settings-info-font-app"] ||
					"Escolha a fonte da interface do aplicativo (vazio = padrão do sistema).",
				chevron: true,
			},
		];

		const custom = fonts.getNames().filter((name) => fonts.isCustom(name));
		if (custom.length) {
			items.push({
				key: "custom-header",
				text: `${strings["font installed count"] || "Fontes instaladas"} (${custom.length})`,
				info: strings["settings-info-font-installed"],
			});
			for (const name of custom) {
				items.push({
					key: `custom:${name}`,
					text: name,
					value: strings["font installed"] || "instalada",
					chevron: true,
				});
			}
		}
		return items;
	}

	/**
	 * @param {string} key
	 */
	async function handleCallback(key) {
		switch (key) {
			case "install-url":
				await installFromUrl();
				rebuild();
				break;

			case "set-editor": {
				const name = await pickFont(strings["font set editor"]);
				if (!name) break;
				settings.value.editorFont = name;
				await settings.update();
				await fonts.setEditorFont(name);
				toast(name);
				rebuild();
				break;
			}

			case "set-app": {
				const name = await pickFont(strings["font set app"], true);
				if (name === undefined) break;
				settings.value.appFont = name || "";
				await settings.update();
				await fonts.setAppFont(name);
				toast(name || strings["font default"] || "Padrão");
				rebuild();
				break;
			}

			default:
				if (key?.startsWith?.("custom:")) {
					await customActions(key.slice("custom:".length));
					rebuild();
				}
				break;
		}
	}

	function rebuild() {
		// settingsPage has no public rebuild — replace the list contents
		// by opening a fresh page instance (cheap, settings-style UX)
		page.hide?.();
		fontSettings();
	}

	/**
	 * Prompts for a font name + URL and installs it.
	 */
	async function installFromUrl() {
		const name = await prompt(
			strings["font name"] || "Nome da fonte",
			"",
			"text",
			{ required: true },
		);
		const fontName = String(name || "").trim();
		if (!fontName) return;

		const url = await prompt(
			strings["font url"] || "URL da fonte (.ttf/.otf/.woff2)",
			"",
			"url",
			{ required: true },
		);
		const fontUrl = String(url || "").trim();
		if (!/^https?:\/\//i.test(fontUrl)) {
			if (fontUrl) toast(strings["font bad url"] || "URL inválida");
			return;
		}

		try {
			const format = /\.woff2?(\?|$)/i.test(fontUrl) ? "woff2" : "truetype";
			fonts.addCustom(
				fontName,
				`@font-face {
  font-family: '${fontName.replace(/'/g, "")}';
  src: url('${fontUrl}') format('${format}');
  font-display: swap;
}`,
			);
			await fonts.loadFont(fontName);
			toast(`${fontName} ✓`);
		} catch (error) {
			toast(`font: ${error?.message || error}`, 4000);
		}
	}

	/**
	 * Pick a font from all installed fonts (system + custom).
	 * @param {string} title
	 * @param {boolean} [allowEmpty] offer the system default
	 * @returns {Promise<string|undefined>} undefined = cancelled
	 */
	async function pickFont(title, allowEmpty = false) {
		const options = [];
		if (allowEmpty) {
			options.push([
				"",
				strings["font default"] || "Padrão do sistema",
				"svg:rotate-ccw",
			]);
		}
		for (const name of fonts.getNames()) {
			options.push([name, name, fonts.isCustom(name) ? "svg:download" : ""]);
		}
		return select(title, options);
	}

	/**
	 * Actions for one installed custom font.
	 * @param {string} name
	 */
	async function customActions(name) {
		const choice = await select(name, [
			[
				"editor",
				strings["font use editor"] || "Usar no editor",
				"svg:file-code",
			],
			["app", strings["font use app"] || "Usar no aplicativo", "svg:type"],
			["remove", strings.remove || "Remover", "svg:trash-2"],
		]);
		if (!choice) return;

		if (choice === "editor") {
			settings.value.editorFont = name;
			await settings.update();
			await fonts.setEditorFont(name);
			toast(name);
		} else if (choice === "app") {
			settings.value.appFont = name;
			await settings.update();
			await fonts.setAppFont(name);
			toast(name);
		} else if (choice === "remove") {
			fonts.remove(name);
			toast(`${name} ✕`);
		}
	}
}
