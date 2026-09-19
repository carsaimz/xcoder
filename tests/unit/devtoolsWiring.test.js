import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("devtools sidebar app wiring", () => {
	const repoRoot = path.resolve(__dirname, "../..");

	it("is registered in the sidebarApps loaders list", () => {
		const source = readFileSync(
			path.join(repoRoot, "src/sidebarApps/index.js"),
			"utf-8",
		);
		expect(source).toContain('["devtools", () => import("./devtools")]');
	});

	it("exports the sidebar app tuple with a palette icon", () => {
		const source = readFileSync(
			path.join(repoRoot, "src/sidebarApps/devtools/index.js"),
			"utf-8",
		);
		expect(source).toContain('"svg:palette"');
		expect(source).toContain('"devtools"');
		expect(source).toContain("{ titleKey: \"dev tools\" }");
	});

	it("generators live in lib/webdevTools.js (not the Eruda devTools)", () => {
		const app = readFileSync(
			path.join(repoRoot, "src/sidebarApps/devtools/index.js"),
			"utf-8",
		);
		expect(app).toContain('from "lib/webdevTools"');
	});

	it("has i18n keys in en-us and pt-br", () => {
		const en = JSON.parse(
			readFileSync(path.join(repoRoot, "src/lang/en-us.json"), "utf-8"),
		);
		const pt = JSON.parse(
			readFileSync(path.join(repoRoot, "src/lang/pt-br.json"), "utf-8"),
		);
		const keys = [
			"dev tools",
			"dev tools shadow",
			"dev tools gradient",
			"dev tools card",
			"dev tools placeholder",
			"dev tools insert",
			"dev tools save svg",
			"update download prompt",
			"downloading update",
			"update downloaded",
			"update download failed",
			"update install failed",
		];
		for (const key of keys) {
			expect(en[key], `en-us missing "${key}"`).toBeTruthy();
			expect(pt[key], `pt-br missing "${key}"`).toBeTruthy();
		}
	});
});
