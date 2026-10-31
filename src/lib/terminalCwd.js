import Url from "utils/Url";

/**
 * Terminal ↔ active project — drops a freshly created terminal session
 * straight into the folder of the active file ("abrir no projeto ativo"
 * instead of the bare Alpine sandbox home).
 *
 * The AXS/proot sandbox binds the host paths /sdcard, /storage and /data
 * verbatim (plugins/terminal/scripts/init-sandbox.sh), so host file://
 * URLs under those trees map 1:1 to paths INSIDE the shell. SAF/content://
 * documents and http(s) remotes have no such mapping — null (skip cd).
 */

/** Host path prefixes visible inside the proot sandbox (verbatim binds). */
const BOUND_PREFIXES = ["/sdcard/", "/storage/", "/data/"];

/**
 * file:// URL → host path, only when the proot sandbox can see it.
 * @param {string} uri file uri (file:///storage/emulated/0/…)
 * @returns {string|null} absolute path inside the sandbox, or null
 */
export function sandboxPathOf(uri) {
	const url = String(uri || "");
	if (!url.startsWith("file://")) return null;
	// file:///storage/x → /storage/x (file://host/path would keep the host)
	let path;
	try {
		path = decodeURIComponent(new URL(url).pathname);
	} catch {
		path = decodeURIComponent(url.replace(/^file:\/\//, ""));
	}
	if (!path.startsWith("/")) return null;
	if (!BOUND_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
	return path;
}

/**
 * Shell-safe single-quoted argument ('→'\'').
 * @param {string} path
 * @returns {string}
 */
export function shellQuote(path) {
	return `'${String(path).replace(/'/g, `'\\''`)}'`;
}

/**
 * Directory to open the terminal in, from the active file (if any).
 * @param {object|null} activeFile editorManager.activeFile ({uri})
 * @returns {string|null} shell command "cd <dir>" or null when unknown
 */
export function activeProjectCd(activeFile) {
	const path = sandboxPathOf(activeFile?.uri);
	if (!path) return null;
	const dir = Url.dirname(`file://${path}`)
		.replace(/^file:\/\//, "")
		.replace(/\/+$/, "");
	if (!dir || dir === "/" || dir === ".") return null;
	return `cd ${shellQuote(dir)}`;
}

export default { sandboxPathOf, shellQuote, activeProjectCd };
