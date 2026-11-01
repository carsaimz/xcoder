// @vitest-environment happy-dom
/**
 * lib/terminalCwd — fresh terminal sessions must open in the ACTIVE
 * project folder instead of the bare Alpine sandbox home ("Terminal
 * deve abrir exatamente no projeto ativo").
 *
 * The proot sandbox binds /sdcard, /storage and /data verbatim
 * (init-sandbox.sh), so file:// URLs under those trees map 1:1 into
 * the shell; everything else (SAF content://, http(s) remotes, app
 * cache URLs) has no in-shell mapping and must be skipped.
 */
import { describe, expect, test } from "vitest";

import {
        activeProjectCd,
        sandboxPathOf,
        shellQuote,
} from "lib/terminalCwd";

describe("terminalCwd.sandboxPathOf", () => {
        test("maps bound host trees into the sandbox verbatim", () => {
                expect(sandboxPathOf("file:///storage/emulated/0/site/index.html")).toBe(
                        "/storage/emulated/0/site/index.html",
                );
                expect(sandboxPathOf("file:///sdcard/Note/app.py")).toBe(
                        "/sdcard/Note/app.py",
                );
                expect(
                        sandboxPathOf("file:///data/user/0/com.carsaimz.xcoder/files/x.txt"),
                ).toBe("/data/user/0/com.carsaimz.xcoder/files/x.txt");
        });

        test("rejects unmappable schemes", () => {
                expect(sandboxPathOf("content://com.provider/docs/a.txt")).toBeNull();
                expect(sandboxPathOf("https://example.com/a.zip")).toBeNull();
                expect(sandboxPathOf("")).toBeNull();
                expect(sandboxPathOf(null)).toBeNull();
        });

        test("rejects trees the sandbox does not bind", () => {
                expect(sandboxPathOf("file:///system/build.prop")).toBeNull();
                expect(sandboxPathOf("file:///cache/leak.txt")).toBeNull();
        });

        test("decodes percent-encoded segments", () => {
                expect(
                        sandboxPathOf("file:///storage/emulated/0/My%20Project/a%20b.html"),
                ).toBe("/storage/emulated/0/My Project/a b.html");
        });
});

describe("terminalCwd.shellQuote", () => {
        test("escapes single quotes POSIX-style", () => {
                expect(shellQuote("/plain/path")).toBe("'/plain/path'");
                // "/storage/a'b" → '/storage/a'\''b'  (' closes, \' literal, '' reopens)
                expect(shellQuote("/storage/a'b")).toBe("'/storage/a" + "'\\''" + "b'");
        });
});

describe("terminalCwd.activeProjectCd", () => {
        test("builds a cd command for the active file's folder", () => {
                expect(
                        activeProjectCd({ uri: "file:///storage/emulated/0/site/index.html" }),
                ).toBe("cd '/storage/emulated/0/site'");
        });

        test("null for no file / unmappable file / root", () => {
                expect(activeProjectCd(null)).toBeNull();
                expect(activeProjectCd({ uri: "content://x/y" })).toBeNull();
                expect(activeProjectCd({ uri: "file:///storage/emulated/0/x.txt" })).toBe(
                        "cd '/storage/emulated/0'",
                );
                expect(activeProjectCd({})).toBeNull();
        });

        test("maps the XCoder public SAF tree to /public", () => {
                expect(
                        sandboxPathOf(
                                "content://com.carsaimz.xcoder.documents/tree/%2Fdata%2Fuser%2F0%2Fcom.carsaimz.xcoder%2Ffiles%2Fpublic::public%3AProjetos%2Fsite",
                        ),
                ).toBe("/public/Projetos/site");
                expect(
                        sandboxPathOf(
                                "content://com.carsaimz.xcoder.documents/tree/%2Fdata%2Fuser%2F0%2Fcom.carsaimz.xcoder%2Ffiles%2Fpublic",
                        ),
                ).toBe("/public");
        });

        test("maps Android external-storage SAF documents to /storage/emulated/0", () => {
                expect(
                        sandboxPathOf(
                                "content://com.android.externalstorage.documents/document/primary%3AProjects%2Fsite%2Findex.html",
                        ),
                ).toBe("/storage/emulated/0/Projects/site/index.html");
                expect(
                        sandboxPathOf(
                                "content://com.android.externalstorage.documents/tree/primary%3AProjects%2Fsite",
                        ),
                ).toBe("/storage/emulated/0/Projects/site");
                expect(
                        sandboxPathOf("content://com.android.externalstorage.documents/document/secondary%3Ax"),
                ).toBeNull();
        });

        test("maps app-owned file trees to their sandbox mounts", () => {
                expect(
                        sandboxPathOf(
                                "file:///data/user/0/com.carsaimz.xcoder/files/public/site/index.html",
                        ),
                ).toBe("/public/site/index.html");
                expect(
                        sandboxPathOf(
                                "file:///data/user/0/com.carsaimz.xcoder/files/alpine/home/x",
                        ),
                ).toBe("/home/x");
        });

        test("falls back to the open project folder when no file is active", () => {
                expect(
                        activeProjectCd(null, [
                                "content://com.android.externalstorage.documents/tree/primary%3AProjects%2Fsite",
                        ]),
                ).toBe("cd '/storage/emulated/0/Projects/site'");
        });

        test("active file wins over the open folders", () => {
                expect(
                        activeProjectCd(
                                { uri: "file:///sdcard/Note/app.py" },
                                [
                                        "content://com.android.externalstorage.documents/tree/primary%3AProjects%2Fsite",
                                ],
                        ),
                ).toBe("cd '/sdcard/Note'");
        });

        test("skips unmappable folders and returns null when nothing maps", () => {
                expect(
                        activeProjectCd(null, [
                                "content://com.termux.documents/tree/abc",
                                "https://example.com/x",
                        ]),
                ).toBeNull();
        });
});
