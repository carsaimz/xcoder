import { describe, expect, it } from "vitest";
import {
	applyVersionToConfigXml,
	applyVersionToPackageJson,
	compareSemver,
	computeVersionCode,
	normalizeVersion,
	parseSemver,
	suffixVersion,
} from "../../utils/scripts/bump-version.mjs";

describe("parseSemver / normalizeVersion", () => {
	it("normalizes v-prefix and whitespace", () => {
		expect(normalizeVersion("v1.4.0")).toBe("1.4.0");
		expect(normalizeVersion("  V2.0.0 ")).toBe("2.0.0");
		expect(normalizeVersion("1.4.0-beta.1")).toBe("1.4.0-beta.1");
	});

	it("parses plain and pre-release versions", () => {
		expect(parseSemver("1.4.0")).toEqual({
			major: 1,
			minor: 4,
			patch: 0,
			prerelease: null,
		});
		expect(parseSemver("v1.4.0-beta.1")).toEqual({
			major: 1,
			minor: 4,
			patch: 0,
			prerelease: "beta.1",
		});
	});

	it("rejects malformed versions", () => {
		expect(parseSemver("")).toBeNull();
		expect(parseSemver("1.2")).toBeNull();
		expect(parseSemver("1.2.3.4")).toBeNull();
		expect(parseSemver("abc")).toBeNull();
	});
});

describe("compareSemver", () => {
	it("compares numerically per component", () => {
		expect(compareSemver("1.4.0", "1.3.9")).toBe(1);
		expect(compareSemver("1.10.0", "1.9.0")).toBe(1);
		expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
		expect(compareSemver("1.4.0", "1.4.0")).toBe(0);
	});

	it("a release is greater than its pre-releases", () => {
		expect(compareSemver("1.4.0", "1.4.0-beta.1")).toBe(1);
		expect(compareSemver("1.4.0-rc.1", "1.4.0")).toBe(-1);
	});

	it("orders pre-release identifiers per semver", () => {
		expect(compareSemver("1.4.0-beta.2", "1.4.0-beta.1")).toBe(1);
		expect(compareSemver("1.4.0-beta", "1.4.0-beta.1")).toBe(-1);
		expect(compareSemver("1.4.0-beta.1", "1.4.0-alpha.2")).toBe(1);
		expect(compareSemver("1.4.0-2", "1.4.0-10")).toBe(-1);
	});

	it("throws when a version is unparseable", () => {
		expect(() => compareSemver("1.2", "1.3.0")).toThrow(/Cannot compare/);
	});
});

describe("computeVersionCode", () => {
	it("follows major*10000 + minor*100 + patch", () => {
		expect(computeVersionCode("1.3.0")).toBe(10300);
		expect(computeVersionCode("1.10.0")).toBe(11000);
		expect(computeVersionCode("0.1.5")).toBe(105);
	});

	it("ignores pre-release suffixes", () => {
		expect(computeVersionCode("1.4.0-beta.1")).toBe(10400);
	});

	it("rejects invalid versions", () => {
		expect(() => computeVersionCode("nope")).toThrow(/Invalid version/);
	});
});

describe("suffixVersion", () => {
	it("appends a debug-style suffix", () => {
		expect(suffixVersion("1.3.0", "debug")).toBe("1.3.0-debug");
		expect(suffixVersion("v1.3.0", "")).toBe("1.3.0");
	});
});

describe("applyVersionToPackageJson", () => {
	it("replaces only the version field and keeps formatting", () => {
		const content = `{
  "name": "com.carsaimz.xcoder",
  "version": "1.3.0",
  "scripts": {
    "test": "vitest run"
  }
}`;
		const next = applyVersionToPackageJson(content, "1.4.0");
		expect(next).toContain('"version": "1.4.0"');
		expect(next).toContain('"name": "com.carsaimz.xcoder"');
		expect(next).toContain('"test": "vitest run"');
	});

	it("is idempotent when the version is already the target (release re-run)", () => {
		// Regression: package.json already at 1.4.14 + release 1.4.14
		// used to throw 'no "version" field found' because replace()
		// returned identical content.
		const content = `{
  "name": "com.carsaimz.xcoder",
  "version": "1.4.14",
  "scripts": {}
}`;
		expect(applyVersionToPackageJson(content, "1.4.14")).toBe(content);
	});

	it("inserts the version field when it is missing", () => {
		const content = `{
  "name": "com.carsaimz.xcoder",
  "description": "XCoder"
}`;
		const next = applyVersionToPackageJson(content, "1.4.14");
		expect(next).toContain('"name": "com.carsaimz.xcoder"');
		expect(next).toContain('"version": "1.4.14"');
		expect(() => JSON.parse(next)).not.toThrow();
	});

	it("inserts after displayName and keeps the original indentation", () => {
		const content = `{
\t"name": "pkg",
\t"displayName": "Pkg",
\t"scripts": {}
}`;
		const next = applyVersionToPackageJson(content, "2.0.0");
		const lines = next.split("\n");
		expect(lines[2]).toBe('\t"version": "2.0.0",');
		expect(() => JSON.parse(next)).not.toThrow();
	});
});

describe("applyVersionToConfigXml", () => {
	const xml = [
		"<?xml version='1.0' encoding='utf-8'?>",
		'<widget id="com.carsaimz.xcoder" android-versionCode="103" version="1.3.0"',
		'        versionCodeUrl="https://example.com">please ignore</widget>',
	].join("\n");

	it("updates versionName and versionCode", () => {
		const next = applyVersionToConfigXml(xml, "1.4.0", 10400);
		expect(next).toContain('android-versionCode="10400"');
		expect(next).toContain('version="1.4.0"');
	});

	it("never touches the XML declaration (single quotes)", () => {
		const next = applyVersionToConfigXml(xml, "1.4.0", 10400);
		expect(next).toContain("<?xml version='1.0' encoding='utf-8'?>");
	});

	it("can stamp a debug versionName without touching versionCode", () => {
		const next = applyVersionToConfigXml(xml, "1.3.0-debug", null);
		expect(next).toContain('version="1.3.0-debug"');
		expect(next).toContain('android-versionCode="103"');
	});

	it("throws when the widget tag is missing", () => {
		expect(() => applyVersionToConfigXml("<root />", "1.4.0")).toThrow(
			/<widget> tag not found/,
		);
	});
});
