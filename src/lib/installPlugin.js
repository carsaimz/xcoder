import fsOperation from "fileSystem";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import JSZip from "jszip";
import helpers from "utils/helpers";
import Url from "utils/Url";
import { isVersionGreater } from "utils/version";
import config from "./config";
import InstallState from "./installState";
import { loadPluginWithTimeout } from "./loadPlugins";

/** @type {import("dialogs/loader").Loader} */
let loaderDialog;
/** @type {Array<() => Promise<void>>} */
let depsLoaders;

/**
 * Installs a plugin.
 * @param {string} id
 * @param {string} name
 * @param {string} purchaseToken
 * @param {boolean} isDependency
 */
export default async function installPlugin(
	id,
	name,
	purchaseToken,
	isDependency,
) {
	if (!isDependency) {
		loaderDialog = loader.create(name || "Plugin", strings.installing, {
			timeout: 6000,
		});
		depsLoaders = [];
	}

	let pluginDir;
	let pluginUrl;
	let state;

	try {
		if (!(await fsOperation(PLUGIN_DIR).exists())) {
			await fsOperation(DATA_STORAGE).createDirectory("plugins");
		}
	} catch (error) {
		window.log("error", error);
	}

	if (!/^(https?|file|content):/.test(id)) {
		// XCoder: remote plugin registry was removed (offline-first).
		throw new Error(
			strings["registry unavailable"] ||
				"Remote registry is disabled in XCoder. Install plugins from a URL or a local zip file.",
		);
	}
	pluginUrl = id;

	try {
		if (!isDependency) loaderDialog.show();

		let plugin;
		if (
			pluginUrl.startsWith("file:") ||
			pluginUrl.startsWith("content:")
		) {
			// Use fsOperation for local files
			plugin = await fsOperation(pluginUrl).readFile(
				undefined,
				(loaded, total) => {
					loaderDialog.setMessage(
						`${strings.loading} ${((loaded / total) * 100).toFixed(2)}%`,
					);
				},
			);
		} else {
			// cordova http plugin for others
			plugin = await new Promise((resolve, reject) => {
				cordova.plugin.http.sendRequest(
					pluginUrl,
					{
						method: "GET",
						responseType: "arraybuffer",
					},
					(response) => {
						resolve(response.data);
						loaderDialog.setMessage(`${strings.loading} 100%`);
					},
					(error) => {
						reject(error);
					},
				);
			});
		}

		if (plugin) {
			const zip = new JSZip();
			await zip.loadAsync(plugin);

			if (!zip.files["plugin.json"]) {
				throw new Error(strings["invalid plugin"]);
			}

			/** @type {{ dependencies: string[] }} */
			const pluginJson = JSON.parse(
				await zip.files["plugin.json"].async("text"),
			);

			/** patch main in manifest */
			if (!zip.files[pluginJson.main]) {
				pluginJson.main = "main.js";
			}

			/** patch icon in manifest */
			if (!zip.files[pluginJson.icon]) {
				pluginJson.icon = "icon.png";
			}

			/** patch readme in manifest */
			if (!zip.files[pluginJson.readme]) {
				pluginJson.readme = "readme.md";
			}

			if (!zip.files[pluginJson.main]) {
				throw new Error(strings["invalid plugin"]);
			}

			if (!isDependency && pluginJson.dependencies) {
				const manifests = await resolveDepsManifest(pluginJson.dependencies);

				let titleText;
				if (manifests.length > 1) {
					titleText = "XCoder wants to install the following dependencies:";
				} else {
					titleText = "XCoder wants to install the following dependency:";
				}

				const shouldInstall = await confirm(
					"Installer Notice",
					titleText +
						"<br /><br />" +
						manifests.map((value) => value.name).join(", "),
					true,
				);

				if (shouldInstall) {
					for (const manifest of manifests) {
						const hasError = await resolveDep(manifest);
						if (hasError) throw new Error(strings.failed);
					}
				} else {
					return;
				}
			}

			if (!pluginDir) {
				pluginJson.source = pluginUrl;
				id = pluginJson.id;
				pluginDir = Url.join(PLUGIN_DIR, id);
			}

			state = await InstallState.new(id);

			if (!(await fsOperation(pluginDir).exists())) {
				await fsOperation(PLUGIN_DIR).createDirectory(id);
			}

			// Track unsafe absolute entries to skip
			const ignoredUnsafeEntries = new Set();

			const files = Object.keys(zip.files);
			const limit = 2;

			async function processFile(file) {
				try {
					const entry = zip.files[file];

					let correctFile = file.replace(/\\/g, "/");
					const isDirEntry = entry.dir || correctFile.endsWith("/");

					if (isUnsafeAbsolutePath(file)) {
						ignoredUnsafeEntries.add(file);
						return;
					}

					correctFile = sanitizeZipPath(correctFile, isDirEntry);
					if (!correctFile) return;

					const fileUrl = Url.join(pluginDir, correctFile);

					// Handle directory entries
					if (isDirEntry) {
						await createFileRecursive(pluginDir, correctFile, true);
						return;
					}

					// Ensure parent directory exists
					const lastSlash = correctFile.lastIndexOf("/");
					if (lastSlash !== -1) {
						const parentRel = correctFile.slice(0, lastSlash + 1);
						await createFileRecursive(pluginDir, parentRel, true);
					}

					if (!state.exists(correctFile)) {
						await createFileRecursive(pluginDir, correctFile, false);
					}

					let data = await entry.async("ArrayBuffer");

					if (file === "plugin.json") {
						data = JSON.stringify(pluginJson);
					}

					if (!(await state.isUpdated(correctFile, data))) return;

					await fsOperation(fileUrl).writeFile(data);
				} catch (error) {
					console.error(`Error processing file ${file}:`, error);
				}
			}

			// Process in batches
			for (let i = 0; i < files.length; i += limit) {
				const batch = files.slice(i, i + limit);
				await Promise.allSettled(batch.map(processFile));

				// Allow UI thread to breathe
				await new Promise((r) => setTimeout(r, 0));
			}
			// Emit a non-blocking warning if any unsafe entries were skipped
			if (!isDependency && ignoredUnsafeEntries.size) {
				const sample = Array.from(ignoredUnsafeEntries).slice(0, 3).join(", ");
				loaderDialog.setMessage(
					`Skipped ${ignoredUnsafeEntries.size} unsafe archive entr${
						ignoredUnsafeEntries.size === 1 ? "y" : "ies"
					} (e.g., ${sample})`,
				);
				console.warn(
					"Plugin installer: skipped unsafe absolute paths in archive:",
					Array.from(ignoredUnsafeEntries),
				);
			}

			if (isDependency) {
				depsLoaders.push(async () => {
					await loadPluginWithTimeout(id, true);
				});
			} else {
				for (const loader of depsLoaders) {
					await loader();
				}
				await loadPluginWithTimeout(id, true);
			}

			await state.save();
			deleteRedundantFiles(pluginDir, state);
		}
	} catch (err) {
		try {
			// Clear the install state if installation fails
			if (state) await state.clear();

			// Delete the plugin directory if it was created
			if (pluginDir && (await fsOperation(pluginDir).exists())) {
				await fsOperation(pluginDir).delete();
			}
		} catch (cleanupError) {
			console.error("Cleanup failed:", cleanupError);
		}
		throw err;
	} finally {
		if (!isDependency) {
			loaderDialog.destroy();
		}
	}
}

/**
 * Create directory recursively
 * @param {string} parent
 * @param {Array<string> | string} dir
 */
async function createFileRecursive(parent, dir, shouldBeDirAtEnd) {
	let wantDirEnd = !!shouldBeDirAtEnd;
	/** @type {string[]} */
	let parts;
	if (typeof dir === "string") {
		if (dir.endsWith("/")) wantDirEnd = true;
		dir = dir.replace(/\\/g, "/");
		parts = dir.split("/");
	} else {
		parts = dir;
	}
	parts = parts.filter((d) => d);
	const cd = parts.shift();
	if (!cd) return;
	const newParent = Url.join(parent, cd);

	const isLast = parts.length === 0;
	const needDir = !isLast || wantDirEnd;
	if (!(await fsOperation(newParent).exists())) {
		if (needDir) {
			try {
				await fsOperation(parent).createDirectory(cd);
			} catch (e) {
				// If another concurrent task created it, consider it fine
				if (!(await fsOperation(newParent).exists())) throw e;
			}
		} else {
			try {
				await fsOperation(parent).createFile(cd);
			} catch (e) {
				if (!(await fsOperation(newParent).exists())) throw e;
			}
		}
	}
	if (parts.length) {
		await createFileRecursive(newParent, parts, wantDirEnd);
	}
}

/**
 * Sanitize zip entry path to ensure it's relative and safe under pluginDir
 * - Normalizes separators to '/'
 * - Strips leading slashes and Windows drive prefixes (e.g., C:/)
 * - Resolves '.' and '..' segments
 * - Preserves trailing slash for directory entries
 * @param {string} p
 * @param {boolean} isDir
 * @returns {string} sanitized relative path
 */
function sanitizeZipPath(p, isDir) {
	if (!p) return "";
	let path = String(p);
	// Normalize separators
	path = path.replace(/\\/g, "/");
	// Remove URL-like scheme if present accidentally
	path = path.replace(/^[a-zA-Z]+:\/\//, "");
	// Strip leading slashes
	path = path.replace(/^\/+/, "");
	// Strip Windows drive letter, e.g., C:/
	path = path.replace(/^[A-Za-z]:\//, "");

	const parts = path.split("/");
	const stack = [];
	for (const part of parts) {
		if (!part || part === ".") continue;
		if (part === "..") {
			if (stack.length) stack.pop();
			continue;
		}
		stack.push(part);
	}
	let safe = stack.join("/");
	if (isDir && safe && !safe.endsWith("/")) safe += "/";
	return safe;
}

/**
 * Detects unsafe absolute paths in zip entries that should be ignored.
 * Treats leading '/' as absolute, Windows drive roots like 'C:/' as absolute,
 * and common Android/Linux device roots like '/data', '/root', '/system'.
 * @param {string} p
 */
function isUnsafeAbsolutePath(p) {
	if (!p) return false;
	const s = String(p);
	if (/^[A-Za-z]:[\\\/]/.test(s)) return true; // Windows drive root
	if (s.startsWith("//")) return true; // network path
	if (s.startsWith("/")) {
		return (
			s.startsWith("/data") ||
			s.startsWith("/system") ||
			s.startsWith("/vendor") ||
			s.startsWith("/storage") ||
			s.startsWith("/sdcard") ||
			s.startsWith("/root") ||
			true // any leading slash is unsafe
		);
	}
	return false;
}

/**
 * Resolves Dependencies Manifest with given sources.
 * XCoder: only direct URL/file dependencies are supported (registry offline).
 * @param {string[]} deps dependencies
 */
async function resolveDepsManifest(deps) {
	const resolved = [];
	for (const dependency of deps) {
		if (!/^(https?|file|content):/.test(dependency)) {
			throw new Error(
				`Unknown plugin dependency: ${dependency} (registry offline)`,
			);
		}
		resolved.push({
			id: dependency,
			name: dependency,
			url: dependency,
			source: dependency,
		});
	}
	return resolved;
}

/**
 * Resolve dependency
 * @param {object} manifest
 * @returns {Promise<boolean>} has error
 */
async function resolveDep(manifest) {
	loaderDialog.setMessage(
		`${strings.installing.replace("...", "")} ${manifest.name || manifest.id}...`,
	);
	await installPlugin(
		manifest.url || manifest.source || manifest.id,
		manifest.name,
		undefined,
		true,
	);
	return false;
}

/**
 *
 * @param {string} dir
 * @param {Array<string>} files
 */
async function listFileRecursive(dir, files) {
	for (const child of await fsOperation(dir).lsDir()) {
		const fileUrl = Url.join(dir, child.name);
		if (child.isDirectory) {
			await listFileRecursive(fileUrl, files);
		} else {
			files.push(fileUrl);
		}
	}
}

/**
 *
 * @param {Record<string, boolean>} files
 */
async function deleteRedundantFiles(pluginDir, state) {
	/** @type {string[]} */
	let files = [];
	await listFileRecursive(pluginDir, files);

	for (const file of files) {
		if (!state.exists(file.replace(`${pluginDir}/`, ""))) {
			fsOperation(file).delete();
		}
	}
}
