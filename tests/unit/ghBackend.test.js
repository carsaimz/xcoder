import { afterEach, describe, expect, it, vi } from "vitest";
import {
	b64decodeUtf8,
	b64encodeUtf8,
	dbPath,
	isConfigured,
	parseRepoInput,
} from "lib/ghBackend";

// minimal settings mock — ghBackend only reads a few fields
vi.mock("lib/settings", () => ({
	default: {
		value: {
			ghRepo: "",
			ghToken: "",
			ghBranch: "main",
		},
		update: vi.fn(),
	},
}));

import settings from "lib/settings";

describe("parseRepoInput", () => {
	it("accepts owner/repo and github urls", () => {
		expect(parseRepoInput("carsaimz/xcoder-backend")).toEqual({
			owner: "carsaimz",
			repo: "xcoder-backend",
		});
		expect(
			parseRepoInput("https://github.com/carsaimz/xcoder-backend.git"),
		).toEqual({ owner: "carsaimz", repo: "xcoder-backend" });
		expect(parseRepoInput("  https://github.com/u/r/  ")).toEqual({
			owner: "u",
			repo: "r",
		});
	});

	it("rejects invalid input", () => {
		expect(parseRepoInput("")).toBeNull();
		expect(parseRepoInput("just-a-name")).toBeNull();
		expect(parseRepoInput("https://gitlab.com/u/r")).toBeNull();
	});
});

describe("base64 helpers", () => {
	it("round-trips unicode text", () => {
		const text = "olá mundo — 你好世界 🚀";
		expect(b64decodeUtf8(b64encodeUtf8(text))).toBe(text);
	});

	it("decodes github-style base64 with newlines", () => {
		const encoded = b64encodeUtf8("hello world");
		expect(b64decodeUtf8(encoded.replace(/(.{4})/g, "$1\n"))).toBe(
			"hello world",
		);
	});
});

describe("dbPath", () => {
	it("prefixes and normalizes document paths", () => {
		expect(dbPath("xcoder/backup.json")).toBe("db/xcoder/backup.json");
		expect(dbPath("/a/b.json")).toBe("db/a/b.json");
	});
});

describe("isConfigured", () => {
	it("requires repo and token", () => {
		expect(isConfigured()).toBe(false);
		settings.value.ghRepo = "carsaimz/xcoder-backend";
		expect(isConfigured()).toBe(false);
		settings.value.ghToken = "github_pat_test";
		expect(isConfigured()).toBe(true);
	});
});

afterEach(() => {
	settings.value.ghRepo = "";
	settings.value.ghToken = "";
});
