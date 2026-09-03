import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildHeaders, sanitizeApiKey, endpoint } from "lib/ai/client";

// client.js only touches cordova/window inside request helpers; the header
// builders are pure. utils/Url is imported transitively and is DOM-free.
vi.mock("lib/settings", () => ({
	default: { value: {}, update: vi.fn() },
}));

describe("keyless default provider", () => {
	it("pollinations is the zero-config default", async () => {
		const { DEFAULT_PROVIDER_ID, PROVIDER_MAP } = await import("lib/ai/providers");
		expect(DEFAULT_PROVIDER_ID).toBe("pollinations");
		expect(PROVIDER_MAP.pollinations?.noKeyRequired).toBe(true);
		expect(String(PROVIDER_MAP.pollinations?.baseURL || "")).toContain(
			"text.pollinations.ai",
		);
	});
});

describe("sanitizeApiKey", () => {
	it("trims whitespace and newlines from pasted keys", () => {
		expect(sanitizeApiKey("  sk-or-v1-abc \n")).toBe("sk-or-v1-abc");
		expect(sanitizeApiKey("gsk_\tkey")).toBe("gsk_key");
	});

	it("strips wrapping quotes", () => {
		expect(sanitizeApiKey('"sk-test"')).toBe("sk-test");
		expect(sanitizeApiKey("'sk-test'")).toBe("sk-test");
	});

	it("keeps interior content intact", () => {
		expect(sanitizeApiKey("sk-a b")).toBe("sk-a b");
		expect(sanitizeApiKey("")).toBe("");
	});
});

describe("buildHeaders", () => {
	it("sends no Authorization header for keyless providers", () => {
		const headers = buildHeaders("https://text.pollinations.ai/openai", "");
		expect(headers.Authorization).toBeUndefined();
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("sends Bearer auth for keyed providers", () => {
		const headers = buildHeaders("https://api.groq.com/openai/v1", " gsk_clean ");
		expect(headers.Authorization).toBe("Bearer gsk_clean");
	});

	it("adds the google key header for gemini", () => {
		const headers = buildHeaders("https://generativelanguage.googleapis.com", "AIzaTest", "google");
		expect(headers.Authorization).toBe("Bearer AIzaTest");
		expect(headers["x-goog-api-key"]).toBe("AIzaTest");
	});
});

describe("endpoint", () => {
	it("joins base URL and path without double slashes", () => {
		expect(endpoint("https://api.x.com/v1/", "chat/completions")).toBe(
			"https://api.x.com/v1/chat/completions",
		);
		expect(endpoint("https://api.x.com/v1", "/chat/completions")).toBe(
			"https://api.x.com/v1/chat/completions",
		);
	});
});
