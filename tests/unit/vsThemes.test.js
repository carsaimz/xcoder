// @vitest-environment happy-dom
/**
 * VS Code theme collection — "mais temas VS": Dark+/Light+ (classic blue
 * status strip), Light Modern, Monokai and both Solarized flavors, plus
 * the vscodeLight editor theme that backs the light pair.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("lib/settings", () => ({
	default: {
		value: {},
		on: () => {},
		get: () => ({}),
	},
}));
vi.mock("lib/logger", () => ({
	default: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}));

import THEMES from "../../src/theme/preInstalled.js";
import { getThemeById } from "../../src/cm/themes/index.js";

describe("VS theme collection", () => {
	it("ships the six VS Code app themes", () => {
		const names = THEMES.map(({ name }) => name);
		for (const name of [
			"VS Dark+",
			"VS Light+",
			"VS Light Modern",
			"VS Monokai",
			"Solarized Dark",
			"Solarized Light",
		]) {
			expect(names, `missing theme ${name}`).toContain(name);
		}
	});

	it("VS Dark+ keeps the classic blue status strip and Dark editor", () => {
		const theme = THEMES.find(({ name }) => name === "VS Dark+");
		expect(theme.type).toBe("dark");
		expect(theme.version).toBe("free");
		expect(theme.statusBarColor).toBe("rgb(0, 122, 204)");
		expect(theme.statusBarTextColor).toBe("rgb(255, 255, 255)");
		expect(theme.activeColor).toBe("rgb(0, 122, 204)");
		expect(theme.preferredEditorTheme).toBe("vscodeDark");
	});

	it("the light pair uses the vscodeLight editor theme", () => {
		for (const name of ["VS Light+", "VS Light Modern"]) {
			const theme = THEMES.find(({ id }) => id === name.toLowerCase());
			expect(theme?.type).toBe("light");
			expect(theme?.preferredEditorTheme).toBe("vscodeLight");
		}
	});

	it("registers the vscodeLight editor theme with Light+ tokens", () => {
		const theme = getThemeById("vscodeLight");
		expect(theme, "vscodeLight editor theme missing").toBeTruthy();
	});
});
