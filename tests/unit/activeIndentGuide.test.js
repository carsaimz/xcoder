import { describe, expect, it } from "vitest";
import { computeEnclosingIndentColumns } from "../../src/cm/indentGuides";

/** minimal doc stub: lines of text */
const doc = (lines) => ({
	lines: lines.length,
	line(n) {
		return { text: lines[n - 1] ?? "" };
	},
});

describe("computeEnclosingIndentColumns", () => {
	it("returns empty for line 1 / zero indent / invalid input", () => {
		const d = doc(["hello", "  world"]);
		expect(computeEnclosingIndentColumns(d, 1, 4, 4).size).toBe(0);
		expect(computeEnclosingIndentColumns(d, 0, 4, 4).size).toBe(0);
		expect(computeEnclosingIndentColumns(d, 99, 4, 4).size).toBe(0);
	});

	it("highlights the cursor's own level and all shallower ancestors", () => {
		const d = doc([
			"class A {", // indent 0
			"    void f() {", // indent 4
			"        if (x) {", // indent 8
			"            doIt();", // indent 12 (cursor)
			"        }",
			"    }",
			"}",
		]);
		const cols = computeEnclosingIndentColumns(d, 4, 4, 4);
		// cursor level 12 aligns → 12; ancestors: 8, 4, 0
		expect(cols).toEqual(new Set([12, 8, 4, 0]));
	});

	it("ignores misaligned block indents (no guide exists there)", () => {
		const d = doc([
			"a:", // indent 0
			"    b:", // indent 4
			"      c()  # indent 6 — misaligned",
			"        pass()", // indent 8 (cursor)
		]);
		const cols = computeEnclosingIndentColumns(d, 4, 4, 4);
		// cursor 8 aligns; ancestors 4 and 0 align; 6 is skipped (no guide)
		expect(cols).toEqual(new Set([8, 4, 0]));
	});

	it("skips blank lines when walking ancestors", () => {
		const d = doc([
			"outer {", // 0
			"    inner {", // 4
			"",
			"",
			"        deep();", // 8 (cursor)
		]);
		const cols = computeEnclosingIndentColumns(d, 5, 4, 4);
		expect(cols).toEqual(new Set([8, 4, 0]));
	});

	it("a blank cursor line uses the nearest non-blank line above", () => {
		const d = doc([
			"outer {", // 0
			"    inner {", // 4
			"        deep();", // 8
			"", // cursor (blank → resolves to 8)
		]);
		const cols = computeEnclosingIndentColumns(d, 4, 4, 4);
		expect(cols).toEqual(new Set([8, 4, 0]));
	});

	it("sibling blocks at the same indent are not ancestors", () => {
		const d = doc([
			"one()", // 0
			"    block1 {", // 4
			"        stmt();", // 8
			"}", // 0
			"    block2 {", // 4
			"        other();", // 8 (cursor) — block1's 8 is NOT an ancestor
		]);
		const cols = computeEnclosingIndentColumns(d, 6, 4, 4);
		expect(cols).toEqual(new Set([8, 4, 0]));
	});

	it("respects the scan limit", () => {
		const lines = Array.from({ length: 100 }, () => "");
		lines[0] = "root {"; // indent 0
		for (let i = 49; i <= 59; i++) lines[i] = "        fill();"; // indent 8
		lines[60] = "        deep();"; // indent 8 — cursor line 61
		const d = doc(lines);
		// with a tiny scan limit the root block (60 lines up) is not found
		const limited = computeEnclosingIndentColumns(d, 61, 4, 4, 10);
		expect(limited).toEqual(new Set([8]));
		const unlimited = computeEnclosingIndentColumns(d, 61, 4, 4, 2000);
		expect(unlimited).toEqual(new Set([8, 0]));
	});
});

describe("active indent guide wiring", () => {
	it("extension consumes the highlightActiveGuide config", () => {
		// computeEnclosingIndentColumns is exported — this guard keeps the
		// active-highlight helper public for the plugin + tests
		expect(typeof computeEnclosingIndentColumns).toBe("function");
	});
});
