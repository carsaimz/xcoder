#!/usr/bin/env node
/**
 * Applies the REMAINING v1.6.0 wiring (the sidebarApps loader, rspack
 * entry, webpack entry were already applied in the first run — this file
 * covers webpack + tests + settings + commands + mainSettings).
 *
 * Every replacement must match EXACTLY ONCE, otherwise the script fails
 * without writing anything.
 */
import { readFileSync, writeFileSync } from "node:fs";

const root = "/home/z/my-project/xcoder";
const files = {
	webpack: `${root}/webpack.config.js`,
	importsTest: `${root}/tests/unit/sidebarAppImports.test.js`,
	settings: `${root}/src/lib/settings.js`,
	commands: `${root}/src/lib/commands.js`,
	mainSettings: `${root}/src/settings/mainSettings.js`,
};

function replaceOnce(source, name, oldStr, newStr) {
	const count = source.split(oldStr).length - 1;
	if (count !== 1) {
		throw new Error(
			`anchor for ${name} matched ${count} times (expected 1):\n${oldStr.slice(0, 140)}`,
		);
	}
	return source.replace(oldStr, newStr);
}

function apply(file, edits) {
	let source = readFileSync(file, "utf8");
	for (const [name, oldStr, newStr] of edits) {
		source = replaceOnce(source, name, oldStr, newStr);
	}
	writeFileSync(file, source);
	console.log(`OK ${file} (${edits.length} edits)`);
}

// webpack.config.js has MIXED line endings — the searchIndexWorker line
// ends with LF while surrounding lines use CRLF (verified via cat -A)
apply(files.webpack, [
	[
		"webpack replWorker",
		"      searchIndexWorker: './src/sidebarApps/searchInFiles/indexWorker.js',\n    },",
		"      searchIndexWorker: './src/sidebarApps/searchInFiles/indexWorker.js',\n" +
			"      replWorker: './src/lib/replWorker.js',\n    },",
	],
]);

// structural test: the new app must be in the tracked list
apply(files.importsTest, [
	[
		"repl in SIDEBAR_APPS",
		'        ["git", () => import("sidebarApps/git")],',
		'        ["git", () => import("sidebarApps/git")],\n' +
			'        ["repl", () => import("sidebarApps/repl")],',
	],
]);

// settings default for the terminal onboarding flag
apply(files.settings, [
	[
		"terminalOnboardingDone default",
		"\t\t\tdeveloperMode: false,",
		"\t\t\t// terminal onboarding shown once (v1.6.0)\n" +
			"\t\t\tterminalOnboardingDone: false,\n" +
			"\t\t\tdeveloperMode: false,",
	],
]);

// terminal onboarding hook in the new-terminal command
apply(files.commands, [
	[
		"new-terminal onboarding",
		'\tasync "new-terminal"() {\n' +
			"\t\ttry {\n" +
			'\t\t\tconst { TerminalManager } = await import(\n' +
			'\t\t\t\t/* webpackChunkName: "terminal" */ "components/terminal"\n' +
			"\t\t\t);\n" +
			"\t\t\tawait TerminalManager.createServerTerminal();",
		'\tasync "new-terminal"() {\n' +
			"\t\ttry {\n" +
			"\t\t\t// first-run onboarding (Alpine vs FailSafe + reinstall)\n" +
			'\t\t\tconst { maybeTerminalOnboarding } = await import("lib/terminalOnboarding");\n' +
			"\t\t\tawait maybeTerminalOnboarding();\n" +
			"\t\t\tconst { TerminalManager } = await import(\n" +
			'\t\t\t\t/* webpackChunkName: "terminal" */ "components/terminal"\n' +
			"\t\t\t);\n" +
			"\t\t\tawait TerminalManager.createServerTerminal();",
	],
]);

// mainSettings: import + items + callback for ssh/font pages
apply(files.mainSettings, [
	[
		"imports",
		'import ghSettings from "./ghSettings";',
		'import fontSettings from "./fontSettings";\n' +
			'import ghSettings from "./ghSettings";\n' +
			'import sshSettings from "./sshSettings";',
	],
	[
		"ssh item",
		'\t\t\t{\n' +
			'\t\t\t\tkey: "gh-settings",\n' +
			'\t\t\t\ttext: strings["github settings"] || "GitHub",',
		'\t\t\t{\n' +
			'\t\t\t\tkey: "ssh-settings",\n' +
			'\t\t\t\ttext: strings["ssh sessions"] || "Sessões SSH",\n' +
			'\t\t\t\ticon: "svg:server",\n' +
			"\t\t\t\tinfo:\n" +
			'\t\t\t\t\tstrings["settings-info-main-ssh"] ||\n' +
			'\t\t\t\t\t"Sessões SSH salvas: abra um terminal remoto com um toque.",\n' +
			"\t\t\t\tcategory: categories.customizationTools,\n" +
			"\t\t\t\tchevron: true,\n" +
			"\t\t\t},\n" +
			"\t\t\t{\n" +
			'\t\t\t\tkey: "gh-settings",\n' +
			'\t\t\t\ttext: strings["github settings"] || "GitHub",',
	],
	[
		"font item",
		'\t\t\t{\n' +
			'\t\t\t\tkey: "editSettings",\n' +
			'\t\t\t\ttext: `${strings["edit"]} settings.json`,',
		'\t\t\t{\n' +
			'\t\t\t\tkey: "font-settings",\n' +
			'\t\t\t\ttext: strings["font manager"] || "Fontes",\n' +
			'\t\t\t\ticon: "svg:type",\n' +
			"\t\t\t\tinfo:\n" +
			'\t\t\t\t\tstrings["settings-info-main-fonts"] ||\n' +
			'\t\t\t\t\t"Instale fontes por URL e escolha a fonte do editor e do app.",\n' +
			"\t\t\t\tcategory: categories.customizationTools,\n" +
			"\t\t\t\tchevron: true,\n" +
			"\t\t\t},\n" +
			"\t\t\t{\n" +
			'\t\t\t\tkey: "editSettings",\n' +
			'\t\t\t\ttext: `${strings["edit"]} settings.json`,',
	],
	[
		"callback cases",
		'\t\t\t\tcase "gh-settings":\n' +
			"\t\t\t\t\tghSettings();\n" +
			"\t\t\t\t\tbreak;",
		'\t\t\t\tcase "gh-settings":\n' +
			"\t\t\t\t\tghSettings();\n" +
			"\t\t\t\t\tbreak;\n" +
			"\n" +
			'\t\t\t\tcase "ssh-settings":\n' +
			"\t\t\t\t\tsshSettings();\n" +
			"\t\t\t\t\tbreak;\n" +
			"\n" +
			'\t\t\t\tcase "font-settings":\n' +
			"\t\t\t\t\tfontSettings();\n" +
			"\t\t\t\t\tbreak;",
	],
]);

console.log("Remaining v1.6.0 wiring applied.");
