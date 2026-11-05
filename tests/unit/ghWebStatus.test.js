// @vitest-environment happy-dom
/**
 * Honest GitHub sign-in chooser — the web (browser) option is only
 * offered when the site deployment actually has the GitHub App
 * credentials (/api/github/status). Otherwise the device flow (verified
 * working with the built-in client id) comes first and PAT last, so the
 * account card never dead-ends on the site's "não configurada" page
 * ("Git até agora fica sem conta").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("dialogs/confirm", () => ({ default: vi.fn(async () => true) }));
vi.mock("dialogs/loader", () => ({
        default: { show: vi.fn(async () => vi.fn()) },
}));
vi.mock("dialogs/prompt", () => ({ default: vi.fn(async () => "") }));
vi.mock("dialogs/select", () => ({
        default: vi.fn(async (title, options) => {
                capturedOptions = options;
                return chosen;
        }),
}));
vi.mock("lib/settings", () => ({
        default: { value: {}, on: vi.fn(), off: vi.fn(), update: vi.fn(async () => {}) },
}));

globalThis.strings = {};

let capturedOptions = [];
let chosen = "device";
let fetchCalls = [];

import { chooseGhSignInMethod } from "lib/ghSignIn";
import { resetGhWebStatusCache, siteGhWebConfigured } from "lib/ghWebFlow";

function stubFetch(body, { fail = false } = {}) {
        fetchCalls = [];
        vi.stubGlobal(
                "fetch",
                vi.fn(async (url) => {
                        fetchCalls.push(String(url));
                        if (fail) throw new Error("network down");
                        return {
                                ok: true,
                                json: async () => body,
                        };
                }),
        );
}

beforeEach(() => {
        resetGhWebStatusCache();
        capturedOptions = [];
        chosen = "device";
});

afterEach(() => {
        vi.unstubAllGlobals();
});

describe("site status probe (siteGhWebConfigured)", () => {
        it("hits /api/github/status on the configured site", async () => {
                stubFetch({ configured: true });
                const result = await siteGhWebConfigured();
                expect(result).toBe(true);
                expect(fetchCalls).toHaveLength(1);
                expect(fetchCalls[0]).toBe(
                        "https://xcoderapp.vercel.app/api/github/status",
                );
        });

        it("caches the probe result", async () => {
                stubFetch({ configured: false });
                expect(await siteGhWebConfigured()).toBe(false);
                expect(await siteGhWebConfigured()).toBe(false);
                expect(fetchCalls).toHaveLength(1, "second call should use the cache");

                resetGhWebStatusCache();
                await siteGhWebConfigured();
                expect(fetchCalls).toHaveLength(2, "cache reset should re-probe");
        });

        it("treats probe failures as not configured", async () => {
                stubFetch(null, { fail: true });
                expect(await siteGhWebConfigured()).toBe(false);
        });
});

describe("chooseGhSignInMethod", () => {
        it("uses the site web flow directly when the site is configured (site-only login)", async () => {
                stubFetch({ configured: true });
                await expect(chooseGhSignInMethod()).resolves.toBe("web");
                expect(capturedOptions).toEqual([], "no in-app chooser is rendered");
        });

        it("falls back to the device flow when the site lacks the credentials", async () => {
                stubFetch({ configured: false });
                await expect(chooseGhSignInMethod()).resolves.toBe("device");
                expect(capturedOptions).toEqual([], "no in-app chooser is rendered");
        });

        it("still resolves to a browser-based method when the probe fails", async () => {
                stubFetch(null, { fail: true });
                await expect(chooseGhSignInMethod()).resolves.toBe("device");
                expect(capturedOptions).toEqual([], "no in-app chooser is rendered");
        });
});
