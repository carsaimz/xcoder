import { beforeEach, describe, expect, it, vi } from "vitest";
import {
        CATALOG,
        cmdGh,
        cmdHttp,
        cmdJq,
        cmdPkg,
        cmdPython,
        filterJq,
        installed,
        setStorage,
} from "lib/ai/pkg";

const { fsMock } = vi.hoisted(() => ({ fsMock: vi.fn() }));

vi.mock("fileSystem", () => ({ default: fsMock }));
vi.mock("lib/openFolder", () => ({ addedFolder: [] }));

import { exec } from "lib/ai/vshell";

/** Map-backed storage adapter isolated per test. */
function makeStorage() {
        const map = new Map();
        return {
                getItem: (key) => (map.has(key) ? map.get(key) : null),
                setItem: (key, value) => map.set(key, value),
        };
}

beforeEach(() => {
        setStorage(makeStorage());
        fsMock.mockReset();
        fsMock.mockImplementation(() => ({
                exists: async () => true,
                readFile: async () => '{"name":"xcoder","stars":9}',
                lsDir: async () => [],
                createFile: async () => undefined,
                createDirectory: async () => undefined,
        }));
});

describe("pkg catalog storage", () => {
        it("starts with no packages installed", () => {
                expect(installed()).toEqual([]);
        });

        it("survives corrupted state", () => {
                setStorage({ getItem: () => "{not json", setItem: () => {} });
                expect(installed()).toEqual([]);
        });
});

describe("filterJq", () => {
        it("returns pretty-printed identity for '.'", () => {
                expect(filterJq({ a: 1 }, ".")).toBe('{\n  "a": 1\n}');
        });

        it("walks nested paths", () => {
                expect(filterJq({ a: { b: [1, 2] } }, ".a.b")).toBe("[\n  1,\n  2\n]");
        });

        it("supports keys and length", () => {
                expect(filterJq({ a: 1, b: 2 }, "keys")).toBe('["a","b"]');
                expect(filterJq([1, 2, 3], "length")).toBe("3");
                expect(filterJq("abcd", "length")).toBe("4");
                expect(filterJq({ x: 1 }, "length")).toBe("1");
        });

        it("throws on unsupported filters and invalid indexes", () => {
                expect(() => filterJq({ a: 1 }, "select(.x)")).toThrow("unsupported filter");
                expect(() => filterJq(7, ".a")).toThrow("cannot index");
        });
});

describe("cmdPkg", () => {
        it("lists the catalog with a hint when nothing is installed", async () => {
                const { output } = await cmdPkg(["list"], { exec });
                expect(output).toContain("no packages installed");
                CATALOG.forEach((entry) => expect(output).toContain(entry.name));
                expect(output).toContain("pkg install <name>");
        });

        it("installs, marks and uninstalls a package", async () => {
                const install = await cmdPkg(["install", "jq"], { exec });
                expect(install.output).toContain("provides: jq");
                expect(installed()).toEqual(["jq"]);

                const listed = await cmdPkg(["list"], { exec });
                expect(listed.output).toContain("[x] jq");

                const again = await cmdPkg(["install", "jq"], { exec });
                expect(again.output).toContain("already installed");
                expect(installed()).toEqual(["jq"]);

                const removed = await cmdPkg(["uninstall", "jq"], { exec });
                expect(removed.output).toBe("removed jq");
                expect(installed()).toEqual([]);
        });

        it("rejects unknown packages and uninstalls of missing ones", async () => {
                const bad = await cmdPkg(["install", "emacs"], { exec });
                expect(bad.error).toBe(true);
                expect(bad.output).toContain("not found");

                const gone = await cmdPkg(["uninstall", "jq"], { exec });
                expect(gone.error).toBe(true);
                expect(gone.output).toContain("not installed");
        });

        it("searches the catalog and reports misses", async () => {
                const hit = await cmdPkg(["search", "json"], { exec });
                expect(hit.output).toContain("jq/");

                const miss = await cmdPkg(["search", "emacs"], { exec });
                expect(miss.output).toContain('no results for "emacs"');
        });

        it("reports catalog update status and usage", async () => {
                expect((await cmdPkg(["update"], { exec })).output).toContain("up to date");
                expect((await cmdPkg(["frobnicate"], { exec })).output).toContain("usage: pkg");
        });
});

describe("cmdJq", () => {
        const io = {
                readText: async (url) => (url.includes("missing") ? null : '{"a":{"b":2}}'),
                resolvePath: (p) => `file:///proj/${p}`,
        };

        it("prints usage when the filter is missing", async () => {
                const { output, error } = await cmdJq([], io);
                expect(error).toBe(true);
                expect(output).toContain("usage: jq");
        });

        it("filters inline JSON", async () => {
                const { output } = await cmdJq([".a.b", '{"a":{"b":42}}'], io);
                expect(output).toBe("42");
        });

        it("reads JSON from files through the shell", async () => {
                const { output } = await cmdJq([".a.b", "data.json"], io);
                expect(output).toBe("2");
        });

        it("reports missing files and invalid JSON", async () => {
                const missing = await cmdJq([".", "missing.json"], io);
                expect(missing.error).toBe(true);
                expect(missing.output).toContain("file not found");

                const invalid = await cmdJq([".", '{oops'], io);
                expect(invalid.error).toBe(true);
                expect(invalid.output).toContain("invalid JSON");
        });
});

describe("cmdHttp", () => {
        it("requires an http(s) url", async () => {
                const noUrl = await cmdHttp([]);
                expect(noUrl.error).toBe(true);
                expect(noUrl.output).toContain("usage: http");

                const badScheme = await cmdHttp(["GET", "ftp://example.com"]);
                expect(badScheme.error).toBe(true);
        });

        it("rejects unsupported methods", async () => {
                const { error, output } = await cmdHttp(["TRACE", "https://example.com"]);
                expect(error).toBe(true);
                expect(output).toContain("unsupported method");
        });

        it("performs a GET request and formats the response", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => ({
                                status: 200,
                                statusText: "OK",
                                headers: new Map([["content-type", "application/json"]]),
                                text: async () => '{"ok":true}',
                        })),
                );

                try {
                        const { output, error } = await cmdHttp(["GET", "https://example.com/api"]);
                        expect(error).toBeUndefined();
                        expect(output).toContain("GET https://example.com/api");
                        expect(output).toContain("200 OK");
                        expect(output).toContain('{"ok":true}');
                } finally {
                        vi.unstubAllGlobals();
                }
        });

        it("reports network failures", async () => {
                vi.stubGlobal("fetch", vi.fn(async () => {
                        throw new Error("offline");
                }));

                try {
                        const { error, output } = await cmdHttp(["GET", "https://example.com"]);
                        expect(error).toBe(true);
                        expect(output).toContain("request failed");
                } finally {
                        vi.unstubAllGlobals();
                }
        });
});

describe("cmdGh and cmdPython guidance", () => {
        it("points gh users to the Git panel", () => {
                const { output } = cmdGh();
                expect(output).toContain("Git sidebar app");
                expect(output).toContain("gh pr create");
        });

        it("points python users to working alternatives", () => {
                const { error, output } = cmdPython();
                expect(error).toBe(true);
                expect(output).toContain("not bundled");
                expect(output).toContain("run_js");
        });
});

describe("vshell package integration", () => {
        it("hints how to install when a packaged command is missing", async () => {
                const { output, error } = await exec("jq . data.json");
                expect(error).toBe(true);
                expect(output).toBe("jq: command not found (install it with 'pkg install jq')");
        });

        it("installs through pkg and then runs jq against a file", async () => {
                const install = await exec("pkg install jq");
                expect(install.output).toContain("Done");

                const result = await exec("jq .name data.json");
                expect(result.output).toBe('"xcoder"');
        });

        it("keeps python3 gated and answers the python alias", async () => {
                const gated = await exec("python3 --version");
                expect(gated.error).toBe(true);
                expect(gated.output).toContain("pkg install python3");

                await exec("pkg install python3");
                const aliased = await exec("python --version");
                expect(aliased.output).toContain("not bundled");
        });

        it("gates nano before install and validates usage after", async () => {
                const gated = await exec("nano notes.md");
                expect(gated.error).toBe(true);
                expect(gated.output).toContain("pkg install nano");

                await exec("pkg install nano");
                const usage = await exec("nano");
                expect(usage.error).toBe(true);
                expect(usage.output).toContain("nano: missing file operand");
        });

        it("lists installed state through the shell", async () => {
                await exec("pkg install gh");
                const { output } = await exec("pkg list");
                expect(output).toContain("installed: gh");
                expect(output).toContain("[x] gh");
        });

        it("documents pkg and installable commands in help", async () => {
                const { output } = await exec("help");
                expect(output).toContain("pkg install <name>");
                expect(output).toContain("installable: jq, http, nano, gh, python3");
        });
});
