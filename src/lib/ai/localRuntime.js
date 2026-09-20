import { getLocalModel, LOCAL_MODELS, modelFiles } from "./localModels";
import {
	ensureModelDirPath,
	installedFileUrl,
	isModelDownloaded,
} from "./modelDownloads";

/**
 * Local (on-device) inference runtime.
 *
 * Engine: transformers.js (ONNX Runtime WASM) loaded lazily from a
 * pinned CDN URL — zero bundle impact, no workers, single-threaded WASM
 * that runs inside the Android WebView. Model FILES come from disk
 * (installed by modelDownloads.js) through a custom cache, so once a
 * model is installed the chat/STT/TTS run fully offline.
 *
 * Tests inject a fake engine module via setLocalRuntimePorts.
 */

/** Pinned transformers.js build (ESM, works from file:// pages). */
export const TJS_CDN_URL =
	"https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5";

/** @type {{tjs?: Promise<object>}} injectable engine port */
let ports = { tjs: null };

/** Replaces the engine loader (tests). Pass null to restore. */
export function setLocalRuntimePorts(next) {
	ports = next || { tjs: null };
}

/** Lazy engine import (cached). */
function loadEngine() {
	if (!ports.tjs) {
		ports.tjs = import(/* webpackIgnore: true */ TJS_CDN_URL);
	}
	return ports.tjs;
}

/** repo id → catalog model, for URL → file mapping. */
const REPO_INDEX = new Map();
for (const model of LOCAL_MODELS) {
	REPO_INDEX.set(model.repo, model);
}

/** Map a transformers.js request url onto an installed file path. */
export function pathForRequestUrl(url) {
	const value = String(url || "");
	// /<repo>/resolve/<ref>/<path>
	const match = /^https?:\/\/[^/]+\/(.+?)\/resolve\/[^/]+\/(.+)$/.exec(value);
	if (!match) return null;
	const [, repo, path] = match;
	const model = REPO_INDEX.get(repo);
	if (!model) return null;
	const known = modelFiles(model).find((file) => file.path === path);
	if (!known) return null;
	return { model, path };
}

/**
 * Disk cache bridge — serves transformers.js from the files installed
 * by modelDownloads.js and persists anything it still fetches online.
 */
function diskCache() {
	return {
		/** @param {Request|string} request */
		match: async (request) => {
			const hit = pathForRequestUrl(
				typeof request === "string" ? request : request?.url,
			);
			if (!hit) return undefined;
			try {
				const fsOperation = (await import("fileSystem")).default;
				const { model, path } = hit;
				const fileUrl = installedFileUrl(model.id, path);
				const fs = fsOperation(fileUrl);
				if (!(await fs.exists())) return undefined;
				const data = await fs.readFile();
				const buffer =
					data instanceof ArrayBuffer
						? data
						: typeof data === "string"
							? new TextEncoder().encode(data).buffer
							: await data.arrayBuffer?.();
				if (!buffer?.byteLength) return undefined;
				const type =
					path.endsWith(".json") || path.endsWith(".model")
						? "application/json"
						: "application/octet-stream";
				return new Response(buffer, { status: 200, headers: { type } });
			} catch {
				return undefined;
			}
		},
		/** Keep online-fetched files so later turns stay offline. */
		put: async (request, response) => {
			try {
				const hit = pathForRequestUrl(
					typeof request === "string" ? request : request?.url,
				);
				if (!hit) return;
				const blob = await response.clone().blob();
				const fsOperation = (await import("fileSystem")).default;
				const { model, path } = hit;
				const fileUrl = installedFileUrl(model.id, path);
				const fs = fsOperation(fileUrl);
				if (!(await fs.exists())) {
					const segments = path.split("/");
					const name = segments.pop();
					const parent = await ensureModelDirPath(model.id, segments);
					await fsOperation(parent).createFile(name, blob);
					return;
				}
				await fs.writeFile(blob);
			} catch {
				/* cache put failures must never break inference */
			}
		},
	};
}

/** Loaded pipelines per task:model. */
const pipelines = new Map();

async function getPipeline(task, model) {
	const key = `${task}:${model.id}`;
	if (pipelines.has(key)) return pipelines.get(key);
	const engine = await loadEngine();
	const env = engine.env;
	env.allowLocalModels = false;
	env.useBrowserCache = false;
	env.customCache = diskCache();
	const pipe = await engine.pipeline(task, model.repo, {
		dtype: model.dtype,
	});
	pipelines.set(key, pipe);
	return pipe;
}

/** Drops a loaded pipeline (storage freed / model deleted). */
export function unloadLocalModel(modelId) {
	for (const key of [...pipelines.keys()]) {
		if (key.endsWith(`:${modelId}`)) pipelines.delete(key);
	}
}

/** Friendly guard before any inference call. */
async function ensureInstalled(model) {
	if (!(await isModelDownloaded(model.id))) {
		throw new Error(
			globalThis.window?.strings?.["local model missing"] ||
				`Model ${model.name} is not downloaded — open the Models screen to install it.`,
		);
	}
}

/**
 * Local LLM chat turn (streaming).
 * @param {object} opts
 * @param {string} opts.modelId catalog id (llm kind)
 * @param {Array<{role: string, content: string}>} opts.messages
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {AbortSignal} [opts.signal]
 * @param {(text: string) => void} [opts.onDelta]
 * @returns {Promise<{content: string, modelId: string}>}
 */
export async function localChat({
	modelId,
	messages,
	temperature,
	maxTokens,
	signal,
	onDelta,
}) {
	const model = getLocalModel(modelId);
	if (!model || model.kind !== "llm") {
		throw new Error(`unknown local model: ${modelId}`);
	}
	await ensureInstalled(model);
	const engine = await loadEngine();
	const pipe = await getPipeline("text-generation", model);

	let interrupt = null;
	if (signal && engine.InterruptableStoppingCriteria) {
		interrupt = new engine.InterruptableStoppingCriteria();
		signal.addEventListener(
			"abort",
			() => {
				try {
					interrupt.interrupt();
				} catch {
					/* already done */
				}
			},
			{ once: true },
		);
	}
	const streamer = new engine.TextStreamer(pipe.tokenizer, {
		skip_prompt: true,
		skip_special_tokens: true,
		callback_function: (text) => onDelta?.(String(text || "")),
	});
	const options = {
		max_new_tokens: Math.min(Math.max(Number(maxTokens) || 512, 32), 1024),
		do_sample: (Number(temperature) ?? 0.7) > 0,
		temperature: Number(temperature) ?? 0.7,
		streamer,
	};
	if (interrupt) options.stopping_criteria = interrupt;
	const output = await pipe(messages, options);
	const last = output?.[0]?.generated_text;
	const content = Array.isArray(last)
		? String(last.at(-1)?.content ?? "")
		: String(last ?? "");
	return { content, modelId };
}

/**
 * Local speech recognition (STT) — Whisper.
 * @param {string} modelId catalog id (stt kind)
 * @param {Float32Array} audio 16kHz mono PCM
 * @param {object} [opts] { language?: string }
 */
export async function localTranscribe(modelId, audio, opts = {}) {
	const model = getLocalModel(modelId);
	if (!model || model.kind !== "stt") {
		throw new Error(`unknown local stt model: ${modelId}`);
	}
	await ensureInstalled(model);
	const pipe = await getPipeline("automatic-speech-recognition", model);
	const result = await pipe(audio, {
		chunk_length_s: 30,
		stride_length_s: 5,
		language: opts.language || undefined,
		task: "transcribe",
	});
	return { text: String(result?.text || "").trim(), modelId };
}

/**
 * Local text-to-speech (TTS).
 * @param {string} modelId catalog id (tts kind)
 * @param {string} text
 */
export async function localSpeak(modelId, text) {
	const model = getLocalModel(modelId);
	if (!model || model.kind !== "tts") {
		throw new Error(`unknown local tts model: ${modelId}`);
	}
	await ensureInstalled(model);
	const pipe = await getPipeline("text-to-speech", model);
	const options = {};
	if (model.id === "speecht5-en") {
		options.speaker_embeddings = SPEAKER_URL;
	}
	const result = await pipe(String(text || ""), options);
	return {
		audio: result?.audio,
		samplingRate: Number(result?.sampling_rate || 16000),
		modelId,
	};
}

/** Speaker embedding for SpeechT5 (see localModels.js). */
const SPEAKER_URL =
	"https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";
