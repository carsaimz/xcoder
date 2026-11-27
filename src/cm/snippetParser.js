/**
 * Pure logic of the VS Code user-snippets format — no UI or storage
 * dependencies (tested directly in tests/unit/snippets.test.js).
 *
 * Supported schema (both <language>.json and <name>.code-snippets):
 *
 *   {
 *     "For Loop": { prefix: "for", body: ["...", "$0"], description: "..." },
 *     ...
 *   }
 *
 * A .code-snippets file may carry a top-level "scope": "javascript,html"
 * that limits the languages it applies to. Tabstops $1/$2/$0,
 * placeholders ${1:default} and choices ${1|a,b|} are understood
 * natively by CodeMirror's snippetCompletion.
 */

/** Extra aliases beyond @codemirror/language-data, keyed by mode name. */
export const ALIASES = {
	javascript: ["js", "jsx", "mjs", "cjs"],
	typescript: ["ts", "tsx"],
	html: ["htm", "xhtml"],
	python: ["py"],
	markdown: ["md"],
	shellscript: ["sh", "bash", "zsh"],
	yaml: ["yml"],
	plaintext: ["txt", "text"],
	cpp: ["c++", "cc"],
	csharp: ["cs"],
};

/**
 * Parse one VS Code snippet file.
 * @param {string} text raw JSON
 * @param {string} fileName e.g. "javascript.json" or "my.code-snippets"
 * @returns {{name: string, prefixes: string[], body: string, description: string, languages: string[]|null}[]} snippets
 */
export function parseSnippetFile(text, fileName) {
	let data;
	try {
		data = JSON.parse(String(text ?? ""));
	} catch {
		return [];
	}
	if (!data || typeof data !== "object" || Array.isArray(data)) return [];

	const isScopedFile = /\.code-snippets$/i.test(String(fileName || ""));
	let scope = null;
	if (isScopedFile && typeof data.scope === "string") {
		scope = data.scope
			.split(",")
			.map((lang) => lang.trim().toLowerCase())
			.filter(Boolean);
	}

	const snippets = [];
	for (const [name, value] of Object.entries(data)) {
		if (isScopedFile && name === "scope") continue;
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;
		const rawPrefix = Array.isArray(value.prefix)
			? value.prefix
			: [value.prefix];
		const prefixes = rawPrefix
			.filter((p) => typeof p === "string" && p.trim())
			.map((p) => p.trim());
		if (!prefixes.length) continue;
		const body = Array.isArray(value.body)
			? value.body.join("\n")
			: typeof value.body === "string"
				? value.body
				: "";
		if (!body) continue;
		snippets.push({
			name: String(name),
			prefixes,
			body,
			description: String(value.description || ""),
			languages: scope,
		});
	}
	return snippets;
}

/**
 * Whether a snippet (or file base name) applies to the given editor mode.
 * @param {string} mode active file mode, e.g. "javascript"
 * @param {string} id file base name or scoped language id
 */
export function matchLanguage(mode, id) {
	const m = String(mode || "").toLowerCase();
	const i = String(id || "").toLowerCase();
	if (!m || !i) return false;
	if (m === i) return true;
	return (ALIASES[m] || []).includes(i) || (ALIASES[i] || []).includes(m);
}
