import fsOperation from "fileSystem";
import Url from "utils/Url";
import { MODELS_ROOT_DIR, modelFiles } from "./localModels";

/**
 * Download manager for local AI models.
 *
 * Files land under `<DATA_STORAGE>/xcoder-models/<model-id>/` preserving
 * the repo-relative layout the runtime expects (onnx/model_q4f16.onnx…).
 * Each finished install writes `_manifest.json` — the source of truth
 * for "is this model downloaded", storage usage and deletion.
 *
 * Transports:
 *  - Native (Cordova): cordova-plugin-advanced-http downloadFile —
 *    streams straight to disk (no JS memory), progress via stat polling.
 *  - Browser/PWA fallback: fetch streaming into memory, guarded at
 *    FETCH_MAX_BYTES so a 1GB model on a phone never goes this way.
 *
 * Both are injectable ports for unit tests (see setModelDownloadPorts).
 */

/** Native transport: one file fully downloaded to disk. */
const NATIVE_HTTP = {
	async download(url, destUrl, { signal, onProgress } = {}) {
		const http = globalThis.cordova?.plugin?.http;
		if (!http?.downloadFile) throw new Error("native http unavailable");
		if (signal?.aborted)
			throw Object.assign(new Error("cancelled"), {
				code: "cancelled",
			});
		const expected = await contentLength(url, signal);
		const nativePath = nativePathOf(destUrl);
		await new Promise((resolve, reject) => {
			http.downloadFile(url, {}, {}, nativePath, resolve, (error) =>
				reject(
					new Error(
						`download failed: ${error?.status || ""} ${
							error?.error || "native http error"
						}`,
					),
				),
			);
		});
		const size = await fileSize(destUrl);
		if (expected > 0 && size > 0 && size < expected * 0.98) {
			throw new Error(`download truncated (${size}/${expected})`);
		}
		onProgress?.(size || expected, expected || size);
	},
};

/** Browser transport: streaming fetch into memory (small files only). */
const FETCH_HTTP = {
	async download(url, destUrl, { signal, onProgress } = {}) {
		const res = await fetch(url, { signal });
		if (!res.ok) throw new Error(`${res.status}: download ${url}`);
		const total = Number(res.headers.get("content-length") || 0);
		if (res.body) {
			const reader = res.body.getReader();
			/** @type {Uint8Array[]} */
			const parts = [];
			let loaded = 0;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				parts.push(value);
				loaded += value.length;
				if (loaded > FETCH_MAX_BYTES) {
					reader.cancel().catch(() => {});
					throw new Error("too big for browser download — use the app");
				}
				onProgress?.(loaded, total);
			}
			await fsOperation(destUrl).writeFile(
				new Blob(parts, { type: "application/octet-stream" }),
			);
			onProgress?.(loaded, loaded);
			return;
		}
		const blob = await res.blob();
		if (blob.size > FETCH_MAX_BYTES) {
			throw new Error("too big for browser download — use the app");
		}
		await fsOperation(destUrl).writeFile(blob);
		onProgress?.(blob.size, blob.size);
	},
};

/** Fetch fallback ceiling (small models / metadata only). */
export const FETCH_MAX_BYTES = 300 * 1024 * 1024;

/** @type {{http: typeof NATIVE_HTTP}} active transport (replaceable) */
let ports = {
	http: null, // resolved lazily: native first, fetch as fallback
};

/**
 * Replaces transports (tests). Pass null to restore defaults.
 */
export function setModelDownloadPorts(next) {
	ports = next || { http: null };
}

/** Active transport: injected one, else native with fetch fallback. */
function httpPort() {
	if (ports.http) return ports.http;
	return {
		download(url, destUrl, opts = {}) {
			const useNative = Boolean(globalThis.cordova?.plugin?.http?.downloadFile);
			const transport = useNative ? NATIVE_HTTP : FETCH_HTTP;
			return transport.download(url, destUrl, opts).catch((error) => {
				// native failure on a small file → retry via fetch
				if (!useNative || opts.signal?.aborted) throw error;
				const size = opts.expectedSize || 0;
				if (size > FETCH_MAX_BYTES) throw error;
				return FETCH_HTTP.download(url, destUrl, opts);
			});
		},
	};
}

/** Root url of the models storage. */
function modelsRoot() {
	return Url.join(globalThis.DATA_STORAGE || "", MODELS_ROOT_DIR);
}

/** Root url of one model's directory. */
function modelRootUrl(modelId) {
	return Url.join(modelsRoot(), modelId);
}

/** Manifest url of one model. */
export function manifestUrl(modelId) {
	return Url.join(modelRootUrl(modelId), "_manifest.json");
}

/** file:// URL → native absolute path (advanced-http wants no scheme). */
function nativePathOf(fileUrl) {
	return decodeURIComponent(String(fileUrl).replace(/^file:\/\//, ""));
}

/** Best-effort file size via fsOperation.stat(). */
async function fileSize(fileUrl) {
	try {
		const stats = await fsOperation(fileUrl).stat();
		return Number(stats?.size || 0);
	} catch {
		return 0;
	}
}

/** HEAD for content-length (HF resolve redirects to the CDN — fetch follows). */
async function contentLength(url, signal) {
	try {
		const res = await fetch(url, { method: "HEAD", signal });
		const length = Number(res.headers.get("content-length") || 0);
		return length;
	} catch {
		return 0;
	}
}

/** Creates a nested directory path (e.g. "onnx") under parent and returns it. */
async function ensureDir(parentUrl, name) {
	const dirUrl = Url.join(parentUrl, name);
	if (!(await fsOperation(dirUrl).exists())) {
		await fsOperation(parentUrl).createDirectory(name);
	}
	return dirUrl;
}

/** Reads the manifest of a model (or null). */
export async function readManifest(modelId) {
	try {
		const fs = fsOperation(manifestUrl(modelId));
		if (!(await fs.exists())) return null;
		const text = await fs.readFile();
		return JSON.parse(
			typeof text === "string" ? text : new TextDecoder().decode(text),
		);
	} catch {
		return null;
	}
}

/**
 * Whether every required file of the catalog entry is on disk.
 * @param {string} modelId
 */
export async function isModelDownloaded(modelId) {
	const { getLocalModel } = await import("./localModels");
	const model = getLocalModel(modelId);
	if (!model) return false;
	const manifest = await readManifest(modelId);
	if (!manifest?.files) return false;
	const required = modelFiles(model).map((file) => file.path);
	return required.every((path) => (manifest.files[path] || 0) > 0);
}

/** Ids of fully installed catalog models. */
export async function downloadedLocalModels() {
	const { LOCAL_MODELS } = await import("./localModels");
	const out = [];
	for (const model of LOCAL_MODELS) {
		if (await isModelDownloaded(model.id)) out.push(model.id);
	}
	return out;
}

/** Bytes on disk for one installed model (manifest total). */
export async function modelStorageBytes(modelId) {
	const manifest = await readManifest(modelId);
	if (!manifest) return 0;
	return Number(manifest.totalBytes || 0);
}

/** Aggregate storage usage of installed models. */
export async function localStorageUsage() {
	const { LOCAL_MODELS } = await import("./localModels");
	let bytes = 0;
	let count = 0;
	for (const model of LOCAL_MODELS) {
		const size = await modelStorageBytes(model.id);
		if (size > 0) {
			bytes += size;
			count++;
		}
	}
	return { bytes, count };
}

/** Deletes an installed model (recursively). */
export async function deleteLocalModel(modelId) {
	const dir = modelRootUrl(modelId);
	if (await fsOperation(dir).exists()) {
		await fsOperation(dir).delete();
	}
}

/** Active downloads by model id. @type {Map<string, {abort: AbortController}>} */
const active = new Map();

/** Whether a model download is running right now. */
export function isDownloading(modelId) {
	return active.has(modelId);
}

/** Cancels a running download (no-op when idle). */
export function cancelDownload(modelId) {
	const entry = active.get(modelId);
	if (entry) entry.abort.abort();
}

/**
 * Downloads (or resumes) a catalog model. Idempotent: files already on
 * disk with the expected size are skipped, so an interrupted download
 * continues where it stopped.
 *
 * @param {object} model catalog entry (localModels.js)
 * @param {object} [opts]
 * @param {(event: object) => void} [opts.onEvent]
 *   { modelId, status: "downloading"|"done"|"error"|"cancelled",
 *     loaded, total, file, fileIndex, fileCount, error? }
 * @returns {Promise<{ok: boolean, error?: string, cancelled?: boolean}>}
 */
export async function downloadModel(model, { onEvent } = {}) {
	if (active.has(model.id)) {
		return { ok: false, error: "already downloading" };
	}
	const abort = new AbortController();
	active.set(model.id, { abort });
	const emit = (event) => onEvent?.({ modelId: model.id, ...event });
	try {
		const root = modelRootUrl(model.id);
		if (!(await fsOperation(root).exists())) {
			await fsOperation(modelsRoot()).createDirectory(model.id);
		}

		const files = modelFiles(model);
		/** @type {Record<string, number>} */
		const saved = {};
		let doneBytes = 0;
		// sizes recorded by a previous attempt — the resume whitelist
		const previous = await readManifest(model.id);

		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			const parts = file.path.split("/");
			const name = parts.pop();
			let dirUrl = root;
			for (const part of parts) {
				dirUrl = await ensureDir(dirUrl, part);
			}
			const destUrl = Url.join(dirUrl, name);
			const expect = Number(previous?.files?.[file.path] || 0);
			const already = await fileSize(destUrl);
			if (expect > 0 && already > 0 && already === expect) {
				// exact byte match with the prior manifest → reuse, no
				// re-download (interrupted installs resume cleanly)
				saved[file.path] = already;
				doneBytes += already;
				emit({
					status: "downloading",
					loaded: doneBytes,
					total: model.sizeBytes,
					file: file.path,
					fileIndex: index + 1,
					fileCount: files.length,
				});
				continue;
			}
			const before = doneBytes;
			await httpPort().download(file.url, destUrl, {
				signal: abort.signal,
				expectedSize: already,
				onProgress: (loaded, _total) => {
					emit({
						status: "downloading",
						loaded: before + loaded,
						total: model.sizeBytes,
						file: file.path,
						fileIndex: index + 1,
						fileCount: files.length,
					});
				},
			});
			const size = await fileSize(destUrl);
			saved[file.path] = size;
			doneBytes = before + size;
		}

		// manifest = proof of install
		const manifest = {
			id: model.id,
			kind: model.kind,
			dtype: model.dtype,
			task: model.task,
			repo: model.repo,
			files: saved,
			totalBytes: doneBytes,
			completedAt: Date.now(),
		};
		await fsOperation(manifestUrl(model.id)).writeFile(
			JSON.stringify(manifest),
		);
		emit({ status: "done", loaded: doneBytes, total: doneBytes });
		return { ok: true };
	} catch (error) {
		const cancelled = abort.signal.aborted || error?.code === "cancelled";
		emit({
			status: cancelled ? "cancelled" : "error",
			error: String(error?.message || error),
		});
		return {
			ok: false,
			cancelled,
			error: String(error?.message || error),
		};
	} finally {
		active.delete(model.id);
	}
}
