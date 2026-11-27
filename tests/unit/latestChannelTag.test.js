import { describe, expect, it } from "vitest";
import {
	filterChannelTags,
	isBetaTag,
	latestChannelTag,
} from "../../utils/scripts/latest-channel-tag.mjs";

// descending version-sorted list, as `git tag --sort=-v:refname` returns.
// Legacy beta tags (the channel was removed in v1.8.48) still exist in
// the repo and must stay excluded from stable comparisons.
const TAGS = [
	"v1.8.46-beta",
	"v1.8.45-beta",
	"v1.8.44",
	"v1.8.43",
	"v1.8.42-beta.3",
	"v1.8.42",
	"v1.7.0-rc.1",
];

describe("isBetaTag", () => {
	it("detects beta/rc suffixes", () => {
		expect(isBetaTag("v1.8.46-beta")).toBe(true);
		expect(isBetaTag("v1.8.46-beta.2")).toBe(true);
		expect(isBetaTag("v1.7.0-rc.1")).toBe(true);
		expect(isBetaTag("v1.8.44")).toBe(false);
		expect(isBetaTag("")).toBe(false);
	});
});

describe("filterChannelTags", () => {
	it("keeps only stable tags in the stable channel", () => {
		expect(filterChannelTags(TAGS, "stable")).toEqual([
			"v1.8.44",
			"v1.8.43",
			"v1.8.42",
		]);
	});

	it("keeps only beta/rc tags in the beta channel", () => {
		expect(filterChannelTags(TAGS, "beta")).toEqual([
			"v1.8.46-beta",
			"v1.8.45-beta",
			"v1.8.42-beta.3",
			"v1.7.0-rc.1",
		]);
	});
});

describe("latestChannelTag", () => {
	it("returns the highest stable tag", () => {
		expect(latestChannelTag(TAGS, "stable")).toBe("v1.8.44");
	});

	it("never returns a legacy beta tag for the stable channel", () => {
		// v1.8.46-beta sorts highest but is not stable — releases compare
		// against v1.8.44, the highest stable tag in this fixture
		expect(latestChannelTag(TAGS, "stable", "v1.8.44")).toBe("v1.8.43");
	});

	it("excludes a tag (force re-run must not compare with itself)", () => {
		expect(latestChannelTag(TAGS, "stable", "v1.8.44")).toBe("v1.8.43");
	});
});
