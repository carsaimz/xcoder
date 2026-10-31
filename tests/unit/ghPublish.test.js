// @vitest-environment happy-dom
/**
 * lib/ghPublish — the git sidebar now publishes through the REST git
 * data API using the connected GitHub account: blobs → tree (base_tree)
 * → commit → update ref. Covers splitRepo, base64 UTF-8, commit planning
 * and the full publish flow on a fake fetch, including the empty-repo
 * root-commit path and the branch-missing path.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
	ghSend,
	planCommit,
	publishToGitHub,
	splitRepo,
	toBase64Utf8,
} from "lib/ghPublish";

/** Minimal GitHub API fake: records calls, serves canned responses. */
function fakeGithub(routes) {
	const calls = [];
	const run = vi.fn(async (url, init) => {
		const method = init?.method || "GET";
		calls.push({ method, url, body: init?.body ? JSON.parse(init.body) : null });
		const key = `${method} ${url.replace("https://api.github.com", "")}`;
		const handler =
			routes[key] ||
			routes[key.replace(/\/[^/]+$/, "/*")] ||
			(() => ({ status: 404, body: {} }));
		const res = handler(calls.at(-1));
		return {
			status: res.status,
			text: async () => JSON.stringify(res.body ?? {}),
		};
	});
	return { run, calls };
}

const REPO = {
	"GET /repos/owner/repo": () => ({
		status: 200,
		body: { default_branch: "main", size: 1 },
	}),
	"GET /repos/owner/repo/git/ref/heads/main": () => ({
		status: 200,
		body: { object: { sha: "base0" } },
	}),
	"GET /repos/owner/repo/git/commits/base0": () => ({
		status: 200,
		body: { tree: { sha: "tree0" } },
	}),
	"POST /repos/owner/repo/git/blobs": () => ({
		status: 201,
		body: { sha: "blob1" },
	}),
	"POST /repos/owner/repo/git/trees": () => ({
		status: 201,
		body: { sha: "tree1" },
	}),
	"POST /repos/owner/repo/git/commits": () => ({
		status: 201,
		body: { sha: "commit1" },
	}),
	"PATCH /repos/owner/repo/git/refs/heads/main": () => ({
		status: 200,
		body: { object: { sha: "commit1" } },
	}),
};

describe("ghPublish.splitRepo", () => {
	test("accepts owner/name and github urls", () => {
		expect(splitRepo("carsaimz/xcoder")).toStrictEqual({
			owner: "carsaimz",
			repo: "xcoder",
		});
		expect(splitRepo("https://github.com/a/b.git")).toStrictEqual({
			owner: "a",
			repo: "b",
		});
		expect(splitRepo("justname")).toBeNull();
		expect(splitRepo("")).toBeNull();
	});
});

describe("ghPublish.toBase64Utf8", () => {
	test("encodes unicode safely", () => {
		// "ação" must survive the latin1 round-trip btoa would break
		const bytes = Uint8Array.from(atob(toBase64Utf8("ação")), (c) =>
			c.charCodeAt(0),
		);
		expect(new TextDecoder().decode(bytes)).toBe("ação");
	});
});

describe("ghPublish.planCommit", () => {
	test("counts ups, deletes and oversized files", () => {
		const plan = planCommit([
			{ path: "a.txt", content: "hello" },
			{ path: "gone.txt", content: null },
			{ path: "big.bin", content: "x".repeat(901 * 1024) },
		]);
		expect(plan.ups).toBe(1);
		expect(plan.dels).toBe(1);
		expect(plan.oversized).toStrictEqual(["big.bin"]);
	});
});

describe("ghPublish.publishToGitHub", () => {
	beforeEach(() => {
		vi.unstubAllGlobals?.();
	});

	test("full happy path: one commit via blobs→tree→commit→ref", async () => {
		const gh = fakeGithub(REPO);
		const result = await publishToGitHub({
			token: "ghp_test",
			ghRepo: "owner/repo",
			branch: "main",
			message: "feat: publish",
			files: [{ path: "index.html", content: "<h1>oi</h1>" }],
			fetchImpl: gh.run,
		});
		assert.equal(result.commit, "commit1");
		assert.equal(result.branch, "main");
		assert.equal(result.created, false);

		const methods = gh.calls.map((c) => `${c.method} ${c.url}`);
		assert.ok(methods.some((m) => m.includes("/git/blobs")));
		assert.ok(methods.some((m) => m.includes("/git/trees")));
		assert.ok(methods.some((m) => m.includes("/git/commits")));
		const patch = gh.calls.find((c) => c.method === "PATCH");
		assert.equal(patch.body.sha, "commit1");
		const tree = gh.calls.find((c) => c.url.endsWith("/git/trees"));
		assert.equal(tree.body.base_tree, "tree0");
	});

	test("empty repo → root commit and ref creation", async () => {
		const gh = fakeGithub({
			"GET /repos/owner/repo": () => ({
				status: 200,
				body: { default_branch: "main", size: 0 },
			}),
			"GET /repos/owner/repo/git/ref/heads/main": () => ({
				status: 404,
				body: {},
			}),
			"POST /repos/owner/repo/git/blobs": () => ({
				status: 201,
				body: { sha: "b1" },
			}),
			"POST /repos/owner/repo/git/trees": () => ({
				status: 201,
				body: { sha: "t1" },
			}),
			"POST /repos/owner/repo/git/commits": () => ({
				status: 201,
				body: { sha: "c1" },
			}),
			"POST /repos/owner/repo/git/refs": () => ({
				status: 201,
				body: {},
			}),
		});
		const result = await publishToGitHub({
			token: "ghp_test",
			ghRepo: "owner/repo",
			message: "init",
			files: [{ path: "README.md", content: "# hi" }],
			fetchImpl: gh.run,
		});
		assert.equal(result.created, true);
		const commit = gh.calls.find(
			(c) => c.method === "POST" && c.url.endsWith("/git/commits"),
		);
		// no parent key on a root commit
		assert.equal(commit.body.parents, undefined);
		const createRef = gh.calls.find(
			(c) => c.method === "POST" && c.url.endsWith("/git/refs"),
		);
		assert.equal(createRef.body.ref, "refs/heads/main");
	});

	test("missing token / invalid repo / nothing to publish fail fast", async () => {
		await expect(
			publishToGitHub({
				token: "",
				ghRepo: "a/b",
				message: "m",
				files: [{ path: "x", content: "y" }],
			}),
		).rejects.toThrow(/account not connected/i);
		await expect(
			publishToGitHub({
				token: "t",
				ghRepo: "nope",
				message: "m",
				files: [{ path: "x", content: "y" }],
			}),
		).rejects.toThrow(/invalid repository/i);
		await expect(
			publishToGitHub({
				token: "t",
				ghRepo: "a/b",
				message: "m",
				files: [],
			}),
		).rejects.toThrow(/nothing to publish/i);
	});

	test("oversized file aborts before any API call", async () => {
		const gh = fakeGithub(REPO);
		await expect(
			publishToGitHub({
				token: "t",
				ghRepo: "owner/repo",
				message: "m",
				files: [{ path: "big.txt", content: "z".repeat(901 * 1024) }],
				fetchImpl: gh.run,
			}),
		).rejects.toThrow(/900 kB/);
		assert.equal(gh.calls.length, 0);
	});

	test("401 surfaces a readable GitHub error", async () => {
		const gh = fakeGithub({
			"GET /repos/owner/repo": () => ({ status: 401, body: {} }),
		});
		await expect(
			publishToGitHub({
				token: "bad",
				ghRepo: "owner/repo",
				message: "m",
				files: [{ path: "a", content: "b" }],
				fetchImpl: gh.run,
			}),
		).rejects.toThrow();
	});
});

describe("ghSend", () => {
	test("sends bearer auth and parses json", async () => {
		let seen;
		const run = async (url, init) => {
			seen = { url, init };
			return {
				status: 200,
				text: async () => JSON.stringify({ ok: 1 }),
			};
		};
		const res = await ghSend({
			url: "https://api.github.com/x",
			token: "tok",
			method: "POST",
			body: { a: 1 },
			fetchImpl: run,
		});
		assert.equal(res.data.ok, 1);
		assert.equal(seen.init.headers.Authorization, "Bearer tok");
		assert.deepEqual(JSON.parse(seen.init.body), { a: 1 });
	});
});
