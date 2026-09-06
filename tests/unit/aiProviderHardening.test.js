import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * v1.4.19 built-in AI hardening:
 *  - Pollinations: stale token (403/401) → automatic anonymous retry
 *  - cookie-store crash ("hostOnly") is recognized for self-healing
 *  - the "search the web" quick toggle filters agent tools
 *  - provider logos (providerIcon) cover known + custom providers
 */

vi.mock("utils/Url", () => ({ default: class Url {} }));
vi.mock("lib/settings", () => ({
        default: {
                value: {},
                update: async () => {},
        },
}));

const { default: settings } = await import("lib/settings");
const { chatCompletion, isCookieStoreError } = await import("lib/ai/client");
const { providerIcon, isLetterGlyph } = await import("lib/ai/providers");
const { applyWebToolsToggle } = await import("lib/ai/toolToggle");

/** Minimal non-streaming fetch response. */
function fetchResponse({ ok = true, status = 200, body = "" }) {
        return {
                ok,
                status,
                statusText: ok ? "OK" : "Error",
                text: async () => body,
                json: async () => JSON.parse(body || "{}"),
                body: null,
        };
}

afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.fetch;
});

describe("pollinations stale-key recovery", () => {
        it("retries WITHOUT the key when pollinations rejects it with 403", async () => {
                const okBody = JSON.stringify({
                        choices: [{ message: { role: "assistant", content: "anon" } }],
                });
                const calls = [];
                globalThis.fetch = vi.fn(async (_url, init) => {
                        calls.push(init);
                        if (calls.length === 1) {
                                return fetchResponse({
                                        ok: false,
                                        status: 403,
                                        body: "invalid API key requested",
                                });
                        }
                        return fetchResponse({ ok: true, status: 200, body: okBody });
                });

                const result = await chatCompletion({
                        baseURL: "https://text.pollinations.ai/openai",
                        apiKey: " plln_dead_token ",
                        providerId: "pollinations",
                        model: "openai-fast",
                        messages: [{ role: "user", content: "hi" }],
                });

                expect(result.content).toBe("anon");
                expect(calls).toHaveLength(2);
                // first call carries the dead key, second goes anonymous
                expect(calls[0].headers.Authorization).toBe("Bearer plln_dead_token");
                expect(calls[1].headers.Authorization).toBeUndefined();
        });

        it("does NOT retry anonymous pollinations requests on 403 (other causes)", async () => {
                globalThis.fetch = vi.fn(async () =>
                        fetchResponse({ ok: false, status: 403, body: "forbidden" }),
                );
                await expect(
                        chatCompletion({
                                baseURL: "https://text.pollinations.ai/openai",
                                apiKey: "",
                                providerId: "pollinations",
                                model: "openai-fast",
                                messages: [{ role: "user", content: "hi" }],
                        }),
                ).rejects.toThrow(/403/);
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        it("explainError() mentions the anonymous fallback for pollinations 403", async () => {
                const { explainError } = await import("lib/ai/client");
                const message = explainError(
                        new Error("403: invalid API key requested"),
                        "pollinations",
                );
                expect(message).toMatch(/anônimo/i);
        });
});

describe("cookie-store crash recognition", () => {
        it("flags the tough-cookie hostOnly crash", () => {
                expect(
                        isCookieStoreError(
                                new Error(
                                        "TypeError: Cannot read properties of null (reading 'hostOnly')",
                                ),
                        ),
                ).toBe(true);
        });

        it("ignores unrelated errors", () => {
                expect(isCookieStoreError(new Error("429: rate limit"))).toBe(false);
                expect(isCookieStoreError(new Error("Network: offline"))).toBe(false);
        });
});

describe("web-search quick toggle (applyWebToolsToggle)", () => {
        it("keeps web tools in the agent allowlist when enabled", () => {
                settings.value.aiWebTools = true;
                const list = applyWebToolsToggle(["read_file", "web_search"]);
                expect(list).toContain("web_search");
                expect(list).toContain("read_file");
        });

        it("drops web tools when disabled", () => {
                settings.value.aiWebTools = false;
                const list = applyWebToolsToggle(["read_file", "web_search", "read_url"]);
                expect(list).toEqual(["read_file"]);
        });

        it("chat mode gains ONLY the web tools when the toggle is on", () => {
                settings.value.aiWebTools = true;
                expect(applyWebToolsToggle([])).toEqual(
                        expect.arrayContaining(["web_search", "read_url"]),
                );
                expect(applyWebToolsToggle([])).toHaveLength(2);
        });

        it("chat mode keeps no tools when the toggle is off", () => {
                settings.value.aiWebTools = false;
                expect(applyWebToolsToggle([])).toEqual([]);
        });

        it("agent mode (null allowlist) excludes web tools when off", () => {
                settings.value.aiWebTools = false;
                const list = applyWebToolsToggle(null, [
                        "read_file",
                        "web_search",
                        "read_url",
                        "run_command",
                        "write_file",
                ]);
                expect(list).not.toContain("web_search");
                expect(list).not.toContain("read_url");
                expect(list).toContain("read_file");
                expect(list).toContain("run_command");
        });
});

describe("provider logos", () => {
        it("maps known providers to brand glyphs", () => {
                expect(providerIcon("pollinations").glyph).toBe("🌼");
                expect(providerIcon("duckduckgo").glyph).toBe("🦆");
                expect(providerIcon("custom").glyph).toBe("🤖");
        });

        it("falls back to a colored letter badge for unknown ids", () => {
                const icon = providerIcon("my-own-endpoint");
                expect(icon.glyph).toBe("M");
                expect(isLetterGlyph(icon.glyph)).toBe(true);
                expect(icon.color).toMatch(/^#/);
        });

        it("letter detection is false for emoji", () => {
                expect(isLetterGlyph("🌼")).toBe(false);
        });
});
