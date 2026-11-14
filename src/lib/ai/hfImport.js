import { addCustomModel, slugForRepo } from "./customModels";

/**
 * "Baixar modelo via link" — import a Hugging Face model into the local
 * catalog by pasting a link.
 *
 * Flow: parse the link → GET the model API (`?blobs=true` gives file
 * sizes, native http plugin = CORS-free) → detect the task/kind from
 * pipeline_tag (config.json fallback) → pick the smallest useful ONNX
 * quantization actually present (q4f16 → q4 → q8 → int8 → fp16 → fp32)
 * → build a catalog entry (meta + weight file list, verified byte size)
 * → register it as a custom model. Downloading reuses the normal model
 * download manager; serving reuses the runtime's disk cache because the
 * entry's `repo` is the REAL HF repo id.
 */

const HF_API = "https://huggingface.co/api/models";
const HF = "https://huggingface.co";

/** transformers.js dtype → filename suffix. */
const DTYPE_SUFFIX = {
	q4f16: "_q4f16",
	q4: "_q4",
	q8: "_quantized",
	int8: "_int8",
	uint8: "_uint8",
	fp16: "_fp16",
	fp32: "",
};
/** Preference order (smallest useful first). */
const DTYPE_ORDER = ["q4f16", "q4", "q8", "int8", "uint8", "fp16", "fp32"];

/** Metadata files worth copying (whitelist — repos hold junk too). */
const META_FILES = [
	"config.json",
	"generation_config.json",
	"preprocessor_config.json",
	"quantize_config.json",
	"chat_template.jinja",
	"tokenizer.json",
	"tokenizer_config.json",
	"special_tokens_map.json",
	"added_tokens.json",
	"vocab.json",
	"merges.txt",
	"spm_char.model",
	"normalizer.json",
];

/** pipeline_tag → catalog kind. */
const KIND_BY_PIPELINE = {
	"text-generation": "llm",
	"automatic-speech-recognition": "stt",
	"text-to-speech": "tts",
	"text2text-generation": "llm",
};

/** config.json model_type → catalog kind (pipeline_tag fallback). */
const KIND_BY_MODEL_TYPE = {
	whisper: "stt",
	wav2vec2: "stt",
	hubert: "stt",
	speecht5: "tts",
	mms: "tts",
	vits: "tts",
	seamless_m4t: "stt",
};

/**
 * @param {string} kind
 * @returns {string} transformers.js pipeline task
 */
export function taskForKind(kind) {
	return kind === "stt"
		? "automatic-speech-recognition"
		: kind === "tts"
			? "text-to-speech"
			: "text-generation";
}

/**
 * Parses a Hugging Face link (or bare "owner/name") into a repo id.
 * Accepts /tree, /blob, /resolve and ".git" shapes.
 * @param {string} input
 * @returns {string} repo id ("owner/name")
 */
export function parseHfUrl(input) {
	const value = String(input || "").trim();
	if (!value) throw new Error("link vazio");
	let repo = value;
	if (/^https?:\/\//i.test(repo)) {
		const host = /^https?:\/\/(www\.)?(huggingface\.co|hf\.co)\//i;
		if (!host.test(repo)) {
			throw new Error(
				"não é um link do Hugging Face (https://huggingface.co/<org>/<repositório>)",
			);
		}
		repo = repo.replace(host, "");
		repo = repo.replace(/\.git(\/|$)/, "$1");
		repo = repo.split("/tree/")[0].split("/blob/")[0].split("/resolve/")[0];
		repo = repo.split("?")[0].split("#")[0];
	}
	repo = repo.replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
	const parts = repo.split("/").filter(Boolean);
	if (parts.length < 2) {
		throw new Error(
			"esperado <org>/<repositório> (ex.: onnx-community/Qwen3-0.6B-ONNX)",
		);
	}
	return `${parts[0]}/${parts[1]}`;
}

/**
 * CORS-free GET for the Hugging Face API (native plugin in the app,
 * fetch fallback elsewhere — api.huggingface.co sends CORS headers).
 * @param {string} url
 * @returns {Promise<any>} parsed JSON
 */
export async function hfApiGet(url) {
	if (globalThis.cordova?.plugin?.http?.sendRequest) {
		return new Promise((resolve, reject) => {
			globalThis.cordova.plugin.http.sendRequest(
				url,
				{
					method: "GET",
					headers: { Accept: "application/json" },
					serializer: "json",
					responseType: "json",
					timeout: 60,
				},
				(response) => {
					let data = response.data;
					if (typeof data === "string") {
						try {
							data = JSON.parse(data);
						} catch {
							data = null;
						}
					}
					resolve(data);
				},
				(error) => {
					reject(
						new Error(
							`huggingface api: ${error?.status || ""} ${
								error?.error || "request failed"
							}`,
						),
					);
				},
			);
		});
	}
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error(`huggingface api: ${response.status} ${url}`);
	}
	return response.json();
}

/**
 * Fetches the model metadata of a repo (with blob sizes).
 * @param {string} repoId
 */
export async function fetchModelInfo(repoId) {
	const info = await hfApiGet(
		`${HF_API}/${encodeURIComponent(repoId)}?blobs=true`,
	);
	if (!info?.siblings) {
		throw new Error(`modelo não encontrado: ${repoId}`);
	}
	return info;
}

/**
 * Detects the catalog kind: pipeline_tag first, config.json model_type
 * fallback (fetched through the resolve endpoint — small file).
 * @param {object} info model API payload
 * @param {string} repoId
 * @returns {Promise<"llm"|"stt"|"tts">}
 */
export async function detectKind(info, repoId) {
	const byPipeline = KIND_BY_PIPELINE[String(info?.pipeline_tag || "")];
	if (byPipeline) return byPipeline;
	try {
		const url = `${HF}/${repoId}/resolve/main/config.json`;
		let text = "";
		if (globalThis.cordova?.plugin?.http?.sendRequest) {
			text = await new Promise((resolve, reject) => {
				globalThis.cordova.plugin.http.sendRequest(
					url,
					{ method: "GET", responseType: "text", timeout: 30 },
					(response) => resolve(String(response.data || "")),
					(error) =>
						reject(new Error(String(error?.status || "config failed"))),
				);
			});
		} else {
			const res = await fetch(url);
			if (res.ok) text = await res.text();
		}
		const config = JSON.parse(text);
		const type = String(config?.model_type || "").toLowerCase();
		return KIND_BY_MODEL_TYPE[type] || "llm";
	} catch {
		return "llm";
	}
}

/**
 * Picks the weight files of the best available dtype for a task shape.
 * @param {string[]} paths repo file paths
 * @param {"llm"|"stt"|"tts"} kind
 * @returns {{dtype: string, weights: string[]}|null}
 */
export function pickWeights(paths, kind) {
	const onnx = paths.filter((path) => path.startsWith("onnx/"));
	const shapes =
		kind === "llm"
			? [`onnx/model{S}.onnx`]
			: [
					`onnx/encoder_model{S}.onnx`,
					`onnx/decoder_model_merged{S}.onnx`,
					...(kind === "tts"
						? [`onnx/decoder_postnet_and_vocoder{S}.onnx`]
						: []),
				];
	for (const dtype of DTYPE_ORDER) {
		const suffix = DTYPE_SUFFIX[dtype];
		const wanted = shapes.map((shape) => shape.replace("{S}", suffix));
		if (!wanted.every((path) => onnx.includes(path))) continue;
		// external weight shards follow "<stem>.onnx_data"
		const weights = [...wanted];
		for (const path of wanted) {
			const dataPath = `${path}_data`;
			if (onnx.includes(dataPath)) weights.push(dataPath);
		}
		return { dtype, weights };
	}
	return null;
}

/**
 * Builds the catalog entry from a model API payload (pure — tests).
 * @param {object} info payload with siblings[] (rfilename + optional size)
 * @param {string} repoId
 * @param {{id?: string, kind?: "llm"|"stt"|"tts", dtype?: string}} [opts]
 * @returns {{entry: object, missing: string[]}}
 */
export function planModelFromHf(info, repoId, opts = {}) {
	const siblings = Array.isArray(info?.siblings) ? info.siblings : [];
	const paths = siblings.map((sibling) =>
		String(sibling?.rfilename || sibling || ""),
	);
	const sizeOf = new Map(
		siblings.map((sibling) => [
			String(sibling?.rfilename || sibling || ""),
			Number(sibling?.size || 0),
		]),
	);

	const kind = opts.kind || "llm";
	const weights = opts.dtype
		? pickWeightsForced(paths, kind, opts.dtype)
		: pickWeights(paths, kind);
	if (!weights) {
		throw new Error(
			"nenhuma variante ONNX encontrada neste repositório (procure repos com pasta onnx/ — export oficial do transformers.js)",
		);
	}

	const meta = META_FILES.filter((path) => paths.includes(path));
	const files = [...meta, ...weights.weights];
	const missing = [];
	const sizeBytes = files.reduce(
		(total, path) => total + (sizeOf.get(path) || 0),
		0,
	);
	if (sizeBytes <= 0) {
		for (const path of files) if (!(sizeOf.get(path) > 0)) missing.push(path);
	}

	const entry = {
		id: opts.id || slugForRepo(repoId),
		kind,
		name: repoId,
		repo: repoId,
		dtype: weights.dtype,
		task: taskForKind(kind),
		lang: "multi",
		descPt: `Importado via link do Hugging Face (${repoId}). Roda offline depois de baixado.`,
		descEn: `Imported from a Hugging Face link (${repoId}). Runs offline once downloaded.`,
		sizeBytes,
		files,
	};
	return { entry, missing };
}

/** Forced-dtype variant of pickWeights (user picked the quantization). */
function pickWeightsForced(paths, kind, dtype) {
	const suffix = DTYPE_SUFFIX[dtype];
	if (suffix === undefined) return null;
	const shapes =
		kind === "llm"
			? [`onnx/model{S}.onnx`]
			: [
					`onnx/encoder_model{S}.onnx`,
					`onnx/decoder_model_merged{S}.onnx`,
					...(kind === "tts"
						? [`onnx/decoder_postnet_and_vocoder{S}.onnx`]
						: []),
				];
	const wanted = shapes.map((shape) => shape.replace("{S}", suffix));
	const onnx = paths.filter((path) => path.startsWith("onnx/"));
	if (!wanted.every((path) => onnx.includes(path))) return null;
	const weights = [...wanted];
	for (const path of wanted) {
		if (onnx.includes(`${path}_data`)) weights.push(`${path}_data`);
	}
	return { dtype, weights };
}

/**
 * Full link import: parse → fetch → plan → register.
 * @param {string} input link or repo id
 * @returns {Promise<{entry: object, repoId: string}>}
 */
export async function importModelFromLink(input) {
	const repoId = parseHfUrl(input);
	const info = await fetchModelInfo(repoId);
	const kind = await detectKind(info, repoId);
	const { entry } = planModelFromHf(info, repoId, { kind });
	const saved = await addCustomModel(entry);
	return { entry: saved, repoId };
}

export default {
	parseHfUrl,
	fetchModelInfo,
	detectKind,
	pickWeights,
	planModelFromHf,
	importModelFromLink,
	taskForKind,
};
