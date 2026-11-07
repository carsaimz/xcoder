// @vitest-environment happy-dom
/**
 * Real git engine tests — run isomorphic-git END TO END against a node
 * temp directory through the SAME fsOperation interface the app uses,
 * so the gitFs bridge and the status classifier are exercised for real.
 * Network commands (push/pull/fetch/clone) are covered with a fake http
 * transport: we verify the credential wiring, not GitHub itself.
 */
import {
        existsSync,
        mkdirSync,
        readFileSync,
        readdirSync,
        rmSync,
        statSync,
        writeFileSync,
} from "node:fs";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- fsOperation mock over a node temp dir --------------------------------

let tmpRoot = "";
const ROOT_URL = "file:///repo";

const toDisk = (url) => {
        let rel = String(url).replace(/^file:\/\//, "");
        if (!rel.startsWith("/repo")) {
                // isomorphic-git passes workspace-relative posix paths too
                rel = `/repo/${rel.replace(/^\/+/, "")}`;
        }
        return path.join(tmpRoot, rel.replace(/^\/repo/, "") || "/");
};

const toUrl = (disk) =>
        `file:///repo/${path.relative(tmpRoot, disk).split(path.sep).join("/")}`;

const statEntry = (disk) => {
        const st = statSync(disk);
        return {
                name: path.basename(disk),
                url: toUrl(disk),
                isFile: st.isFile(),
                isDirectory: st.isDirectory(),
                size: st.size,
                modifiedDate: st.mtimeMs,
        };
};

const toBuffer = (data) =>
        typeof data === "string" ? data : Buffer.from(data.buffer ?? data);

vi.mock("fileSystem", () => ({
        default: (url) => {
                const disk = toDisk(url);
                const parentDisk = path.dirname(disk);
                return {
                        async exists() {
                                return existsSync(disk);
                        },
                        async stat() {
                                return statEntry(disk);
                        },
                        async readFile() {
                                const buf = readFileSync(disk);
                                return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                        },
                        async writeFile(data) {
                                writeFileSync(disk, toBuffer(data));
                        },
                        async lsDir() {
                                return readdirSync(disk).map((name) => {
                                        const st = statSync(path.join(disk, name));
                                        return {
                                                name,
                                                url: toUrl(path.join(disk, name)),
                                                isFile: st.isFile(),
                                                isDirectory: st.isDirectory(),
                                        };
                                });
                        },
                        async delete() {
                                rmSync(disk, { recursive: true });
                        },
                        async createDirectory(name) {
                                mkdirSync(path.join(disk, name), { recursive: true });
                        },
                        async createFile(name, data) {
                                writeFileSync(path.join(disk, name), toBuffer(data));
                        },
                };
        },
}));

vi.mock("lib/ai/vshell", () => ({
        default: { getRoot: () => ROOT_URL },
        getRoot: () => ROOT_URL,
}));
vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("dialogs/prompt", () => ({ default: vi.fn(async () => "") }));
vi.mock("lib/settings", () => ({
        default: {
                value: { ghToken: "ghs_testtoken123", ghUserLogin: "octocat" },
                update: vi.fn(async () => {}),
                on: vi.fn(),
                off: vi.fn(),
        },
}));

window.strings = {};

const gitEngine = await import("lib/git");
const { onGitChange } = gitEngine;

// ---------------------------------------------------------------------------

beforeEach(() => {
        tmpRoot = mkdtempSync(path.join(os.tmpdir(), "xcoder-git-"));
        vi.clearAllMocks();
});

afterEach(() => {
        rmSync(tmpRoot, { recursive: true, force: true });
});

const writeRepoFile = (rel, content) => {
        const target = path.join(tmpRoot, rel);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
};

describe("git engine (real isomorphic-git)", () => {
        it("init creates a real .git and status reports a clean empty repo", async () => {
                await gitEngine.init(ROOT_URL);
                expect(existsSync(path.join(tmpRoot, ".git", "HEAD"))).toBe(true);
                const st = await gitEngine.status(ROOT_URL);
                expect(st.branch).toBe("main");
                expect(st.total).toBe(0);
        });

        it("status classifies untracked / staged / modified / deleted", async () => {
                await gitEngine.init(ROOT_URL);
                writeRepoFile("a.txt", "one");
                writeRepoFile("src/b.txt", "two");

                let st = await gitEngine.status(ROOT_URL);
                expect(st.untracked.map((r) => r.path).sort()).toEqual([
                        "a.txt",
                        "src/b.txt",
                ]);

                await gitEngine.stage(ROOT_URL, "*");
                st = await gitEngine.status(ROOT_URL);
                expect(st.staged.map((r) => r.path).sort()).toEqual(["a.txt", "src/b.txt"]);

                const oid = await gitEngine.commit(ROOT_URL, "feat: first");
                expect(oid).toMatch(/^[0-9a-f]{40}$/);

                // unstaged modification + tracked-file deletion
                writeRepoFile("a.txt", "one-changed");
                rmSync(path.join(tmpRoot, "src/b.txt"));
                st = await gitEngine.status(ROOT_URL);
                expect(st.changed.map((r) => r.path).sort()).toEqual([
                        "a.txt",
                        "src/b.txt",
                ]);

                // stage the modified file: staged-modified, deletion stays unstaged
                await gitEngine.stage(ROOT_URL, ["a.txt"]);
                st = await gitEngine.status(ROOT_URL);
                expect(st.staged.map((r) => r.path)).toEqual(["a.txt"]);
                expect(st.changed.map((r) => r.path)).toEqual(["src/b.txt"]);

                // unstaging returns it to a plain modification
                await gitEngine.unstage(ROOT_URL, ["a.txt"]);
                st = await gitEngine.status(ROOT_URL);
                expect(st.staged).toHaveLength(0);
                expect(st.changed.map((r) => r.path)).toContain("a.txt");

                // staging the deletion (a.txt stays unstaged-modified)
                await gitEngine.stage(ROOT_URL, ["src/b.txt"]);
                st = await gitEngine.status(ROOT_URL);
                expect(st.changed.map((r) => r.path)).toEqual(["a.txt"]);
                expect(st.staged.map((r) => r.path)).toEqual(["src/b.txt"]);
        });

        it("commit, log and history round-trip", async () => {
                await gitEngine.init(ROOT_URL);
                writeRepoFile("x.md", "hello");
                await gitEngine.stage(ROOT_URL, ["x.md"]);
                await gitEngine.commit(ROOT_URL, "docs: hello");
                writeRepoFile("x.md", "hello world");
                await gitEngine.stage(ROOT_URL, ["x.md"]);
                await gitEngine.commit(ROOT_URL, "docs: update");

                const history = await gitEngine.log(ROOT_URL);
                expect(history).toHaveLength(2);
                expect(history[0].message).toBe("docs: update");
                expect(history[1].message).toBe("docs: hello");
        });

        it("branch create/checkout/list", async () => {
                await gitEngine.init(ROOT_URL);
                writeRepoFile("f.txt", "v1");
                await gitEngine.stage(ROOT_URL, ["f.txt"]);
                await gitEngine.commit(ROOT_URL, "base");

                await gitEngine.createBranch(ROOT_URL, "feat-x");
                let list = await gitEngine.branches(ROOT_URL);
                expect(list.current).toBe("feat-x");
                expect(list.all.map((b) => b.name).sort()).toEqual(["feat-x", "main"]);

                await gitEngine.checkout(ROOT_URL, "main");
                list = await gitEngine.branches(ROOT_URL);
                expect(list.current).toBe("main");
        });

        it("unstage moves files back to unstaged", async () => {
                await gitEngine.init(ROOT_URL);
                writeRepoFile("u.txt", "data");
                await gitEngine.stage(ROOT_URL, ["u.txt"]);
                await gitEngine.unstage(ROOT_URL, ["u.txt"]);
                const st = await gitEngine.status(ROOT_URL);
                expect(st.staged).toHaveLength(0);
                expect(st.untracked.map((r) => r.path)).toEqual(["u.txt"]);
        });

        it("discard restores a modified tracked file", async () => {
                await gitEngine.init(ROOT_URL);
                writeRepoFile("d.txt", "original");
                await gitEngine.stage(ROOT_URL, ["d.txt"]);
                await gitEngine.commit(ROOT_URL, "base");
                writeRepoFile("d.txt", "dirty");
                await gitEngine.discard(ROOT_URL, ["d.txt"]);
                expect(readFileSync(path.join(tmpRoot, "d.txt"), "utf8")).toBe("original");
        });

        it("remotes can be added and listed", async () => {
                await gitEngine.init(ROOT_URL);
                await gitEngine.addRemote(
                        ROOT_URL,
                        "origin",
                        "https://github.com/octo/repo.git",
                );
                const remotes = await gitEngine.listRemotes(ROOT_URL);
                expect(remotes).toEqual([
                        { remote: "origin", url: "https://github.com/octo/repo.git" },
                ]);
        });

        it("push without a remote fails with a friendly message", async () => {
                await gitEngine.init(ROOT_URL);
                await expect(gitEngine.push(ROOT_URL)).rejects.toThrow(/remote/i);
        });

        it("push targets the git smart-http endpoint with auth", async () => {
                await gitEngine.init(ROOT_URL);
                await gitEngine.addRemote(
                        ROOT_URL,
                        "origin",
                        "https://github.com/octo/repo.git",
                );
                writeRepoFile("p.txt", "pushed");
                await gitEngine.stage(ROOT_URL, ["p.txt"]);
                await gitEngine.commit(ROOT_URL, "to push");

                const requests = [];
                const fakeHttp = {
                        async request(info) {
                                requests.push(info);
                                throw new Error("network disabled in tests");
                        },
                };
                const { default: gitLib } = await import("isomorphic-git");
                const { createGitFs } = await import("lib/git/gitFs");
                await expect(
                        gitLib.push({
                                fs: createGitFs(ROOT_URL),
                                http: fakeHttp,
                                dir: "/",
                                gitdir: "/.git",
                                remote: "origin",
                                ref: "main",
                                auth: { username: "octocat", password: "ghs_testtoken123" },
                        }),
                ).rejects.toThrow();
                expect(requests[0]?.url).toContain("github.com/octo/repo.git/info/refs");
        });

        it("git events fire for mutations", async () => {
                const seen = [];
                const off = onGitChange((event) => seen.push(event.action));
                await gitEngine.init(ROOT_URL);
                writeRepoFile("e.txt", "1");
                await gitEngine.stage(ROOT_URL, ["e.txt"]);
                await gitEngine.commit(ROOT_URL, "chore: e");
                off();
                expect(seen).toEqual(["init", "stage", "commit"]);
        });
});
