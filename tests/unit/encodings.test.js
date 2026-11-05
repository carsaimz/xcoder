// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * initEncodings is the first native call of the boot sequence and runs
 * BEFORE lang.set() populates window.strings. Regression: when the native
 * list failed (e.g. desktop before the System service implemented
 * "get-available-encodings"), the error callback referenced the bare
 * `strings` global and crashed the whole app with
 * "ReferenceError: strings is not defined" on the splash screen.
 */

const execHandlers = vi.hoisted(() => ({ current: null }));

vi.stubGlobal(
        "cordova",
        {
                exec(success, fail, service, action) {
                        execHandlers.current = { success, fail, service, action };
                },
        },
);

vi.mock("lib/settings", () => ({
        default: {
                value: { defaultFileEncoding: "auto" },
                uiSettings: {},
                async update() {},
                get(key) {
                        return this.value[key];
                },
                on() {},
                off() {},
                async reset() {},
        },
}));

import {
        getEncoding,
        getEncodingName,
        initEncodings,
} from "../../src/utils/encodings.js";

describe("initEncodings", () => {
        beforeEach(() => {
                execHandlers.current = null;
                vi.spyOn(console, "warn").mockImplementation(() => {});
                delete window.strings;
        });

        it("requests the native list from the System service", async () => {
                const promise = initEncodings();
                expect(execHandlers.current).toMatchObject({
                        service: "System",
                        action: "get-available-encodings",
                });
                execHandlers.current.success({
                        "UTF-8": { label: "Unicode (UTF-8)", aliases: ["utf8"], name: "UTF-8" },
                });
                await promise;
        });

        it("resolves with default charsets when the native list fails", async () => {
                const promise = initEncodings();
                execHandlers.current.fail(new Error("unsupported action"));
                await expect(promise).resolves.toBeUndefined();

                // Common charsets stay usable even without the native answer.
                expect(getEncodingName("UTF-8")).toBe("UTF-8");
                expect(getEncodingName("windows-1252")).toBe("windows-1252");
                expect(getEncodingName("ISO-8859-1")).toBe("ISO-8859-1");
                expect(getEncodingName("utf-16le")).toBe("UTF-16LE");
                expect(getEncodingName("ascii")).toBe("US-ASCII");
        });

        it("never touches the strings global on the failure path", async () => {
                // window.strings is deliberately deleted: before this regression fix
                // the failure callback crashed with a ReferenceError.
                const promise = initEncodings();
                expect(() => execHandlers.current.fail(new Error("boom"))).not.toThrow();
                await promise;
                expect(window.strings).toBeUndefined();
        });

        it("prefers the native list over defaults on success", async () => {
                const promise = initEncodings();
                execHandlers.current.success({
                        "KOI8-R": { label: "Cyrillic", aliases: ["koi8"], name: "KOI8-R" },
                        "UTF-8": { label: "Native UTF-8", aliases: [], name: "UTF-8" },
                });
                await promise;
                expect(getEncoding("koi8")?.name).toBe("KOI8-R");
                expect(getEncoding("UTF-8")?.label).toBe("Native UTF-8");
        });
});
