import { describe, expect, it, vi } from "vitest";

// keep the UI/fs graph out of the unit test
vi.mock("fileSystem", () => ({ default: vi.fn(() => ({})) }));
vi.mock("utils/Url", () => ({
	default: {
		dirname: (url) => url,
		join: (...parts) => parts.join("/"),
		basename: (url) => String(url).split("/").pop(),
	},
}));
vi.mock("lib/ai/vshell", () => ({ getRoot: vi.fn(() => "root://workspace") }));

import {
	buildImageUrl,
	parseImageArgs,
} from "lib/ai/imageGen";

describe("buildImageUrl", () => {
	it("encodes the prompt and applies defaults", () => {
		const url = buildImageUrl({ prompt: "a red apple" });
		expect(url).toContain("https://image.pollinations.ai/prompt/a%20red%20apple");
		expect(url).toContain("width=1024");
		expect(url).toContain("height=1024");
		expect(url).toContain("model=flux");
		expect(url).toContain("nologo=true");
		expect(url).toContain("referrer=xcoder");
	});

	it("clamps sizes and keeps known models", () => {
		const url = buildImageUrl({
			prompt: "x",
			width: 9999,
			height: 100,
			model: "turbo",
		});
		expect(url).toContain("width=2048");
		expect(url).toContain("height=256");
		expect(url).toContain("model=turbo");
	});

	it("falls back to flux for unknown models", () => {
		expect(buildImageUrl({ prompt: "x", model: "dalle" })).toContain(
			"model=flux",
		);
	});
});

describe("parseImageArgs", () => {
	it("treats plain text as the prompt", () => {
		const parsed = parseImageArgs("a cat on a roof");
		expect(parsed.prompt).toBe("a cat on a roof");
		expect(parsed.width).toBe(1024);
		expect(parsed.height).toBe(1024);
		expect(parsed.model).toBe("flux");
	});

	it("reads WxH hints", () => {
		const parsed = parseImageArgs("neon city 768x512");
		expect(parsed.prompt).toBe("neon city");
		expect(parsed.width).toBe(768);
		expect(parsed.height).toBe(512);
	});

	it("reads w= h= hints and the --turbo flag", () => {
		const parsed = parseImageArgs("--turbo w=512 h=256 a tiny robot");
		expect(parsed.prompt).toBe("a tiny robot");
		expect(parsed.width).toBe(512);
		expect(parsed.height).toBe(256);
		expect(parsed.model).toBe("turbo");
	});

	it("returns an empty prompt when only flags are given", () => {
		// the chat UI strips the "/image" prefix before parsing
		expect(parseImageArgs("").prompt).toBe("");
		expect(parseImageArgs("--turbo 512x512").prompt).toBe("");
	});
});
