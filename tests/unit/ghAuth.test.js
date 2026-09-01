import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
        GH_SCOPES,
        fetchGhUser,
        pollForToken,
        requestDeviceCode,
        signInWithGitHub,
} from "../../src/lib/ghAuth";

/** Builds a Response-like object for the fetch fallback path. */
function jsonRes(body, ok = true, status = 200) {
        return {
                ok,
                status,
                text: async () => JSON.stringify(body),
                json: async () => body,
        };
}

describe("ghAuth: requestDeviceCode", () => {
        beforeEach(() => {
                vi.unstubAllGlobals();
        });
        afterEach(() => {
                vi.unstubAllGlobals();
        });

        it("rejects a missing client id", async () => {
                await expect(requestDeviceCode("")).rejects.toThrow("client id");
        });

        it("requests a device code with client_id and default scopes", async () => {
                const fetchMock = vi.fn(async () =>
                        jsonRes({
                                device_code: "dev123",
                                user_code: "ABCD-1234",
                                verification_uri: "https://github.com/login/device",
                                expires_in: 900,
                                interval: 5,
                        }),
                );
                vi.stubGlobal("fetch", fetchMock);

                const code = await requestDeviceCode("cid123");

                expect(fetchMock).toHaveBeenCalledTimes(1);
                const [url, init] = fetchMock.mock.calls[0];
                expect(url).toBe("https://github.com/login/device/code");
                expect(init.method).toBe("POST");
                expect(init.headers.Accept).toBe("application/json");
                expect(init.body).toContain("client_id=cid123");
                expect(init.body).toContain(
                        GH_SCOPES.join(" ").replace(/ /g, "+").replace(":", "%3A"),
                );
                expect(code).toEqual({
                        deviceCode: "dev123",
                        userCode: "ABCD-1234",
                        verificationUri: "https://github.com/login/device",
                        expiresIn: 900,
                        interval: 5,
                });
        });

        it("applies fallback interval and expiry when GitHub omits them", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => jsonRes({ device_code: "d", user_code: "U" })),
                );
                const code = await requestDeviceCode("cid");
                expect(code.interval).toBe(5);
                expect(code.expiresIn).toBe(900);
                expect(code.verificationUri).toBe("https://github.com/login/device");
        });

        it("throws when GitHub returns an error payload", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () =>
                                jsonRes({ error: "bad_verification_code" }, false, 400),
                        ),
                );
                await expect(requestDeviceCode("cid")).rejects.toThrow(
                        /GitHub request failed \(400\)/,
                );
        });
});

describe("ghAuth: pollForToken", () => {
        const sleep = vi.fn(async () => {});

        beforeEach(() => {
                sleep.mockClear();
                vi.unstubAllGlobals();
        });
        afterEach(() => {
                vi.unstubAllGlobals();
        });

        it("polls until the token is returned", async () => {
                const responses = [
                        { error: "authorization_pending" },
                        { error: "authorization_pending" },
                        { access_token: "tok1" },
                ];
                const fetchMock = vi.fn(async () => jsonRes(responses.shift()));
                vi.stubGlobal("fetch", fetchMock);

                const token = await pollForToken("cid", "dev", 5, { sleepImpl: sleep });

                expect(token).toBe("tok1");
                expect(fetchMock.mock.calls[0][1].body).toContain(
                        "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:device_code"),
                );
                // sleeps happen BEFORE each poll, at the given interval (in ms)
                expect(sleep).toHaveBeenNthCalledWith(1, 5000);
        });

        it("honours slow_down by increasing the interval", async () => {
                const responses = [
                        { error: "slow_down" },
                        { access_token: "tok2" },
                ];
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => jsonRes(responses.shift())),
                );

                const token = await pollForToken("cid", "dev", 5, { sleepImpl: sleep });

                expect(token).toBe("tok2");
                expect(sleep).toHaveBeenNthCalledWith(1, 5000);
                expect(sleep).toHaveBeenNthCalledWith(2, 10000);
        });

        it("throws on access_denied", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => jsonRes({ error: "access_denied" })),
                );
                await expect(
                        pollForToken("cid", "dev", 5, { sleepImpl: sleep }),
                ).rejects.toThrow("denied");
        });

        it("throws on expired_token", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => jsonRes({ error: "expired_token" })),
                );
                await expect(
                        pollForToken("cid", "dev", 5, { sleepImpl: sleep }),
                ).rejects.toThrow("expired");
        });

        it("gives up when maxMs is exceeded", async () => {
                const fetchMock = vi.fn(async () =>
                        jsonRes({ error: "authorization_pending" }),
                );
                vi.stubGlobal("fetch", fetchMock);
                await expect(
                        pollForToken("cid", "dev", 5, { sleepImpl: sleep, maxMs: -1 }),
                ).rejects.toThrow("expired");
                // deadline is checked before the first sleep/poll
                expect(fetchMock).not.toHaveBeenCalled();
        });

        it("retries after transient network errors", async () => {
                const fetchMock = vi
                        .fn()
                        .mockRejectedValueOnce(new Error("offline"))
                        .mockResolvedValue(jsonRes({ access_token: "tok3" }));
                vi.stubGlobal("fetch", fetchMock);

                const token = await pollForToken("cid", "dev", 1, { sleepImpl: sleep });
                expect(token).toBe("tok3");
                expect(fetchMock).toHaveBeenCalledTimes(2);
        });
});

describe("ghAuth: fetchGhUser", () => {
        afterEach(() => {
                vi.unstubAllGlobals();
        });

        it("sends the bearer token and maps the profile", async () => {
                const fetchMock = vi.fn(async () =>
                        jsonRes({
                                login: "carsaimz",
                                name: "Carsaim Z",
                                avatar_url: "https://avatars/u.png",
                        }),
                );
                vi.stubGlobal("fetch", fetchMock);

                const user = await fetchGhUser("tok");
                expect(user).toEqual({
                        login: "carsaimz",
                        name: "Carsaim Z",
                        avatarUrl: "https://avatars/u.png",
                });
                expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
                        "Bearer tok",
                );
        });

        it("throws on non-2xx responses", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => jsonRes({}, false, 401)),
                );
                await expect(fetchGhUser("bad")).rejects.toThrow("401");
        });
});

describe("ghAuth: signInWithGitHub", () => {
        afterEach(() => {
                vi.unstubAllGlobals();
        });

        it("orchestrates device code, polling and profile fetch", async () => {
                const responses = [
                        {
                                device_code: "dev",
                                user_code: "XY-12",
                                verification_uri: "https://github.com/login/device",
                                interval: 1,
                                expires_in: 60,
                        },
                        { access_token: "tok9" },
                        { login: "carsaimz", name: "Carsaim Z", avatar_url: "https://a/u.png" },
                ];
                vi.stubGlobal(
                        "fetch",
                        vi.fn(async () => jsonRes(responses.shift())),
                );
                const sleep = vi.fn(async () => {});
                const onUserCode = vi.fn();

                const { token, user } = await signInWithGitHub({
                        clientId: "cid",
                        onUserCode,
                        sleepImpl: sleep,
                });

                expect(token).toBe("tok9");
                expect(user?.login).toBe("carsaimz");
                expect(user?.avatarUrl).toBe("https://a/u.png");
                expect(onUserCode).toHaveBeenCalledTimes(1);
                expect(onUserCode.mock.calls[0][0].userCode).toBe("XY-12");
        });

        it("keeps user null when the profile request fails", async () => {
                const responses = [
                        {
                                device_code: "dev",
                                user_code: "XY-12",
                                verification_uri: "https://github.com/login/device",
                                interval: 1,
                                expires_in: 60,
                        },
                        { access_token: "tok9" },
                        { message: "bad credentials" },
                ];
                const fetchMock = vi.fn(async (url) => {
                        const body = responses.shift();
                        if (String(url).includes("api.github.com")) {
                                return jsonRes(body, false, 401);
                        }
                        return jsonRes(body);
                });
                vi.stubGlobal("fetch", fetchMock);

                const { user } = await signInWithGitHub({
                        clientId: "cid",
                        sleepImpl: vi.fn(async () => {}),
                });
                expect(user).toBeNull();
        });
});

describe("ghAuth: cordova native path", () => {
        afterEach(() => {
                vi.unstubAllGlobals();
        });

        it("uses cordova.plugin.http.post instead of fetch when available", async () => {
                const fetchSpy = vi.fn();
                vi.stubGlobal("fetch", fetchSpy);
                vi.stubGlobal("cordova", {
                        plugin: {
                                http: {
                                        setDataSerializer: vi.fn(),
                                        post: vi.fn((url, data, headers, success) => {
                                                success({
                                                        status: 200,
                                                        data: JSON.stringify({
                                                                device_code: "dev",
                                                                user_code: "CO-DE",
                                                        }),
                                                });
                                        }),
                                },
                        },
                });

                const code = await requestDeviceCode("cid");
                expect(code.deviceCode).toBe("dev");
                expect(fetchSpy).not.toHaveBeenCalled();
        });
});
