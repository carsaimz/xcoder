// @vitest-environment happy-dom
/**
 * GitHub agent tools (github_read / github_write) — the AI chat works
 * with the repository selected in the Git sidebar using the user's own
 * token. Fetch is stubbed; settings store is in memory.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

const state = vi.hoisted(() => ({
        settingsValue: {},
        calls: [],
}));

vi.mock("lib/settings", () => ({
        default: {
                get value() {
                        return state.settingsValue;
                },
                set value(v) {
                        state.settingsValue = v;
                },
        },
}));

import { githubRead, githubWrite, putRepoFile, ghToolsContext } from "lib/ai/githubTools";

function jsonResponse(data, status = 200) {
        return {
                ok: status < 400,
                status,
                text: async () => JSON.stringify(data),
        };
}

beforeEach(() => {
        state.settingsValue = {
                ghRepo: "octocat/hello-world",
                ghToken: "ghp_token_abc",
                ghBranch: "main",
        };
        state.calls = [];
        window.fetch = async (url, opts = {}) => {
                const urlText = String(url);
                state.calls.push({ url: urlText, opts });
                if (opts.method === "PUT") {
                        return jsonResponse({ commit: { sha: "newcommit" } }, 201);
                }
                if (urlText.includes("/git/trees/")) {
                        return jsonResponse({
                                tree: [
                                        { type: "blob", path: "src/main.js" },
                                        { type: "tree", path: "src" },
                                        { type: "blob", path: "README.md" },
                                ],
                        });
                }
                if (urlText.includes("/contents/README.md")) {
                        return jsonResponse({
                                sha: "abc123def456",
                                encoding: "base64",
                                content: btoa("hello readme"),
                        });
                }
                return jsonResponse({ sha: "f00dcafe" });
        };
});

describe("github_read", () => {
        test("tree mode lists tracked files", { timeout: 20000 }, async () => {
                const out = await githubRead({ tree: true });
                assert.match(out, /2 files:/);
                assert.match(out, /src\/main\.js/);
                assert.doesNotMatch(out, /"src"/, "directories filtered out");
                const call = state.calls[0];
                assert.match(call.url, /recursive=1/);
                assert.equal(call.opts.headers?.Authorization, "Bearer ghp_token_abc");
        });

        test("file mode decodes base64 content and shows the sha", { timeout: 20000 }, async () => {
                const out = await githubRead({ file: "README.md" });
                assert.match(out, /hello readme/);
                assert.match(out, /abc123def4/);
                assert.match(out, /branch main/);
        });

        test("no args returns usage guidance", { timeout: 20000 }, async () => {
                const out = await githubRead({});
                assert.match(out, /ERROR/);
                assert.match(out, /tree/);
        });

        test("without a token it tells the model what to ask the user", { timeout: 20000 }, async () => {
                state.settingsValue = { ghRepo: "octocat/hello-world" };
                const out = await githubRead({ tree: true });
                assert.match(out, /ERROR/);
                assert.match(out, /sign in/i);
        });
});

describe("github_write", () => {
        test("rejects GET and missing endpoints", { timeout: 20000 }, async () => {
                assert.match(await githubWrite({ endpoint: "repos/x/y", method: "GET" }), /ERROR/);
                assert.match(await githubWrite({}), /ERROR/);
                assert.equal(state.calls.length, 0, "no network calls attempted");
        });

        test("performs a contents API PUT with the body", { timeout: 20000 }, async () => {
                const out = await githubWrite({
                        endpoint: "repos/octocat/hello-world/contents/src/app.js",
                        method: "PUT",
                        body: { message: "update", content: "YWJj", branch: "main", sha: "f00d" },
                });
                assert.match(out, /OK \(HTTP 201\)/);
                const put = state.calls.find((c) => c.opts.method === "PUT");
                assert.ok(put, "PUT request sent");
                assert.equal(JSON.parse(put.opts.body).sha, "f00d");
        });
});

describe("putRepoFile", () => {
        test("fetches the sha and commits base64 content", { timeout: 20000 }, async () => {
                const out = await putRepoFile(
                        "src/app.js",
                        "console.log('olá');",
                        "feat: greet",
                );
                assert.match(out, /committed src\/app\.js to main/);
                const put = state.calls.find((c) => c.opts.method === "PUT");
                assert.ok(put);
                const body = JSON.parse(put.opts.body);
                assert.equal(body.message, "feat: greet");
                assert.equal(body.branch, "main");
                const decoded = new TextDecoder().decode(
                        Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)),
                );
                assert.equal(decoded, "console.log('olá');");
        });
});

describe("ghToolsContext", () => {
        test("empty without a repo, guidance without a token, full with both", () => {
                state.settingsValue = {};
                assert.equal(ghToolsContext(), "");
                state.settingsValue = { ghRepo: "octocat/hello-world" };
                assert.match(ghToolsContext(), /no GitHub token/);
                state.settingsValue = {
                        ghRepo: "octocat/hello-world",
                        ghToken: "t",
                        ghBranch: "dev",
                };
                const ctx = ghToolsContext();
                assert.match(ctx, /octocat\/hello-world/);
                assert.match(ctx, /branch dev/);
                assert.match(ctx, /github_read/);
        });
});
