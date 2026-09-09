import { afterEach, describe, expect, it, vi } from "vitest";


/**
 * Regression tests for the v1.5.3 GitHub sign-in bug: the device flow
 * destructured `{token, user}` from pollForToken — which resolves with
 * the token STRING — so both came out undefined and an EMPTY session was
 * saved ("connected" toast, but no account data and no repositories).
 */

const fetchCalls = [];

vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("dialogs/confirm", () => ({ default: vi.fn(async () => true) }));
vi.mock("dialogs/loader", () => ({
        default: { show: vi.fn(async () => vi.fn()) },
}));
vi.mock("dialogs/prompt", () => ({ default: vi.fn() }));
vi.mock("dialogs/select", () => ({ default: vi.fn() }));
vi.mock("lib/config", () => ({
        default: { GH_OAUTH_CLIENT_ID: "test-client-id" },
}));
vi.mock("lib/settings", () => ({
        default: {
                value: {
                        ghToken: "",
                        ghUserLogin: "",
                        ghUserName: "",
                        ghUserAvatar: "",
                },
                update: vi.fn(async () => {}),
        },
}));

import toast from "components/toast";
import settings from "lib/settings";
import { fetchGhUser } from "lib/ghAuth";
import { saveGhSession, signInWithDeviceFlow } from "lib/ghSignIn";

// `strings` is a WebView global injected by the app runtime; the flow
// reads it with `strings["key"] || "fallback"` so a minimal stub is enough
globalThis.strings = {};

function jsonRes(body, status = 200) {
        return new Response(JSON.stringify(body), { status });
}

/**
 * Routes the fake fetch to the GitHub endpoints used by the flow.
 * First poll -> authorization_pending, then the token is granted.
 */
function routeFetch(url) {
        fetchCalls.push(String(url));
        const u = String(url);
        if (u.includes("/login/device/code")) {
                return Promise.resolve(
                        jsonRes({
                                device_code: "dev123",
                                user_code: "ABCD-1234",
                                verification_uri: "https://github.com/login/device",
                                expires_in: 900,
                                interval: 1,
                        }),
                );
        }
        if (u.includes("/login/oauth/access_token")) {
                if (!routeFetch.granted) {
                        routeFetch.granted = true;
                        return Promise.resolve(
                                jsonRes({ error: "authorization_pending" }),
                        );
                }
                return Promise.resolve(jsonRes({ access_token: "gho_token123" }));
        }
        if (u.includes("api.github.com/user")) {
                return Promise.resolve(
                        jsonRes({
                                login: "octocat",
                                name: "The Octocat",
                                avatar_url: "https://avatars.githubusercontent.com/octocat.png",
                        }),
                );
        }
        return Promise.resolve(new Response("not found", { status: 404 }));
}

function stubGlobals(fetchImpl) {
        globalThis.fetch = vi.fn(fetchImpl);
        globalThis.system = { openInBrowser: vi.fn() };
}

describe("ghSignIn: device flow saves a REAL session", () => {
        it("saves token AND profile after the user authorizes", async () => {
                routeFetch.granted = false;
                stubGlobals(routeFetch);
                vi.useFakeTimers();

                const flow = signInWithDeviceFlow();
                await vi.runAllTimersAsync();
                const ok = await flow;
                vi.useRealTimers();

                expect(ok).toBe(true);
                expect(toast).toHaveBeenCalledWith(
                        expect.stringContaining("Signed in as octocat"),
                );
                expect(settings.value.ghToken).toBe("gho_token123");
                expect(settings.value.ghUserLogin).toBe("octocat");
                expect(settings.value.ghUserName).toBe("The Octocat");
                expect(settings.value.ghUserAvatar).toContain("avatars");
                expect(settings.update).toHaveBeenCalled();
        });

        it("still saves the token when the profile request fails", async () => {
                routeFetch.granted = false;
                stubGlobals((url) => {
                        if (String(url).includes("api.github.com/user")) {
                                return Promise.resolve(new Response("nope", { status: 403 }));
                        }
                        return routeFetch(url);
                });
                vi.useFakeTimers();

                const flow = signInWithDeviceFlow();
                await vi.runAllTimersAsync();
                const ok = await flow;
                vi.useRealTimers();

                expect(ok).toBe(true);
                expect(settings.value.ghToken).toBe("gho_token123");
                // profile absent but the session is NOT empty anymore
                expect(settings.value.ghUserLogin).toBe("");
        });
});

describe("ghSignIn: session guards", () => {
        it("saveGhSession refuses to store an empty session", async () => {
                await expect(saveGhSession("", { login: "x" })).rejects.toThrow();
                await expect(saveGhSession(undefined, null)).rejects.toThrow();
                expect(settings.value.ghToken).toBe("");
        });
});

describe("ghAuth: profile via the native plugin", () => {
        it("fetchGhUser uses cordova.plugin.http when available", async () => {
                const sendRequest = vi.fn((url, opts, ok) => {
                        expect(opts.method).toBe("GET");
                        expect(opts.headers.Authorization).toBe("Bearer tok");
                        ok({
                                status: 200,
                                data: {
                                        login: "native-user",
                                        name: "Native",
                                        avatar_url: "https://a/x.png",
                                },
                        });
                });
                globalThis.cordova = { plugin: { http: { sendRequest } } };

                const user = await fetchGhUser("tok");

                expect(user).toEqual({
                        login: "native-user",
                        name: "Native",
                        avatarUrl: "https://a/x.png",
                });
                expect(sendRequest).toHaveBeenCalledTimes(1);
                delete globalThis.cordova;
        });
});

afterEach(() => {
        vi.clearAllMocks();
        settings.value.ghToken = "";
        settings.value.ghUserLogin = "";
        settings.value.ghUserName = "";
        settings.value.ghUserAvatar = "";
        delete globalThis.fetch;
        delete globalThis.system;
        delete globalThis.cordova;
});
