/**
 * Local (on-device) model catalog — downloadable LLM, STT and TTS models
 * that run fully offline inside the app (transformers.js WASM runtime).
 *
 * Sizes are VERIFIED against the Hugging Face API (2026-09-19): every
 * entry lists the exact files it needs and the sum of their bytes, so
 * the models screen can show honest numbers BEFORE the user taps
 * download. The lightest entries sit at ~56MB and the heaviest at
 * ~1.2GB — all above the 50MB floor requested for the catalog.
 *
 * Each entry:
 *   - repo    Hugging Face repo (files fetched from /resolve/main/)
 *   - files   repo-relative paths that must be on disk to run
 *   - extra   optional absolute-URL files (e.g. speaker embeddings)
 *   - dtype   ONNX quantization transformers.js should load
 *   - kind    "llm" | "stt" | "tts"
 *
 * The download manager preserves the repo-relative layout under
 * `xcoder-models/<id>/`, and the runtime serves those files to
 * transformers.js through a custom cache (see localRuntime.js).
 */

/** @typedef {"llm"|"stt"|"tts"} LocalModelKind */

/**
 * @typedef {object} LocalModel
 * @property {string} id
 * @property {LocalModelKind} kind
 * @property {string} name
 * @property {string} repo
 * @property {string} dtype
 * @property {string} descPt
 * @property {string} descEn
 * @property {string} [lang] language tag or "multi"
 * @property {number} sizeBytes total download size (verified + meta)
 * @property {string[]} files repo-relative required files
 * @property {string} [task] transformers.js pipeline task
 */

const HF = "https://huggingface.co";

// Imported models (device files / HF link) — merged into every lookup
// below. one-way import keeps the module graph acyclic.
import { customModelsCache } from "./customModels";

/** Common LLM metadata files (tokenizer + configs). */
const LLM_META = [
	"config.json",
	"generation_config.json",
	"tokenizer.json",
	"tokenizer_config.json",
	"special_tokens_map.json",
];

/** Common Whisper metadata files. */
const WHISPER_META = [
	"config.json",
	"generation_config.json",
	"preprocessor_config.json",
	"quantize_config.json",
	"added_tokens.json",
	"special_tokens_map.json",
	"tokenizer.json",
	"tokenizer_config.json",
];

/** @type {LocalModel[]} */
export const LOCAL_MODELS = [
	// ------------------------------------------------------------- LLMs
	{
		id: "smollm2-135m",
		kind: "llm",
		name: "SmolLM2 135M Instruct",
		repo: "HuggingFaceTB/SmolLM2-135M-Instruct",
		dtype: "q4f16",
		task: "text-generation",
		lang: "en",
		descPt:
			"O mais leve: ~120MB, respostas rápidas no aparelho. Inglês. Ideal para telemóveis modestos.",
		descEn:
			"Lightest option: ~120MB, fast on-device answers. English. Great for modest phones.",
		sizeBytes: 119_801_094,
		files: [...LLM_META, "onnx/model_q4f16.onnx"],
	},
	{
		id: "lfm2.5-230m",
		kind: "llm",
		name: "LFM2.5 230M (Liquid AI)",
		repo: "LiquidAI/LFM2.5-230M-ONNX",
		dtype: "q4",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~216MB da Liquid AI, multilingue (português incluído): arquitetura híbrida feita para rodar rápido no aparelho, boa em instruções e extração de dados. Export oficial ONNX — a variante «heretic» sem censura só existe em GGUF (llama.cpp).",
		descEn:
			"~216MB from Liquid AI, multilingual (Portuguese included): hybrid architecture built for fast on-device inference, good at instructions and data extraction. Official ONNX export — the uncensored «heretic» variant only exists as GGUF (llama.cpp).",
		sizeBytes: 216_011_102,
		// the Liquid export ships no special_tokens_map.json — listing
		// LLM_META verbatim would 404 the download manager; it puts
		// the chat template in a standalone chat_template.jinja
		files: [
			"config.json",
			"generation_config.json",
			"tokenizer.json",
			"tokenizer_config.json",
			"chat_template.jinja",
			"onnx/model_q4.onnx",
			"onnx/model_q4.onnx_data",
		],
	},
	{
		id: "lfm2.5-350m",
		kind: "llm",
		name: "LFM2.5 350M (Liquid AI)",
		repo: "onnx-community/LFM2.5-350M-ONNX",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~258MB: irmão maior do 230M, multilingue (português incluído), com respostas mais completas mantendo a velocidade no aparelho.",
		descEn:
			"~258MB: bigger sibling of the 230M, multilingual (Portuguese included), more complete answers while staying fast on-device.",
		sizeBytes: 258_454_337,
		// onnx-community export: no special_tokens_map.json, standalone
		// chat_template.jinja (mirrors the official Liquid repo layout)
		files: [
			"config.json",
			"generation_config.json",
			"tokenizer.json",
			"tokenizer_config.json",
			"chat_template.jinja",
			"onnx/model_q4f16.onnx",
			"onnx/model_q4f16.onnx_data",
		],
	},
	{
		id: "smollm2-360m",
		kind: "llm",
		name: "SmolLM2 360M Instruct",
		repo: "HuggingFaceTB/SmolLM2-360M-Instruct",
		dtype: "q4f16",
		task: "text-generation",
		lang: "en",
		descPt:
			"Equilíbrio leve (~275MB): melhor qualidade que o 135M mantendo a velocidade. Inglês.",
		descEn:
			"Light balance (~275MB): better quality than 135M while staying fast. English.",
		sizeBytes: 274_847_243,
		files: [...LLM_META, "onnx/model_q4f16.onnx"],
	},
	{
		id: "qwen2.5-0.5b",
		kind: "llm",
		name: "Qwen2.5 0.5B Instruct",
		repo: "onnx-community/Qwen2.5-0.5B-Instruct",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~490MB, multilingue (entende português). Boa para perguntas gerais e explicações de código.",
		descEn:
			"~490MB, multilingual (understands Portuguese). Good for Q&A and code explanations.",
		sizeBytes: 490_203_582,
		files: [...LLM_META, "onnx/model_q4f16.onnx"],
	},
	{
		id: "qwen2.5-coder-0.5b",
		kind: "llm",
		name: "Qwen2.5 Coder 0.5B",
		repo: "onnx-community/Qwen2.5-Coder-0.5B-Instruct",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~560MB focado em código: completa funções, explica trechos e escreve scripts curtos.",
		descEn:
			"~560MB code-focused: completes functions, explains snippets, writes short scripts.",
		sizeBytes: 562_135_833,
		files: [...LLM_META, "onnx/model_q4f16.onnx"],
	},
	{
		id: "qwen3-0.6b",
		kind: "llm",
		name: "Qwen3 0.6B",
		repo: "onnx-community/Qwen3-0.6B-ONNX",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~579MB da Qwen 3: raciocínio passo a passo e boas instruções de código, multilingue.",
		descEn:
			"~579MB from Qwen 3: step-by-step reasoning and solid code instructions, multilingual.",
		sizeBytes: 578_923_726,
		// this repo ships added_tokens.json and a standalone chat template
		files: [
			...LLM_META,
			"added_tokens.json",
			"chat_template.jinja",
			"onnx/model_q4f16.onnx",
			"onnx/model_q4f16.onnx_data",
		],
	},
	{
		id: "smollm2-1.7b",
		kind: "llm",
		name: "SmolLM2 1.7B Instruct",
		repo: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
		dtype: "q4f16",
		task: "text-generation",
		lang: "en",
		descPt:
			"~1,1GB: o SmolLM2 mais capaz — conversa e explica código com fluência (inglês).",
		descEn:
			"~1.1GB: the most capable SmolLM2 — fluent conversation and code explanations (English).",
		sizeBytes: 1_110_840_353,
		files: [...LLM_META, "onnx/model_q4f16.onnx"],
	},
	{
		id: "qwen2.5-1.5b",
		kind: "llm",
		name: "Qwen2.5 1.5B Instruct",
		repo: "onnx-community/Qwen2.5-1.5B-Instruct",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~1.2GB, o melhor equilíbrio offline: conversa, resume e explica código com qualidade.",
		descEn:
			"~1.2GB, best offline balance: chats, summarizes and explains code with quality.",
		sizeBytes: 1_229_078_940,
		files: [...LLM_META, "onnx/model_q4f16.onnx"],
	},
	{
		id: "llama-3.2-1b",
		kind: "llm",
		name: "Llama 3.2 1B Instruct",
		repo: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~1.25GB da Meta: respostas naturais em português. O modelo offline mais completo do catálogo.",
		descEn:
			"~1.25GB from Meta: natural Portuguese answers. The most complete offline model here.",
		sizeBytes: 1_246_843_797,
		files: [...LLM_META, "onnx/model_q4f16.onnx"],
	},
	{
		id: "qwen2.5-coder-1.5b",
		kind: "llm",
		name: "Qwen2.5 Coder 1.5B",
		repo: "onnx-community/Qwen2.5-Coder-1.5B-Instruct",
		dtype: "q4f16",
		task: "text-generation",
		lang: "multi",
		descPt:
			"~1,36GB focado em código: escreve e refatora funções completas — o mais forte do catálogo para programar offline.",
		descEn:
			"~1.36GB code-focused: writes and refactors complete functions — the strongest offline coding model in the catalog.",
		sizeBytes: 1_355_669_223,
		// ships added_tokens.json alongside LLM_META
		files: [
			...LLM_META,
			"added_tokens.json",
			"onnx/model_q4f16.onnx",
			"onnx/model_q4f16.onnx_data",
		],
	},

	// ------------------------------------------------------------- STT
	{
		id: "whisper-base",
		kind: "stt",
		name: "Whisper Base",
		repo: "onnx-community/whisper-base",
		dtype: "q8",
		task: "automatic-speech-recognition",
		lang: "multi",
		descPt:
			"~81MB: voz → texto offline (português + 98 idiomas). Leve e rápido no microfone do telemóvel.",
		descEn:
			"~81MB: offline voice → text (Portuguese + 98 languages). Light and fast on-device.",
		sizeBytes: 81_294_629,
		files: [
			...WHISPER_META,
			"onnx/encoder_model_quantized.onnx",
			"onnx/decoder_model_merged_quantized.onnx",
		],
	},
	{
		id: "whisper-small",
		kind: "stt",
		name: "Whisper Small",
		repo: "onnx-community/whisper-small",
		dtype: "q8",
		task: "automatic-speech-recognition",
		lang: "multi",
		descPt:
			"~253MB: transcrição bem mais precisa que o Base, mantendo o aparelho offline.",
		descEn:
			"~253MB: noticeably more accurate transcription than Base, still fully offline.",
		sizeBytes: 253_477_005,
		files: [
			...WHISPER_META,
			"onnx/encoder_model_quantized.onnx",
			"onnx/decoder_model_merged_quantized.onnx",
		],
	},

	// ------------------------------------------------------------- TTS
	{
		id: "mms-tts-por",
		kind: "tts",
		name: "MMS TTS Português",
		repo: "Xenova/mms-tts-por",
		dtype: "fp16",
		task: "text-to-speech",
		lang: "pt",
		descPt:
			"~58MB: lê texto em voz alta em português (Meta MMS). Funciona sem internet.",
		descEn:
			"~58MB: reads text aloud in Portuguese (Meta MMS). Works without internet.",
		sizeBytes: 58_135_555,
		files: [
			"config.json",
			"quantize_config.json",
			"special_tokens_map.json",
			"tokenizer.json",
			"tokenizer_config.json",
			"added_tokens.json",
			"vocab.json",
			"onnx/model_fp16.onnx",
		],
	},
	{
		id: "speecht5-en",
		kind: "tts",
		name: "SpeechT5 (English)",
		repo: "Xenova/speecht5_tts",
		dtype: "q8",
		task: "text-to-speech",
		lang: "en",
		descPt:
			"~181MB: voz inglesa natural (Microsoft SpeechT5) com voz de referência incluída.",
		descEn:
			"~181MB: natural English voice (Microsoft SpeechT5) with bundled reference voice.",
		sizeBytes: 180_940_073,
		files: [
			"config.json",
			"generation_config.json",
			"preprocessor_config.json",
			"quantize_config.json",
			"added_tokens.json",
			"special_tokens_map.json",
			"spm_char.model",
			"tokenizer.json",
			"tokenizer_config.json",
			"onnx/encoder_model_quantized.onnx",
			"onnx/decoder_model_merged_quantized.onnx",
			"onnx/decoder_postnet_and_vocoder_quantized.onnx",
		],
	},
];

/** Speaker embedding for SpeechT5 (small, bundled in the same install). */
export const SPEAKER_EMBEDDINGS_URL =
	"https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin";

/** Root directory name for installed models. */
export const MODELS_ROOT_DIR = "xcoder-models";

/** Absolute URL of one catalog file. */
export function fileUrl(model, path) {
	return `${HF}/${model.repo}/resolve/main/${path}`;
}

/**
 * All files a model needs, as { url, path, size } (size is the HF-side
 * byte count when the file lives in the repo — meta entries carry an
 * estimate; the download manager trusts Content-Length at runtime).
 */
export function modelFiles(model) {
	const list = (model.files || []).map((path) => ({
		url: fileUrl(model, path),
		path,
	}));
	for (const url of model.extraUrls || []) {
		list.push({ url, path: url.split("/").pop() || url });
	}
	if (model.id === "speecht5-en") {
		list.push({
			url: SPEAKER_EMBEDDINGS_URL,
			path: "speaker_embeddings.bin",
		});
	}
	return list;
}

/**
 * Every catalog model: the built-in entries PLUS user-imported ones
 * (device files / HF link — see customModels.js). The custom cache is
 * hydrated asynchronously at import and refreshed via its own event.
 * @returns {LocalModel[]}
 */
export function allLocalModels() {
	return [...LOCAL_MODELS, ...customModelsCache()];
}

/** Catalog entry by id — built-in or imported. */
export function getLocalModel(id) {
	return (
		LOCAL_MODELS.find((model) => model.id === id) ||
		customModelsCache().find((model) => model.id === id) ||
		null
	);
}

/** Catalog entries of one kind (built-in + imported). */
export function modelsByKind(kind) {
	return allLocalModels().filter((model) => model.kind === kind);
}

/** Local directory (relative to the app storage root) for a model. */
export function modelDir(id) {
	return `${MODELS_ROOT_DIR}/${id}`;
}

/** Repo-relative path the runtime expects for a URL. */
export function pathForUrl(model, url) {
	const hit = modelFiles(model).find((file) => file.url === url);
	return hit ? hit.path : "";
}

/**
 * Human size: "92 MB" / "1,2 GB" (decimal units, matching HF display).
 * Pure so tests pin it.
 * @param {number} bytes
 * @param {boolean} [comma] decimal comma (pt) vs dot (en)
 */
export function formatBytes(bytes, comma = true) {
	const value = Number(bytes) || 0;
	const unit = value >= 1_000_000_000 ? "GB" : "MB";
	const scaled = unit === "GB" ? value / 1_000_000_000 : value / 1_000_000;
	const text = scaled.toFixed(1);
	return `${comma ? text.replace(".", ",") : text} ${unit}`;
}

/** Local model ids exposed as "models" of the Local provider. */
export function localLlmIds() {
	return modelsByKind("llm").map((model) => model.id);
}
