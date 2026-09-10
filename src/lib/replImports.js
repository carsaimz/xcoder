/**
 * REPL workspace imports (roadmap v1.7.x item 3).
 *
 * The JS Console runs snippets inside a sandboxed Web Worker through
 * `new Function(...)` — static `import` declarations cannot be parsed
 * there. This module lets snippets import files from the workspace:
 *
 *   - Relative specifiers (`./x.js`, `../lib/y.mjs`) are resolved against
 *     the active file's folder and inlined as Blob URLs.
 *   - In SNIPPET mode, static imports are rewritten into `await import()`
 *     statements (the snippet already runs inside an async wrapper).
 *   - In MODULE mode (the imported sources themselves), relative
 *     specifiers are rewritten in place, keeping real static imports.
 *   - Resolution is transitive with cycle and size guards.
 *
 * Pure and dependency-free: filesystem access, Blob URL creation and
 * base paths are injected, so unit tests run in Node.
 */

export const MODULE_DEPTH_CAP = 16;
export const MODULE_COUNT_CAP = 64;

const FROM_IMPORT = /\bimport\s+([^;'"]*?)\s+from\s*(["'])([^"'\n]+)\2/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g;
const BARE_IMPORT = /\bimport\s*(["'])([^"'\n]+)\1/g;
const EXPORT_NAMED_FROM =
	/\bexport\s+(?!\*)([^;'"]*?)\s+from\s*(["'])([^"'\n]+)\2/g;
const EXPORT_ALL_FROM = /\bexport\s*\*\s*from\s*(["'])([^"'\n]+)\1/g;

/**
 * Whether a specifier points into the workspace (relative form only).
 * Bare specifiers and absolute/URL forms are left untouched.
 * @param {string} spec
 */
export function isRelativeSpec(spec) {
	return /^(?:\.{1,2}\/)/.test(String(spec || ""));
}

/**
 * Resolves a relative specifier against a base directory (file URI,
 * content URI or plain path). Returns null when it cannot be resolved.
 * @param {string} baseDir directory the snippet is anchored at
 * @param {string} spec import specifier (must be relative)
 */
export function resolveSpec(baseDir, spec) {
	if (!baseDir || !isRelativeSpec(spec)) return null;
	const joined = /\/$/.test(baseDir) ? baseDir + spec : `${baseDir}/${spec}`;
	return normalizePath(joined);
}

/**
 * Collapses "." and ".." segments without touching the scheme part.
 * @param {string} path
 */
export function normalizePath(path) {
	const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]*\/)?([\s\S]*)$/i.exec(path);
	const prefix = match?.[1] || "";
	let rest = match?.[2] ?? path;
	const root = rest.startsWith("/") ? "/" : "";
	rest = root ? rest.slice(1) : rest;
	const out = [];
	for (const segment of rest.split("/")) {
		if (!segment || segment === ".") continue;
		if (segment === "..") {
			if (out.length && out[out.length - 1] !== "..") out.pop();
			continue;
		}
		out.push(segment);
	}
	return `${prefix}${root}${out.join("/")}`;
}

/**
 * Parses an import clause (everything between `import` and `from`).
 * @param {string} clause e.g. "fs", "{a as b}", "* as ns", "def, {a}"
 * @returns {{defaultName: string|null, namespaceName: string|null,
 *   named: {imported: string, local: string}[]}|null}
 */
export function parseImportClause(clause) {
	const text = String(clause ?? "").trim();
	if (!text) return null;
	const result = { defaultName: null, namespaceName: null, named: [] };

	let rest = text;
	const namespaceMatch = /\*\s*as\s+([A-Za-z_$][\w$]*)\s*$/.exec(rest);
	if (namespaceMatch) {
		result.namespaceName = namespaceMatch[1];
		rest = rest.slice(0, namespaceMatch.index).trim().replace(/,\s*$/, "");
	}

	const namedMatch = /\{([\s\S]*?)\}\s*$/.exec(rest);
	if (namedMatch) {
		result.named = namedMatch[1]
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const pair = part.split(/\s+as\s+/);
				return { imported: pair[0], local: pair[1] || pair[0] };
			});
		rest = rest.slice(0, namedMatch.index).trim().replace(/,\s*$/, "");
	}

	if (rest && /^[A-Za-z_$][\w$]*$/.test(rest)) {
		result.defaultName = rest;
	} else if (rest) {
		return null;
	}

	if (!result.defaultName && !result.namespaceName && !result.named.length) {
		return null;
	}
	return result;
}

/**
 * Builds the `await import(...)` statements that replace a static import.
 * @param {ReturnType<typeof parseImportClause>} clause
 * @param {string} url blob URL of the resolved module
 */
export function buildSnippetImport(clause, url) {
	const parts = [];
	if (clause.namespaceName) parts.push(`${clause.namespaceName}`);
	const destructured = [];
	if (clause.defaultName) destructured.push(`default: ${clause.defaultName}`);
	for (const item of clause.named) {
		destructured.push(
			item.imported === item.local
				? item.imported
				: `${item.imported}: ${item.local}`,
		);
	}
	if (destructured.length) {
		parts.push(`{${destructured.join(", ")}}`);
	}
	if (!parts.length) return `await import(${JSON.stringify(url)});`;
	return parts
		.map((part) => `const ${part} = await import(${JSON.stringify(url)});`)
		.join("\n");
}

/**
 * Rewrites a SNIPPET's imports into `await import(url)` statements.
 * Only relative specifiers are rewritten; `resolve(spec)` returns the
 * Blob URL for a relative spec (or null while missing).
 * @param {string} code user snippet
 * @param {(spec: string) => string|null} resolve
 * @returns {{code: string, rewritten: {spec: string, url: string}[]}}
 */
export function rewriteSnippetImports(code, resolve) {
	let source = String(code ?? "");
	const rewritten = [];

	source = source.replace(DYNAMIC_IMPORT, (raw, _quote, spec) => {
		const url = resolve(spec);
		if (!url) return raw;
		rewritten.push({ spec, url });
		return `import(${JSON.stringify(url)})`;
	});

	source = source.replace(FROM_IMPORT, (raw, clause, _quote, spec) => {
		const url = resolve(spec);
		if (!url) return raw;
		const parsed = parseImportClause(clause);
		if (!parsed) return raw;
		rewritten.push({ spec, url });
		return buildSnippetImport(parsed, url);
	});

	source = source.replace(BARE_IMPORT, (raw, _quote, spec) => {
		const url = resolve(spec);
		if (!url) return raw;
		rewritten.push({ spec, url });
		return `await import(${JSON.stringify(url)});`;
	});

	return { code: source, rewritten };
}

/**
 * Rewrites an imported MODULE's specifiers in place (static imports stay
 * static — real ES modules resolve them at runtime). Relative specifiers
 * become the provided Blob URLs.
 * @param {string} code module source
 * @param {(spec: string) => string|null} resolve
 * @returns {{code: string, rewritten: {spec: string, url: string}[]}}
 */
export function rewriteModuleImports(code, resolve) {
	let source = String(code ?? "");
	const rewritten = [];

	const swap = (spec) => {
		const url = resolve(spec);
		if (!url) return null;
		rewritten.push({ spec, url });
		return JSON.stringify(url);
	};

	source = source.replace(DYNAMIC_IMPORT, (raw, _quote, spec) => {
		const url = swap(spec);
		return url ? `import(${url})` : raw;
	});
	source = source.replace(EXPORT_NAMED_FROM, (raw, clause, _quote, spec) => {
		const url = swap(spec);
		return url ? `export ${clause} from ${url}` : raw;
	});
	source = source.replace(EXPORT_ALL_FROM, (raw, _quote, spec) => {
		const url = swap(spec);
		return url ? `export * from ${url}` : raw;
	});
	source = source.replace(FROM_IMPORT, (raw, clause, _quote, spec) => {
		const url = swap(spec);
		return url ? `import ${clause} from ${url}` : raw;
	});
	source = source.replace(BARE_IMPORT, (raw, _quote, spec) => {
		const url = swap(spec);
		return url ? `import ${url};` : raw;
	});

	return { code: source, rewritten };
}

/**
 * Walks the workspace module graph rooted at the snippet and produces
 * the rewritten snippet plus the Blob URLs of every module involved.
 *
 * @param {string} code user snippet
 * @param {object} io injected filesystem/blob services
 * @param {string} [io.baseDir] directory relative specs anchor at
 * @param {(uri: string) => Promise<string>} io.readFile reads module source
 * @param {(source: string) => string} io.createObjectUrl creates a Blob URL
 * @returns {Promise<{code: string, urls: {uri: string, url: string}[],
 *   missing: {spec: string, from: string}[], modules: string[]}>}
 */
export async function resolveSnippetImports(
	code,
	{ baseDir = "", readFile, createObjectUrl },
) {
	const urls = [];
	const missing = [];
	const modules = [];
	const urlByUri = new Map();
	const sources = new Map();
	const visited = new Set();
	const building = new Set();

	const parentOf = (uri) =>
		uri.includes("/") ? uri.slice(0, uri.lastIndexOf("/")) : "";

	/**
	 * Phase 1 — depth-first walk: read every relative module, recording
	 * sources and missing entries (cycle/size guarded).
	 */
	async function walk(uri) {
		if (visited.has(uri)) return;
		visited.add(uri);
		if (visited.size > MODULE_COUNT_CAP) {
			missing.push({
				spec: `module cap ${MODULE_COUNT_CAP} exceeded`,
				from: uri,
			});
			return;
		}

		let source;
		try {
			source = await readFile(uri);
		} catch {
			missing.push({ spec: uri, from: "<snippet>" });
			return;
		}
		sources.set(uri, source);
		modules.push(uri);

		const dir = parentOf(uri);
		for (const entry of collectSpecs(source)) {
			if (!isRelativeSpec(entry.spec)) continue;
			const child = resolveSpec(dir, entry.spec);
			if (!child) {
				missing.push({ spec: entry.spec, from: uri });
				continue;
			}
			if (sources.has(child)) continue;
			await walk(child);
		}
	}

	const preliminary = collectSpecs(code).filter((entry) =>
		isRelativeSpec(entry.spec),
	);
	for (const entry of preliminary) {
		const uri = resolveSpec(baseDir, entry.spec);
		if (!uri) {
			missing.push({ spec: entry.spec, from: "<snippet>" });
			continue;
		}
		await walk(uri);
	}

	/**
	 * Phase 2 — bottom-up Blob URL creation: a module's relative specifiers
	 * are rewritten only after its dependencies have URLs. Import cycles
	 * leave the offending specifier untouched (reported at runtime).
	 */
	function buildUrl(uri) {
		if (urlByUri.has(uri)) return urlByUri.get(uri);
		if (building.has(uri)) return null;
		if (!sources.has(uri)) return null;
		building.add(uri);
		try {
			const dir = parentOf(uri);
			const { code: rewritten } = rewriteModuleImports(
				sources.get(uri),
				(spec) => {
					if (!isRelativeSpec(spec)) return null;
					const child = resolveSpec(dir, spec);
					return child ? buildUrl(child) : null;
				},
			);
			const url = createObjectUrl(rewritten);
			urlByUri.set(uri, url);
			urls.push({ uri, url });
			return url;
		} finally {
			building.delete(uri);
		}
	}

	for (const uri of modules) buildUrl(uri);

	const finalRewrite = rewriteSnippetImports(code, (spec) => {
		if (!isRelativeSpec(spec)) return null;
		const uri = resolveSpec(baseDir, spec);
		return uri ? urlByUri.get(uri) || null : null;
	});

	return {
		code: finalRewrite.code,
		urls,
		missing,
		modules,
	};
}

/**
 * Collects every import specifier present in the code (any import form).
 * Order is not guaranteed; used for the pre-pass module walk.
 * @param {string} code
 * @returns {{spec: string, kind: "static"|"bare"|"dynamic"|"export"}[]}
 */
export function collectSpecs(code) {
	const source = String(code ?? "");
	const specs = [];
	for (const match of source.matchAll(FROM_IMPORT)) {
		specs.push({ spec: match[3], kind: "static" });
	}
	for (const match of source.matchAll(EXPORT_NAMED_FROM)) {
		specs.push({ spec: match[3], kind: "export" });
	}
	for (const match of source.matchAll(EXPORT_ALL_FROM)) {
		specs.push({ spec: match[2], kind: "export" });
	}
	for (const match of source.matchAll(DYNAMIC_IMPORT)) {
		specs.push({ spec: match[2], kind: "dynamic" });
	}
	for (const match of source.matchAll(BARE_IMPORT)) {
		specs.push({ spec: match[2], kind: "bare" });
	}
	return specs;
}
