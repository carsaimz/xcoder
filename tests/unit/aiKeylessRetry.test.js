import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Keyless (built-in) provider hardening in lib/ai/client.js:
 *  - requests against the keyless providers are retried on 429/5xx
 *  - keyed providers are NOT retried (their errors surface immediately)
 *  - Pollinations requests carry the `referrer` etiquette field
 */

const clientModuleUrl = "lib/ai/client";

// client.js pulls utils/Url only for a re-export — stub it to keep the
// module importable in isolation.
vi.mock("utils/Url", () => ({ default: class Url {} }));

const { streamChatCompletion, chatCompletion } = await import(clientModuleUrl);

/** Minimal response stub (fetch shape); `stream` adds a body reader. */
function fetchResponse({ ok = true, status = 200, body = "", json = null, stream = false }) {
        const response = {
                ok,
                status,
                statusText: ok ? "OK" : "Error",
                text: async () => body,
                json: async () => json ?? JSON.parse(body || "{}"),
                body: null,
        };
        if (stream) {
                const encoder = new TextEncoder();
                const chunks = [encoder.encode(body)];
                response.body = {
                        getReader() {
                                return {
                                        read: async () =>
                                                chunks.length
                                                        ? { done: false, value: chunks.shift() }
                                                        : { done: true, value: undefined },
                                };
                        },
                };
        }
        return response;
}

/** Installs a fetch mock that answers with the given queued responses. */
function mockFetchQueue(responses) {
        const calls = [];
        const fetchMock = vi.fn(async (_url, init) => {
                calls.push({ url: _url, init });
                const next = responses.shift();
                if (!next) throw new Error("unexpected extra fetch call");
                if (next instanceof Error) throw next;
                return next;
        });
        globalThis.fetch = fetchMock;
        return { fetchMock, calls };
}

afterEach(() => {
        vi.restoreAllMocks();
});

describe("keyless provider retry (built-in AI hardening)", () => {
        it("retries a 429 from pollinations and succeeds on the 2nd attempt", async () => {
                const okBody =
                        'data: {"choices":[{"delta":{"content":"hi"},"index":0}]}\n\ndata: [DONE]\n\n';
                const { fetchMock } = mockFetchQueue([
                        fetchResponse({
                                ok: false,
                                status: 429,
                                body: "rate limited",
                        }),
                        fetchResponse({ ok: true, status: 200, body: okBody, stream: true }),
                ]);

                const result = await streamChatCompletion({
                        baseURL: "https://text.pollinations.ai/openai",
                        apiKey: "",
                        providerId: "pollinations",
                        model: "openai-fast",
                        messages: [{ role: "user", content: "hi" }],
                });

                expect(fetchMock).toHaveBeenCalledTimes(2);
                expect(result.content).toBe("hi");
        }, 15000);

        it("does NOT retry keyed requests (real provider errors surface fast)", async () => {
                const { fetchMock } = mockFetchQueue([
                        fetchResponse({
                                ok: false,
                                status: 429,
                                body: "quota exceeded",
                        }),
                ]);

                await expect(
                        chatCompletion({
                                baseURL: "https://api.groq.com/openai/v1",
                                apiKey: "gsk_test",
                                providerId: "groq",
                                model: "llama-3.3-70b-versatile",
                                messages: [{ role: "user", content: "hi" }],
                        }),
                ).rejects.toThrow(/429/);

                expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("stops retrying when the signal is already aborted", async () => {
                const controller = new AbortController();
                controller.abort();
                const { fetchMock } = mockFetchQueue([
                        fetchResponse({
                                ok: false,
                                status: 429,
                                body: "rate limited",
                        }),
                ]);

                await expect(
                        chatCompletion({
                                baseURL: "https://text.pollinations.ai/openai",
                                apiKey: "",
                                providerId: "pollinations",
                                model: "openai-fast",
                                messages: [{ role: "user", content: "hi" }],
                                signal: controller.signal,
                        }),
                ).rejects.toThrow();

                expect(fetchMock).toHaveBeenCalledTimes(1);
        });
        it("adds the referrer etiquette field for pollinations requests", async () => {
                const okBody =
                        'data: {"choices":[{"delta":{"content":"ok"},"index":0}]}\n\ndata: [DONE]\n\n';
                const { calls } = mockFetchQueue([
                        fetchResponse({ ok: true, status: 200, body: okBody, stream: true }),
                ]);

                await streamChatCompletion({
                        baseURL: "https://text.pollinations.ai/openai",
                        apiKey: "",
                        providerId: "pollinations",
                        model: "openai-fast",
                        messages: [{ role: "user", content: "hello" }],
                });

                const sent = JSON.parse(calls[0].init.body);
                expect(sent.referrer).toBe("xcoder");
        }, 15000);
});

describe("Pollinations legacy→gen migration (402 deprecation)", () => {
        it("falls back to the new gen API when legacy answers 402 (non-streaming)", async () => {
                const { fetchMock, calls } = mockFetchQueue([
                        fetchResponse({
                                ok: false,
                                status: 500,
                                body: JSON.stringify({
                                        error: "402 Payment required",
                                        status: 500,
                                        depreciation_notice:
                                                "NOTICE: Pollinations legacy text API is being deprecated for authenticated users. Please migrate to https://pollinations.ai",
                                }),
                        }),
                        fetchResponse({
                                ok: true,
                                status: 200,
                                body: JSON.stringify({
                                        choices: [
                                                {
                                                        index: 0,
                                                        message: { role: "assistant", content: "migrated!" },
                                                        finish_reason: "stop",
                                                },
                                        ],
                                }),
                        }),
                ]);

                const result = await chatCompletion({
                        baseURL: "https://text.pollinations.ai/openai",
                        apiKey: "",
                        providerId: "pollinations",
                        model: "openai-fast",
                        messages: [{ role: "user", content: "hi" }],
                });

                expect(result.content).toBe("migrated!");
                expect(fetchMock).toHaveBeenCalledTimes(2);
                // second call hits the new gen API with the normalized model
                expect(calls[1].url).toBe(
                        "https://gen.pollinations.ai/v1/chat/completions",
                );
                expect(JSON.parse(calls[1].init.body).model).toBe("openai");
        }, 15000);

        it("routes keyed requests straight to the new gen API", async () => {
                const { calls } = mockFetchQueue([
                        fetchResponse({
                                ok: true,
                                status: 200,
                                body: JSON.stringify({
                                        choices: [
                                                {
                                                        index: 0,
                                                        message: { role: "assistant", content: "gen key" },
                                                        finish_reason: "stop",
                                                },
                                        ],
                                }),
                        }),
                ]);

                const result = await chatCompletion({
                        baseURL: "https://text.pollinations.ai/openai",
                        apiKey: "plln_test_key",
                        providerId: "pollinations",
                        model: "openai-fast",
                        messages: [{ role: "user", content: "hi" }],
                });

                expect(result.content).toBe("gen key");
                expect(calls[0].url).toBe("https://gen.pollinations.ai/v1/chat/completions");
                expect(JSON.parse(calls[0].init.body).model).toBe("openai");
        });

        it("falls back to a single-delta non-streamed answer when streaming hits 402", async () => {
                const deltas = [];
                const { fetchMock } = mockFetchQueue([
                        fetchResponse({
                                ok: false,
                                status: 402,
                                body: "Payment required",
                        }),
                        fetchResponse({
                                ok: true,
                                status: 200,
                                body: JSON.stringify({
                                        choices: [
                                                {
                                                        index: 0,
                                                        message: { role: "assistant", content: "whole answer" },
                                                        finish_reason: "stop",
                                                },
                                        ],
                                }),
                        }),
                ]);

                const result = await streamChatCompletion({
                        baseURL: "https://text.pollinations.ai/openai",
                        apiKey: "",
                        providerId: "pollinations",
                        model: "openai-fast",
                        messages: [{ role: "user", content: "hi" }],
                        onDelta: (delta) => deltas.push(delta),
                });

                expect(result.content).toBe("whole answer");
                expect(deltas).toEqual([{ content: "whole answer" }]);
                expect(fetchMock).toHaveBeenCalledTimes(2);
        }, 15000);
});
