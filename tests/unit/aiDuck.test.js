import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/backend", () => ({
	backendConfig: vi.fn(() => null),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

import {
	duckChatCompletion,
	normalizeDuckMessages,
	parseDuckBody,
} from "lib/ai/duck";
import { chatCompletion, streamChatCompletion } from "lib/ai/client";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: (name) => headers[name] ?? headers[name.toLowerCase()] ?? null },
		text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
	};
}

describe("normalizeDuckMessages", () => {
	it("merges system prompts into the first user turn", () => {
		const result = normalizeDuckMessages([
			{ role: "system", content: "You are a coding helper." },
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "hi" },
			{ role: "user", content: "bye" },
		]);
		expect(result).toEqual([
			{ role: "user", content: "You are a coding helper.\n\nhello" },
			{ role: "assistant", content: "hi" },
			{ role: "user", content: "bye" },
		]);
	});

	it("joins consecutive same-role turns and drops leading assistant turns", () => {
		const result = normalizeDuckMessages([
			{ role: "assistant", content: "orphan" },
			{ role: "user", content: "a" },
			{ role: "user", content: "b" },
		]);
		expect(result).toEqual([{ role: "user", content: "a\n\nb" }]);
	});

	it("returns an empty list for garbage input", () => {
		expect(normalizeDuckMessages(null)).toEqual([]);
	});
});

describe("parseDuckBody", () => {
	it("parses duck SSE chunks ({message, action})", () => {
		const body = [
			'data: {"message":"Hel","created":1,"action":"success"}',
			'data: {"message":"lo","created":2,"action":"success"}',
			'data: {"action":"done"}',
		].join("\n");
		expect(parseDuckBody(body)).toBe("Hello");
	});

	it("parses OpenAI-ish SSE deltas", () => {
		const body = [
			'data: {"choices":[{"delta":{"content":"Hey"}}]}',
			"data: [DONE]",
		].join("\n");
		expect(parseDuckBody(body)).toBe("Hey");
	});

	it("parses a plain JSON answer", () => {
		expect(
			parseDuckBody(JSON.stringify({ choices: [{ message: { content: "ok" } }] })),
		).toBe("ok");
		expect(parseDuckBody(JSON.stringify({ message: "plain" }))).toBe("plain");
	});
});

describe("duckChatCompletion", () => {
	beforeEach(() => {
		fetchMock.mockReset();
		// status endpoint → x-vqd-4 token
		fetchMock.mockImplementation(async (url) => {
			if (String(url).includes("/status")) {
				return jsonResponse("", {
					headers: { "x-vqd-4": "vqd-token-1" },
				});
			}
			return jsonResponse('data: {"message":"Hi!"}');
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("handshakes (x-vqd-4) and returns the chat content", async () => {
		const result = await duckChatCompletion({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: "hello" }],
		});
		expect(result.content).toBe("Hi!");
		expect(result.toolCalls).toEqual([]);
		expect(result.raw.choices[0].message.content).toBe("Hi!");

		const chatCall = fetchMock.mock.calls.find(
			([url]) => String(url).includes("/chat"),
		);
		expect(chatCall).toBeTruthy();
		expect(chatCall[1].headers["x-vqd-4"]).toBe("vqd-token-1");
	});

	it("retries once with a fresh VQD when the endpoint answers 403", async () => {
		let chatCalls = 0;
		fetchMock.mockImplementation(async (url) => {
			if (String(url).includes("/status")) {
				return jsonResponse("", { headers: { "x-vqd-4": "fresh-vqd" } });
			}
			chatCalls += 1;
			if (chatCalls === 1) {
				return jsonResponse("blocked", { status: 403 });
			}
			return jsonResponse('data: {"message":"ok"}');
		});
		const result = await duckChatCompletion({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: "hello" }],
		});
		expect(result.content).toBe("ok");
		expect(chatCalls).toBe(2);
	});

	it("surfaces an actionable error when the session never arrives", async () => {
		fetchMock.mockImplementation(async (url) =>
			jsonResponse("", { headers: {} }),
		);
		await expect(
			duckChatCompletion({
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "hello" }],
			}),
		).rejects.toThrow(/x-vqd-4/);
	});
});

describe("client integration", () => {
	it("chatCompletion routes duckduckgo through the adapter", async () => {
		fetchMock.mockImplementation(async (url) => {
			if (String(url).includes("/status")) {
				return jsonResponse("", { headers: { "x-vqd-4": "vqd-x" } });
			}
			return jsonResponse('data: {"message":"routed"}');
		});
		const result = await chatCompletion({
			baseURL: "",
			apiKey: "",
			providerId: "duckduckgo",
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: "hi" }],
		});
		expect(result.content).toBe("routed");
	});

	it("streamChatCompletion refuses to stream for duckduckgo (non-HTTP error)", async () => {
		await expect(
			streamChatCompletion({
				baseURL: "",
				apiKey: "",
				providerId: "duckduckgo",
				model: "gpt-4o-mini",
				messages: [{ role: "user", content: "hi" }],
			}),
		).rejects.toThrow(/streaming not supported/);
	});
});
