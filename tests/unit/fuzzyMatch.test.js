import { describe, expect, it } from "vitest";
import {
	fuzzyScore,
	highlightMatches,
	rankCandidates,
} from "../../src/utils/fuzzyMatch";

describe("fuzzyScore", () => {
	it("returns null when the query is not a subsequence", () => {
		expect(fuzzyScore("zq", "app.js")).toBeNull();
		expect(fuzzyScore("jsa", "app.js")).toBeNull();
	});

	it("returns null for empty query", () => {
		expect(fuzzyScore("", "app.js")).toBeNull();
	});

	it("scores a plain subsequence", () => {
		const res = fuzzyScore("ap", "app.js");
		expect(res).not.toBeNull();
		expect(res.indices).toEqual([0, 1]);
	});

	it("prefers the start of the string", () => {
		const atStart = fuzzyScore("ma", "main.js").score;
		const midWord = fuzzyScore("ai", "main.js").score;
		expect(atStart).toBeGreaterThan(midWord);
	});

	it("prefers basename matches over path matches", () => {
		const inName = fuzzyScore("app", "src/app.js", 4).score;
		const inPath = fuzzyScore("src", "src/app.js", 4).score;
		expect(inName).toBeGreaterThan(inPath);
	});

	it("rewards consecutive runs", () => {
		const consecutive = fuzzyScore("app", "app.js").score;
		const scattered = fuzzyScore("ap", "a_x_p.js").score;
		expect(consecutive).toBeGreaterThan(scattered);
	});
});

describe("highlightMatches", () => {
	it("wraps matched characters in mark elements", () => {
		const html = highlightMatches("app.js", [0, 1, 2]);
		expect(html).toContain("<mark");
		expect(html).toContain("</mark>");
	});

	it("escapes html entities in names", () => {
		const html = highlightMatches("<b>", []);
		expect(html).toBe("&lt;b&gt;");
	});

	it("returns plain escaped text when there are no indices", () => {
		expect(highlightMatches("a&b", [])).toBe("a&amp;b");
	});
});

describe("rankCandidates", () => {
	const items = [
		{ name: "settings.js", path: "src/lib/settings.js", priority: 4 },
		{ name: "app.js", path: "src/app.js", priority: 3 },
		{ name: "main.js", path: "src/main.js", priority: 2 },
	];

	it("filters out non-matching candidates", () => {
		const ranked = rankCandidates(items, "zzz");
		expect(ranked).toHaveLength(0);
	});

	it("ranks exact basename matches first", () => {
		const ranked = rankCandidates(
			[
				{ name: "utils.js", path: "src/lib/utils.js", priority: 9 },
				{ name: "app.js", path: "src/app.js", priority: 9 },
			],
			"app",
		);
		expect(ranked[0].item.name).toBe("app.js");
		expect(ranked[0].indices).toEqual([0, 1, 2]);
	});

	it("breaks score ties by priority", () => {
		const ranked = rankCandidates(
			[
				{ name: "bbb.js", path: "x/bbb.js", priority: 5 },
				{ name: "aaa.js", path: "x/aaa.js", priority: 1 },
			],
			"",
		);
		expect(ranked[0].item.name).toBe("aaa.js");
	});

	it("respects the result limit", () => {
		const many = Array.from({ length: 80 }, (_, i) => ({
			name: `file${i}.js`,
			path: `src/file${i}.js`,
			priority: 3,
		}));
		expect(rankCandidates(many, "file", 50)).toHaveLength(50);
	});

	it("keeps insertion (priority) order without a query", () => {
		const ranked = rankCandidates(items, "");
		expect(ranked.map((r) => r.item.name)).toEqual([
			"main.js",
			"app.js",
			"settings.js",
		]);
	});

	it("matches when only the path matches the query", () => {
		const ranked = rankCandidates(
			[{ name: "index.js", path: "src/handlers/index.js", priority: 3 }],
			"handlers",
		);
		expect(ranked).toHaveLength(1);
	});
});
