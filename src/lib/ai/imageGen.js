/**
 * AI image generation — keyless, powered by Pollinations
 * (https://image.pollinations.ai — free, no API key, CORS open).
 *
 * VERIFIED live (2026-09): GET image.pollinations.ai/prompt/<prompt>
 * answers 200 with a JPEG without any key. `referrer=xcoder` labels the
 * app per Pollinations etiquette (same as the text provider).
 *
 * The generated image is saved into the current workspace (next to the
 * active file, or the workspace root) and the chat bubble links to it.
 */

import fsOperation from "fileSystem";
import Url from "utils/Url";
import { getRoot } from "./vshell";

const IMAGE_API = "https://image.pollinations.ai/prompt";

/** Available keyless image models (Pollinations "flux" family). */
export const IMAGE_MODELS = ["flux", "turbo"];

/** @type {Array<{label: string, value: string}>} */
export const IMAGE_SIZES = [
	{ label: "1024 × 1024 (quadrado)", value: "1024x1024" },
	{ label: "1024 × 576 (16:9)", value: "1024x576" },
	{ label: "576 × 1024 (9:16)", value: "576x1024" },
	{ label: "768 × 768", value: "768x768" },
];

/**
 * Builds the Pollinations image URL for a prompt.
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {string} [opts.model] "flux" | "turbo"
 * @param {number} [opts.seed]
 * @returns {string}
 */
export function buildImageUrl({
	prompt,
	width = 1024,
	height = 1024,
	model = "flux",
	seed,
}) {
	const query = new URLSearchParams({
		width: String(Math.max(256, Math.min(2048, Math.round(width)))),
		height: String(Math.max(256, Math.min(2048, Math.round(height)))),
		model: IMAGE_MODELS.includes(model) ? model : "flux",
		nologo: "true",
		referrer: "xcoder",
	});
	if (Number.isFinite(seed)) query.set("seed", String(Math.round(seed)));
	return `${IMAGE_API}/${encodeURIComponent(String(prompt || "").slice(0, 900))}?${query.toString()}`;
}

/**
 * Generates an image and returns the blob.
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {string} [opts.model]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{blob: Blob, url: string}>}
 */
export async function generateImage(opts) {
	const url = buildImageUrl(opts);
	const response = await fetch(url, { signal: opts?.signal });
	if (!response.ok) {
		throw new Error(
			`${response.status}: a geração de imagem falhou (${response.statusText || "sem detalhes"})`,
		);
	}
	const blob = await response.blob();
	if (!blob || !blob.size) {
		throw new Error("502: a geração de imagem devolveu uma resposta vazia");
	}
	return { blob, url };
}

/** Blob → data URL (for previews and persistence via fs APIs). */
export function blobToDataUrl(blob) {
	return new Promise((resolve, reject) => {
		try {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(new Error("failed to read image blob"));
			reader.readAsDataURL(blob);
		} catch (error) {
			reject(error);
		}
	});
}

/**
 * Picks the directory where generated images are saved: the folder of the
 * active file, falling back to the workspace root.
 * @returns {string} directory URL
 */
function targetDir() {
	try {
		const active = window.editorManager?.activeFile;
		if (active?.uri && active.location) {
			return Url.dirname(active.uri);
		}
	} catch {
		/* fall through */
	}
	return getRoot();
}

/**
 * Saves a generated image into the workspace.
 * @param {Blob} blob
 * @param {string} [basename] without extension
 * @returns {Promise<{path: string, dataUrl: string}>}
 */
export async function saveGeneratedImage(blob, basename) {
	const dir = targetDir();
	const name = `${basename || "ai-image"}-${Date.now()}.jpg`;
	// the fs layer accepts Blobs directly (FileContent = string|Blob|ArrayBuffer)
	await fsOperation(dir).createFile(name, blob);
	// preview for the chat bubble (small images only — thumbs are 48px)
	const dataUrl = await blobToDataUrl(blob);
	return { path: Url.join(dir, name), dataUrl };
}

/**
 * Extracts the description from a "/image <args>" chat input.
 * Accepts optional size hints like "w=768 h=512" or "768x512" and a
 * "--turbo" model flag; everything else is the prompt.
 * @param {string} args
 * @returns {{prompt: string, width: number, height: number, model: string}}
 */
export function parseImageArgs(args) {
	let text = String(args || "").trim();
	let width = 1024;
	let height = 1024;
	let model = "flux";

	const dims = /(\d{3,4})\s*[x×]\s*(\d{3,4})/i.exec(text);
	if (dims) {
		width = Number(dims[1]);
		height = Number(dims[2]);
		text = text.replace(dims[0], "");
	} else {
		const w = /\bw=(\d{3,4})\b/i.exec(text);
		const h = /\bh=(\d{3,4})\b/i.exec(text);
		if (w) {
			width = Number(w[1]);
			text = text.replace(w[0], "");
		}
		if (h) {
			height = Number(h[1]);
			text = text.replace(h[0], "");
		}
	}

	if (/--turbo\b/i.test(text)) {
		model = "turbo";
		text = text.replace(/--turbo\b/i, "");
	}

	return { prompt: text.trim(), width, height, model };
}

export default {
	buildImageUrl,
	generateImage,
	blobToDataUrl,
	saveGeneratedImage,
	parseImageArgs,
	IMAGE_MODELS,
	IMAGE_SIZES,
};
