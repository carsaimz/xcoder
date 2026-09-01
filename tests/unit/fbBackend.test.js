import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/settings", () => ({
        default: {
                value: {
                        firebaseEnabled: false,
                        firebaseProjectId: "",
                        firebaseApiKey: "",
                        ghToken: "",
                },
                update: vi.fn(),
        },
}));

import settings from "lib/settings";
import {
        authState,
        buildSyncUrl,
        clearAuth,
        ensureAuth,
        isConfigured,
        pullAll,
        pushAll,
        readAuth,
        refreshAuth,
        signInAnonymously,
} from "lib/fbBackend";

/** localStorage is not available in the node test environment. */
function makeStorage() {
        const map = new Map();
        return {
                getItem: (key) => (map.has(key) ? map.get(key) : null),
                setItem: (key, value) => map.set(key, String(value)),
                removeItem: (key) => map.delete(key),
                clear: () => map.clear(),
        };
}

function configureFirebase() {
        settings.value.firebaseEnabled = true;
        settings.value.firebaseProjectId = "my-app";
        settings.value.firebaseApiKey = "AIzaTest";
}

const SIGN_UP_RESPONSE = {
        ok: true,
        json: async () => ({
                localId: "uid123",
                idToken: "id-token-1",
                refreshToken: "refresh-1",
                expiresIn: "3600",
        }),
};

describe("fbBackend auth", () => {
        beforeEach(() => {
                vi.stubGlobal("localStorage", makeStorage());
        });

        it("is not configured when disabled or incomplete", () => {
                expect(isConfigured()).toBe(false);
                settings.value.firebaseEnabled = true;
                expect(isConfigured()).toBe(false);
                settings.value.firebaseProjectId = "my-app";
                expect(isConfigured()).toBe(false);
                settings.value.firebaseApiKey = "AIzaTest";
                expect(isConfigured()).toBe(true);
        });

        it("builds the per-user sync document URL", () => {
                configureFirebase();
                expect(buildSyncUrl("uid123")).toBe(
                        "https://firestore.googleapis.com/v1/projects/my-app/databases/(default)/documents/xcoder_users/uid123/sync/backup",
                );
        });

        it("signs in anonymously and caches the session", async () => {
                configureFirebase();
                const fetchSpy = vi.fn().mockResolvedValue(SIGN_UP_RESPONSE);
                vi.stubGlobal("fetch", fetchSpy);

                const auth = await signInAnonymously();

                expect(auth.localId).toBe("uid123");
                expect(auth.idToken).toBe("id-token-1");
                const [url, options] = fetchSpy.mock.calls[0];
                expect(url).toContain(
                        "identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaTest",
                );
                expect(options.body).toContain("returnSecureToken");
                expect(readAuth()?.localId).toBe("uid123");
                expect(authState()).toEqual({ signedIn: true, localId: "uid123" });
        });

        it("maps auth errors to friendly messages", async () => {
                configureFirebase();
                vi.stubGlobal(
                        "fetch",
                        vi.fn().mockResolvedValue({
                                ok: false,
                                json: async () => ({
                                        error: { message: "OPERATION_NOT_ALLOWED" },
                                }),
                        }),
                );
                await expect(signInAnonymously()).rejects.toThrow(
                        /OPERATION_NOT_ALLOWED.*Anonymous sign-in is disabled/,
                );
        });

        it("refreshes an expired session with the refresh token", async () => {
                configureFirebase();
                localStorage.setItem(
                        "xcoder.fb.auth",
                        JSON.stringify({
                                localId: "uid123",
                                idToken: "stale-token",
                                refreshToken: "refresh-1",
                                expiresAt: Date.now() - 1000,
                        }),
                );
                const fetchSpy = vi.fn().mockResolvedValue({
                        ok: true,
                        json: async () => ({
                                id_token: "fresh-token",
                                refresh_token: "refresh-2",
                                user_id: "uid123",
                                expires_in: "3600",
                        }),
                });
                vi.stubGlobal("fetch", fetchSpy);

                const auth = await ensureAuth();

                expect(auth.idToken).toBe("fresh-token");
                const [url, options] = fetchSpy.mock.calls[0];
                expect(url).toContain("securetoken.googleapis.com/v1/token");
                expect(options.body).toContain("grant_type=refresh_token");
                expect(readAuth()?.idToken).toBe("fresh-token");
        });

        it("reuses the cached session without network calls", async () => {
                configureFirebase();
                localStorage.setItem(
                        "xcoder.fb.auth",
                        JSON.stringify({
                                localId: "uid123",
                                idToken: "cached-token",
                                refreshToken: "refresh-1",
                                expiresAt: Date.now() + 3600_000,
                        }),
                );
                const fetchSpy = vi.fn();
                vi.stubGlobal("fetch", fetchSpy);

                const auth = await ensureAuth();

                expect(auth.idToken).toBe("cached-token");
                expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("clears the local session", async () => {
                configureFirebase();
                vi.stubGlobal("fetch", vi.fn().mockResolvedValue(SIGN_UP_RESPONSE));
                await signInAnonymously();
                clearAuth();
                expect(authState()).toEqual({ signedIn: false, localId: null });
        });
});

describe("fbBackend sync", () => {
        beforeEach(() => {
                vi.stubGlobal("localStorage", makeStorage());
                configureFirebase();
        });

        it("pushes settings + chats to the per-user Firestore document", async () => {
                localStorage.setItem("xcoder.ai.sessions", '[{"id":"s1"}]');
                settings.value.editorTheme = "dark";
                const fetchSpy = vi
                        .fn()
                        .mockResolvedValueOnce(SIGN_UP_RESPONSE)
                        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
                vi.stubGlobal("fetch", fetchSpy);

                const summary = await pushAll();

                expect(summary).toContain("firebase backup saved");
                const [url, options] = fetchSpy.mock.calls[1];
                expect(url).toContain(
                        "projects/my-app/databases/(default)/documents/xcoder_users/uid123/sync/backup",
                );
                expect(url).toContain("updateMask.fieldPaths=json");
                expect(options.method).toBe("PATCH");
                const body = JSON.parse(options.body);
                const payload = JSON.parse(body.fields.json.stringValue);
                expect(payload.settings.editorTheme).toBe("dark");
                expect(payload.aiSessions).toEqual([{ id: "s1" }]);
        });

        it("refuses to push when not configured", async () => {
                settings.value.firebaseApiKey = "";
                const fetchSpy = vi.fn();
                vi.stubGlobal("fetch", fetchSpy);
                await expect(pushAll()).rejects.toThrow("Firebase is not configured");
                expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("reports a friendly error when no backup exists", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi
                                .fn()
                                .mockResolvedValueOnce(SIGN_UP_RESPONSE)
                                .mockResolvedValueOnce({ ok: false, status: 404 }),
                );
                await expect(pullAll()).rejects.toThrow("No backup found in Firebase");
        });

        it("restores settings (secrets excluded) and chats from the backup", async () => {
                localStorage.setItem(
                        "xcoder.fb.auth",
                        JSON.stringify({
                                localId: "uid123",
                                idToken: "tok",
                                refreshToken: "rt",
                                expiresAt: Date.now() + 3600_000,
                        }),
                );
                settings.value.ghToken = "current-secret";
                const payload = {
                        version: 1,
                        savedAt: 1,
                        settings: {
                                editorTheme: "solarized",
                                ghToken: "leaked-secret",
                                unknownKey: "ignored",
                        },
                        aiSessions: [{ id: "s2" }],
                };
                vi.stubGlobal(
                        "fetch",
                        vi.fn().mockResolvedValue({
                                ok: true,
                                json: async () => ({
                                        fields: { json: { stringValue: JSON.stringify(payload) } },
                                }),
                        }),
                );

                const { restored } = await pullAll();

                expect(restored).toEqual(["settings", "chats"]);
                expect(settings.value.editorTheme).toBe("solarized");
                expect(settings.value.ghToken).toBe("current-secret");
                expect(settings.value.unknownKey).toBeUndefined();
                expect(JSON.parse(localStorage.getItem("xcoder.ai.sessions"))).toEqual([
                        { id: "s2" },
                ]);
                expect(settings.update).toHaveBeenCalled();
        });

        it("rejects backups that are not valid JSON", async () => {
                vi.stubGlobal(
                        "fetch",
                        vi
                                .fn()
                                .mockResolvedValueOnce(SIGN_UP_RESPONSE)
                                .mockResolvedValueOnce({
                                        ok: true,
                                        json: async () => ({
                                                fields: { json: { stringValue: "{broken" } },
                                        }),
                                }),
                );
                await expect(pullAll()).rejects.toThrow("not valid JSON");
        });
});

afterEach(() => {
        vi.unstubAllGlobals();
        settings.value.firebaseEnabled = false;
        settings.value.firebaseProjectId = "";
        settings.value.firebaseApiKey = "";
        settings.value.ghToken = "";
        vi.mocked(settings.update).mockClear();
});
