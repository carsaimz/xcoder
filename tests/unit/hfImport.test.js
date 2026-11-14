// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import {
	detectKind,
	parseHfUrl,
	pickWeights,
	planModelFromHf,
	taskForKind,
} from "../../src/lib/ai/hfImport";
import { detectFolderDtype, detectFolderKind } from "../../src/lib/ai/modelImport";

describe("hfImport.parseHfUrl", () => {
	it("accepts full links, tree/blob/resolve shapes and bare ids", () => {
		expect(parseHfUrl("https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX")).toBe(
			"onnx-community/Qwen3-0.6B-ONNX",
		);
		expect(
			parseHfUrl("https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX/tree/main"),
		).toBe("onnx-community/Qwen3-0.6B-ONNX");
		expect(
			parseHfUrl("https://huggingface.co/acme/model/blob/main/config.json"),
		).toBe("acme/model");
		expect(
			parseHfUrl("https://huggingface.co/acme/model/resolve/main/onnx/model.onnx"),
		).toBe("acme/model");
		expect(parseHfUrl("https://huggingface.co/acme/model.git")).toBe("acme/model");
		expect(parseHfUrl("https://hf.co/acme/model")).toBe("acme/model");
		expect(parseHfUrl("acme/model")).toBe("acme/model");
	});

	it("rejects non-HF links and incomplete ids", () => {
		expect(() => parseHfUrl("https://github.com/a/b")).toThrow(/Hugging Face/);
		expect(() => parseHfUrl("just-a-name")).toThrow(/org/);
		expect(() => parseHfUrl("")).toThrow();
	});
});

describe("hfImport.pickWeights", () => {
	it("picks q4f16 for single-file LLMs and keeps external shards", () => {
		const paths = [
			"config.json",
			"tokenizer.json",
			"onnx/model_q4f16.onnx",
			"onnx/model_q4f16.onnx_data",
			"onnx/model_fp16.onnx",
		];
		const picked = pickWeights(paths, "llm");
		expect(picked.dtype).toBe("q4f16");
		expect(picked.weights).toEqual([
			"onnx/model_q4f16.onnx",
			"onnx/model_q4f16.onnx_data",
		]);
	});

	it("picks the quantized pair for whisper-shaped (stt) repos", () => {
		const paths = [
			"onnx/encoder_model_quantized.onnx",
			"onnx/decoder_model_merged_quantized.onnx",
			"onnx/encoder_model_fp16.onnx",
		];
		const picked = pickWeights(paths, "stt");
		expect(picked.dtype).toBe("q8");
		expect(picked.weights).toEqual([
			"onnx/encoder_model_quantized.onnx",
			"onnx/decoder_model_merged_quantized.onnx",
		]);
	});

	it("includes the vocoder file for speecht5-shaped (tts) repos", () => {
		const paths = [
			"onnx/encoder_model_quantized.onnx",
			"onnx/decoder_model_merged_quantized.onnx",
			"onnx/decoder_postnet_and_vocoder_quantized.onnx",
		];
		const picked = pickWeights(paths, "tts");
		expect(picked.weights).toHaveLength(3);
	});

	it("returns null when no ONNX variant exists", () => {
		expect(pickWeights(["config.json", "model.safetensors"], "llm")).toBeNull();
	});
});

describe("hfImport.planModelFromHf", () => {
	const info = {
		pipeline_tag: "text-generation",
		siblings: [
			{ rfilename: "config.json", size: 100 },
			{ rfilename: "tokenizer.json", size: 200 },
			{ rfilename: "onnx/model_q4f16.onnx", size: 300 },
			{ rfilename: "onnx/model_fp16.onnx", size: 900 },
			{ rfilename: "model.safetensors", size: 5000 },
		],
	};

	it("builds an honest catalog entry (size = listed files only)", () => {
		const { entry, missing } = planModelFromHf(info, "acme/model");
		expect(entry.kind).toBe("llm");
		expect(entry.dtype).toBe("q4f16");
		expect(entry.task).toBe("text-generation");
		expect(entry.repo).toBe("acme/model");
		expect(entry.sizeBytes).toBe(600);
		expect(entry.files).toEqual([
			"config.json",
			"tokenizer.json",
			"onnx/model_q4f16.onnx",
		]);
		expect(entry.id).toBe("hf-acme-model");
		expect(missing).toEqual([]);
	});

	it("maps pipeline tags to kinds and tasks", async () => {
		expect(taskForKind("stt")).toBe("automatic-speech-recognition");
		const sttInfo = { pipeline_tag: "automatic-speech-recognition", siblings: [] };
		expect(await detectKind(sttInfo, "a/b")).toBe("stt");
	});
});

describe("modelImport detection", () => {
	it("detects kind from config model_type", () => {
		expect(detectFolderKind({ model_type: "whisper" }, [])).toBe("stt");
		expect(detectFolderKind({ model_type: "speecht5" }, [])).toBe("tts");
		expect(detectFolderKind({ model_type: "lfm2" }, [])).toBe("llm");
		expect(detectFolderKind({}, ["onnx/encoder_model.onnx"])).toBe("stt");
	});

	it("detects dtype from ONNX file names", () => {
		expect(detectFolderDtype(["onnx/model_q4f16.onnx"])).toBe("q4f16");
		expect(detectFolderDtype(["onnx/encoder_model_quantized.onnx"])).toBe("q8");
		expect(detectFolderDtype(["onnx/model_fp16.onnx"])).toBe("fp16");
		expect(detectFolderDtype(["onnx/model.onnx"])).toBe("fp32");
	});
});
