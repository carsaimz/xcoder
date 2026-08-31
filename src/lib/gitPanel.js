import fsOperation from "fileSystem";
import Url from "utils/Url";
import vshell, { exec as shellExec } from "lib/ai/vshell";

/**
 * Git panel logic — built on top of the local snapshot VCS stored in
 * `.xcoder/vcs.json` inside the workspace, plus prepared git/gh commands
 * for real environments (Termux/desktop).
 */

const VCS_DIR = ".xcoder";
const VCS_FILE = "vcs.json";
const MAX_FILE_SIZE = 200 * 1024;

/**
 * Text files tracked by the local VCS (same convention as vshell).
 * @param {string} url
 */
export function isTextFile(url) {
	return /\.(txt|md|json|js|jsx|ts|tsx|css|scss|html|xml|svg|yml|yaml|py|java|kt|c|h|cpp|hpp|cs|go|rs|rb|php|sh|toml|ini|gradle|properties|csv)$/i.test(
		Url.basename(url),
	);
}

/**
 * @param {string} url
 */
async function exists(url) {
	try {
		return await fsOperation(url).exists();
	} catch {
		return false;
	}
}

async function readText(url) {
	try {
		const content = await fsOperation(url).readFile("utf8");
		return typeof content === "string" ? content : null;
	} catch {
		return null;
	}
}

async function nameOf(url) {
	return Url.basename(url);
}

/**
 * Walks the workspace tree (mirrors vshell.walk, also skipping .xcoder).
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
		const name = Url.basename(item.url);
		if (name === "." || name === ".." || name.startsWith(".git")) continue;
		if (name === VCS_DIR) continue;
		if (item.isDirectory) {
			await visitor(item.url, true);
			await walk(item.url, depth - 1, visitor);
		} else {
			await visitor(item.url, false);
		}
	}
}

/**
 * Relative path of a url against the workspace root.
 * @param {string} url
 */
function displayPath(url) {
	const root = vshell.getRoot();
	if (url === root) return ".";
	if (url.startsWith(root)) return url.slice(root.length).replace(/^\//, "");
	return url;
}

/**
 * Pure tree diff between the last snapshot and the current files.
 * @param {Record<string, string>} lastFiles snapshot files
 * @param {Record<string, string>} currentFiles current workspace files
 * @returns {{modified: string[], added: string[], deleted: string[]}}
 */
export function diffTrees(lastFiles, currentFiles) {
	const modified = [];
	const added = [];
	const deleted = [];

	for (const [path, content] of Object.entries(currentFiles || {})) {
		if (!(path in (lastFiles || {}))) {
			added.push(path);
		} else if (lastFiles[path] !== content) {
			modified.push(path);
		}
	}
	for (const path of Object.keys(lastFiles || {})) {
		if (!(path in (currentFiles || {}))) deleted.push(path);
	}

	const sort = (list) => list.sort((a, b) => a.localeCompare(b));
	return {
		modified: sort(modified),
		added: sort(added),
		deleted: sort(deleted),
	};
}

/**
 * Reads the raw snapshot database.
 * @returns {Promise<{commits: Array<{id: string, message: string, at: number, files: Record<string,string>}>}>}
 */
export async function readVcsDb() {
	const dbUrl = Url.join(vshell.getRoot(), VCS_DIR, VCS_FILE);
	try {
		const raw = await fsOperation(dbUrl).readFile("utf8");
		const db = JSON.parse(raw);
		return { commits: Array.isArray(db?.commits) ? db.commits : [] };
	} catch {
		return { commits: [] };
	}
}

/**
 * Collects the current workspace text files (relative path -> content).
 * @returns {Promise<Record<string, string>>}
 */
export async function collectWorkspace() {
	const files = {};
	await walk(vshell.getRoot(), 5, async (url, isDir) => {
		if (isDir || !isTextFile(url)) return;
		const content = await readText(url);
		if (!content || content.length > MAX_FILE_SIZE) return;
		files[displayPath(url)] = content;
	});
	return files;
}

/**
 * Working-tree status against the newest snapshot.
 * @returns {Promise<{hasRepo: boolean, hasChanges: boolean, changes: {modified: string[], added: string[], deleted: string[]}, commitCount: number, lastCommit: object | null}>}
 */
export async function getStatus() {
	const { commits } = await readVcsDb();
	const last = commits.length ? commits[commits.length - 1] : null;
	const current = await collectWorkspace();
	const changes = diffTrees(last?.files || {}, current);

	return {
		hasRepo: Boolean(last),
		hasChanges: Boolean(
			changes.modified.length ||
				changes.added.length ||
				changes.deleted.length ||
				!last,
		),
		changes,
		commitCount: commits.length,
		lastCommit: last
			? { id: last.id, message: last.message, at: last.at }
			: null,
	};
}

/**
 * Creates a snapshot commit.
 * @param {string} message
 * @returns {Promise<{output: string, error?: boolean}>}
 */
export async function commit(message) {
	const text = String(message || "").trim() || "update";
	return shellExec(`vcs commit ${text}`);
}

/**
 * Restores all files from a snapshot.
 * @param {string} id
 */
export async function restore(id) {
	return shellExec(`vcs restore ${id}`);
}

/**
 * Prepared git/gh commands for a real terminal (Termux or desktop).
 * @param {string} remoteUrl e.g. https://github.com/user/repo.git
 * @param {string} message default commit message
 * @returns {Array<{label: string, command: string}>}
 */
export function preparedCommands(remoteUrl, message = "update") {
	const repo = String(remoteUrl || "").trim();
	const ghRepo = repo
		.replace(/^https?:\/\/[^/]+\//, "")
		.replace(/\.git$/, "");
	const commitMsg = message.replace(/"/g, '\\"');

	const commands = [
		{
			label: "git init + first commit",
			command: `git init && git add -A && git commit -m "${commitMsg}"`,
		},
	];
	if (repo) {
		commands.push(
			{
				label: "git push (publish)",
				command: `git remote add origin ${repo} && git push -u origin main`,
			},
			{
				label: "gh pull request",
				command: `gh pr create --base main --head feat-change --title "feat: change" --body "Describe the change"`,
			},
			{
				label: "gh release",
				command: `gh release create v1.0.0 --title "v1.0.0" --notes "Release notes"`,
			},
		);
		if (ghRepo) {
			commands.push({
				label: "gh clone",
				command: `gh repo clone ${ghRepo}`,
			});
		}
	}
	return commands;
}
