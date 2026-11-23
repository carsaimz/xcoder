import { quoteArg } from "cm/lsp/installRuntime";

/**
 * LSP server size statistics — "quanto pesa um servidor?".
 *
 * Two complementary numbers per server:
 *
 *  - estimateDownloadSize(server): BEFORE installing — asks the public
 *    package registries (npm registry, PyPI JSON API, crates.io download
 *    endpoint) for the package size of each pinned dependency. Network
 *    calls ride the native http plugin (no CORS) with a fetch fallback.
 *
 *  - measureInstalledSize(server): AFTER installing — runs a tiny `du -sk`
 *    script in the app runtime shell (axs/proot Alpine) over the paths each
 *    installer kind actually writes to (npm global prefix, pip site-packages,
 *    apk installed size from the apk database, release binaries).
 *
 * Results are cached in memory for the session; the manager page exposes a
 * refresh action that clears the cache.
 */

const REGISTRY_TIMEOUT = 20000;

/** @type {Map<string, Promise<{bytes: number, packages: number}|null>>} */
const estimateCache = new Map();
/** @type {Map<string, Promise<number|null>>} installed size cache (bytes) */
const installedCache = new Map();

/**
 * Formats a byte count the way the app shows file sizes ("43 KB", "2.1 MB").
 * @param {number|null|undefined} bytes
 * @returns {string|null} null when the value is unknown
 */
export function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return null;
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Strips version/extras decorations from an installer package spec and
 * returns the registry package name.
 *
 *   "ty"                              -> "ty"
 *   "python-lsp-server[all]"          -> "python-lsp-server"
 *   "@vtsls/language-server"          -> "@vtsls/language-server"
 *   "@typescript/native@npm:typescript@^7.0.2" -> "typescript"
 *   "typescript@5.4"                  -> "typescript"
 *
 * @param {string} spec
 * @param {"npm"|"pip"|"cargo"} kind
 * @returns {string|null}
 */
export function parsePackageSpec(spec, kind) {
	let name = String(spec || "").trim();
	if (!name) return null;

	// npm alias spec: "<alias>@npm:<real>@<range>" — the real package wins
	const aliasMatch = name.match(/@npm:([^@]+)@/);
	if (aliasMatch) {
		return aliasMatch[1] || null;
	}

	if (kind === "pip") {
		// extras + pinned versions: name[extra]>=1.2
		name = name.replace(/\[.*\]/, "").split(/[=<>!~;\s]/)[0];
		return name || null;
	}

	// scoped npm package: @scope/name or @scope/name@version
	if (name.startsWith("@")) {
		const parts = name.split("/");
		if (parts.length >= 2) {
			return `${parts[0]}/${parts[1].split("@")[0]}` || null;
		}
		return name;
	}

	// plain name@version
	return name.split("@")[0] || null;
}

/**
 * CORS-free GET that parses a JSON body (native http plugin first).
 * @param {string} url
 * @param {Record<string, string>} [headers]
 * @returns {Promise<any|null>}
 */
async function fetchJson(url, headers = {}) {
	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return new Promise((resolve) => {
			cordova.plugin.http.sendRequest(
				url,
				{
					method: "GET",
					headers,
					serializer: "utf8",
					responseType: "text",
					timeout: REGISTRY_TIMEOUT,
				},
				(response) => {
					const data = response?.data;
					if (typeof data !== "string") {
						resolve(data ?? null);
						return;
					}
					try {
						resolve(JSON.parse(data));
					} catch {
						resolve(null);
					}
				},
				() => resolve(null),
			);
		});
	}
	try {
		const response = await fetch(url, { headers });
		if (!response.ok) return null;
		return await response.json();
	} catch {
		return null;
	}
}

/**
 * HEAD request returning Content-Length (crates.io .crate download size).
 * @param {string} url
 * @returns {Promise<number|null>}
 */
async function fetchContentLength(url) {
	if (typeof cordova !== "undefined" && cordova.plugin?.http?.sendRequest) {
		return new Promise((resolve) => {
			cordova.plugin.http.sendRequest(
				url,
				{
					method: "HEAD",
					serializer: "utf8",
					responseType: "text",
					timeout: REGISTRY_TIMEOUT,
				},
				(response) => {
					const headers = response?.headers || {};
					const raw = headers["content-length"] ?? headers["Content-Length"];
					const size = Number(raw);
					resolve(Number.isFinite(size) ? size : null);
				},
				() => resolve(null),
			);
		});
	}
	try {
		const response = await fetch(url, { method: "HEAD" });
		const size = Number(response.headers.get("content-length"));
		return Number.isFinite(size) ? size : null;
	} catch {
		return null;
	}
}

/**
 * Registry size for ONE package (uncompressed where the registry provides
 * it — npm `dist.unpackedSize`, PyPI wheel `size`; crates.io reports the
 * compressed .crate download because that is all it exposes).
 * @param {"npm"|"pip"|"cargo"} kind
 * @param {string} pkgName
 * @returns {Promise<number|null>} bytes or null
 */
export async function fetchPackageSize(kind, pkgName) {
	try {
		if (kind === "npm") {
			const data = await fetchJson(
				`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`,
				{ Accept: "application/vnd.npm.install-v1+json" },
			);
			const size = Number(data?.dist?.unpackedSize);
			return Number.isFinite(size) ? size : null;
		}
		if (kind === "pip") {
			const data = await fetchJson(
				`https://pypi.org/pypi/${encodeURIComponent(pkgName)}/json`,
				{ Accept: "application/json" },
			);
			const urls = Array.isArray(data?.urls) ? data.urls : [];
			const wheel = urls.find((u) => u?.packagetype === "bdist_wheel");
			const sdist = urls.find((u) => u?.packagetype === "sdist");
			const size = Number(wheel?.size ?? sdist?.size);
			return Number.isFinite(size) ? size : null;
		}
		if (kind === "cargo") {
			const crate = await fetchJson(
				`https://crates.io/api/v1/crates/${encodeURIComponent(pkgName)}`,
				{ Accept: "application/json", "User-Agent": "XCoder (xcoder app)" },
			);
			const version =
				crate?.crate?.max_stable_version || crate?.crate?.max_version;
			if (!version) return null;
			return await fetchContentLength(
				`https://crates.io/api/v1/crates/${encodeURIComponent(pkgName)}/${encodeURIComponent(version)}/download`,
			);
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Registry download estimate for a whole server (sum over its packages).
 * @param {import("cm/lsp/types").LspServerDefinition} server
 * @returns {Promise<{bytes: number, packages: number}|null>}
 */
export async function estimateDownloadSize(server) {
	const install = server?.launcher?.install;
	if (!install) return null;
	const kind = install.kind || install.source;
	if (kind !== "npm" && kind !== "pip" && kind !== "cargo") return null;
	const packages = Array.isArray(install.packages) ? install.packages : [];
	if (!packages.length) return null;

	const cacheKey = `${kind}:${packages.join("|")}`;
	if (estimateCache.has(cacheKey)) {
		return estimateCache.get(cacheKey);
	}

	const promise = (async () => {
		const names = packages
			.map((spec) => parsePackageSpec(spec, kind))
			.filter(Boolean);
		const results = await Promise.all(
			names.map((name) => fetchPackageSize(kind, name)),
		);
		let bytes = 0;
		let counted = 0;
		for (const size of results) {
			if (Number.isFinite(size) && size > 0) {
				bytes += size;
				counted += 1;
			}
		}
		return counted ? { bytes, packages: counted } : null;
	})();

	estimateCache.set(cacheKey, promise);
	try {
		return await promise;
	} catch {
		estimateCache.delete(cacheKey);
		return null;
	}
}

/**
 * Shell helper — runs through the same wrapped `sh -lc` path the runtime
 * uses (quoteArg escapes embedded quotes safely), but never throws.
 * @param {string} script
 * @returns {Promise<string>} command output ("" when unavailable)
 */
async function shellOutput(script) {
	const executor =
		/** @type {{BackgroundExecutor?: {execute(cmd: string, flag?: boolean): Promise<string>}, execute(cmd: string, flag?: boolean): Promise<string>}|undefined} */ (
			/** @type {any} */ (globalThis).Executor
		);
	if (!executor) return "";
	const run = executor.BackgroundExecutor ?? executor;
	try {
		const out = await run.execute(
			`sh -lc ${quoteArg(`set +e\n${script}`)}`,
			true,
		);
		return String(out ?? "").trim();
	} catch {
		return "";
	}
}

/** Shell awk snippet summing a `du -sk` output column. */
const AWK_SUM = "awk '{s+=$1} END{print s+0}'";

/** Parses `du -sk` awk output (KB) into bytes. @param {string} out */
function kbOut(out) {
	const kb = Number(String(out).trim());
	if (!Number.isFinite(kb) || kb <= 0) return null;
	return kb * 1024;
}

/**
 * Parses `apk info -s` size output: either a plain byte count
 * ("293674624") or a human value ("290.5 MiB").
 * @param {string} out
 * @returns {number|null}
 */
function parseApkSize(out) {
	const text = String(out).trim();
	if (!text) return null;
	const numeric = Number(text);
	if (Number.isFinite(numeric) && numeric > 0) return numeric;
	const units = {
		KiB: 1024,
		MiB: 1024 ** 2,
		GiB: 1024 ** 3,
		KB: 1000,
		MB: 1000 ** 2,
		GB: 1000 ** 3,
	};
	const match = text.match(/([\d.]+)\s*(KiB|MiB|GiB|KB|MB|GB)?/);
	if (!match) return null;
	const value = Number(match[1]);
	const factor = units[match[2]] || 1;
	if (!Number.isFinite(value) || value <= 0) return null;
	return value * factor;
}

/**
 * Installed size (after install) for a server, measured in the runtime
 * shell with `du -sk` over the installer's real target paths.
 * @param {import("cm/lsp/types").LspServerDefinition} server
 * @returns {Promise<number|null>} bytes or null
 */
export async function measureInstalledSize(server) {
	const install = server?.launcher?.install;
	const id = server?.id;
	if (!install || !id) return null;

	if (installedCache.has(id)) return installedCache.get(id);

	const promise = (async () => {
		const kind = install.kind || install.source;
		const packages = Array.isArray(install.packages) ? install.packages : [];
		const names = packages
			.map((spec) => parsePackageSpec(spec, kind))
			.filter(Boolean);
		const executable = String(install.executable || "").trim();
		const binaryPath = String(install.binaryPath || "").trim();
		const py =
			"(command -v python3 >/dev/null 2>&1 && echo python3 || echo python)";

		if (kind === "npm" && names.length) {
			// npm root -g already points at .../node_modules
			const out = await shellOutput(
				`for p in ${names.join(" ")}; do du -sk "$(npm root -g 2>/dev/null)/$p" 2>/dev/null; done | ${AWK_SUM}`,
			);
			return kbOut(out);
		}

		if (kind === "pip" && names.length) {
			// pip show Location + both dash/underscore dist variants via globs
			const lines = names.map(
				(name) =>
					`L=$(${py} -m pip show ${quoteArg(name)} 2>/dev/null | awk '/^Location:/{print $2}')\n` +
					`[ -n "$L" ] && du -sk "$L"/${quoteArg(name)}* "$L"/$(echo ${quoteArg(name)} | tr - _)* 2>/dev/null`,
			);
			const out = await shellOutput(`${lines.join("\n")}\n: | ${AWK_SUM}`);
			return kbOut(out);
		}

		if (kind === "github-release" && binaryPath) {
			const out = await shellOutput(
				`du -sk ${quoteArg(binaryPath)} 2>/dev/null | ${AWK_SUM}`,
			);
			return kbOut(out);
		}

		if (kind === "apk" || kind === "shell" || kind === "manual") {
			// apk: installed size straight from the apk database
			if (kind === "apk" && names.length) {
				const out = await shellOutput(
					`apk info -s ${names.map((n) => quoteArg(n)).join(" ")} 2>/dev/null | awk '/Size:/{print $2}' | tail -n 1`,
				);
				const size = parseApkSize(out);
				if (size) return size;
			}
			// fall back to the binary itself when known
			if (executable && !executable.includes("/")) {
				const out = await shellOutput(
					`du -sk "$(command -v ${executable} 2>/dev/null)" 2>/dev/null | ${AWK_SUM}`,
				);
				const size = kbOut(out);
				if (size) return size;
			}
			if (binaryPath) {
				const out = await shellOutput(
					`du -sk ${quoteArg(binaryPath)} 2>/dev/null | ${AWK_SUM}`,
				);
				return kbOut(out);
			}
		}

		return null;
	})();

	installedCache.set(id, promise);
	try {
		return await promise;
	} catch {
		installedCache.delete(id);
		return null;
	}
}

/** Clears the size caches (manager refresh action). */
export function clearSizeCaches() {
	estimateCache.clear();
	installedCache.clear();
}

/**
 * Pure helper — filters/sorts a server list for the manager page.
 * @param {Array<{label: string, languages: string[], installed: boolean|null, estimate: number|null, installedBytes: number|null}>} rows
 * @param {{query?: string, filter?: "all"|"installed"|"missing", language?: string|null, sortBy?: "name"|"language"|"status"|"size"}} options
 * @returns {typeof rows}
 */
export function applyServerFilters(rows, options = {}) {
	const {
		query = "",
		filter = "all",
		language = null,
		sortBy = "name",
	} = options;
	let result = rows.slice();

	const needle = query.trim().toLowerCase();
	if (needle) {
		result = result.filter(
			(row) =>
				row.label.toLowerCase().includes(needle) ||
				row.languages.join(" ").toLowerCase().includes(needle),
		);
	}
	if (filter === "installed") {
		result = result.filter((row) => row.installed === true);
	}
	if (filter === "missing") {
		result = result.filter((row) => row.installed === false);
	}
	if (language) {
		result = result.filter((row) => row.languages.includes(language));
	}

	const collator = new Intl.Collator(undefined, {
		sensitivity: "base",
		numeric: true,
	});
	const size = (row) => row.installedBytes ?? row.estimate ?? -1;
	result.sort((a, b) => {
		if (sortBy === "status") {
			if ((a.installed === true) !== (b.installed === true)) {
				return a.installed === true ? -1 : 1;
			}
			return collator.compare(a.label, b.label);
		}
		if (sortBy === "language") {
			const la = a.languages[0] || "zzz";
			const lb = b.languages[0] || "zzz";
			return collator.compare(la, lb) || collator.compare(a.label, b.label);
		}
		if (sortBy === "size") {
			return size(b) - size(a) || collator.compare(a.label, b.label);
		}
		return collator.compare(a.label, b.label);
	});
	return result;
}

/**
 * Collects the distinct language ids across servers (for the filter menu).
 * @param {Array<{languages: string[]}>} rows
 * @returns {string[]}
 */
export function collectLanguages(rows) {
	const set = new Set();
	for (const row of rows) for (const lang of row.languages || []) set.add(lang);
	return Array.from(set).sort(
		new Intl.Collator(undefined, { sensitivity: "base" }).compare,
	);
}
