import fsOperation from "fileSystem";
import Url from "utils/Url";
import { addCustomModel } from "./customModels";
import {
	ensureModelDirPath,
	manifestUrl,
	writeModelFile,
} from "./modelDownloads";

/**
 * "Importar arquivos do aparelho" — turn model files already downloaded
 * on the device (config.json, tokenizer, onnx/…) into a working local
 * model, without re-downloading anything.
 *
 * Flow: pick a folder found in the opened workspace that contains a
 * config.json (findModelFolders feeds the picker) → scan its files →
 * detect kind (config model_type, then ONNX shape) and dtype (file
 * names) → copy everything into `<DATA_STORAGE>/xcoder-models/<id>/`
 * preserving the layout → write the `_manifest.json` install proof →
 * register the custom model (localModels.js merges it into the catalog).
 */

/** Directories that are never model folders. */
const SKIP_DIRS = new Set([
	".git",
	".github",
	"__MACOSX",
	"node_modules",
	".xcoder",
]);
/** Size cap per copied file (a 2GB+ stray file would freeze the copy). */
const MAX_FILE_BYTES = 3 * 1024 * 1024 * 1024;
/** Scan caps. */
const MAX_DIRS = 250;
const MAX_FILES = 400;

/** config.json model_type → catalog kind (shared with hfImport). */
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
 * @param {object} config parsed config.json
 * @param {string[]} relativePaths files inside the folder
 * @returns {"llm"|"stt"|"tts"}
 */
export function detectFolderKind(config, relativePaths) {
	const type = String(config?.model_type || "").toLowerCase();
	if (KIND_BY_MODEL_TYPE[type]) return KIND_BY_MODEL_TYPE[type];
	const joined = relativePaths.join(" ");
	if (/encoder_model.*\.onnx/i.test(joined)) return "stt";
	if (/decoder_postnet|vocoder/i.test(joined)) return "tts";
	return "llm";
}

/**
 * Guesses the transformers.js dtype from ONNX file names.
 * @param {string[]} relativePaths
 */
export function detectFolderDtype(relativePaths) {
	const joined = relativePaths.join(" ");
	if (/model_q4f16\.onnx/i.test(joined)) return "q4f16";
	if (/[\w]_q4\.onnx/i.test(joined)) return "q4";
	if (/_quantized\.onnx/i.test(joined)) return "q8";
	if (/_int8\.onnx/i.test(joined)) return "int8";
	if (/_uint8\.onnx/i.test(joined)) return "uint8";
	if (/_fp16\.onnx/i.test(joined)) return "fp16";
	return "fp32";
}

/**
 * Depth-limited search of the workspace for folders holding a
 * config.json (model candidates).
 * @param {string} rootUrl workspace root url
 * @param {{maxDirs?: number}} [opts]
 * @returns {Promise<Array<{url: string, name: string}>>}
 */
export async function findModelFolders(rootUrl, opts = {}) {
	const maxDirs = opts.maxDirs || MAX_DIRS;
	const found = [];
	let visited = 0;
	let frontier = [rootUrl];
	let depth = 0;

	while (frontier.length && visited < maxDirs && depth < 3) {
		const next = [];
		for (const dir of frontier) {
			if (visited >= maxDirs) break;
			visited++;
			let entries = [];
			try {
				entries = toEntries(await fsOperation(dir).lsDir());
			} catch {
				continue;
			}
			if (entries.some((entry) => entry.name === "config.json")) {
				found.push({ url: dir, name: Url.basename(dir) });
				continue; // do not descend into a model folder
			}
			for (const entry of entries) {
				if (!entry.isDirectory) continue;
				const base = entry.name || Url.basename(entry.url);
				if (SKIP_DIRS.has(base) || base.startsWith(".")) continue;
				next.push(entry.url);
			}
		}
		frontier = next;
		depth++;
	}
	return found;
}

/** Normalizes lsDir output (objects on internal fs, strings on sftp). */
function toEntries(list) {
	return (list || []).map((item) =>
		typeof item === "string"
			? {
					name: Url.basename(item),
					url: item,
					isDirectory: false,
					isFile: true,
				}
			: item,
	);
}

/**
 * Recursively lists files under folderUrl (relative paths + absolute).
 * @param {string} folderUrl
 * @returns {Promise<Array<{rel: string, url: string}>>}
 */
async function listFilesRecursively(folderUrl) {
	/** @type {Array<{rel: string, url: string, size: number}>} */
	const out = [];
	let frontier = [{ url: folderUrl, rel: "" }];
	while (frontier.length && out.length < MAX_FILES) {
		const next = [];
		for (const dir of frontier) {
			let entries = [];
			try {
				entries = toEntries(await fsOperation(dir.url).lsDir());
			} catch {
				continue;
			}
			for (const entry of entries) {
				const base = entry.name || Url.basename(entry.url);
				if (SKIP_DIRS.has(base) || base.startsWith(".")) continue;
				const rel = dir.rel ? `${dir.rel}/${base}` : base;
				if (entry.isDirectory) {
					next.push({ url: entry.url, rel });
					continue;
				}
				out.push({ rel, url: entry.url, size: await sizeOf(entry.url) });
			}
		}
		frontier = next;
	}
	return out;
}

/** Reads a (small) text file — config.json detection. */
async function readJson(fileUrl) {
	try {
		const fs = fsOperation(fileUrl);
		const data = await fs.readFile();
		const text =
			typeof data === "string" ? data : new TextDecoder().decode(data);
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/** File size (0 when unknown). */
async function sizeOf(fileUrl) {
	try {
		return Number((await fsOperation(fileUrl).stat())?.size || 0);
	} catch {
		return 0;
	}
}

/**
 * Imports a model from a device folder.
 * @param {string} folderUrl folder with config.json + onnx files
 * @param {{id?: string, name?: string, onLog?: (line: string) => void}} [opts]
 * @returns {Promise<{entry: object, fileCount: number}>}
 */
export async function importModelFromFolder(folderUrl, opts = {}) {
	const files = await listFilesRecursively(folderUrl);
	if (!files.some((file) => file.rel === "config.json")) {
		throw new Error(
			"a pasta não parece um modelo (config.json ausente) — abra a pasta do modelo no editor e tente de novo",
		);
	}

	const config = await readJson(Url.join(folderUrl, "config.json"));
	const rels = files.map((file) => file.rel);
	const kind = detectFolderKind(config, rels);
	const dtype = detectFolderDtype(rels);
	const task =
		kind === "stt"
			? "automatic-speech-recognition"
			: kind === "tts"
				? "text-to-speech"
				: "text-generation";

	const baseName =
		opts.name || config?._name_or_path || Url.basename(folderUrl) || "model";
	const slug = String(baseName)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	let id = opts.id || `imported-${slug || "model"}`;
	let n = 2;
	while (opts.taken?.some((model) => model.id === id)) {
		id = `imported-${slug || "model"}-${n}`;
		n++;
	}

	const totalBytes = files.reduce(
		(total, file) => total + Math.max(0, file.size || 0),
		0,
	);

	/** @type {Record<string, number>} */
	const savedSizes = {};
	for (const file of files) {
		if ((file.size || 0) > MAX_FILE_BYTES) {
			throw new Error(`arquivo grande demais para importar: ${file.rel}`);
		}
		const parts = file.rel.split("/");
		const name = parts.pop();
		const destDir = await ensureModelDirPath(id, parts);
		const destUrl = Url.join(destDir, name);
		const data = await fsOperation(file.url).readFile();
		await writeModelFile(destUrl, data);
		savedSizes[file.rel] = (await sizeOf(destUrl)) || file.size || 1;
		opts.onLog?.(`copiado: ${file.rel}`);
	}

	const entry = {
		id,
		kind,
		name: String(baseName),
		// synthetic repo id — the runtime cache maps ANY request for this
		// repo onto the installed files (pathForRequestUrl)
		repo: `imported/${id}`,
		dtype,
		task,
		lang: "multi",
		descPt: `Importado dos arquivos do aparelho (${String(baseName)}).`,
		descEn: `Imported from device files (${String(baseName)}).`,
		sizeBytes:
			totalBytes || Object.values(savedSizes).reduce((a, b) => a + b, 0),
		files: rels,
	};

	const manifest = {
		id,
		kind,
		dtype,
		task,
		repo: entry.repo,
		files: savedSizes,
		totalBytes: entry.sizeBytes,
		completedAt: Date.now(),
		imported: true,
	};
	await writeModelFile(manifestUrl(id), JSON.stringify(manifest));

	const saved = await addCustomModel(entry);
	return { entry: saved, fileCount: files.length };
}

export default {
	findModelFolders,
	importModelFromFolder,
	detectFolderKind,
	detectFolderDtype,
};
