import { openLearnPage } from "pages/tools/learn";

/**
 * Learn sidebar app — «Não vejo opção de estudos» (v1.8.43). The study
 * catalog had only lived inside the Tools hub page since v1.8.40, which
 * made it easy to miss. It is back as its own sidebar icon: a LAUNCHER
 * app (no panel, no floating window) whose tap opens the reliable
 * full-screen Learn page directly.
 */

export default [
	"cod:mortar-board",
	"learn",
	strings["learn"] || "Learn",
	() => {},
	false,
	() => {
		openLearnPage().catch((error) => console.error(error));
	},
	{ titleKey: "learn", group: "tools", launcher: true },
];
