import {
	ACODE_PLUGIN_EXTENSIONS,
	PLUGIN_ARCHIVE_EXTENSIONS,
	XCODER_PLUGIN_EXTENSIONS,
	adaptPluginManifest,
	derivePluginId,
	getPluginExtension,
	isPluginArchiveFile,
	isPluginPackageFile,
} from "lib/pluginFiles";
import { describe, expect, it } from "vitest";

describe("pluginFiles — package detection", () => {
	it("detects XCoder plugin packages", () => {
		expect(isPluginArchiveFile("/sdcard/app.xcoder")).toBe(true);
		expect(isPluginArchiveFile("/sdcard/app.xcoder-plugin")).toBe(true);
		expect(getPluginExtension("App.XCODER")).toBe(".xcoder");
		expect(getPluginExtension("x/y/p.xcoder-plugin")).toBe(".xcoder-plugin");
	});

	it("detects Acode plugin packages", () => {
		expect(isPluginArchiveFile("/sdcard/prettier.acode-plugin")).toBe(true);
		expect(isPluginArchiveFile("content://x/y/plugin.acode")).toBe(true);
		expect(getPluginExtension("plugin.ACODE")).toBe(".acode");
		expect(getPluginExtension("plugin.ACODE-PLUGIN")).toBe(".acode-plugin");
	});

	it("ignores regular files", () => {
		expect(isPluginArchiveFile("script.js")).toBe(false);
		expect(isPluginArchiveFile("archive.zip")).toBe(false);
		expect(isPluginArchiveFile("")).toBe(false);
		expect(isPluginArchiveFile(null)).toBe(false);
		expect(isPluginArchiveFile(undefined)).toBe(false);
	});

	it("strips query strings and fragments before matching", () => {
		expect(isPluginArchiveFile("https://x/y.acode-plugin?token=1")).toBe(true);
		expect(isPluginArchiveFile("file:///a/b.xcoder#frag")).toBe(true);
	});

	it("exposes both extension families under one list", () => {
		expect(PLUGIN_ARCHIVE_EXTENSIONS).toEqual(
			expect.arrayContaining([
				...XCODER_PLUGIN_EXTENSIONS,
				...ACODE_PLUGIN_EXTENSIONS,
			]),
		);
		expect(isPluginPackageFile("a.zip")).toBe(true);
		expect(isPluginPackageFile("a.acode-plugin")).toBe(true);
		expect(isPluginPackageFile("a.xcoder")).toBe(true);
		expect(isPluginPackageFile("a.js")).toBe(false);
	});
});

describe("pluginFiles — derivePluginId", () => {
	it("keeps manifest ids, including Acode-style ids", () => {
		expect(derivePluginId({ id: "vscode_api" })).toBe("vscode_api");
		expect(derivePluginId({ id: "acode.ai.agent" })).toBe("acode.ai.agent");
	});

	it("falls back to the display name", () => {
		expect(derivePluginId({ name: "My Plugin!" })).toBe("My-Plugin");
	});

	it("falls back to the package file name", () => {
		expect(derivePluginId({}, "file:///a/prettier.acode-plugin")).toBe(
			"prettier",
		);
		expect(derivePluginId({}, "https://x/y/prettier.acode-plugin?x=1")).toBe(
			"prettier",
		);
		expect(derivePluginId({}, "https://x/y/plugin.zip")).toBe("plugin");
	});

	it("never returns an empty or unsafe id", () => {
		expect(derivePluginId({}, "")).toBe("plugin");
		expect(derivePluginId({ id: "!!!" })).toBe("plugin");
		expect(derivePluginId({ id: "  spaced id  " })).toBe("spaced-id");
	});
});

describe("pluginFiles — adaptPluginManifest", () => {
	it("fills legacy/Acode manifests with safe defaults", () => {
		const { manifest, id } = adaptPluginManifest(
			{ name: "Git" },
			"https://acode.app/api/plugin/download/x",
		);
		expect(id).toBe("Git");
		expect(manifest.id).toBe("Git");
		expect(manifest.main).toBe("main.js");
		expect(manifest.icon).toBe("icon.png");
		expect(manifest.readme).toBe("readme.md");
	});

	it("keeps complete manifests untouched", () => {
		const input = {
			id: "p.x",
			main: "m.js",
			icon: "i.png",
			readme: "r.md",
		};
		const { manifest, id } = adaptPluginManifest(input);
		expect(id).toBe("p.x");
		expect(manifest).toEqual(input);
	});
});
