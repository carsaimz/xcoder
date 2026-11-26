import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * v1.8.43 — user feedback round:
 *   1. «Não vejo opção de estudos» — the Learn catalog is back as its own
 *      sidebar icon (launcher) AND a main-menu entry, besides the Tools hub
 *   2. «os recursos removidos, transforme em plugins» — Scraper / Inspector /
 *      Site Analyzer are marketplace plugins (xcoder-plugins repo) building
 *      on plugin-API engines the app must expose
 *   3. console option in the preview «aparece por 1 segundo e some» — the
 *      native Browser no longer hides the Console menu item when a device
 *      emulator default is restored
 */
describe("v1.8.43 — estudos visíveis, ferramentas como plugins, consola fixa", () => {
	const repoRoot = path.resolve(__dirname, "../..");

	it("registers the learn launcher app in the sidebar loaders", () => {
		const source = readFileSync(
			path.join(repoRoot, "src/sidebarApps/index.js"),
			"utf-8",
		);
		expect(source).toContain('["learn", () => import("./learn")]');
	});

	it("learn app is a launcher with the mortar-board icon", () => {
		const source = readFileSync(
			path.join(repoRoot, "src/sidebarApps/learn/index.js"),
			"utf-8",
		);
		expect(source).toContain('"cod:mortar-board"');
		expect(source).toContain('"learn"');
		expect(source).toContain("launcher: true");
		expect(source).toContain('from "pages/tools/learn"');
	});

	it("main menu has a direct Estudos entry", () => {
		const source = readFileSync(path.join(repoRoot, "src/views/menu.hbs"), "utf-8");
		expect(source).toContain('<li action="open" value="learn">');
		expect(source).toContain("codicon-mortar-board");
	});

	it("commands.js opens the learn page for the menu action", () => {
		const source = readFileSync(path.join(repoRoot, "src/lib/commands.js"), "utf-8");
		expect(source).toContain('case "learn":');
		expect(source).toContain('import(/* webpackChunkName: "learnPage" */ "pages/tools/learn")');
	});

	it("exposes the plugin engines on the xcoder API", () => {
		const source = readFileSync(path.join(repoRoot, "src/lib/xcoder.js"), "utf-8");
		for (const engine of [
			"webScraper",
			"techDetect",
			"webInspector",
			"clipboard",
			"downloadManager",
		]) {
			expect(source).toContain(`this.define("${engine}"`);
		}
	});

	it("bundled registry lists the three tool plugins", () => {
		const registry = JSON.parse(
			readFileSync(path.join(repoRoot, "src/res/plugin-registry.json"), "utf-8"),
		);
		const ids = registry.plugins.map((plugin) => plugin.id);
		for (const id of [
			"xcoder.site-analyzer",
			"xcoder.inspector",
			"xcoder.scraper",
		]) {
			expect(ids).toContain(id);
			const entry = registry.plugins.find((plugin) => plugin.id === id);
			expect(entry.source).toMatch(/^https:\/\/raw\.githubusercontent\.com\/carsaimz\/xcoder-plugins\//);
			expect(entry.source_fallback).toContain("cdn.jsdelivr.net");
		}
	});

	it("native preview keeps the Console menu item visible in device mode", () => {
		const source = readFileSync(
			path.join(
				repoRoot,
				"src/plugins/browser/android/com/xcoder/browser/Browser.java",
			),
			"utf-8",
		);
		const createMenu = source.slice(source.indexOf("private void createMenu()"));
		expect(createMenu).toContain('menu.addItem(Ui.Icons.TERMINAL, "Console", false)');
		// the restore path must NOT hide the console item anymore
		const restore = source.slice(
			source.indexOf("private void restoreEmulator()"),
			source.indexOf("private void createDeviceEmulatorLayout()"),
		);
		expect(restore).not.toContain('menu.setVisible("Console", false)');
		expect(restore).not.toContain("setConsoleVisible(false)");
		// the Devices toggle must not hide it either
		const devices = source.slice(
			source.indexOf('case "Devices":'),
			source.indexOf('case "Console":'),
		);
		expect(devices).not.toContain('menu.setVisible("Console", false)');
		expect(devices).not.toContain("setConsoleVisible(false)");
	});

	it("new plugin UI keys are translated in en-us and pt-br", () => {
		const en = JSON.parse(
			readFileSync(path.join(repoRoot, "src/lang/en-us.json"), "utf-8"),
		);
		const pt = JSON.parse(
			readFileSync(path.join(repoRoot, "src/lang/pt-br.json"), "utf-8"),
		);
		const keys = [
			"inspector search",
			"inspector loaded",
			"analyzer cmd desc",
			"scraper fetching",
			"scraper secrets found",
			"scraper hint",
		];
		for (const key of keys) {
			expect(en[key]).toBeTruthy();
			expect(pt[key]).toBeTruthy();
		}
	});
});
