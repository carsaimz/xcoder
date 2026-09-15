import { wrappedIndentColumns } from "cm/indentedLineWrapping";
import { describe, expect, it } from "vitest";

describe("wrapped line indentation", () => {
	it("preserves space indentation and stops at content", () => {
		expect(wrappedIndentColumns("   code   ", 4, 40)).toBe(3);
		expect(wrappedIndentColumns("code", 4, 40)).toBe(0);
		expect(wrappedIndentColumns("", 4, 40)).toBe(0);
	});
	it("counts tabs from their current column and rounds mixed indentation up", () => {
		expect(wrappedIndentColumns(" \tcode", 4, 40)).toBe(4);
		expect(wrappedIndentColumns(" \t  code", 4, 40)).toBe(8);
		expect(wrappedIndentColumns("\t code", 8, 40)).toBe(16);
	});
	it("rounds space indentation to preserve content tab alignment", () => {
		expect(wrappedIndentColumns("  key\tvalue", 4, 40)).toBe(4);
	});
	it("caps deep indentation without introducing fractional tab stops", () => {
		expect(wrappedIndentColumns(" ".repeat(10000), 4, 13)).toBe(13);
		expect(wrappedIndentColumns("\t".repeat(10000), 4, 13)).toBe(12);
		expect(wrappedIndentColumns("\tcode", 4, 3)).toBe(0);
		expect(wrappedIndentColumns("  code", 4, 0)).toBe(0);
	});
	it("extra indent modes add whole tab stops for unindented lines", () => {
		expect(wrappedIndentColumns("code", 4, 40, "indent")).toBe(4);
		expect(wrappedIndentColumns("code", 4, 40, "deepIndent")).toBe(8);
		expect(wrappedIndentColumns("code", 4, 40, "none")).toBe(0);
		// Extra levels stay capped by the measured limit, tab-aligned.
		expect(wrappedIndentColumns("code", 4, 6, "indent")).toBe(4);
		expect(wrappedIndentColumns("code", 4, 6, "deepIndent")).toBe(4);
	});
	it("extra indent modes add on top of the line's own indentation", () => {
		expect(wrappedIndentColumns("  code", 4, 40, "indent")).toBe(6);
		expect(wrappedIndentColumns("\tcode", 4, 40, "deepIndent")).toBe(12);
		// "none" mode never indents, even for indented lines.
		expect(wrappedIndentColumns("  code", 4, 40, "none")).toBe(0);
	});
});
