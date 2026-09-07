import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Model id normalization (user request: "Ao buscar modelos, não precisam
 * aparecerem com 'models' antes"):
 *  - normalizeModelId() strips only a LEADING "models/" prefix;
 *  - listModels() returns normalized ids straight from the catalog;
 *  - resolveModel() normalizes legacy stored values at read time.
 */

import { normalizeModelId } from "lib/ai/modelId";

describe("normalizeModelId", () => {
        it("strips a leading models/ prefix", () => {
                expect(normalizeModelId("models/gemini-2.5-flash")).toBe(
                        "gemini-2.5-flash",
                );
        });

        it("keeps ids that merely CONTAIN models/ (Fireworks, Proxypa)", () => {
                expect(
                        normalizeModelId(
                                "accounts/fireworks/models/llama4-maverick-instruct-basic",
                        ),
                ).toBe("accounts/fireworks/models/llama4-maverick-instruct-basic");
        });

        it("keeps openrouter-style vendor namespacing", () => {
                expect(normalizeModelId("google/gemini-2.5-pro")).toBe(
                        "google/gemini-2.5-pro",
                );
        });

        it("trims whitespace and tolerates empty values", () => {
                expect(normalizeModelId("  models/gemma-3-27b ")).toBe(
                        "gemma-3-27b",
                );
                expect(normalizeModelId("")).toBe("");
                expect(normalizeModelId(undefined)).toBe("");
        });
});

describe("listModels normalizes the catalog", () => {
        afterEach(() => {
                vi.unstubAllGlobals();
        });

        it("returns bare ids for google-style catalogs, untouched otherwise", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => ({
                                ok: true,
                                status: 200,
                                text: async () =>
                                        JSON.stringify({
                                                data: [
                                                        { id: "models/gemini-2.5-flash" },
                                                        { name: "models/gemini-2.0-flash" },
                                                        {
                                                                id: "accounts/fireworks/models/llama4-maverick-instruct-basic",
                                                        },
                                                        { id: "gpt-4o" },
                                                ],
                                        }),
                        })),
                );

                const { listModels } = await import("lib/ai/client");
                const models = await listModels({
                        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
                        apiKey: "test-key",
                });

                expect(models).toEqual([
                        "gemini-2.5-flash",
                        "gemini-2.0-flash",
                        "accounts/fireworks/models/llama4-maverick-instruct-basic",
                        "gpt-4o",
                ]);
        });
});

describe("resolveModel normalizes stored values", () => {
        it("normalizes per-provider and legacy global models at read time", async () => {
                const { readFileSync } = await import("node:fs");
                const { join } = await import("node:path");
                const source = readFileSync(
                        join(process.cwd(), "src/lib/ai/providers.js"),
                        "utf8",
                );
                expect(source).toMatch(/return normalizeModelId\(own\)/);
                expect(source).toMatch(/return normalizeModelId\(legacy\)/);
        });

        it("listModels maps ids through normalizeModelId", async () => {
                const { readFileSync } = await import("node:fs");
                const { join } = await import("node:path");
                const source = readFileSync(
                        join(process.cwd(), "src/lib/ai/client.js"),
                        "utf8",
                );
                expect(source).toMatch(
                        /normalizeModelId\(model\?\.id \|\| model\?\.name\)/,
                );
        });
});
