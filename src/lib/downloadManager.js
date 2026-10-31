import fsOperation from "fileSystem";
import toast from "components/toast";
import helpers from "utils/helpers";
import Url from "utils/Url";
import { formatBytesShort } from "./appUpdateDownload";
import notificationManager from "./notificationManager";

/**
 * Download manager — real in-app downloads for ANY url (project assets,
 * zips, APKs, images…). "Download dentro do app não funciona" fixed:
 * native transport (cordova-plugin-advanced-http) streams to disk with
 * byte-accurate progress, the streaming fetch fallback covers browser
 * builds. Each download surfaces as a notification with a Cancel action
 * and runs through a sequential queue (mobile radios hate parallel
 * streams). Files land in the caller-provided dir or the app Download
 * folder, reachable from the file browser.
 */

const manager = notificationManager;

let seq = 0;
/** @type {Map<string, {abort: AbortController, name: string}>} */
const active = new Map();

/** App-private Download folder (visible in the app's file browser). */
export function defaultDownloadDir() {
	const base = globalThis.DATA_STORAGE || "";
	return base ? Url.join(base, "Download") : "Download";
}

/** Last url path segment, sanitized into a usable filename. */
export function guessNameFromUrl(url) {
	let name = "";
	try {
		const path = new URL(String(url)).pathname;
		name = decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
	} catch {
		name = String(url).split("/").filter(Boolean).pop() || "";
	}
	name = helpers
		.fixFilename(name)
		.replace(/[\\/:*?"<>|]/g, "_")
		.trim();
	return name || `download-${Date.now()}`;
}

/** file:// url → native absolute path (advanced-http requirement). */
function nativePathOf(fileUrl) {
	return decodeURIComponent(String(fileUrl).replace(/^file:\/\//, ""));
}

async function ensureDir(dir) {
	if (!dir) return;
	if (!(await fsOperation(dir).exists())) {
		await fsOperation(Url.dirname(dir)).createDirectory(Url.basename(dir));
	}
}

/** Streams via fetch into memory (browser fallback; tests use this). */
async function fetchDownload(url, destUrl, { signal, onProgress }) {
	const res = await fetch(url, { signal });
	if (!res.ok) throw new Error(`${res.status}: ${url}`);
	const reader = res.body?.getReader?.();
	if (!reader) {
		const blob = await res.blob();
		await fsOperation(destUrl).writeFile(blob);
		onProgress?.(blob.size, blob.size);
		return blob.size;
	}
	/** @type {Uint8Array[]} */
	const parts = [];
	let loaded = 0;
	const total = Number(res.headers.get("content-length") || 0);
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		loaded += value.length;
		onProgress?.(loaded, total);
	}
	await fsOperation(destUrl).writeFile(new Blob(parts));
	onProgress?.(loaded, total || loaded);
	return loaded;
}

/** Native transport — advanced-http streams straight to the file. */
async function nativeDownload(url, destUrl, { signal, onProgress }) {
	const http = globalThis.cordova?.plugin?.http;
	if (!http?.downloadFile) throw new Error("native http unavailable");
	const stop = pollProgress(destUrl, signal, onProgress);
	try {
		await new Promise((resolve, reject) => {
			http.downloadFile(
				url,
				{},
				{},
				nativePathOf(destUrl),
				resolve,
				/** @param {any} error */
				(error) =>
					reject(
						new Error(
							`download failed: ${error?.status || ""} ${error?.error || "native http error"}`,
						),
					),
			);
		});
	} finally {
		stop();
	}
	if (signal?.aborted) {
		const err = new Error("cancelled");
		err.code = "cancelled";
		throw err;
	}
	const size = await fileSize(destUrl);
	onProgress?.(size, size || 0);
	return size;
}

async function fileSize(fileUrl) {
	try {
		const stats = await fsOperation(fileUrl).stat();
		return Number(stats?.size || 0);
	} catch {
		return 0;
	}
}

/** Polls the partial file size (advanced-http has no progress callback). */
function pollProgress(destUrl, signal, onProgress) {
	const timer = setInterval(async () => {
		if (signal?.aborted) return;
		const size = await fileSize(destUrl);
		if (size > 0) onProgress?.(size, 0);
	}, 500);
	return () => clearInterval(timer);
}

/**
 * Core download — picks the native transport when available.
 * @param {{url: string, dir?: string, name?: string, signal?: AbortSignal, onProgress?: (loaded: number, total: number)=>void}} opts
 * @returns {Promise<{destUrl: string, size: number}>}
 */
export async function downloadUrl(opts) {
	const url = String(opts?.url || "").trim();
	if (!/^https?:\/\//i.test(url)) {
		throw new Error("only http(s) downloads are supported");
	}
	const dir = opts.dir || defaultDownloadDir();
	const name = opts.name || guessNameFromUrl(url);
	await ensureDir(dir);
	const destUrl = Url.join(dir, name);

	const onProgress = opts.onProgress;
	if (globalThis.cordova?.plugin?.http?.downloadFile) {
		const size = await nativeDownload(url, destUrl, {
			signal: opts.signal,
			onProgress,
		});
		return { destUrl, size };
	}
	const size = await fetchDownload(url, destUrl, {
		signal: opts.signal,
		onProgress,
	});
	return { destUrl, size };
}

/**
 * Queued download with notification UI (title = file name, message =
 * live progress, action = Cancel). Sequential on purpose.
 * @param {{url: string, name?: string, dir?: string}} job
 * @returns {string} download id (for cancelDownload)
 */
export function startDownload(job) {
	const id = `dl_${++seq}`;
	const name = job?.name || guessNameFromUrl(job?.url);
	const abort = new AbortController();
	active.set(id, { abort, name });

	const notification = {
		downloadId: id,
		title: name,
		message: "0%",
		type: "info",
		icon: "file_download",
		actions: [
			{
				text: strings?.cancel || "Cancel",
				action: () => cancelDownload(id),
			},
		],
	};
	manager.pushNotification(notification);
	toast(`${strings?.downloading || "Downloading"}: ${name}`);

	runQueued(id, job, notification).finally(() => active.delete(id));
	return id;
}

/** Serial queue — one native stream at a time. */
let chain = Promise.resolve();

function runQueued(id, job, notification) {
	const task = chain.then(() =>
		runDownload(id, job, notification).catch(() => {}),
	);
	chain = task;
	return task;
}

async function runDownload(id, job, notification) {
	const entry = active.get(id);
	if (!entry) return;
	try {
		const { destUrl, size } = await downloadUrl({
			url: job.url,
			name: notification.title,
			dir: job.dir,
			signal: entry.abort.signal,
			onProgress: (loaded, total) => {
				const stored = manager.notifications.find(
					(item) => item.downloadId === id,
				);
				if (!stored) return;
				stored.message =
					total > 0
						? `${Math.round((loaded / total) * 100)}% — ${formatBytesShort(loaded)} / ${formatBytesShort(total)}`
						: formatBytesShort(loaded);
				manager.renderNotifications();
			},
		});
		const stored = manager.notifications.find((item) => item.downloadId === id);
		if (stored) {
			stored.message = `✓ ${formatBytesShort(size || 0)}`;
			stored.type = "success";
			manager.renderNotifications();
		}
		toast(
			`${strings?.["download complete"] || "Downloaded"}: ${Url.basename(destUrl)}`,
		);
		// file browser (and any other view) can refresh its listing
		document.dispatchEvent(new CustomEvent("download-finished"));

		return destUrl;
	} catch (error) {
		const cancelled = entry.abort.signal.aborted || error?.code === "cancelled";
		const stored = manager.notifications.find((item) => item.downloadId === id);
		if (stored) {
			stored.message = cancelled
				? strings?.cancel || "Cancelled"
				: `✗ ${error?.message || error}`;
			stored.type = cancelled ? "info" : "error";
			manager.renderNotifications();
		}
		if (!cancelled) {
			toast(`download: ${error?.message || error}`);
		}
	}
}

/** Aborts an active download (no-op when unknown). */
export function cancelDownload(id) {
	const entry = active.get(id);
	if (!entry) return false;
	entry.abort.abort();
	return true;
}

/** ids of the downloads still running. */
export function activeDownloads() {
	return [...active.keys()];
}

export default {
	downloadUrl,
	startDownload,
	cancelDownload,
	activeDownloads,
	defaultDownloadDir,
	guessNameFromUrl,
};
