import { describe, expect, it } from "vitest";
import {
	LOCAL_MODELS,
	fileUrl,
	formatBytes,
	getLocalModel,
	localLlmIds,
	modelDir,
	modelFiles,
	modelsByKind,
} from "lib/ai/localModels";

describe("local model catalog", () => {
	it("covers llm, stt and tts kinds", () => {
		const kinds = new Set(LOCAL_MODELS.map((model) => model.kind));
		expect(kinds.has("llm")).toBe(true);
		expect(kinds.has("stt")).toBe(true);
		expect(kinds.has("tts")).toBe(true);
	});

	it("has unique ids and every model at or above the 50MB floor", () => {
		const ids = LOCAL_MODELS.map((model) => model.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const model of LOCAL_MODELS) {
			expect(
				model.sizeBytes,
				`${model.id} below 50MB floor`,
			).toBeGreaterThanOrEqual(50 * 1000 * 1000);
		}
	});

	it("orders kinds lightest-first and lists the heaviest last", () => {
		for (const kind of ["llm", "stt", "tts"]) {
			const sizes = modelsByKind(kind).map((model) => model.sizeBytes);
			expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
		}
		// heavy end: the catalog tops out around 1.2GB (Llama 3.2 1B)
		const biggest = Math.max(...LOCAL_MODELS.map((m) => m.sizeBytes));
		expect(biggest).toBeGreaterThan(1_000_000_000);
		expect(biggest).toBeLessThan(2_500_000_000);
	});

	it("builds resolve URLs and preserves repo-relative layout", () => {
		const model = getLocalModel("qwen2.5-0.5b");
		expect(model).toBeTruthy();
		const files = modelFiles(model);
		expect(files.length).toBeGreaterThan(4);
		expect(files.some((file) => file.path.startsWith("onnx/"))).toBe(true);
		for (const file of files) {
			expect(file.url).toBe(
				`https://huggingface.co/${model.repo}/resolve/main/${file.path}`,
			);
		}
		expect(fileUrl(model, "config.json")).toContain(
			`${model.repo}/resolve/main/config.json`,
		);
	});

	it("bundles the SpeechT5 speaker embedding file", () => {
		const speech = getLocalModel("speecht5-en");
		const files = modelFiles(speech);
		expect(
			files.some((file) => file.path === "speaker_embeddings.bin"),
		).toBe(true);
	});

	it("ships the official Liquid AI LFM2.5-230M ONNX export", () => {
		const model = getLocalModel("lfm2.5-230m");
		expect(model.repo).toBe("LiquidAI/LFM2.5-230M-ONNX");
		expect(model.dtype).toBe("q4");
		const paths = modelFiles(model).map((file) => file.path);
		expect(paths).toContain("onnx/model_q4.onnx");
		expect(paths).toContain("onnx/model_q4.onnx_data");
		expect(paths).toContain("chat_template.jinja");
		// the Liquid export has no special_tokens_map.json on the repo —
		// listing it would 404 the download manager
		expect(paths).not.toContain("special_tokens_map.json");
		// verified against the HF blob sizes (2026-11-13): 216,0 MB
		expect(model.sizeBytes).toBe(216_011_102);
	});

	it("exposes llm ids for the Local provider and stable dirs", () => {
		expect(localLlmIds()).toEqual(
			modelsByKind("llm").map((model) => model.id),
		);
		expect(modelDir("whisper-base")).toBe("xcoder-models/whisper-base");
	});
});

describe("formatBytes", () => {
	it("formats decimal MB with a comma by default (pt)", () => {
		expect(formatBytes(119_801_094)).toBe("119,8 MB");
		expect(formatBytes(50_000_000)).toBe("50,0 MB");
	});

	it("switches to GB at one billion bytes", () => {
		expect(formatBytes(1_246_843_797)).toBe("1,2 GB");
		expect(formatBytes(1_246_843_797, false)).toBe("1.2 GB");
	});
});
