import fsOperation from "fileSystem";
import Url from "utils/Url";
import { addedFolder } from "lib/openFolder";

/**
 * XCoder virtual shell — a small, safe command surface the AI agent can use.
 *
 * Runs entirely inside the app sandbox using fsOperation (no native exec).
 * Includes a minimal local VCS ("vcs") that stores text snapshots so the
 * agent can restore files it changed.
 */

let cwd = "";

/**
 * Current working directory (absolute app FS url).
 * @returns {string}
 */
export function getRoot() {
	if (cwd) return cwd;
	const folder = addedFolder[0]?.url;
	if (folder) {
		cwd = folder;
		return cwd;
	}
	if (typeof editorManager !== "undefined" && editorManager.activeFile?.uri) {
		const dir = Url.dirname(editorManager.activeFile.uri);
		if (dir) {
			cwd = dir;
			return cwd;
		}
	}
	cwd = typeof DATA_STORAGE !== "undefined" ? DATA_STORAGE : "file:///";
	return cwd;
}

export function getCwd() {
	return getRoot();
}

/**
 * @param {string} url absolute url
 */
export function setCwd(url) {
	cwd = url;
}

/**
 * Resolves a (possibly relative) path against the cwd.
 * @param {string} p
 * @returns {string} absolute url
 */
export function resolvePath(p) {
	if (!p || p === ".") return getCwd();
	if (/^(content:|file:|https?:)/.test(p)) return p;
	if (p.startsWith("~/")) {
		p = p.slice(2);
		return Url.join(DATA_STORAGE, p);
	}
	if (p.startsWith("/")) {
		// absolute POSIX path: treat as relative to the root folder
		return Url.join(getRoot(), p);
	}
	return Url.join(getCwd(), p);
}

/**
 * @param {string} url
 */
function nameOf(url) {
	return Url.basename(url);
}

/**
 * Executes a shell command line.
 * @param {string} commandLine
 * @returns {Promise<{output: string, error?: boolean}>}
 */
export async function exec(commandLine) {
	const trimmed = String(commandLine || "").trim();
	if (!trimmed) return { output: "" };

	const [cmd, ...args] = splitArgs(trimmed);

	try {
		switch (cmd) {
			case "pwd":
				return { output: displayPath(getCwd()) };
			case "cd": {
				const target = resolvePath(args[0] || "");
				if (!(await exists(target))) {
					return { output: `cd: ${args[0]}: no such file or directory`, error: true };
				}
				setCwd(target);
				return { output: displayPath(target) };
			}
			case "ls":
				return await cmdLs(args);
			case "cat":
				return await cmdCat(args);
			case "head":
				return await cmdCat(args, 20);
			case "mkdir":
				return await cmdMkdir(args);
			case "touch":
				return await cmdTouch(args);
			case "rm":
				return await cmdRm(args);
			case "cp":
				return await cmdCopy(args, false);
			case "mv":
				return await cmdCopy(args, true);
			case "echo":
				return { output: args.join(" ") };
			case "find":
				return await cmdFind(args);
			case "grep":
				return await cmdGrep(args);
			case "wc": {
				const content = await readText(resolvePath(args[args.length - 1]));
				if (content == null) return { output: "wc: file not found", error: true };
				const lines = content.split("\n").length;
				const words = content.split(/\s+/).filter(Boolean).length;
				return { output: `${lines} ${words} ${content.length}` };
			}
			case "vcs":
				return await cmdVcs(args);
			case "help":
				return {
					output: [
						"available commands:",
						"  pwd, cd, ls, cat, head, echo, wc",
						"  mkdir, touch, rm, cp, mv, find, grep",
						"  vcs init | vcs commit <msg> | vcs log | vcs restore <id> | vcs diff",
					].join("\n"),
				};
			default:
				return { output: `${cmd}: command not found`, error: true };
		}
	} catch (error) {
		return { output: `${cmd}: ${error.message || error}`, error: true };
	}
}

/**
 * Splits a command line honoring simple quotes.
 * @param {string} line
 */
function splitArgs(line) {
	const matches = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
	return matches.map((part) => part.replace(/^["']|["']$/g, ""));
}

/**
 * @param {string} url
 */
function displayPath(url) {
	const root = getRoot();
	if (url === root) return ".";
	if (url.startsWith(root)) return url.slice(root.length).replace(/^\//, "");
	return url;
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function exists(url) {
	try {
		return await fsOperation(url).exists();
	} catch {
		return false;
	}
}

async function cmdLs(args) {
	const flags = args.filter((arg) => arg.startsWith("-"));
	const target = resolvePath(args.find((arg) => !arg.startsWith("-")) || "");
	const list = await fsOperation(target).lsDir();
	if (!list.length) return { output: "(empty)" };
	const showHidden = flags.some((flag) => flag.includes("a"));
	const lines = list
		.filter((item) => showHidden || !nameOf(item.url).startsWith("."))
		.map((item) => `${item.isDirectory ? "d" : "-"} ${nameOf(item.url)}`);
	return { output: lines.join("\n") || "(empty)" };
}

async function cmdCat(args, limit) {
	const target = resolvePath(args.find((arg) => !arg.startsWith("-")) || "");
	const content = await readText(target);
	if (content == null) {
		return { output: `cat: ${args[0] || ""}: cannot open file`, error: true };
	}
	const text = limit ? content.split("\n").slice(0, limit).join("\n") : content;
	return { output: truncate(text, 8000) };
}

async function cmdMkdir(args) {
	const target = args.find((arg) => !arg.startsWith("-"));
	if (!target) return { output: "mkdir: missing operand", error: true };
	await fsOperation(resolvePath(target)).createDirectory();
	return { output: "" };
}

async function cmdTouch(args) {
	const target = args.find((arg) => !arg.startsWith("-"));
	if (!target) return { output: "touch: missing operand", error: true };
	const url = resolvePath(target);
	if (await exists(url)) return { output: "" };
	await fsOperation(Url.dirname(url)).createFile(nameOf(url), "");
	return { output: "" };
}

async function cmdRm(args) {
	const recursive = args.some((arg) => arg.startsWith("-") && /[rf]/.test(arg));
	const targets = args.filter((arg) => !arg.startsWith("-"));
	if (!targets.length) return { output: "rm: missing operand", error: true };
	for (const target of targets) {
		const url = resolvePath(target);
		if (!(await exists(url))) {
			return { output: `rm: ${target}: no such file or directory`, error: true };
		}
		await fsOperation(url).delete();
	}
	void recursive;
	return { output: "" };
}

async function cmdCopy(args, move) {
	const files = args.filter((arg) => !arg.startsWith("-"));
	if (files.length < 2) {
		return { output: `${move ? "mv" : "cp"}: missing destination`, error: true };
	}
	const from = resolvePath(files[0]);
	const to = resolvePath(files[files.length - 1]);
	if (!(await exists(from))) {
		return { output: `${move ? "mv" : "cp"}: ${files[0]}: not found`, error: true };
	}
	const content = await fsOperation(from).readFile();
	const toExists = await exists(to);
	const toIsDir = toExists ? await isDirectory(to) : false;
	if (toIsDir) {
		await fsOperation(to).createFile(nameOf(from), content);
	} else {
		const dir = toExists ? Url.dirname(to) : Url.dirname(to);
		if (!(await exists(dir))) {
			await fsOperation(Url.dirname(dir)).createDirectory(nameOf(dir));
		}
		await fsOperation(dir).createFile(nameOf(to), content);
	}
	if (move) await fsOperation(from).delete();
	return { output: "" };
}

/**
 * @param {string} url
 */
async function isDirectory(url) {
	try {
		const list = await fsOperation(url).lsDir();
		return Array.isArray(list);
	} catch {
		return false;
	}
}

/**
 * Reads a file as text (string) or null when unavailable.
 * @param {string} url
 */
async function readText(url) {
	try {
		const content = await fsOperation(url).readFile("utf8");
		return typeof content === "string" ? content : null;
	} catch {
		return null;
	}
}

async function cmdFind(args) {
	const baseArg = args.find((arg) => !arg.startsWith("-"));
	const base = resolvePath(baseArg || ".");
	const pattern = extractFlagValue(args, "-name") || "";
	const results = [];
	await walk(base, 4, async (url, isDir) => {
		const name = nameOf(url);
		if (pattern) {
			const regex = new RegExp(pattern.replace(/\./g, "\\.").replace(/\*/g, ".*"));
			if (!regex.test(name)) return;
		}
		results.push(`${isDir ? "d" : "-"} ${displayPath(url)}`);
	});
	return { output: truncate(results.join("\n") || "(no results)", 6000) };
}

/**
 * @param {string[]} args
 * @param {string} flag
 */
function extractFlagValue(args, flag) {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : null;
}

async function cmdGrep(args) {
	const filtered = args.filter((arg) => arg !== "-rn" && arg !== "-r" && arg !== "-n");
	const [pattern, ...paths] = filtered;
	if (!pattern) return { output: "grep: missing pattern", error: true };
	const base = resolvePath(paths[0] || ".");
	const regex = new RegExp(escapeRegex(pattern), "i");
	const results = [];
	await walk(base, 3, async (url, isDir) => {
		if (isDir) return;
		if (!isTextFile(url)) return;
		const content = await readText(url);
		if (!content) return;
		content.split("\n").forEach((line, index) => {
			if (regex.test(line)) {
				results.push(`${displayPath(url)}:${index + 1}: ${truncate(line, 200)}`);
			}
		});
	});
	return { output: truncate(results.join("\n") || "(no matches)", 6000) };
}

/**
 * @param {string} value
 */
function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} url
 */
function isTextFile(url) {
	return /\.(txt|md|json|js|jsx|ts|tsx|css|scss|html|xml|svg|yml|yaml|py|java|kt|c|h|cpp|hpp|cs|go|rs|rb|php|sh|toml|ini|gradle|properties|csv)$/i.test(
		nameOf(url),
	);
}

/**
 * Walks a directory tree.
 * @param {string} url
 * @param {number} depth
 * @param {(url: string, isDir: boolean) => Promise<void>} visitor
 */
async function walk(url, depth, visitor) {
	if (depth < 0) return;
	let list;
	try {
		list = await fsOperation(url).lsDir();
	} catch {
		return;
	}
	if (!Array.isArray(list)) return;
	for (const item of list) {
		const name = nameOf(item.url);
		if (name === "." || name === ".." || name.startsWith(".git")) continue;
		if (item.isDirectory) {
			await visitor(item.url, true);
			await walk(item.url, depth - 1, visitor);
		} else {
			await visitor(item.url, false);
		}
	}
}

// ------------------------------------------------------------------- vcs

const VCS_DIR = ".xcoder";
const VCS_FILE = "vcs.json";
const MAX_SNAPSHOTS = 15;
const MAX_FILE_SIZE = 200 * 1024;

/**
 * @param {string[]} args
 */
async function cmdVcs(args) {
	const sub = args[0] || "help";
	const vcsUrl = Url.join(getCwd(), VCS_DIR);
	const vcsFileUrl = Url.join(vcsDirUrl(), VCS_FILE);

	async function loadDb() {
		try {
			const raw = await fsOperation(vcsFileUrl).readFile("utf8");
			return JSON.parse(raw);
		} catch {
			return { commits: [] };
		}
	}

	async function saveDb(db) {
		if (!(await exists(vcsDirUrl()))) {
			await fsOperation(getCwd()).createDirectory(VCS_DIR);
		}
		await fsOperation(vcsDirUrl()).createFile(
			VCS_FILE,
			JSON.stringify(db, null, 2),
		);
	}

	switch (sub) {
		case "init": {
			await saveDb(await loadDb());
			return { output: `initialized local vcs in ${displayPath(vcsDirUrl())}` };
		}
		case "commit": {
			const message = args.slice(1).join(" ") || "update";
			const files = {};
			await walk(getCwd(), 5, async (url, isDir) => {
				if (isDir || !isTextFile(url)) return;
				const content = await readText(url);
				if (!content || content.length > MAX_FILE_SIZE) return;
				files[displayPath(url)] = content;
			});
			const db = await loadDb();
			const id = `c${Date.now().toString(36)}`;
			db.commits.push({ id, message, at: Date.now(), files });
			while (db.commits.length > MAX_SNAPSHOTS) db.commits.shift();
			await saveDb(db);
			return { output: `[${id}] ${message} (${Object.keys(files).length} files)` };
		}
		case "log": {
			const db = await loadDb();
			if (!db.commits.length) return { output: "(no commits)" };
			return {
				output: db.commits
					.slice()
					.reverse()
					.map(
						(commit) =>
							`${commit.id} ${new Date(commit.at).toLocaleString()} ${commit.message}`,
					)
					.join("\n"),
			};
		}
		case "restore": {
			const id = args[1];
			const db = await loadDb();
			const commit = db.commits.find((entry) => entry.id === id);
			if (!commit) return { output: `vcs: commit ${id} not found`, error: true };
			let restored = 0;
			for (const [relative, content] of Object.entries(commit.files)) {
				const url = Url.join(getCwd(), relative);
				const dir = Url.dirname(url);
				if (!(await exists(dir))) {
					await fsOperation(Url.dirname(dir)).createDirectory(nameOf(dir));
				}
				await fsOperation(dir).createFile(nameOf(url), content);
				restored++;
			}
			return { output: `restored ${restored} files from ${id}` };
		}
		case "diff": {
			const db = await loadDb();
			if (!db.commits.length) return { output: "(no commits to diff against)" };
			const last = db.commits[db.commits.length - 1];
			const changed = [];
			const current = {};
			await walk(getCwd(), 5, async (url, isDir) => {
				if (isDir || !isTextFile(url)) return;
				const content = await readText(url);
				if (!content || content.length > MAX_FILE_SIZE) return;
				current[displayPath(url)] = content;
			});
			for (const [relative, content] of Object.entries(current)) {
				if (last.files[relative] !== content) {
					changed.push(`M ${relative}`);
				}
			}
			for (const relative of Object.keys(last.files)) {
				if (!(relative in current)) changed.push(`D ${relative}`);
			}
			return { output: changed.join("\n") || "(no changes)" };
		}
		default:
			return {
				output: "usage: vcs init | commit <msg> | log | restore <id> | diff",
			};
	}
}

function vcsDirUrl() {
	return Url.join(getCwd(), VCS_DIR);
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
	if (!text) return "";
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n... (truncated)`;
}

export default {
	exec,
	getCwd,
	setCwd,
	getRoot,
	resolvePath,
};
