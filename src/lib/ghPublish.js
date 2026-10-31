import { describeGhError, normalizeGhToken } from "lib/ghAuth";

/**
 * Publish the workspace to GitHub through the REST git data API —
 * the git sidebar now actually USES the GitHub account (the PAT) instead
 * of only offering copy-paste terminal commands.
 *
 * One push = ONE real commit: blobs → tree (with base_tree) → commit →
 * update ref. Handles three starting states: branch exists (normal),
 * branch missing but repo has commits (branch off default), repo empty
 * (root commit + create ref). Files with `content: null` are deleted.
 */

const API = "https://api.github.com";

/** Max bytes pushed per file (mobile data + API limits). */
export const MAX_FILE_BYTES = 900 * 1024;

/**
 * UTF-8-safe base64 (btoa chokes on non-latin1 — encode via TextEncoder).
 * @param {string} text
 * @returns {string}
 */
export function toBase64Utf8(text) {
	const bytes = new TextEncoder().encode(String(text));
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/**
 * "owner/repo" | "https://github.com/owner/repo(.git)" → {owner, repo}
 * @param {string} ghRepo
 * @returns {{owner: string, repo: string}|null}
 */
export function splitRepo(ghRepo) {
	const value = String(ghRepo || "")
		.replace(/^https?:\/\/[^/]+\//, "")
		.replace(/\.git$/, "")
		.replace(/^\/+|\/+$/g, "");
	const [owner, repo] = value.split("/");
	if (!owner || !repo) return null;
	return { owner, repo };
}

/**
 * Sends one API request with the stored PAT (native http inside the
 * webview, fetch elsewhere). Injected fetchImpl keeps this unit-testable.
 * @param {object} opts
 * @returns {Promise<{status: number, data: any}>}
 */
export async function ghSend({ url, token, method = "GET", body, fetchImpl }) {
	const headers = {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${normalizeGhToken(token)}`,
		"X-GitHub-Api-Version": "2022-11-28",
		"Content-Type": "application/json",
	};
	const run = fetchImpl || fetch;
	const res = await run(url, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	let data = null;
	const text = await res.text();
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			data = text;
		}
	}
	return { status: res.status, data };
}

const ok2xx = (status) => status >= 200 && status < 300;

/**
 * Builds the commit plan from the diff vs. the remote tree state — pure
 * helper so callers can preview counts before hitting the API.
 * @param {{path: string, content: string|null}[]} files
 * @returns {{ups: number, dels: number, oversized: string[]}}
 */
export function planCommit(files) {
	let ups = 0;
	let dels = 0;
	const oversized = [];
	for (const file of files) {
		if (file.content === null) {
			dels += 1;
			continue;
		}
		const bytes = new TextEncoder().encode(file.content).length;
		if (bytes > MAX_FILE_BYTES) {
			oversized.push(file.path);
			continue;
		}
		ups += 1;
	}
	return { ups, dels, oversized };
}

/**
 * Publishes files as a single commit on the given branch.
 * @param {object} opts
 * @param {string} opts.token GitHub PAT (repo scope)
 * @param {string} opts.ghRepo "owner/name"
 * @param {string} [opts.branch] defaults to the repo default branch
 * @param {string} opts.message commit message
 * @param {{path: string, content: string|null}[]} opts.files
 * @param {typeof fetch} [opts.fetchImpl]
 * @returns {Promise<{commit: string, branch: string, url: string, created: boolean}>}
 */
export async function publishToGitHub({
	token,
	ghRepo,
	branch,
	message,
	files,
	fetchImpl,
}) {
	const parsed = splitRepo(ghRepo);
	if (!parsed) throw new Error("invalid repository (expected owner/name)");
	if (!token) throw new Error("GitHub account not connected");
	const base = `${API}/repos/${parsed.owner}/${parsed.repo}`;
	const send = (path, method, body) =>
		ghSend({
			url: `${base}${path}`,
			token,
			method,
			body,
			fetchImpl,
		});
	const treeEntries = planCommit(files);
	if (treeEntries.oversized.length) {
		throw new Error(
			`file(s) above ${Math.round(MAX_FILE_BYTES / 1024)} kB: ${treeEntries.oversized.join(", ")}`,
		);
	}
	if (treeEntries.ups + treeEntries.dels === 0) {
		throw new Error("nothing to publish");
	}

	// repository info (default branch + existence)
	const repoRes = await send("", "GET");
	if (repoRes.status === 404) {
		throw new Error(describeGhError(404, "repository not found"));
	}
	if (!ok2xx(repoRes.status)) {
		throw new Error(describeGhError(repoRes.status, "cannot read repository"));
	}
	const targetBranch = branch || repoRes.data.default_branch || "main";

	// entry blob sha list
	const entries = [];
	for (const file of files) {
		if (file.content === null) {
			entries.push({ path: file.path, sha: null });
			continue;
		}
		const blobRes = await send("/git/blobs", "POST", {
			content: toBase64Utf8(file.content),
			encoding: "base64",
		});
		if (!ok2xx(blobRes.status)) {
			throw new Error(
				`blob ${file.path}: ${describeGhError(blobRes.status, "upload failed")}`,
			);
		}
		entries.push({
			path: file.path,
			mode: "100644",
			type: "blob",
			sha: blobRes.data.sha,
		});
	}

	// resolve the branch ref (create-from-default / root-commit fallbacks)
	const refRes = await send(`/git/ref/heads/${targetBranch}`, "GET");
	let parentCommit = null;
	let created = false;

	if (ok2xx(refRes.status)) {
		parentCommit = refRes.data?.object?.sha || null;
	} else if (refRes.status === 404) {
		const hasCommits = Number(repoRes.data?.size || 0) > 0;
		if (hasCommits) {
			// branch off the default branch head
			const defRes = await send(
				`/git/ref/heads/${repoRes.data.default_branch}`,
				"GET",
			);
			if (!ok2xx(defRes.status)) {
				throw new Error("cannot resolve default branch");
			}
			parentCommit = defRes.data?.object?.sha || null;
		}
	} else {
		throw new Error(describeGhError(refRes.status, "cannot read branch"));
	}

	// base tree: reuse the parent's tree so deletes/unmodified paths survive
	let baseTree = null;
	if (parentCommit) {
		const commitRes = await send(`/git/commits/${parentCommit}`, "GET");
		if (ok2xx(commitRes.status)) {
			baseTree = commitRes.data?.tree?.sha || null;
		}
	}

	const treeBody = baseTree
		? { base_tree: baseTree, tree: entries }
		: { tree: entries };
	const treeRes = await send("/git/trees", "POST", treeBody);
	if (!ok2xx(treeRes.status)) {
		throw new Error(describeGhError(treeRes.status, "cannot create tree"));
	}

	const commitRes = await send("/git/commits", "POST", {
		message: message || "update",
		tree: treeRes.data.sha,
		...(parentCommit ? { parents: [parentCommit] } : {}),
	});
	if (!ok2xx(commitRes.status)) {
		throw new Error(describeGhError(commitRes.status, "cannot create commit"));
	}

	if (parentCommit || ok2xx(refRes.status)) {
		const updateRes = await send(`/git/refs/heads/${targetBranch}`, "PATCH", {
			sha: commitRes.data.sha,
			force: false,
		});
		if (!ok2xx(updateRes.status)) {
			throw new Error(
				describeGhError(updateRes.status, "push rejected (history changed?)"),
			);
		}
	} else {
		const createRes = await send("/git/refs", "POST", {
			ref: `refs/heads/${targetBranch}`,
			sha: commitRes.data.sha,
		});
		if (!ok2xx(createRes.status)) {
			throw new Error(
				describeGhError(createRes.status, "cannot create branch"),
			);
		}
		created = true;
	}

	return {
		commit: commitRes.data.sha,
		branch: targetBranch,
		url: `https://github.com/${parsed.owner}/${parsed.repo}/commit/${commitRes.data.sha}`,
		created,
	};
}

export default {
	toBase64Utf8,
	splitRepo,
	ghSend,
	planCommit,
	publishToGitHub,
	MAX_FILE_BYTES,
};
