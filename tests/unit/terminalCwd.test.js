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
});
