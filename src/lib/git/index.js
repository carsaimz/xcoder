/**
 * Real git engine (isomorphic-git) for the opened project folder.
 *
 * This is what makes Source Control actually WORK — init, stage,
 * commit, branch, checkout, push, pull, fetch and clone over the
 * workspace's fsOperation filesystem, with the GitHub session as the
 * credential helper. Every mutation broadcasts a git-change event so
 * the sidebar and the AI terminal stay in sync.
 */
import * as git from "isomorphic-git";
import { describeGhError } from "lib/ghAuth";
import settings from "lib/settings";
import Url from "utils/Url";
import {
	promptForToken,
	rememberCredentials,
	resolveCredentials,
} from "./credentials";
import { emitGitChange } from "./events";
import { createGitFs } from "./gitFs";
import http from "./httpClient";

export { emitGitChange, onGitChange, resetGitListeners } from "./events";
export { FsError } from "./gitFs";

const GIT_DIR = ".git";
/** Virtual POSIX paths isomorphic-git sees (real urls never cross it). */
const VIRTUAL_DIR = "/";
const VIRTUAL_GITDIR = `/${GIT_DIR}`;
const LOG_DEPTH = 50;
const WALK_CAP = 500;

/** @type {Map<string, object>} per-root fs cache */
const fsCache = new Map();

/**
 * @param {string} root workspace url
 */
function fsFor(root) {
	if (!fsCache.has(root)) fsCache.set(root, createGitFs(root));
	return fsCache.get(root);
}

/**
 * Resolves the workspace root (explicit arg, or the opened project via
 * vshell — lazily to avoid a circular import).
 * @param {string} [root]
 * @returns {Promise<string>}
 */
export async function gitRoot(root) {
	if (root) return root;
	const { getRoot } = await import("lib/ai/vshell");
	return getRoot();
}

/**
 * Url of the .git directory inside a workspace.
 * @param {string} root
 */
export function gitDirUrl(root) {
	return Url.join(root, GIT_DIR);
}
/**
 * Whether the workspace has a real git repository.
 * @param {string} [root]
 */
export async function hasRepo(root) {
	root = await gitRoot(root);
	try {
		return Boolean(await fsFor(root).promises.stat(`${GIT_DIR}/HEAD`));
	} catch {
		return false;
	}
}

/**
 * Commit author from the GitHub session (falls back to an app identity).
 */
function author() {
	const login = settings.value.ghUserLogin || "";
	return {
		name: settings.value.ghUserName || login || "XCoder",
		email: login ? `${login}@users.noreply.github.com` : "app@xcoder.dev",
	};
}

/** Options bundle shared by every command (virtual POSIX paths). */
async function opts(root, extra = {}) {
	root = await gitRoot(root);
	return {
		fs: fsFor(root),
		http,
		dir: extra.dir || VIRTUAL_DIR,
		gitdir: extra.gitdir || VIRTUAL_GITDIR,
		...extra,
	};
}

/** Maps engine errors to friendly, actionable messages. */
export function describeGitError(error) {
	const raw = String(error?.message || error || "");
	if (
		/não foi possível conectar|failed to fetch|network|getaddrinfo|ECONN|timed out/i.test(
			raw,
		)
	) {
		return (
			strings["git network error"] ||
			"Sem conexão com o servidor git — verifique a internet e tente novamente (ou use o terminal Alpine)."
		);
	}
	if (error?.code === "NotFoundError" || /could not find/i.test(raw)) {
		return (
			strings["git not found"] || "Not a git repository — Initialize first."
		);
	}
	if (error?.code === "MergeNotSupportedError" || /merge/i.test(raw)) {
		return strings["git merge unsupported"] || "Merge not supported here.";
	}
	if (error?.data?.expected || /push rejected|non-fast-forward/i.test(raw)) {
		return (
			strings["git push rejected"] ||
			"Push rejected — pull first to integrate remote changes."
		);
	}
	if (/401|403|authentication/i.test(raw)) {
		return describeGhError(401, raw);
	}
	return raw;
}

/**
 * One-line workspace git summary for the AI system prompt (cheap:
 * branch + remote only — statusMatrix would be too slow per request).
 * @returns {Promise<string>} "" when the workspace has no repo
 */
export async function workspaceSummary() {
	try {
		if (!(await hasRepo())) return "";
		const branch = await currentBranch();
		const remote = await remoteUrl();
		const repo = settings.value.ghRepo || "";
		return `Git workspace: branch ${branch || "detached"}${remote ? `, remote ${remote}` : ", sem remote"}${repo ? `, repo ativo no GitHub: ${repo}` : ""}. File tools operate on this folder; 'git add/commit/push' via run_command or the terminal publishes it.`;
	} catch {
		return "";
	}
}

/**
 * Initializes a repository in the workspace.
 * @param {string} [root]
 * @param {{defaultBranch?: string}} [args]
 */
export async function init(root, args = {}) {
	root = await gitRoot(root);
	await git.init(
		await opts(root, {
			defaultBranch:
				args.defaultBranch || settings.value.gitDefaultBranch || "main",
		}),
	);
	emitGitChange(root, "init");
	return true;
}

/** Classifiable status row. Empirical statusMatrix (this version):
 * row = [filepath, head, workdir, stage] where head/stage are compared
 * against HEAD and workdir against HEAD too:
 *   untracked        [0, 2, 0]   staged-new   [0, 2, 2]
 *   clean            [1, 1, 1]   staged-mod   [1, 2, 2]
 *   modified         [1, 2, 1]   deleted      [1, 0, 1]
 *   staged-deleted   [1, 0, 0]
 */
function classifyRow(filepath, [head, workdir, stage]) {
	if (filepath === ".xcoder" || filepath.startsWith(".xcoder/")) return null;
	if (head === 1 && workdir === 1 && stage === 1) return null; // clean
	if (head === 0 && workdir === 2 && stage === 0) {
		return { path: filepath, status: "untracked" };
	}
	if (head === 0 && workdir === 2 && stage === 2) {
		return { path: filepath, status: "added" };
	}
	if (head === 0 && workdir === 0 && stage === 2) {
		return { path: filepath, status: "staged-deleted" };
	}
	if (head === 1 && workdir === 2 && stage === 1) {
		return { path: filepath, status: "modified" };
	}
	if (head === 1 && workdir === 2 && stage === 2) {
		return { path: filepath, status: "staged-modified" };
	}
	if (head === 1 && workdir === 0 && stage === 1) {
		return { path: filepath, status: "deleted" };
	}
	if (head === 1 && workdir === 0 && stage === 0) {
		return { path: filepath, status: "staged-deleted" };
	}
	return { path: filepath, status: `unknown-${head}-${workdir}-${stage}` };
}

/**
 * Full working status: staged rows, unstaged rows, untracked files and
 * the current branch.
 * @param {string} [root]
 */
export async function status(root) {
	root = await gitRoot(root);
	const branch = await currentBranch(root);
	const matrix = await git.statusMatrix(await opts(root));
	const rows = [];
	for (const entry of matrix) {
		const row = classifyRow(entry[0], entry.slice(1));
		if (row) rows.push(row);
	}

	const staged = rows.filter((row) =>
		["added", "staged-modified", "staged-deleted"].includes(row.status),
	);
	const changed = rows.filter((row) =>
		["modified", "deleted"].includes(row.status),
	);
	const untracked = rows.filter((row) => row.status === "untracked");

	return {
		root,
		branch,
		staged,
		changed,
		untracked,
		total: staged.length + changed.length + untracked.length,
	};
}

/**
 * @param {string} [root]
 */
export async function currentBranch(root) {
	root = await gitRoot(root);
	try {
		const name = await git.currentBranch(await opts(root));
		return name || "";
	} catch {
		return "";
	}
}

/**
 * Stages files. `paths === "*"` stages everything (like git add -A).
 * @param {string} [root]
 * @param {string[]|"*"} paths
 */
export async function stage(root, paths = "*") {
	root = await gitRoot(root);
	const targets = paths === "*" ? "*" : paths.map((p) => p.replace(/^\/+/, ""));
	const matrix = await git.statusMatrix(await opts(root));
	const rowFor = new Map(matrix.map((row) => [row[0], row]));
	if (targets === "*") {
		for (const [filepath, , workdir, stage] of matrix) {
			if (workdir === 2) {
				await git.add(await opts(root, { filepath }));
			} else if (workdir === 0 && stage === 1) {
				// unstaged deletion — stage it
				await git.remove(await opts(root, { filepath }));
			}
		}
	} else {
		for (const filepath of targets) {
			const row = rowFor.get(filepath);
			if (row && row[2] === 0) {
				// missing from the worktree — record the deletion
				await git.remove(await opts(root, { filepath }));
				continue;
			}
			await git.add(await opts(root, { filepath }));
		}
	}
	emitGitChange(root, "stage", { paths: targets });
	return true;
}

/**
 * Unstages files (git restore --staged). "*" unstages everything.
 * @param {string} [root]
 * @param {string[]|"*"} paths
 */
export async function unstage(root, paths = "*") {
	root = await gitRoot(root);
	const targets = paths === "*" ? "*" : paths.map((p) => p.replace(/^\/+/, ""));
	if (targets === "*") {
		const matrix = await git.statusMatrix(await opts(root));
		for (const row of matrix) {
			// stage column (row[3]) differs from HEAD — unstage it
			if (row[3] !== 1) {
				await git.resetIndex(await opts(root, { filepath: row[0] }));
			}
		}
	} else {
		for (const filepath of targets) {
			await git.resetIndex(await opts(root, { filepath }));
		}
	}
	emitGitChange(root, "unstage", { paths: targets });
	return true;
}

/**
 * Discards changes for files (VS Code discard): tracked files are
 * restored from HEAD, untracked files are deleted.
 * @param {string} [root]
 * @param {string[]} paths
 */
export async function discard(root, paths) {
	root = await gitRoot(root);
	const statusRows = await status(root);
	const untracked = new Set(statusRows.untracked.map((row) => row.path));
	for (const raw of paths.map((p) => p.replace(/^\/+/, ""))) {
		if (untracked.has(raw)) {
			// never tracked — discard means deleting the file
			try {
				await fsFor(root).promises.unlink(raw);
			} catch (error) {
				if (error?.code !== "ENOENT") throw error;
			}
			continue;
		}
		await git.checkout(await opts(root, { filepaths: [raw], force: true }));
	}
	emitGitChange(root, "discard", { paths });
	return true;
}

/**
 * Creates a commit from everything staged.
 * @param {string} [root]
 * @param {string} message
 */
export async function commit(root, message) {
	root = await gitRoot(root);
	const text = String(message || "").trim();
	if (!text) throw new Error(strings["git commit msg"] || "Commit message");
	// nothing to commit = every file identical in HEAD, index AND worktree
	const matrix = await git.statusMatrix(await opts(root));
	const clean = matrix.every(
		(row) => row[1] === 1 && row[2] === 1 && row[3] === 1,
	);
	if (clean) {
		throw new Error(strings["git no changes"] || "No changes to commit");
	}
	const oid = await git.commit(
		await opts(root, { message: text, author: author() }),
	);
	emitGitChange(root, "commit", { oid, message: text });
	return oid;
}

/**
 * Commit history (newest first).
 * @param {string} [root]
 * @param {{depth?: number, ref?: string}} [args]
 */
export async function log(root, args = {}) {
	root = await gitRoot(root);
	try {
		const commits = await git.log(
			await opts(root, { depth: args.depth || LOG_DEPTH, ref: args.ref }),
		);
		return commits.map((item) => ({
			oid: item.oid,
			short: item.oid.slice(0, 7),
			message: item.commit.message?.split("\n")[0] || "",
			author: item.commit.author?.name || "",
			timestamp: item.commit.author.timestamp * 1000,
		}));
	} catch (error) {
		if (/could not find|not a valid/i.test(String(error?.message))) return [];
		throw error;
	}
}

/**
 * Local branches with the current one flagged.
 * @param {string} [root]
 */
export async function branches(root) {
	root = await gitRoot(root);
	const current = await currentBranch(root);
	const list = await git.listBranches(await opts(root));
	return {
		current,
		all: list.map((name) => ({ name, current: name === current })),
	};
}

/**
 * @param {string} [root]
 * @param {string} name
 * @param {{checkout?: boolean}} [args]
 */
export async function createBranch(root, name, args = {}) {
	root = await gitRoot(root);
	await git.branch(
		await opts(root, { ref: name, checkout: args.checkout !== false }),
	);
	emitGitChange(root, "branch", { name });
	return true;
}

/**
 * @param {string} [root]
 * @param {string} ref branch name or commit oid
 */
export async function checkout(root, ref) {
	root = await gitRoot(root);
	await git.checkout(await opts(root, { ref }));
	emitGitChange(root, "checkout", { ref });
	return true;
}

/**
 * @param {string} [root]
 * @param {string} name
 */
export async function deleteBranch(root, name) {
	root = await gitRoot(root);
	await git.deleteBranch(await opts(root, { ref: name }));
	emitGitChange(root, "branch-delete", { name });
	return true;
}

/** Remote list [{remote, url}]. */
export async function listRemotes(root) {
	root = await gitRoot(root);
	try {
		return await git.listRemotes(await opts(root));
	} catch {
		return [];
	}
}

/**
 * @param {string} [root]
 * @param {string} name
 * @param {string} url
 */
export async function addRemote(root, name, url) {
	root = await gitRoot(root);
	try {
		await git.deleteRemote(await opts(root, { remote: name }));
	} catch {
		/* no previous remote — fine */
	}
	await git.addRemote(await opts(root, { remote: name, url }));
	emitGitChange(root, "remote", { name, url });
	return true;
}

/**
 * Removes a remote (VS Code "Remove Remote").
 * @param {string} [root]
 * @param {string} name
 */
export async function removeRemote(root, name) {
	root = await gitRoot(root);
	await git.deleteRemote(await opts(root, { remote: name }));
	emitGitChange(root, "remote-remove", { name });
	return true;
}

/**
 * Fetches refs from a remote and reports the remote head of a branch.
 * @param {string} [root]
 * @param {{remote?: string, branch?: string, creds?: object}} [args]
 */
export async function fetch(root, args = {}) {
	root = await gitRoot(root);
	const remote = args.remote || "origin";
	const branch = args.branch || (await currentBranch(root));
	const creds =
		args.creds || (await resolveCredentials(await remoteUrl(root, remote)));
	await git.fetch(
		await opts(root, {
			remote,
			ref: branch,
			auth: creds,
			onAuth: () => creds,
			onAuthFailure: async () => promptForToken(await remoteUrl(root, remote)),
		}),
	);
	emitGitChange(root, "fetch", { remote, branch });
	return true;
}

/**
 * @param {string} [root]
 * @param {string} remote
 */
export async function remoteUrl(root, remote = "origin") {
	root = await gitRoot(root);
	const remotes = await listRemotes(root);
	const found = remotes.find((item) => item.remote === remote);
	return found?.url || "";
}

/**
 * {ahead, behind} between the local branch and its remote tracking
 * counterpart (after a fetch).
 * @param {string} [root]
 * @param {{remote?: string, branch?: string}} [args]
 */
export async function aheadBehind(root, args = {}) {
	root = await gitRoot(root);
	const branch = args.branch || (await currentBranch(root));
	const remote = args.remote || "origin";
	if (!branch) return { ahead: 0, behind: 0 };
	try {
		const base = await git.findMergeBase(
			await opts(root, { refs: [branch, `${remote}/${branch}`] }),
		);
		const walk = async (ref, stopAt) => {
			const commits = await git
				.log(await opts(root, { ref, depth: WALK_CAP }))
				.catch(() => []);
			let count = 0;
			for (const item of commits) {
				if (stopAt && item.oid === stopAt?.oid) break;
				count += 1;
			}
			return count;
		};
		const [ahead, behind] = await Promise.all([
			walk(branch, base),
			walk(`${remote}/${branch}`, base),
		]);
		return { ahead, behind };
	} catch {
		return { ahead: 0, behind: 0 };
	}
}

/**
 * Push with the GitHub session (credential-manager behaviour: stored
 * token first, PAT prompt + remember on 401).
 * @param {string} [root]
 * @param {{remote?: string, branch?: string, force?: boolean}} [args]
 */
export async function push(root, args = {}) {
	root = await gitRoot(root);
	const branch = args.branch || (await currentBranch(root));
	const remote = args.remote || "origin";
	const url = await remoteUrl(root, remote);
	if (!url) {
		throw new Error(strings["git no remote"] || "No remote configured");
	}
	let creds = await resolveCredentials(url);
	let result;
	try {
		result = await git.push(
			await opts(root, {
				remote,
				ref: branch,
				force: Boolean(args.force),
				auth: creds,
				onAuth: () => creds,
				onAuthFailure: async () => {
					creds = await promptForToken(url);
					return creds;
				},
			}),
		);
	} catch (error) {
		throw new Error(describeGitError(error));
	}
	if (result?.error) throw new Error(describeGitError(result.error));
	await rememberCredentials(creds);
	emitGitChange(root, "push", { remote, branch });
	return { ok: true, remote, branch };
}

/**
 * Pull = fetch + fast-forward when possible; otherwise a real merge
 * (conflicts are surfaced, not silently resolved).
 * @param {string} [root]
 * @param {{remote?: string, branch?: string}} [args]
 */
export async function pull(root, args = {}) {
	root = await gitRoot(root);
	const branch = args.branch || (await currentBranch(root));
	const remote = args.remote || "origin";
	const url = await remoteUrl(root, remote);
	let creds = await resolveCredentials(url);
	try {
		const result = await git.pull(
			await opts(root, {
				remote,
				ref: branch,
				// fast-forward when possible, real merge otherwise;
				// merge conflicts surface as MergeConflictError below
				author: author(),
				auth: creds,
				onAuth: () => creds,
				onAuthFailure: async () => {
					creds = await promptForToken(url);
					return creds;
				},
			}),
		);
		await rememberCredentials(creds);
		emitGitChange(root, "pull", { remote, branch, result });
		return { ok: true, ...result };
	} catch (error) {
		if (error?.code === "MergeConflictError") {
			throw new Error(
				strings["git merge conflict"] ||
					"Merge conflict — resolve the conflicted files, stage and commit.",
			);
		}
		throw new Error(describeGitError(error));
	}
}

/**
 * Clones a repository into a subfolder of the workspace root (or an
 * explicit dir). Token auth comes from the session/PAT prompt.
 * @param {{url: string, dir?: string, root?: string, depth?: number}} args
 */
export async function clone(args) {
	const root = await gitRoot(args.root);
	const name = String(args.dir || Url.basename(args.url).replace(/\.git$/, ""))
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
	// clone into a subfolder of the workspace — virtual POSIX paths
	const dir = `/${name}`;
	const realDir = Url.join(root, name);
	const creds = await resolveCredentials(args.url);
	await git.clone(
		await opts(root, {
			// the repo lives in the subfolder — .git must follow it
			dir,
			gitdir: `${dir}/${GIT_DIR}`,
			url: args.url,
			singleBranch: false,
			auth: creds,
			onAuth: () => creds,
			onAuthFailure: async () => promptForToken(args.url),
		}),
	);
	await rememberCredentials(creds);
	emitGitChange(root, "clone", { url: args.url, dir: realDir });
	return realDir;
}
