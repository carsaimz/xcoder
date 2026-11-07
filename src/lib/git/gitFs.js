/**
 * isomorphic-git fs adapter on top of the app's fsOperation abstraction.
 *
 * isomorphic-git speaks the Node `fs.promises` API and POSIX paths. The
 * app talks to Cordova (internal/external storage), FTP, SFTP and http
 * URLs through `fsOperation`. This adapter presents a VIRTUAL POSIX
 * root ("/") bound to the workspace url and maps every path onto the
 * real fsOperation url — a real `.git` directory then lives inside the
 * opened project folder, the same repo the desktop build sees on disk
 * and the AI terminal commands operate on.
 *
 * Why virtual: isomorphic-git path-normalises every fs path
 * (`file:///a` would collapse to `file:/a`), so real URLs must never
 * cross the fs boundary — only POSIX paths do.
 *
 * Supported subset (everything isomorphic-git core needs):
 *   readFile, writeFile, unlink, readdir, mkdir, rmdir, stat, lstat,
 *   readlink (always ENOTSUP), symlink (always ENOTSUP).
 */
import fsOperation from "fileSystem";
import Url from "utils/Url";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Errors surfaced as Node-style codes so isomorphic-git's fallbacks
 * (ENOENT short-circuits, EEXIST skips…) behave like on real disk.
 */
export class FsError extends Error {
	/**
	 * @param {string} code Node-style code (ENOENT, EEXIST…)
	 * @param {string} path affected path
	 */
	constructor(code, path) {
		super(`${code}: ${path}`);
		this.code = code;
		this.path = path;
	}
}

/**
 * Normalises a virtual POSIX path: absolute ("/src/a.js"), relative
 * ("src/a.js") and Windows-ish separators all become "src/a.js".
 * @param {string} path
 * @returns {string} path segments joined by "/"
 */
function relPath(path) {
	return String(path || "")
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
		.replace(/\/+$/, "");
}

/**
 * Maps a virtual path onto the workspace url.
 * @param {string} root workspace url
 * @param {string} path virtual POSIX path
 * @returns {string} real fsOperation url
 */
function toUrl(root, path) {
	const rel = relPath(path);
	if (/^[a-z]+:\/\//i.test(path)) return path; // already a real url
	if (!rel) return root;
	return Url.join(root, rel);
}

/**
 * Node-like stat object from a fsOperation stat. isomorphic-git reads
 * mtimeMs AND ctime(-Ms) — missing ctime crashes its normalizeStats.
 * @param {object} raw fsOperation stat result
 */
function toStat(raw) {
	const isDirectory = Boolean(raw?.isDirectory);
	const modified = Number(raw?.modifiedDate) || Date.now();
	const mtimeMs = modified < 10 ** 12 ? modified * 1000 : modified;
	const date = new Date(mtimeMs);
	return {
		isFile: () => !isDirectory,
		isDirectory: () => isDirectory,
		isSymbolicLink: () => false,
		size: Number(raw?.size) || 0,
		mtimeMs,
		mtime: date,
		ctimeMs: mtimeMs,
		ctime: date,
		mode: isDirectory ? 0o040755 : 0o100644,
		uid: 0,
		gid: 0,
		ino: 0,
	};
}

/**
 * Creates an isomorphic-git-compatible fs bound to one workspace root.
 * @param {string} root workspace root url (fsOperation url)
 * @returns {object} fs with a `promises` namespace; all paths are
 *   virtual POSIX paths relative to the workspace root
 */
export function createGitFs(root) {
	/**
	 * @param {string} path virtual path
	 */
	const urlOf = (path) => toUrl(root, path);

	const api = {
		/**
		 * @param {string} path
		 * @param {{encoding?: string}} [opts]
		 */
		async readFile(path, opts = {}) {
			const fs = fsOperation(urlOf(path));
			if (!(await fs.exists())) {
				throw new FsError("ENOENT", String(path));
			}
			const data = await fs.readFile();
			const encoding = opts.encoding || (opts || {}).encoding;
			if (encoding === "utf8" || encoding === "utf-8") {
				return typeof data === "string" ? data : decoder.decode(data);
			}
			if (typeof data === "string") return encoder.encode(data);
			return new Uint8Array(data || new ArrayBuffer(0));
		},

		/**
		 * @param {string} path
		 * @param {Uint8Array|string} data
		 */
		async writeFile(path, data) {
			const url = urlOf(path);
			const fs = fsOperation(url);
			const payload =
				typeof data === "string"
					? data
					: new Uint8Array(data || new ArrayBuffer(0));
			if (await fs.exists()) {
				await fs.writeFile(payload);
				return;
			}
			// create missing parents, then the file itself
			const rel = relPath(path);
			const segments = rel.split("/").filter(Boolean);
			const fileName = segments.pop() || "";
			let current = root;
			for (const segment of segments) {
				current = Url.join(current, segment);
				const dir = fsOperation(current);
				if (!(await dir.exists())) {
					await fsOperation(Url.dirname(current)).createDirectory(segment);
				}
			}
			try {
				await fsOperation(Url.dirname(url)).createFile(fileName, payload);
			} catch {
				await fs.writeFile(payload);
			}
		},

		/**
		 * @param {string} path
		 */
		async unlink(path) {
			const fs = fsOperation(urlOf(path));
			if (!(await fs.exists())) throw new FsError("ENOENT", String(path));
			await fs.delete();
		},

		/**
		 * @param {string} path
		 */
		async readdir(path) {
			const fs = fsOperation(urlOf(path));
			if (!(await fs.exists())) throw new FsError("ENOENT", String(path));
			const entries = await fs.lsDir();
			return (Array.isArray(entries) ? entries : [])
				.filter(
					(entry) => entry?.name && entry.name !== "." && entry.name !== "..",
				)
				.map((entry) => entry.name);
		},

		/**
		 * @param {string} path
		 * @param {{recursive?: boolean}} [opts]
		 */
		async mkdir(path, opts = {}) {
			const rel = relPath(path);
			if (!rel) return undefined;
			if (/^[a-z]+:\/\//i.test(path)) {
				// real url — create only the deepest segment
				const fs = fsOperation(path);
				if (await fs.exists()) {
					if (!opts.recursive) throw new FsError("EEXIST", String(path));
					return undefined;
				}
				await fsOperation(Url.dirname(path)).createDirectory(
					Url.basename(path),
				);
				return undefined;
			}
			const segments = rel.split("/").filter(Boolean);
			let current = root;
			for (const segment of segments) {
				current = Url.join(current, segment);
				const fs = fsOperation(current);
				if (await fs.exists()) continue;
				await fsOperation(Url.dirname(current)).createDirectory(segment);
			}
			return undefined;
		},

		/**
		 * @param {string} path
		 * @param {{recursive?: boolean}} [opts]
		 */
		async rmdir(path, opts = {}) {
			const fs = fsOperation(urlOf(path));
			if (!(await fs.exists())) throw new FsError("ENOENT", String(path));
			if (opts.recursive) {
				await fs.delete();
				return undefined;
			}
			const entries = await fs.lsDir();
			if ((Array.isArray(entries) ? entries : []).length) {
				throw new FsError("ENOTEMPTY", String(path));
			}
			await fs.delete();
			return undefined;
		},

		/**
		 * @param {string} path
		 */
		async stat(path) {
			const fs = fsOperation(urlOf(path));
			if (!(await fs.exists())) throw new FsError("ENOENT", String(path));
			return toStat(await fs.stat());
		},

		/**
		 * @param {string} path
		 */
		async lstat(path) {
			return api.stat(path);
		},

		/**
		 * Cordova/FTP/SFTP workspaces have no symlinks.
		 */
		async readlink() {
			throw new FsError("ENOTSUP", "readlink");
		},

		async symlink() {
			throw new FsError("ENOTSUP", "symlink");
		},
	};

	return { promises: api, ...api };
}
