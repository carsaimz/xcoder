import { describe, expect, it } from "vitest";
import {
	applyServerFilters,
	collectLanguages,
	formatBytes,
	parsePackageSpec,
} from "../../src/settings/lspServerStats";

describe("lspServerStats", () => {
	describe("parsePackageSpec", () => {
		it("keeps plain names", () => {
			expect(parsePackageSpec("ty", "pip")).toBe("ty");
			expect(parsePackageSpec("ty", "npm")).toBe("ty");
		});

		it("strips pip extras and version pins", () => {
			expect(parsePackageSpec("python-lsp-server[all]", "pip")).toBe(
				"python-lsp-server",
			);
			expect(parsePackageSpec("ruff>=0.4", "pip")).toBe("ruff");
		});

		it("keeps scoped npm names", () => {
			expect(parsePackageSpec("@vtsls/language-server", "npm")).toBe(
				"@vtsls/language-server",
			);
			expect(parsePackageSpec("@tailwindcss/language-server@1.0", "npm")).toBe(
				"@tailwindcss/language-server",
			);
		});

		it("resolves npm alias specs to the real package", () => {
			expect(
				parsePackageSpec("@typescript/native@npm:typescript@^7.0.2", "npm"),
			).toBe("typescript");
		});

		it("strips plain npm version pins", () => {
			expect(parsePackageSpec("typescript@5.4", "npm")).toBe("typescript");
		});

		it("returns null for junk", () => {
			expect(parsePackageSpec("", "npm")).toBe(null);
			expect(parsePackageSpec("   ", "pip")).toBe(null);
		});
	});

	describe("formatBytes", () => {
		it("formats the usual buckets", () => {
			expect(formatBytes(0)).toBe(null);
			expect(formatBytes(-5)).toBe(null);
			expect(formatBytes(900)).toBe("900 B");
			expect(formatBytes(44 * 1024)).toBe("44 KB");
			expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
			expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
		});
	});

	describe("applyServerFilters", () => {
		const rows = [
			{
				label: "Python (ty)",
				languages: ["python"],
				installed: true,
				estimate: 5 * 1024 * 1024,
				installedBytes: 8 * 1024 * 1024,
			},
			{
				label: "Tailwind CSS",
				languages: ["html", "css"],
				installed: false,
				estimate: 12 * 1024 * 1024,
				installedBytes: null,
			},
			{
				label: "Lua",
				languages: ["luau"],
				installed: null,
				estimate: null,
				installedBytes: 1 * 1024 * 1024,
			},
		];

		it("filters by installed state", () => {
			const installed = applyServerFilters(rows, { filter: "installed" });
			expect(installed).toHaveLength(1);
			expect(installed[0].label).toBe("Python (ty)");

			const missing = applyServerFilters(rows, { filter: "missing" });
			expect(missing).toHaveLength(1);
			expect(missing[0].label).toBe("Tailwind CSS");
		});

		it("filters by language and query", () => {
			expect(
				applyServerFilters(rows, { language: "html" }).map((r) => r.label),
			).toEqual(["Tailwind CSS"]);
			expect(
				applyServerFilters(rows, { query: "python" }).map((r) => r.label),
			).toEqual(["Python (ty)"]);
		});

		it("sorts by size using installed size then estimate", () => {
			const sorted = applyServerFilters(rows, { sortBy: "size" });
			expect(sorted[0].label).toBe("Tailwind CSS");
			expect(sorted[2].label).toBe("Lua");
		});

		it("sorts by status putting installed servers first", () => {
			const sorted = applyServerFilters(rows, { sortBy: "status" });
			expect(sorted[0].label).toBe("Python (ty)");
		});

		it("sorts by first language", () => {
			const sorted = applyServerFilters(rows, { sortBy: "language" });
			expect(sorted[0].label).toBe("Tailwind CSS");
		});
	});

	describe("collectLanguages", () => {
		it("collects distinct sorted languages", () => {
			expect(
				collectLanguages([
					{ languages: ["python", "javascript"] },
					{ languages: ["html", "python"] },
					{ languages: [] },
				]),
			).toEqual(["html", "javascript", "python"]);
		});
	});
});
