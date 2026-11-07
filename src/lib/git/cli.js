/**
 * git CLI driver — real git over the engine, formatted like the git
 * command line. This is what powers `git …` in the AI terminal (vshell)
 * and what the Source Control UI echoes when sidebar buttons run
 * operations, so both surfaces show the same language.
 */
import * as engine from "lib/git";

/**
 * @typedef {{output: string, error?: boolean}} ShellResult
 */

/** Porcelain letters for a status row. */
const LETTERS = {
	added: "A",
	"staged-modified": "M",
	"staged-deleted": "D",
	modified: "M",
	deleted: "D",
	untracked: "??",
};

/**
 * Runs `git <args>` and returns a shell-style result.
 * @param {string[]} args arguments after "git"
 * @param {{root?: string}} [opts]
 * @returns {Promise<ShellResult>}
 */
export async function gitCli(args, opts = {}) {
	const [sub, ...rest] = args;
	if (!sub || sub === "-h" || sub === "--help" || sub === "help") {
		return { output: GIT_HELP };
	}
	try {
		switch (sub) {
			case "init":
				await engine.init(opts.root);
				return { output: "Initialized empty Git repository" };
			case "status":
				return await cmdStatus(opts.root, rest);
			case "add":
				return await cmdAdd(opts.root, rest);
			case "restore":
			case "checkout": {
				if (sub === "restore" || rest.includes("--")) {
					const files = rest.filter((arg) => !arg.startsWith("-"));
					await engine.discard(opts.root, files);
					return { output: `restored ${files.join(", ") || "worktree"}` };
				}
				const ref = rest.find((arg) => !arg.startsWith("-"));
				if (!ref) return { output: "checkout: missing branch", error: true };
				await engine.checkout(opts.root, ref);
				return { output: `Switched to '${ref}'` };
			}
			case "commit":
				return await cmdCommit(opts.root, rest);
			case "log":
				return await cmdLog(opts.root, rest);
			case "branch":
				return await cmdBranch(opts.root, rest);
			case "remote":
				return await cmdRemote(opts.root, rest);
			case "push":
				return await cmdPush(opts.root, rest);
			case "pull":
				return await cmdPull(opts.root, rest);
			case "fetch":
				await engine.fetch(opts.root);
				return { output: "fetch ok" };
			case "clone": {
				const url = rest.find((arg) => /^https?:\/\//.test(arg));
				if (!url) return { output: "clone: missing url", error: true };
				const dir = await engine.clone({ url, root: opts.root });
				return { output: `Cloned into '${dir}'` };
			}
			default:
				return { output: `git: '${sub}' is not a command here`, error: true };
		}
	} catch (error) {
		return { output: `git: ${error.message || error}`, error: true };
	}
}

const GIT_HELP = [
	"usage: git <command> [args]",
	"",
	"  init                 create a repository in the project",
	"  status               short working status",
	"  add <files|-A>       stage files",
	"  commit -m <message>  commit staged changes",
	"  log [--oneline]      commit history",
	"  branch [new] [-D x]  list, create or delete branches",
	"  checkout <branch>    switch branches",
	"  push [--force]       push the current branch",
	"  pull                 fetch + integrate the current branch",
	"  fetch                update remote refs",
	"  remote add <n> <url> add a remote (or `remote` to list)",
	"  clone <url>          clone into the project folder",
].join("\n");

/**
 * @param {string} [root]
 */
async function cmdStatus(root) {
	const st = await engine.status(root);
	if (!st.total) return { output: "nothing to commit, working tree clean" };
	const rows = [...st.staged, ...st.changed, ...st.untracked].map((row) => {
		const letter = LETTERS[row.status] || "??";
		return `${letter.padEnd(3)}${row.path}`;
	});
	const branch = st.branch ? `On branch ${st.branch}` : "HEAD is detached";
	return { output: [branch, "", ...rows].join("\n") };
}

/**
 * @param {string} [root]
 * @param {string[]} args
 */
async function cmdAdd(root, args) {
	const files = args.filter((arg) => !arg.startsWith("-"));
	const all = !files.length || args.some((arg) => /^(-A|--all|\.)$/.test(arg));
	await engine.stage(root, all ? "*" : files);
	return { output: all ? "staged all changes" : `staged ${files.join(", ")}` };
}

/**
 * @param {string} [root]
 * @param {string[]} args
 */
async function cmdCommit(root, args) {
	const mIndex = args.findIndex((arg) => arg === "-m" || arg === "--message");
	let message = mIndex >= 0 ? args[mIndex + 1] : "";
	if (!message && args.length) message = args.join(" ");
	if (!message) {
		return {
			output: 'commit: message required (git commit -m "msg")',
			error: true,
		};
	}
	const oid = await engine.commit(root, message);
	return { output: `[main ${oid.slice(0, 7)}] ${message}` };
}

/**
 * @param {string} [root]
 * @param {string[]} args
 */
async function cmdLog(root, args) {
	const oneline = args.some((arg) => /--oneline|-n\s*\d+/.test(arg));
	const history = await engine.log(root, {
		depth: oneline ? 20 : 8,
	});
	if (!history.length) return { output: "no commits yet" };
	const lines = history.map((item) =>
		oneline
			? `${item.short} ${item.message}`
			: [
					`commit ${item.oid}`,
					`Author: ${item.author}`,
					`Date:   ${new Date(item.timestamp).toLocaleString()}`,
					"",
					`    ${item.message}`,
					"",
				].join("\n"),
	);
	return { output: lines.join(oneline ? "\n" : "\n").trimEnd() };
}

/**
 * @param {string} [root]
 * @param {string[]} args
 */
async function cmdBranch(root, args) {
	const deleteName = args.includes("-D")
		? args[args.indexOf("-D") + 1]
		: args.includes("-d")
			? args[args.indexOf("-d") + 1]
			: null;
	if (deleteName) {
		await engine.deleteBranch(root, deleteName);
		return { output: `Deleted branch ${deleteName}` };
	}
	const create = args.find((arg) => !arg.startsWith("-"));
	if (create) {
		await engine.createBranch(root, create);
		return { output: `Switched to a new branch '${create}'` };
	}
	const list = await engine.branches(root);
	return {
		output: list.all
			.map((branch) => `${branch.current ? "* " : "  "}${branch.name}`)
			.join("\n"),
	};
}

/**
 * @param {string} [root]
 * @param {string[]} args
 */
async function cmdRemote(root, args) {
	if (args[0] === "add") {
		const [, name, url] = args;
		if (!name || !url) {
			return { output: "remote add <name> <url>", error: true };
		}
		await engine.addRemote(root, name, url);
		return { output: `remote '${name}' -> ${url}` };
	}
	const remotes = await engine.listRemotes(root);
	if (!remotes.length) return { output: "(no remotes)" };
	return {
		output: remotes.map((item) => `${item.remote}\t${item.url}`).join("\n"),
	};
}

/**
 * @param {string} [root]
 * @param {string[]} args
 */
async function cmdPush(root, args) {
	const force = args.some((arg) => arg === "--force" || arg === "-f");
	const result = await engine.push(root, { force });
	return { output: `pushed ${result.branch} -> ${result.remote}` };
}

/**
 * @param {string} [root]
 */
async function cmdPull(root) {
	await engine.pull(root);
	return { output: "pull ok — branch updated" };
}
