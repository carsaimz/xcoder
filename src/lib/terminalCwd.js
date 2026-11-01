import Url from "utils/Url";

/**
 * Terminal ↔ active project — drops a freshly created terminal session
 * straight into the folder of the active file (or of an open project)
 * instead of the bare Alpine sandbox home.
 *
 * In-shell path mapping, mirroring lib/openFolder.convertToProotPath:
 *  - XCoder public SAF trees (content://com.carsaimz.xcoder.documents)
 *    and file:// URLs under the app public dir → /public/…
 *  - file:// URLs under the Alpine root → sandbox-relative paths
 *  - file:// URLs under /sdcard, /storage and /data (bound verbatim by
 *    the proot sandbox, plugins/terminal/scripts/init-sandbox.sh) → 1:1
 *  - Android external-storage SAF documents ("primary:…") →
 *    /storage/emulated/0/…
 * Everything else (Termux trees, http(s) remotes, cache URLs) has no
 * in-shell mapping — null (skip cd).
 */

/** Host path prefixes visible inside the proot sandbox (verbatim binds). */
const BOUND_PREFIXES = ["/sdcard/", "/storage/", "/data/"];

/** SAF authorities whose trees map into the sandbox. */
const XCODER_SAF = "content://com.carsaimz.xcoder.documents/";
const EXTERNAL_SAF = "content://com.android.externalstorage.documents/";

/** App private root (/data/user/0/<pkg>), from the runtime package id. */
function appDataDir() {
	const packageName =
		globalThis.BuildInfo?.packageName || "com.carsaimz.xcoder";
	return `/data/user/0/${packageName}`;
}

/** Alpine sandbox root and app-public dir inside the app data folder. */
function terminalRoots() {
	const dataDir = appDataDir();
	return {
		alpineRoot: `${dataDir}/files/alpine`,
		publicDir: `${dataDir}/files/public`,
	};
}

/** Decodes a SAF tree/doc id segment ("primary%3AProjects" → "primary:Projects"). */
function safeDecode(value) {
	try {
		return decodeURIComponent(String(value || ""));
	} catch {
		return String(value || "");
	}
}

/**
 * Maps a XCoder public-provider doc id to /public/… (same rules as
 * openFolder.convertToProotPath: absolute public paths, "/public/…",
 * "public:rel" and bare relative ids all land under /public).
 * @param {string} docId decoded doc id
 * @returns {string}
 */
function xcoderDocToPublic(docId) {
	const { publicDir } = terminalRoots();
	const id = String(docId || "");
	if (!id) return "/public";
	if (id.startsWith(publicDir)) return id.replace(publicDir, "/public");
	if (id.startsWith("/public")) return id;
	if (id.startsWith("public:")) {
		const relative = id.slice("public:".length).replace(/^\/+/, "");
		return relative ? `/public/${relative}` : "/public";
	}
	const relative = id.replace(/^\/+/, "").replace(/^public\//, "");
	return relative ? `/public/${relative}` : "/public";
}

/**
 * file:// URL → host path, only when the proot sandbox can see it.
 * Also maps the SAF trees the sandbox understands.
 * @param {string} uri file or SAF uri
 * @returns {string|null} absolute path inside the sandbox, or null
 */
export function sandboxPathOf(uri) {
	const url = String(uri || "");

	// XCoder public provider — always reachable, mounted at /public
	if (url.startsWith(XCODER_SAF)) {
		const rest = url.slice(XCODER_SAF.length);
		// docId is everything after the first '::' (tree roots may contain
		// further '::' inside percent-encoded segments)
		const docId = safeDecode(
			rest.includes("::") ? rest.slice(rest.indexOf("::") + 2) : rest,
		);
		if (/^(document|tree)/.test(docId)) {
			// "document/<encoded id>" or "tree/<root>" leftovers
			const stripped = docId.replace(/^(document|tree)\//, "");
			if (!stripped) return "/public";
			return xcoderDocToPublic(safeDecode(stripped));
		}
		return xcoderDocToPublic(docId);
	}

	// Android external storage SAF — "primary:Sub/Dir" is /storage/emulated/0
	if (url.startsWith(EXTERNAL_SAF)) {
		const rest = safeDecode(url.slice(EXTERNAL_SAF.length)).replace(
			/^(document|tree)\//,
			"",
		);
		const docId = rest.split("::").pop() || "";
		if (docId.startsWith("primary:")) {
			const relative = docId.slice("primary:".length).replace(/^\/+/, "");
			return relative
				? `/storage/emulated/0/${relative}`
				: "/storage/emulated/0";
		}
		return null;
	}

	if (!url.startsWith("file://")) return null;
	// file:///storage/x → /storage/x (file://host/path would keep the host)
	let path;
	try {
		path = decodeURIComponent(new URL(url).pathname);
	} catch {
		path = decodeURIComponent(url.replace(/^file:\/\//, ""));
	}
	if (!path.startsWith("/")) return null;

	const { alpineRoot, publicDir } = terminalRoots();
	// App-owned trees map to their in-shell mounts
	if (path === publicDir || path.startsWith(`${publicDir}/`)) {
		return path.replace(publicDir, "/public");
	}
	if (path === alpineRoot || path.startsWith(`${alpineRoot}/`)) {
		return path.slice(alpineRoot.length) || "/";
	}
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

/** Strips trailing slashes (keeps the root "/"). */
function normalizeDir(path) {
	return String(path).replace(/\/+$/, "") || "/";
}

/**
 * Directory the terminal should open in for one uri: the mapped folder
 * itself for SAF tree roots, the parent dir for files.
 * @param {string} uri file or folder uri
 * @returns {string|null}
 */
function cdTargetOf(uri) {
	const isTreeRoot = String(uri).includes("/tree/");
	const path = sandboxPathOf(uri);
	if (!path) return null;
	if (isTreeRoot) return normalizeDir(path);
	const dir = Url.dirname(`file://${path}`)
		.replace(/^file:\/\//, "")
		.replace(/\/+$/, "");
	if (!dir || dir === "/" || dir === ".") return null;
	return dir;
}

/**
 * Directory to open the terminal in: from the active file first, then
 * from the open project folders ("abrir no projeto ativo" even when no
 * file tab is focused).
 * @param {object|null} activeFile editorManager.activeFile ({uri})
 * @param {string[]} [folderUrls] addedFolder urls (open project roots)
 * @returns {string|null} shell command "cd <dir>" or null when unknown
 */
export function activeProjectCd(activeFile, folderUrls = []) {
	const candidates = [activeFile?.uri, ...folderUrls].filter(Boolean);
	for (const uri of candidates) {
		const target = cdTargetOf(uri);
		if (target) return `cd ${shellQuote(target)}`;
	}
	return null;
}

export default {
	sandboxPathOf,
	shellQuote,
	activeProjectCd,
};
