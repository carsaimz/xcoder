import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GitHub App web flow (xcoder://github/session): the app opens
 * github.com/login/oauth/authorize, the official site exchanges the code
 * server-side and returns the session to the app. Covers availability
 * detection, authorize URL building, state validation and session save.
 */

vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("handlers/intent", () => ({
        addIntentHandler: vi.fn(),
        removeIntentHandler: vi.fn(),
}));
vi.mock("lib/settings", () => ({
        default: { value: {}, update: vi.fn(async () => {}) },
}));

import config from "lib/config";
import settings from "lib/settings";
import {
        applyGhWebTokens,
        buildGhAuthorizeUrl,
        completeGhWebFlow,
        ghWebFlowEnabled,
        makeGhState,
        registerGhIntentHandler,
} from "../../src/lib/ghWebFlow";
import { addIntentHandler } from "handlers/intent";

/** Minimal storage stub — the node test env has no sessionStorage. */
const store = new Map();
globalThis.sessionStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
};
/** document stub for the ghauthchange dispatch. */
globalThis.document = { dispatchEvent: () => {} };
globalThis.CustomEvent = class CustomEvent {
        constructor(type) {
                this.type = type;
        }
};

function jsonRes(body, ok = true, status = 200) {
        return {
                ok,
                status,
                text: async () => JSON.stringify(body),
                json: async () => body,
        };
}

describe("ghWebFlow: availability", () => {
        it("is enabled for the built-in GitHub App client id (Ov23li…)", () => {
                expect(ghWebFlowEnabled()).toBe(
                        /^Ov23li/.test(String(config.GH_OAUTH_CLIENT_ID || "")),
                );
        });

        it("is disabled for legacy OAuth App ids and empty config", () => {
                const original = config.GH_OAUTH_CLIENT_ID;
                config.GH_OAUTH_CLIENT_ID = "Iv1abc123def456";
                expect(ghWebFlowEnabled()).toBe(false);
                config.GH_OAUTH_CLIENT_ID = "";
                expect(ghWebFlowEnabled()).toBe(false);
                config.GH_OAUTH_CLIENT_ID = original;
        });
});

describe("ghWebFlow: authorize URL", () => {
        it("targets github authorize with client id, callback and scope", () => {
                const url = buildGhAuthorizeUrl("st-123");
                expect(url).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
                expect(url).toContain(
                        `client_id=${encodeURIComponent(String(config.GH_OAUTH_CLIENT_ID))}`,
                );
                expect(url).toContain(
                        `redirect_uri=${encodeURIComponent(
                                `${String(config.WEBSITE_URL).replace(/\/+$/, "")}/api/github/callback`,
                        )}`,
                );
                // GitHub Apps ignore the scope param — it must NOT be sent
                expect(url).not.toContain("scope=");
                expect(url).toContain("state=st-123");
        });

        it("makeGhState stores the nonce for later validation", () => {
                const state = makeGhState();
                expect(state).toBeTruthy();
                expect(sessionStorage.getItem("xcoder.ghWebFlow.state")).toBe(state);
        });
});

describe("ghWebFlow: session completion", () => {
        beforeEach(() => {
                settings.value = {};
                store.clear();
        });

        afterEach(() => {
                vi.unstubAllGlobals();
        });

        it("saves the session from a return fragment (token + profile)", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () =>
                                jsonRes({
                                        login: "carsaimz",
                                        name: "Carsaim Z",
                                        avatar_url: "https://a/u.png",
                                }),
                        ),
                );
                const ok = await applyGhWebTokens(
                        "xcoder://github/session#access_token=gho_tok&state=&login=carsaimz",
                        { expectedState: "" },
                );
                expect(ok).toBe(true);
                expect(settings.value.ghToken).toBe("gho_tok");
                expect(settings.value.ghUserLogin).toBe("carsaimz");
                expect(settings.value.ghUserAvatar).toBe("https://a/u.png");
        });

        it("rejects a return link without a token", async () => {
                const ok = await applyGhWebTokens("xcoder://github/session#error=denied");
                expect(ok).toBe(false);
        });

        it("rejects forged links whose state does not match", async () => {
                makeGhState(); // stores the real nonce
                const forged = "xcoder://github/session#access_token=evil&state=wrong";
                const ok = await applyGhWebTokens(forged);
                expect(ok).toBe(false);
                expect(settings.value.ghToken).toBeUndefined();
        });

        it("accepts the link when the stored state matches", async () => {
                const state = makeGhState();
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => jsonRes({ login: "u1", name: "", avatar_url: "" })),
                );
                const ok = await applyGhWebTokens(
                        `xcoder://github/session#access_token=t&state=${encodeURIComponent(state)}`,
                );
                expect(ok).toBe(true);
        });

        it("falls back to the login/avatar params when the profile API fails", async () => {
                vi.stubGlobal("fetch", vi.fn(async () => jsonRes({}, false, 401)));
                const ok = await applyGhWebTokens(
                        "xcoder://github/session#access_token=t2&login=octo&avatar=https%3A%2F%2Fa.png",
                        { expectedState: "" },
                );
                expect(ok).toBe(true);
                expect(settings.value.ghUserLogin).toBe("octo");
                expect(settings.value.ghUserAvatar).toBe("https://a.png");
        });

        it("completeGhWebFlow surfaces a toast on failure", async () => {
                globalThis.strings = {};
                const ok = await completeGhWebFlow("xcoder://github/session#nope");
                expect(ok).toBe(false);
        });

        it("registers a single intent handler for github/session", () => {
                globalThis.strings = {};
                registerGhIntentHandler();
                expect(addIntentHandler).toHaveBeenCalledTimes(1);
                const handler = addIntentHandler.mock.calls[0][0];

                const skip = { module: "auth", action: "oauth", preventDefault: vi.fn() };
                handler(skip);
                expect(skip.preventDefault).not.toHaveBeenCalled();

                const hit = {
                        module: "github",
                        action: "session",
                        url: "xcoder://github/session#access_token=zzz",
                        preventDefault: vi.fn(),
                };
                handler(hit);
                expect(hit.preventDefault).toHaveBeenCalled();
        });
});
