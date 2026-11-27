import { describe, expect, it } from "vitest";
import {
        diffLines,
        diffStats,
        splitLines,
} from "../../src/pages/tools/diff/lineDiff";

describe("splitLines", () => {
        it("splits without trailing-empty artifact", () => {
                expect(splitLines("a\nb\n")).toEqual(["a", "b", ""]);
                expect(splitLines("")).toEqual([]);
                expect(splitLines(null)).toEqual([]);
        });
});

describe("diffLines", () => {
        it("returns all-equal rows for identical inputs", () => {
                const rows = diffLines(["a", "b"], ["a", "b"]);
                expect(rows.every((row) => row.type === "equal")).toBe(true);
        });

        it("marks pure additions with right-side line numbers", () => {
                const rows = diffLines(["a"], ["a", "b", "c"]);
                const added = rows.filter((row) => row.type === "add");
                expect(added.map((row) => row.bLine)).toEqual([2, 3]);
        });

        it("marks pure removals with left-side line numbers", () => {
                const rows = diffLines(["a", "b", "c"], ["a"]);
                const removed = rows.filter((row) => row.type === "del");
                expect(removed.map((row) => row.aLine)).toEqual([2, 3]);
        });

        it("maps edited middle lines back to both documents", () => {
                const rows = diffLines(["a", "old", "c"], ["a", "new", "c"]);
                expect(rows).toContainEqual({ type: "del", aLine: 2 });
                expect(rows).toContainEqual({ type: "add", bLine: 2 });
                expect(rows.some((row) => row.type === "equal" && row.aLine === 1)).toBe(
                        true,
                );
        });

        it("keeps line numbers correct with a shared prefix", () => {
                const a = ["x", "y", "1", "2", "3"];
                const b = ["x", "y", "9"];
                const rows = diffLines(a, b);
                const dels = rows.filter((row) => row.type === "del");
                expect(dels.map((row) => row.aLine)).toEqual([3, 4, 5]);
        });
});

describe("diffStats", () => {
        it("reports identical documents", () => {
                expect(diffStats("a\nb", "a\nb")).toEqual({
                        added: 0,
                        removed: 0,
                        changed: 0,
                        identical: true,
                });
        });

        it("counts additions and removals", () => {
                const stats = diffStats("a\nb\nc", "a\nX\nY\nZ\nc");
                expect(stats.added).toBe(3);
                expect(stats.removed).toBe(1);
                expect(stats.identical).toBe(false);
        });

        it("handles empty vs non-empty", () => {
                const stats = diffStats("", "one\ntwo");
                expect(stats.added).toBe(2);
                expect(stats.removed).toBe(0);
        });
});
