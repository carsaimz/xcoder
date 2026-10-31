// @vitest-environment happy-dom
/**
 * helpers.basenameRange() — pre-selected range for the rename prompt.
 * Selecting the name WITHOUT the last extension (Acode #3004 polish)
 * lets the user type a replacement while keeping ".html"/".tar.gz" etc.
 */
import assert from "node:assert/strict";
import { describe, expect, test } from "vitest";

import helpers from "utils/helpers";

describe("helpers.basenameRange", () => {
        test("selects the name before the extension", () => {
                expect(helpers.basenameRange("index.html")).toStrictEqual([0, 5]);
                expect(helpers.basenameRange("app.min.js")).toStrictEqual([0, 7]);
                expect(helpers.basenameRange("archive.tar.gz")).toStrictEqual([0, 11]);
        });

        test("keeps dotfiles intact (dot at position 0 is not an extension)", () => {
                expect(helpers.basenameRange(".gitignore")).toStrictEqual([0, 10]);
                // ".env.local" — selection stops before the LAST dot: typing a
                // replacement swaps the basename and keeps ".local"
                expect(helpers.basenameRange(".env.local")).toStrictEqual([0, 4]);
        });

        test("names without a dot select the whole value", () => {
                expect(helpers.basenameRange("Makefile")).toStrictEqual([0, 8]);
                expect(helpers.basenameRange("README")).toStrictEqual([0, 6]);
        });

        test("edge cases do not throw", () => {
                expect(helpers.basenameRange("")).toStrictEqual([0, 0]);
                expect(helpers.basenameRange(null)).toStrictEqual([0, 0]);
                expect(helpers.basenameRange(undefined)).toStrictEqual([0, 0]);
                expect(helpers.basenameRange(".")).toStrictEqual([0, 1]);
                assert.ok(Array.isArray(helpers.basenameRange("x.txt")));
        });
});
