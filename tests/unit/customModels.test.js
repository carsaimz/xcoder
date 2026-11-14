import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	addCustomModel,
	customModelsCache,
	getCustomModel,
	hydrateCustomModels,
	onCustomModelsChanged,
	removeCustomModel,
	setCustomModelsPort,
	slugForRepo,
} from "../../src/lib/ai/customModels";

/** @type {{read: Function, write: Function}} */
let port;
const writes = [];

function baseEntry(overrides = {}) {
	return {
		id: "hf-acme-model",
		kind: "llm",
		name: "acme/model",
		repo: "acme/model",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt: "importado",
		descEn: "imported",
		sizeBytes: 100,
		files: ["config.json"],
		source: "link",
		...overrides,
	};
}

describe("customModels store", () => {
	beforeEach(() => {
		writes.length = 0;
		port = {
			read: async () => writes.at(-1) ?? "",
			write: async (text) => {
				writes.push(text);
			},
		};
		setCustomModelsPort(port);
	});

	it("starts empty and hydrates once", async () => {
		await hydrateCustomModels();
		expect(customModelsCache()).toEqual([]);
	});

	it("registers, persists and emits imported models", async () => {
		const listener = vi.fn();
		const off = onCustomModelsChanged(listener);

		const saved = await addCustomModel(baseEntry());
		expect(saved.custom).toBe(true);
		expect(saved.importedAt).toBeGreaterThan(0);
		expect(customModelsCache()).toHaveLength(1);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(JSON.parse(writes.at(-1))).toHaveLength(1);

		off();
		await addCustomModel(baseEntry({ id: "hf-other" }));
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("dedupes by id and removes entries", async () => {
		await addCustomModel(baseEntry());
		await addCustomModel(baseEntry({ name: "acme/model v2" }));
		expect(customModelsCache()).toHaveLength(1);

		expect(await removeCustomModel("hf-acme-model")).toBe(true);
		expect(customModelsCache()).toHaveLength(0);
		expect(await removeCustomModel("hf-acme-model")).toBe(false);
	});

	it("round-trips through the persisted store", async () => {
		await addCustomModel(baseEntry());
		// fresh cache (simulated restart): port read returns last write
		writes.push(writes.at(-1));
		setCustomModelsPort(port);
		await hydrateCustomModels();
		expect(getCustomModel("hf-acme-model")?.repo).toBe("acme/model");
	});

	it("recovers from a corrupt store", async () => {
		setCustomModelsPort({ read: async () => "{broken", write: async () => {} });
		await hydrateCustomModels();
		expect(customModelsCache()).toEqual([]);
	});

	it("slugifies repo ids without clashing with catalog ids", async () => {
		expect(slugForRepo("onnx-community/Qwen3-0.6B-ONNX")).toBe(
			"hf-onnx-community-qwen3-0-6b-onnx",
		);
		expect(slugForRepo("acme/Foo Bar!!")).toBe("hf-acme-foo-bar");
		const taken = [{ id: "hf-acme-model" }];
		expect(slugForRepo("acme/model", taken)).toBe("hf-acme-model-2");
	});
});
