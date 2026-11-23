/**
 * Plugin package file helpers.
 *
 * XCoder supports both native plugin packages (.xcoder / .xcoder-plugin)
 * and Acode plugin packages (.acode / .acode-plugin) simultaneously.
 * Both families are plain ZIP archives carrying a `plugin.json` manifest
 * at their root — only the file extension differs, so every installer
 * entry point (marketplace, deep links, file browser, share intents)
 * accepts the two side by side.
 */

/** Extensions used by native XCoder plugin packages. */
export const XCODER_PLUGIN_EXTENSIONS = [".xcoder", ".xcoder-plugin"];

/** Extensions used by Acode plugin packages (the compatibility set). */
export const ACODE_PLUGIN_EXTENSIONS = [".acode", ".acode-plugin"];

/** Every extension that marks an installable plugin archive. */
export const PLUGIN_ARCHIVE_EXTENSIONS = [
	...XCODER_PLUGIN_EXTENSIONS,
	...ACODE_PLUGIN_EXTENSIONS,
];

/**
 * Returns the plugin package extension of a file, or null.
 * @param {string} url file url or name
 * @returns {string|null}
 */
export function getPluginExtension(url) {
	const name = String(url || "")
		.toLowerCase()
		.split("?")[0]
		.split("#")[0];
	return PLUGIN_ARCHIVE_EXTENSIONS.find((ext) => name.endsWith(ext)) || null;
}

/**
 * Whether the file is a plugin archive (.xcoder, .acode, ...).
 * @param {string} url file url or name
 * @returns {boolean}
 */
export function isPluginArchiveFile(url) {
	return getPluginExtension(url) !== null;
}

/**
 * Whether the file may hold a plugin package — the named archives plus the
 * generic .zip (whose manifest has to be verified from the zip or from a
 * sibling plugin.json).
 * @param {string} url file url or name
 * @returns {boolean}
 */
export function isPluginPackageFile(url) {
	return (
		isPluginArchiveFile(url) ||
		String(url || "")
			.toLowerCase()
			.split("?")[0]
			.endsWith(".zip")
	);
}

/**
 * Derives a stable plugin id for a manifest.
 *
 * Acode manifests always carry an `id`, but legacy packages and hand-made
 * zips may lack one — in that case the display name or the package file
 * name is slugified into a safe folder id.
 * @param {object} manifest parsed plugin.json
 * @param {string} [sourceUrl] package url (used as a last resort)
 * @returns {string}
 */
export function derivePluginId(manifest, sourceUrl) {
	let candidate = "";
	const raw = manifest?.id ?? manifest?.name;
	if (typeof raw === "string" && raw.trim()) {
		candidate = raw.trim();
	}
	if (!candidate && sourceUrl) {
		const clean = String(sourceUrl).split("?")[0].split("#")[0];
		const base =
			decodeURIComponent(clean.replace(/\/+$/, "").split("/").pop() || "") ||
			"";
		candidate = base.replace(
			/\.(zip|acode|acode-plugin|xcoder|xcoder-plugin)$/i,
			"",
		);
	}
	candidate = String(candidate)
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^\w.-]/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "");
	return candidate || "plugin";
}

/**
 * Normalizes a plugin manifest for installation, whichever family it came
 * from (.xcoder or .acode): guarantees a stable `id` plus the default
 * entry files used by both ecosystems.
 * @param {object} manifest parsed plugin.json
 * @param {string} [sourceUrl] package url
 * @returns {{ manifest: object, id: string }}
 */
export function adaptPluginManifest(manifest, sourceUrl) {
	const adapted = { ...manifest };
	adapted.id = derivePluginId(adapted, sourceUrl);
	if (!adapted.main) adapted.main = "main.js";
	if (!adapted.icon) adapted.icon = "icon.png";
	if (!adapted.readme) adapted.readme = "readme.md";
	return { manifest: adapted, id: adapted.id };
}
