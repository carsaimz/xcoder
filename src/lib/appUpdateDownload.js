import fsOperation from "fileSystem";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import Url from "utils/Url";

/**
 * In-app update download & install.
 *
 * When a newer GitHub release is detected (lib/checkAppUpdate.js), this
 * module downloads the APK asset straight to the app cache and hands it
 * to the Android package installer through the system plugin's
 * FileProvider-backed fileAction — no browser detour required.
 *
 * Ports are injectable so the whole flow is unit-testable (see
 * setUpdatePorts): http transport, dialogs, toast, environment probes.
 */

/** MIME type the Android package installer resolves for APK files. */
export const APK_MIME = "application/vnd.android.package-archive";

/** Browser-fetch fallback ceiling (release APKs are ~30-40 MB). */
const FETCH_MAX_BYTES = 500 * 1024 * 1024;

/** @type {{http: any|null}} active download transport (replaceable) */
let ports = { http: null };

/**
 * Replaces transports/ports (tests). Pass null to restore defaults.
 * @param {{http?: any|null}|null} [next]
 */
export function setUpdatePorts(next) {
	ports = next || { http: null };
}

/**
 * Picks the APK asset of a GitHub release payload.
 * Skips checksums/signatures (.sha256/.asc/.sig) and AAB bundles,
 * preferring the official "XCoder-*.apk" name when present.
 * @param {object} release GitHub release object (needs .assets[])
 * @returns {{name: string, url: string, size: number}|null}
 */
export function pickApkAsset(release) {
	const assets = Array.isArray(release?.assets) ? release.assets : [];
	const apks = assets.filter((asset) => {
		const name = String(asset?.name || "");
		return (
			name.toLowerCase().endsWith(".apk") &&
			!/(\.sha256|\.sha1|\.md5|\.asc|\.sig)$/i.test(name)
		);
	});
	if (!apks.length) return null;
	const official = apks.find((asset) => /^xcoder-/i.test(asset.name || ""));
	const asset = official || apks[0];
	return {
		name: asset.name,
		url: asset.browser_download_url || asset.url,
		size: Number(asset.size || 0),
	};
}

/**
 * Formats a byte count with a locale-stable unit (no external deps).
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytesShort(bytes) {
	const value = Number(bytes || 0);
	if (!Number.isFinite(value) || value <= 0) return "0 MB";
	const mb = value / (1024 * 1024);
	if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
	if (mb >= 1) return `${mb.toFixed(1)} MB`;
	return `${Math.max(1, Math.round(value / 1024))} KB`;
}

/** Cache directory URL for downloaded APKs (covered by FileProvider). */
function cacheDirUrl() {
	const cordova = globalThis.cordova;
	const dir = cordova?.file?.cacheDirectory || globalThis.DATA_STORAGE || "";
	return dir;
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

/** Whether a download was aborted by the caller. */
function aborted(signal) {
	return Boolean(signal?.aborted);
}

function cancelError() {
	return Object.assign(new Error("cancelled"), { code: "cancelled" });
}

/** Polls the partial file size and reports download progress. */
function startProgressPolling(fileUrl, expected, signal, onProgress) {
	const timer = setInterval(async () => {
		if (aborted(signal)) return;
		const size = await fileSize(fileUrl);
		if (size > 0) onProgress?.(size, expected);
	}, 400);
	return () => clearInterval(timer);
}

/** Native transport: cordova-plugin-advanced-http streams to disk. */
async function nativeDownload(asset, destUrl, { signal, onProgress }) {
	const http = ports.http || globalThis.cordova?.plugin?.http;
	if (!http?.downloadFile) throw new Error("native http unavailable");
	if (aborted(signal)) throw cancelError();

	const stopPolling = startProgressPolling(
		destUrl,
		asset.size,
		signal,
		onProgress,
	);
	try {
		await new Promise((resolve, reject) => {
			http.downloadFile(
				asset.url,
				{},
				{},
				nativePathOf(destUrl),
				resolve,
				/** @param {any} error */
				(error) =>
					reject(
						new Error(
							`download failed: ${error?.status || ""} ${
								error?.error || "native http error"
							}`,
						),
					),
			);
		});
	} finally {
		stopPolling();
	}

	if (aborted(signal)) throw cancelError();

	const size = await fileSize(destUrl);
	if (asset.size > 0 && size > 0 && size < asset.size * 0.98) {
		throw new Error(`download truncated (${size}/${asset.size})`);
	}
	onProgress?.(size || asset.size, asset.size || size);
	return size;
}

/** Browser transport: streaming fetch into memory (tests / PWA only). */
async function fetchDownload(asset, destUrl, { signal, onProgress }) {
	const res = await fetch(asset.url, { signal });
	if (!res.ok) throw new Error(`${res.status}: download ${asset.url}`);
	const total = Number(res.headers.get("content-length") || 0) || asset.size;
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
		await fsOperation(destUrl).writeFile(new Blob(parts, { type: APK_MIME }));
		onProgress?.(loaded, loaded);
		return loaded;
	}
	const blob = await res.blob();
	await fsOperation(destUrl).writeFile(blob);
	onProgress?.(blob.size, blob.size);
	return blob.size;
}

/**
 * Downloads the release APK into the app cache directory.
 * @param {{name: string, url: string, size: number}} asset APK asset
 * @param {{onProgress?: (loaded: number, total: number)=>void, signal?: AbortSignal}} [opts]
 * @returns {Promise<string>} file URL of the downloaded APK
 */
export async function downloadApk(asset, { onProgress, signal } = {}) {
	const dir = cacheDirUrl();
	if (!dir) throw new Error("no cache directory");
	const destUrl = Url.join(dir, asset.name || "xcoder-update.apk");

	if (ports.http || globalThis.cordova?.plugin?.http?.downloadFile) {
		await nativeDownload(asset, destUrl, { signal, onProgress });
	} else {
		await fetchDownload(asset, destUrl, { signal, onProgress });
	}
	return destUrl;
}

/**
 * Hands an APK file to the Android package installer.
 * Resolves true when the installer activity started, rejects otherwise.
 * @param {string} fileUrl file:// URL of the APK
 * @param {string} filename display name for the FileProvider
 * @returns {Promise<boolean>}
 */
export function installApk(fileUrl, filename) {
	const system = globalThis.window?.system;
	if (!system?.fileAction) {
		return Promise.reject(new Error("installer unavailable"));
	}
	return new Promise((resolve, reject) => {
		let settled = false;
		const fail = (error) => {
			if (settled) return;
			settled = true;
			reject(error instanceof Error ? error : new Error(String(error)));
		};
		try {
			system.fileAction(fileUrl, filename, "VIEW", APK_MIME, () =>
				fail(new Error("no app to handle the APK")),
			);
			// The plugin's success callback fires right after startActivity
			// succeeds; failure would reject above within the same tick,
			// so a short defer resolves once Android accepted the intent.
			setTimeout(() => {
				if (settled) return;
				settled = true;
				resolve(true);
			}, 300);
		} catch (error) {
			fail(error);
		}
	});
}

/**
 * Whether the current environment can download + install an APK itself.
 * @param {{cordova?: any, system?: any, platform?: string}} [env]
 */
export function canInstallInApp(env) {
	const cordova = env?.cordova ?? globalThis.cordova;
	const system = env?.system ?? globalThis.window?.system;
	const platform = env?.platform ?? globalThis.device?.platform;
	return Boolean(
		cordova?.plugin?.http?.downloadFile &&
			system?.fileAction &&
			platform === "Android",
	);
}

/**
 * Runs the full in-app update flow for a detected update:
 * confirm (with size) → download with progress → launch installer.
 * Falls back to opening the release page when the environment cannot
 * install in-app (browser, PWA, non-Android) or when anything fails.
 *
 * @param {{hasUpdate: boolean, tag: string, url: string, assets?: any[]}} update
 * @param {object} [opts]
 * @param {(message: string, ms?: number)=>void} [opts.toast]
 * @param {(title: string)=>Promise<boolean>} [opts.confirm]
 * @param {object} [opts.loaderFactory] {create(title, message, opts)}
 * @param {()=>void} [opts.openInBrowser]
 * @param {(asset: object, opts: object)=>Promise<string>} [opts.download]
 * @param {(fileUrl: string, name: string)=>Promise<boolean>} [opts.install]
 * @param {object} [opts.env] environment probe overrides
 * @returns {Promise<{ok: boolean, fallback?: "browser", cancelled?: boolean, installed?: boolean, error?: string}>}
 */
export async function runUpdateFlow(update, opts = {}) {
	const strings = globalThis.strings || {};
	const notify = opts.toast || toast;
	const openInBrowser =
		opts.openInBrowser ||
		(() => globalThis.window?.system?.openInBrowser(update.url));
	const ask = opts.confirm || confirm;
	const download =
		opts.download ||
		((asset, downloadOpts) => downloadApk(asset, downloadOpts));
	const install = opts.install || installApk;
	const env = opts.env;
	const loaderFactory = opts.loaderFactory || {
		create: (t, m, o) => loader.create(t, m, o),
	};

	if (!canInstallInApp(env)) {
		openInBrowser();
		return { ok: true, fallback: "browser" };
	}

	const asset = pickApkAsset(update);
	if (!asset) {
		openInBrowser();
		return { ok: true, fallback: "browser" };
	}

	const prompt = (
		strings["update download prompt"] ||
		"New version {version} available ({size}). Download and install now?"
	)
		.replace(/\{version\}/g, update.tag || "")
		.replace(/\{size\}/g, formatBytesShort(asset.size));

	const confirmed = update.hasUpdate
		? await ask(strings["update available"] || "Update Available", prompt)
		: false;
	if (!confirmed) return { ok: false, cancelled: true };

	const abort = new AbortController();
	const $loader = loaderFactory.create(
		strings["downloading update"] || "Downloading update",
		"",
		{
			timeout: 0,
			oncancel: () => abort.abort(),
		},
	);

	let fileUrl;
	try {
		fileUrl = await download(asset, {
			signal: abort.signal,
			onProgress: (loaded, total) => {
				const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
				$loader.setMessage(
					`${pct}% — ${formatBytesShort(loaded)} / ${formatBytesShort(total)}`,
				);
			},
		});
	} catch (error) {
		$loader?.destroy?.();
		if (abort.signal.aborted || error?.code === "cancelled") {
			return { ok: false, cancelled: true };
		}
		notify(
			strings["update download failed"] || "Failed to download the update",
		);
		openInBrowser();
		return { ok: false, error: String(error?.message || error) };
	}

	$loader?.destroy?.();
	notify(
		strings["update downloaded"] || "Update downloaded — opening installer…",
	);

	try {
		await install(fileUrl, asset.name);
		return { ok: true, installed: true };
	} catch (error) {
		notify(
			strings["update install failed"] || "Could not start the installation",
		);
		openInBrowser();
		return { ok: false, error: String(error?.message || error) };
	}
}

export default {
	APK_MIME,
	pickApkAsset,
	formatBytesShort,
	downloadApk,
	installApk,
	canInstallInApp,
	runUpdateFlow,
	setUpdatePorts,
};
