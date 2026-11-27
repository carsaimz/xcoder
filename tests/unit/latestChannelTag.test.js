import { describe, expect, it } from "vitest";
import {
	filterChannelTags,
	isBetaTag,
	latestChannelTag,
} from "../../utils/scripts/latest-channel-tag.mjs";

// descending version-sorted list, as `git tag --sort=-v:refname` returns
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

	it("returns the highest beta tag", () => {
		expect(latestChannelTag(TAGS, "beta")).toBe("v1.8.46-beta");
	});

	it("excludes a tag (force re-run must not compare with itself)", () => {
		expect(latestChannelTag(TAGS, "beta", "v1.8.46-beta")).toBe(
			"v1.8.45-beta",
		);
		expect(latestChannelTag(TAGS, "stable", "v1.8.44")).toBe("v1.8.43");
	});

	it("returns empty when the channel has no tags", () => {
		expect(latestChannelTag([], "stable")).toBe("");
		expect(latestChannelTag([], "beta")).toBe("");
		expect(latestChannelTag(["v1.8.44"], "beta")).toBe("");
		expect(latestChannelTag(["v1.8.44-beta"], "stable")).toBe("");
	});
});
