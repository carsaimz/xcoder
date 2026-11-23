import { describe, expect, it } from "vitest";
import { extractChangelogSection } from "utils/changelogSection";

const MD = [
	"# Changelog / Registro de mudanças",
	"",
	"<a id=\"português\"></a>",
	"",
	"## [1.8.30] - 2026-11-23",
	"",
	"### Plugins — ponte com o marketplace do Acode",
	"",
	"- item um",
	"- item dois",
	"",
	"## [1.8.29] - 2026-11-14",
	"",
	"### Git",
	"",
	"- item antigo",
	"",
	"## v1.8.28",
	"",
	"- mais antigo ainda",
	"",
].join("\n");

describe("extractChangelogSection", () => {
	it("extracts the bracketed current-version section", () => {
		const section = extractChangelogSection(MD, "1.8.30");
		expect(section).not.toBeNull();
		expect(section).toContain("ponte com o marketplace do Acode");
		expect(section).toContain("item dois");
		expect(section).not.toContain("item antigo");
	});

	it("extracts bracketed older versions", () => {
		const section = extractChangelogSection(MD, "1.8.29");
		expect(section).toContain("item antigo");
		expect(section).not.toContain("item dois");
	});

	it("supports the v-prefixed heading style", () => {
		const section = extractChangelogSection(MD, "1.8.28");
		expect(section).toContain("mais antigo ainda");
	});

	it("matches the exact version, never a prefix", () => {
		expect(extractChangelogSection(MD, "1.8.3")).toBeNull();
		expect(extractChangelogSection(MD, "9.9.9")).toBeNull();
	});

	it("returns null for empty input", () => {
		expect(extractChangelogSection("", "1.8.30")).toBeNull();
		expect(extractChangelogSection(null, "1.8.30")).toBeNull();
		expect(extractChangelogSection(MD, "")).toBeNull();
	});
});
