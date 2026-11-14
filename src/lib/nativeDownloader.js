/**
 * Native Android DownloadManager (window.Downloader plugin) — the
 * reliable channel for big downloads: no read timeouts, automatic
 * retries, survives app kills and shows the system progress
 * notification in the status bar.
 *
 * Used first by the app update flow (appUpdateDownload.js) before the
 * advanced-http transport and the browser fallback.
 */

/** Poll interval while a native download runs. */
const POLL_MS = 1000;
/** Hard cap: 40 minutes (the system notification keeps progress after). */
const MAX_WAIT_MS = 40 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether the native downloader plugin is available in this build.
 * @returns {boolean}
 */
export function nativeDownloaderAvailable() {
	const downloader = globalThis.Downloader;
	return Boolean(downloader?.download && downloader?.query);
}

function cancelError() {
	return Object.assign(new Error("cancelled"), { code: "cancelled" });
}

/**
 * Downloads a file through the system DownloadManager.
 * @param {string} url http(s) url
 * @param {string} filename display name (lands in the public Downloads dir)
 * @param {{onProgress?: (loaded: number, total: number) => void, signal?: AbortSignal}} [opts]
 * @returns {Promise<{localUri: string, bytes: number, total: number}>}
 *   localUri points at the finished file (content:// or file://)
 */
export async function nativeDownload(url, filename, opts = {}) {
	const downloader = globalThis.Downloader;
	if (!downloader?.download) {
		throw new Error("native downloader unavailable");
	}
	if (opts.signal?.aborted) throw cancelError();

	const id = await downloader.download(url, filename);
	const started = Date.now();

	for (;;) {
		if (opts.signal?.aborted) {
			downloader.cancel(id).catch(() => {});
			throw cancelError();
		}
		if (Date.now() - started > MAX_WAIT_MS) {
			throw new Error("native download exceeded the wait limit");
		}

		let info;
		try {
			info = await downloader.query(id);
		} catch (error) {
			throw new Error(
				`native download lost (id ${id}): ${error?.message || error}`,
			);
		}

		const bytes = Number(info?.bytes || 0);
		const total = Number(info?.total || 0);
		if (typeof opts.onProgress === "function" && bytes > 0) {
			opts.onProgress(bytes, total);
		}

		if (info?.status === "successful") {
			return {
				localUri: String(info.localUri || ""),
				bytes,
				total,
			};
		}
		if (info?.status === "failed") {
			throw new Error(`download failed (reason ${info?.reason ?? "?"})`);
		}
		await sleep(POLL_MS);
	}
}

export default { nativeDownloaderAvailable, nativeDownload };
