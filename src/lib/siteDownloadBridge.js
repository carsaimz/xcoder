import toast from "components/toast";
import { startDownload } from "./downloadManager";

/**
 * Bridge between the embedded site (iframe) and the download manager.
 *
 * The site — when loaded inside the app's Website panel — can't perform
 * downloads itself: the webview iframe swallows navigations to APKs and
 * attachments, which is why "download dentro do app não funcionava".
 * The site detects the embedded mode and postMessages
 * `{ type: "xcoder:download", url }` for every download link; this
 * module routes those messages into the download manager (and flags
 * APKs so the package installer opens right after the transfer).
 */

export const SITE_DOWNLOAD_MSG = "xcoder:download";

/** Guard so the listener installs exactly once per session. */
const BRIDGE_FLAG = "__xcoderSiteDownloadBridge";

/**
 * Handles one postMessage event (exported for tests).
 * @param {MessageEvent} event
 * @returns {boolean} true when the message was accepted as a download
 */
export function handleSiteMessage(event) {
	const data = event?.data;
	if (!data || typeof data !== "object" || data.type !== SITE_DOWNLOAD_MSG) {
		return false;
	}
	const url = String(data.url || "");
	if (!/^https?:\/\//i.test(url)) return false;

	const isApk = /\.apk(\?|#|$)/i.test(url) || Boolean(data.install);
	startDownload({ url, install: isApk });
	return true;
}

/** Whether the app should expose the bridge (always in this build). */
export function bridgeAvailable() {
	return true;
}

/**
 * Installs the global message listener (idempotent).
 * @returns {()=>void} detach function
 */
export function installSiteDownloadBridge() {
	if (globalThis[BRIDGE_FLAG]) return () => {};
	globalThis[BRIDGE_FLAG] = true;
	window.addEventListener("message", handleSiteMessage);
	toast(
		globalThis.strings?.["site bridge ready"] ||
		"Downloads do site chegam ao app",
	);
	return () => {
		window.removeEventListener("message", handleSiteMessage);
		delete globalThis[BRIDGE_FLAG];
	};
}

export default {
	SITE_DOWNLOAD_MSG,
	handleSiteMessage,
	bridgeAvailable,
	installSiteDownloadBridge,
};
