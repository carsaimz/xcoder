import { openToolsHub } from "pages/tools/hub";

/**
 * Tools sidebar launcher — the user asked for a «Ferramentas» entry in
 * the sidebar itself (v1.8.45): «sugiro adicionar também uma opção
 * Ferramentas na barra lateral». Like the Learn launcher, it owns no
 * panel: the tap opens the Tools hub page, which hosts the Inspector,
 * Scraper, Site Analyzer, Learn, Libs, JS console, Website and the web
 * dev generators (moved here from their own sidebar icon).
 */

export default [
	"cod:tools",
	"tools",
	strings["tools"] || "Tools",
	() => {},
	false,
	() => {
		openToolsHub().catch((error) => console.error(error));
	},
	{ titleKey: "tools", group: "tools", launcher: true },
];
