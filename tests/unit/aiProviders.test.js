import { beforeEach, describe, expect, it, vi } from "vitest";
import {
        enabledProviders,
        isProviderEnabled,
        keyShapeWarning,
        modelCapabilities,
        modelType,
        PROVIDER_MAP,
        PROVIDERS,
        resolveModel,
        setProviderEnabled,
        setProviderModel,
} from "lib/ai/providers";

// minimal settings mock — providers.js only reads/writes a few fields
const settingsValue = {
        aiProvider: "groq",
        aiModel: "",
        aiProviderPrefs: {},
};
vi.mock("lib/settings", () => ({
        default: {
                get value() {
                        return settingsValue;
                },
                update: vi.fn(async (patch) => {
                        Object.assign(settingsValue, patch);
                }),
        },
}));

describe("provider enable/disable", () => {
        beforeEach(() => {
                settingsValue.aiProvider = "groq";
                settingsValue.aiProviderPrefs = {};
        });

        it("treats the selected provider as enabled (legacy default)", () => {
                expect(isProviderEnabled("groq")).toBe(true);
                expect(isProviderEnabled("openai")).toBe(false);
        });

        it("treats providers with an own key as enabled (legacy default)", () => {
                settingsValue.aiProviderPrefs.openai = { apiKey: "sk-test" };
                expect(isProviderEnabled("openai")).toBe(true);
        });

        it("stores an explicit toggle that wins over the legacy default", async () => {
                await setProviderEnabled("openai", true);
                expect(isProviderEnabled("openai")).toBe(true);

                await setProviderEnabled("groq", false);
                expect(isProviderEnabled("groq")).toBe(false);

                expect(enabledProviders().map((provider) => provider.id)).toEqual([
                        "openai",
                ]);
        });

        it("enabledProviders returns catalog entries in order", async () => {
                await setProviderEnabled("cerebras", true);
                const ids = enabledProviders().map((provider) => provider.id);
                expect(ids).toContain("groq");
                expect(ids).toContain("cerebras");
                expect(ids.indexOf("groq")).toBeLessThan(ids.indexOf("cerebras"));
        });
});

describe("per-provider model memory", () => {
        beforeEach(() => {
                settingsValue.aiProvider = "groq";
                settingsValue.aiModel = "";
                settingsValue.aiProviderPrefs = {};
        });

        it("falls back to the provider default model", () => {
                expect(resolveModel("groq")).toBe("llama-3.3-70b-versatile");
        });

        it("uses the legacy global model for the selected provider", () => {
                settingsValue.aiModel = "my-custom-model";
                expect(resolveModel("groq")).toBe("my-custom-model");
                // but not for other providers
                expect(resolveModel("openai")).toBe("gpt-4o-mini");
        });

        it("remembers a model per provider and syncs the selected one", async () => {
                await setProviderModel("openai", "gpt-4.1");
                expect(
                        settingsValue.aiProviderPrefs.openai.model,
                ).toBe("gpt-4.1");
                // openai is not selected -> legacy global model untouched
                expect(settingsValue.aiModel).toBe("");

                await setProviderModel("groq", "llama-3.1-8b-instant");
                expect(settingsValue.aiModel).toBe("llama-3.1-8b-instant");
                expect(resolveModel("groq")).toBe("llama-3.1-8b-instant");
        });

        it("still resolves the remembered model after switching providers", async () => {
                await setProviderModel("openai", "gpt-4.1");
                settingsValue.aiProvider = "openai";
                settingsValue.aiModel = "";
                expect(resolveModel("openai")).toBe("gpt-4.1");
        });
});

describe("model capabilities and type", () => {
        it("marks vision models as image-capable", () => {
                expect(modelCapabilities("google", "gemini-2.5-flash")).toMatchObject({
                        text: true,
                        image: true,
                        video: true,
                });
                expect(modelCapabilities("openai", "gpt-4o-mini").image).toBe(true);
        });

        it("marks plain models as text-only", () => {
                const caps = modelCapabilities("groq", "llama-3.1-8b-instant");
                expect(caps.text).toBe(true);
                expect(caps.image).toBe(false);
                expect(caps.video).toBe(false);
        });

        it("flags known no-tools families", () => {
                expect(modelCapabilities("google", "gemma-3-27b-it").agents).toBe(false);
                expect(modelCapabilities("openai", "gpt-4.1").agents).toBe(true);
        });

        it("classifies OpenRouter free models by the :free suffix", () => {
                const openrouter = PROVIDER_MAP["openrouter-free"];
                expect(modelType(openrouter, "qwen/qwen3-coder:free")).toBe("free");
                // the openrouter-free catalog is free overall (group decides)…
                expect(modelType(openrouter, "meta-llama/llama-3.3-70b-instruct")).toBe("free");
                // …while the paid catalog classifies by group
                const paid = PROVIDER_MAP["openrouter-paid"];
                expect(modelType(paid, "anthropic/claude-sonnet-4.5")).toBe("paid");
                expect(modelType(paid, "some/model:free")).toBe("free");
        });

        it("classifies by provider group when there is no suffix", () => {
                expect(modelType(PROVIDER_MAP.groq, "llama-3.3-70b-versatile")).toBe("free");
                expect(modelType(PROVIDER_MAP.openai, "gpt-4.1")).toBe("paid");
        });
});

describe("keyShapeWarning", () => {
        it("flags a Groq key used on the Google card", () => {
                const warn = keyShapeWarning("google", "gsk_ABCDEF1234567890");
                expect(warn).toContain("Groq");
        });

        it("flags a Gemini key used on the Groq card", () => {
                const warn = keyShapeWarning("groq", "AIzaSyABCDEF1234567890");
                expect(warn).toContain("Google");
        });

        it("accepts a matching key and an unknown shape", () => {
                expect(keyShapeWarning("groq", "gsk_ABCDEF1234567890")).toBe("");
                expect(keyShapeWarning("custom", "totally-private-token")).toBe("");
        });

        it("treats both OpenRouter catalogs as one family", () => {
                expect(keyShapeWarning("openrouter-free", "sk-or-v1-abcdef")).toBe("");
                expect(keyShapeWarning("openrouter-paid", "sk-or-v1-abcdef")).toBe("");
                expect(keyShapeWarning("groq", "sk-or-v1-abcdef")).toContain("OpenRouter");
        });

        it("returns empty for a missing key", () => {
                expect(keyShapeWarning("groq", "")).toBe("");
                expect(keyShapeWarning("groq", undefined)).toBe("");
        });
});
