/**
 * Termux-like package manager for the virtual shell.
 *
 * The catalog is local and honest: installing a package either wires up a
 * real new command in the shell (jq, http, nano) or prints guidance for
 * capabilities that need a real environment (python3, gh). State persists
 * in localStorage under "xcoder.pkg".
 */

const PKG_KEY = "xcoder.pkg";

/**
 * Storage adapter (injectable for tests; defaults to localStorage).
 * @type {{getItem: (key: string) => string|null, setItem: (key: string, value: string) => void}|null}
 */
let storage = null;

/**
 * Replaces the storage adapter used to persist installed packages.
 * @param {{getItem: (key: string) => string|null, setItem: (key: string, value: string) => void}} adapter
 */
export function setStorage(adapter) {
	storage = adapter;
}

/**
 * @returns {{getItem: (key: string) => string|null, setItem: (key: string, value: string) => void}|null}
 */
function getStorage() {
	if (storage) return storage;
	return typeof localStorage !== "undefined" ? localStorage : null;
}

/**
 * @typedef {object} PkgEntry
 * @property {string} name
 * @property {string} version
 * @property {string} summary
 * @property {Array<string>} provides shell commands added when installed
 */

/** @type {PkgEntry[]} */
export const CATALOG = [
	{
		name: "jq",
		version: "1.0.0",
		summary: "JSON processor: pretty-print and query files/data",
		provides: ["jq"],
	},
	{
		name: "http",
		version: "1.0.0",
		summary: "HTTPie-style client: http GET|POST <url> [json]",
		provides: ["http"],
	},
	{
		name: "nano",
		version: "1.0.0",
		summary: "Open a file in the XCoder editor (editor-backed)",
		provides: ["nano"],
	},
	{
		name: "gh",
		version: "1.0.0",
		summary: "GitHub CLI guidance + prepared commands (see Git panel)",
		provides: ["gh"],
	},
	{
		name: "python3",
		version: "3.0.0-xcoder",
		summary: "Python runtime — requires proot/termux (not bundled)",
		provides: ["python3"],
	},
];

/**
 * Installed package names (order = install order).
 * @returns {string[]}
 */
export function installed() {
	try {
		const raw = getStorage()?.getItem(PKG_KEY);
		const list = raw ? JSON.parse(raw) : [];
		return Array.isArray(list)
			? list.filter((name) => typeof name === "string")
			: [];
	} catch {
		return [];
	}
}

/**
 * @param {string[]} list
 */
function saveInstalled(list) {
	try {
		getStorage()?.setItem(PKG_KEY, JSON.stringify([...new Set(list)]));
	} catch {
		/* ignore */
	}
}

/**
 * Pure jq-like filter over parsed JSON.
 * Supported: "." (identity), ".key" / ".a.b.c" paths, "keys", "length".
 * @param {any} data parsed JSON value
 * @param {string} query
 * @returns {string} formatted output
 */
export function filterJq(data, query) {
	const q = String(query || ".").trim();

	if (q === "keys") {
		if (Array.isArray(data)) return JSON.stringify(data.map((_, i) => i));
		if (data && typeof data === "object")
			return JSON.stringify(Object.keys(data));
		throw new Error("jq: keys: not an object");
	}
	if (q === "length") {
		if (Array.isArray(data) || typeof data === "string")
			return String(data.length);
		if (data && typeof data === "object")
			return String(Object.keys(data).length);
		throw new Error("jq: length: unsupported type");
	}
	if (q === "." || q === "") return JSON.stringify(data, null, 2);

	if (q.startsWith(".")) {
		let value = data;
		for (const part of q.slice(1).split(".")) {
			if (part === "") continue;
			if (value === null || typeof value !== "object") {
				throw new Error(`jq: cannot index ${typeof value} with "${part}"`);
			}
			value = value[part];
		}
		return JSON.stringify(value, null, 2);
	}

	throw new Error(`jq: unsupported filter "${q}" (use . , .a.b, keys, length)`);
}

/**
 * pkg command handler.
 * @param {string[]} args
 * @param {object} io {exec(commandLine) for nested commands}
 * @returns {Promise<{output: string, error?: boolean}>}
 */
export async function cmdPkg(args, { exec }) {
	const sub = args[0] || "list";
	const names = installed();

	switch (sub) {
		case "list": {
			if (!names.length) {
				return {
					output:
						"no packages installed\n\ncatalog:\n" +
						CATALOG.map(
							(entry) =>
								`  ${entry.name} (${entry.version}) - ${entry.summary}`,
						).join("\n") +
						"\n\nuse 'pkg install <name>'",
				};
			}
			const rows = CATALOG.map((entry) => {
				const mark = names.includes(entry.name) ? "[x]" : "[ ]";
				return `${mark} ${entry.name} (${entry.version}) - ${entry.summary}`;
			});
			return {
				output: `installed: ${names.join(", ") || "(none)"}\n\ncatalog:\n${rows.join("\n")}`,
			};
		}

		case "search": {
			const term = (args[1] || "").toLowerCase();
			const matches = CATALOG.filter(
				(entry) =>
					entry.name.includes(term) ||
					entry.summary.toLowerCase().includes(term),
			);
			if (!matches.length) return { output: `no results for "${term}"` };
			return {
				output: matches
					.map((entry) => `${entry.name}/${entry.version} - ${entry.summary}`)
					.join("\n"),
			};
		}

		case "install": {
			const name = args[1];
			const entry = CATALOG.find((item) => item.name === name);
			if (!entry) {
				return {
					output: `pkg: package '${name}' not found (try 'pkg search')`,
					error: true,
				};
			}
			if (names.includes(name)) {
				return { output: `${name} is already installed` };
			}
			saveInstalled([...names, name]);
			return {
				output: `Installing ${name} (${entry.version})...\nfetching from local catalog... done\n${name} provides: ${entry.provides.join(", ")}\nDone. Type 'help' to see the new commands.`,
			};
		}

		case "uninstall": {
			const name = args[1];
			if (!names.includes(name)) {
				return { output: `pkg: '${name}' is not installed`, error: true };
			}
			saveInstalled(names.filter((item) => item !== name));
			return { output: `removed ${name}` };
		}

		case "update":
			return { output: "local catalog is up to date" };

		default:
			return {
				output:
					"usage: pkg list | pkg search <term> | pkg install <name> | pkg uninstall <name> | pkg update",
			};
	}
}

/**
 * jq command handler (available when the jq package is installed).
 * @param {string[]} args
 * @param {object} io {readText(url), resolvePath(path)}
 * @returns {Promise<{output: string, error?: boolean}>}
 */
export async function cmdJq(args, { readText, resolvePath }) {
	const [query, ...rest] = args;
	let source = rest.join(" ");
	let data;

	if (!query) {
		return { output: "usage: jq '<filter>' <file | json>", error: true };
	}

	if (source) {
		const looksLikeFile =
			/\.(json)$/i.test(source) || !/^[{[]/.test(source.trim());
		if (looksLikeFile) {
			const content = await readText(resolvePath(source));
			if (content == null) {
				return { output: `jq: ${source}: file not found`, error: true };
			}
			source = content;
		}
	} else {
		return { output: "usage: jq '<filter>' <file | json>", error: true };
	}

	try {
		data = JSON.parse(source);
	} catch (error) {
		return { output: `jq: invalid JSON (${error.message})`, error: true };
	}

	try {
		return { output: filterJq(data, query) };
	} catch (error) {
		return { output: error.message, error: true };
	}
}

/**
 * http command handler (available when the http package is installed).
 * @param {string[]} args
 * @returns {Promise<{output: string, error?: boolean}>}
 */
export async function cmdHttp(args) {
	const method = (args[0] || "GET").toUpperCase();
	const url = args[1];
	const body = args.slice(2).join(" ");

	if (!url || !/^https?:\/\//i.test(url)) {
		return {
			output: "usage: http GET|POST <https-url> [json-body]",
			error: true,
		};
	}
	if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) {
		return { output: `http: unsupported method ${method}`, error: true };
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);
	try {
		const response = await fetch(url, {
			method,
			headers: body ? { "Content-Type": "application/json" } : undefined,
			body:
				method === "GET" || method === "HEAD" ? undefined : body || undefined,
			signal: controller.signal,
		});
		const text = await response.text().catch(() => "");
		const head =
			`${method} ${url}\n${response.status} ${response.statusText}\n` +
			[...response.headers.entries()]
				.filter(([key]) =>
					["content-type", "content-length", "date"].includes(key),
				)
				.map(([key, value]) => `${key}: ${value}`)
				.join("\n");
		const bodyText =
			text.length > 4000 ? `${text.slice(0, 4000)}\n... (truncated)` : text;
		return { output: `${head}\n\n${bodyText || "(empty body)"}` };
	} catch (error) {
		const reason =
			error.name === "AbortError" ? "timed out (15s)" : error.message;
		return { output: `http: request failed: ${reason}`, error: true };
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * gh guidance (available when the gh package is installed).
 * @returns {{output: string}}
 */
export function cmdGh() {
	return {
		output: [
			"gh: the GitHub CLI is not bundled, but XCoder prepares the commands for you:",
			"  1. open the Git sidebar app",
			"  2. set the remote URL (globe icon)",
			"  3. tap any prepared command (git push, gh pr create, gh release) to copy it",
			"  4. paste it into Termux or a desktop terminal",
		].join("\n"),
	};
}

/**
 * python3 stub (available when the python3 package is installed).
 * @returns {{output: string, error: boolean}}
 */
export function cmdPython() {
	return {
		output:
			"python3: a real Python runtime is not bundled with XCoder.\nAlternatives that work right now:\n  - run_js in the AI agent (sandboxed JavaScript)\n  - 'node -e' style evaluation through the console\n  - install proot/termux on the device and run python there",
		error: true,
	};
}
