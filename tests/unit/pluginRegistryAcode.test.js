// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import registryJson from "res/plugin-registry.json";
import pluginRegistry, {
	mapAcodePlugin,
	parsePluginKeywords,
} from "lib/pluginRegistry";

vi.mock("lib/backend", () => ({
	backendConfig: () => ({}),
	ensureBackendConfig: async () => ({}),
}));

const storeItem = {
	id: "acode.ai.agent",
	name: "Acode AI Agent",
	version: "0.5.0",
	icon: "https://acode.app/plugin-icon/acode.ai.agent",
	author: "Acode Foundation",
	author_verified: 1,
	downloads: 13836,
	license: "MIT",
	keywords: '["ai","agent","coding"]',
	price: 0,
	repository: "https://github.com/Acode-Foundation/acode-ai-agent",
	supported_editor: "cm",
	min_version_code: 1002,
};

describe("parsePluginKeywords — Acode store format", () => {
	it("parses JSON-encoded keyword arrays", () => {
		expect(parsePluginKeywords('["ai","agent"]')).toEqual(["ai", "agent"]);
	});

	it("parses comma separated lists", () => {
		expect(parsePluginKeywords("git, vcs")).toEqual(["git", "vcs"]);
	});

	it("passes arrays through and defaults to empty", () => {
		expect(parsePluginKeywords(["a"])).toEqual(["a"]);
		expect(parsePluginKeywords(null)).toEqual([]);
		expect(parsePluginKeywords(undefined)).toEqual([]);
	});
});

describe("mapAcodePlugin — store item to registry entry", () => {
	it("maps an Acode store item into the XCoder registry shape", () => {
		const entry = mapAcodePlugin(storeItem);
		expect(entry).not.toBeNull();
		expect(entry.id).toBe("acode.ai.agent");
		expect(entry.name).toBe("Acode AI Agent");
		expect(entry.version).toBe("0.5.0");
		expect(entry.vendor).toBe("acode");
		expect(entry.author).toBe("Acode Foundation");
		expect(entry.author_verified).toBe(true);
		expect(entry.keywords).toEqual(["ai", "agent", "coding"]);
		expect(entry.price).toBe(0);
		expect(entry.downloads).toBe(13836);
		expect(entry.min_version_code).toBe(1002);
		expect(entry.supported_editor).toBe("cm");
	});

	it("points source at the official Acode download endpoint", () => {
		const entry = mapAcodePlugin({ ...storeItem, id: "dev.pixforge" });
		expect(entry.source).toBe(
			"https://acode.app/api/plugin/download/dev.pixforge",
		);
	});

	it("rejects paid plugins — they rely on Acode in-app purchases", () => {
		expect(mapAcodePlugin({ ...storeItem, price: 100 })).toBeNull();
	});

	it("rejects packages built for another editor core", () => {
		expect(mapAcodePlugin({ ...storeItem, supported_editor: "ace" })).toBeNull();
	});

	it("keeps editor-agnostic plugins", () => {
		expect(mapAcodePlugin({ ...storeItem, supported_editor: "all" })).not.toBeNull();
		expect(
			mapAcodePlugin({ ...storeItem, supported_editor: undefined }),
		).not.toBeNull();
	});

	it("rejects malformed store items", () => {
		expect(mapAcodePlugin(null)).toBeNull();
		expect(mapAcodePlugin({ id: "x" })).toBeNull();
		expect(mapAcodePlugin({ name: "x" })).toBeNull();
	});
});

describe("pluginRegistry — Acode store merge", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: true, json: async () => [] })),
		);
		localStorage.clear();
	});

	it("lists Acode plugins alongside the bundled registry", async () => {
		localStorage.setItem(
			"xcoder.pluginRegistry.acodeCache",
			JSON.stringify({
				t: Date.now(),
				plugins: [
					{
						id: "acode.plugin.github",
						name: "GitHub",
						version: "1.0.0",
						vendor: "acode",
					},
				],
			}),
		);
		vi.resetModules();
		const mod = await import("lib/pluginRegistry");
		const all = await mod.default.list();
		const ids = all.map((p) => p.id);
		expect(ids).toContain("acode.plugin.github");
		expect(ids[ids.length - 1]).toBe("acode.plugin.github");
		const acodeEntry = all.find((p) => p.id === "acode.plugin.github");
		expect(acodeEntry.vendor).toBe("acode");
		expect(acodeEntry.source).toBe(
			"https://acode.app/api/plugin/download/acode.plugin.github",
		);
	});

	it("keeps bundled entries ahead of Acode duplicates", async () => {
		const bundledId = registryJson.plugins[0].id;
		localStorage.setItem(
			"xcoder.pluginRegistry.acodeCache",
			JSON.stringify({
				t: Date.now(),
				plugins: [
					{
						id: bundledId,
						name: "Duplicate from Acode",
						vendor: "acode",
					},
					{
						id: "acode.plugin.github",
						name: "GitHub",
						vendor: "acode",
					},
				],
			}),
		);
		vi.resetModules();
		const mod = await import("lib/pluginRegistry");
		const all = await mod.default.list();
		const dupes = all.filter((p) => p.id === bundledId);
		expect(dupes).toHaveLength(1);
		expect(dupes[0].vendor).not.toBe("acode");
		expect(all.filter((p) => p.vendor === "acode")).toHaveLength(1);
	});

	it("resolves Acode ids through get() for installs", async () => {
		localStorage.setItem(
			"xcoder.pluginRegistry.acodeCache",
			JSON.stringify({
				t: Date.now(),
				plugins: [
					{
						id: "acode.plugin.version.control.gitpro",
						name: "Git Pro",
						version: "2.0.0",
						vendor: "acode",
					},
				],
			}),
		);
		vi.resetModules();
		const mod = await import("lib/pluginRegistry");
		const entry = await mod.default.get("acode.plugin.version.control.gitpro");
		expect(entry).not.toBeNull();
		expect(entry.vendor).toBe("acode");
		expect(entry.source).toBe(
			"https://acode.app/api/plugin/download/acode.plugin.version.control.gitpro",
		);
		expect(await mod.default.get("does.not.exist")).toBeNull();
	});
});
