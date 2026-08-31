import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("lib/settings", () => ({
        default: {
                value: {
                        firebaseEnabled: false,
                        firebaseProjectId: "",
                        firebaseApiKey: "",
                },
                update: vi.fn(),
        },
}));

import settings from "lib/settings";
import {
        fromFirestoreFields,
        getDocument,
        isReady,
        logEvent,
        toFirestoreFields,
} from "lib/firebaseLite";

describe("firebaseLite", () => {
        it("is not ready when disabled or incomplete", () => {
                expect(isReady()).toBe(false);
                settings.value.firebaseEnabled = true;
                expect(isReady()).toBe(false);
                settings.value.firebaseProjectId = "my-app";
                expect(isReady()).toBe(false);
                settings.value.firebaseApiKey = "AIzaTest";
                expect(isReady()).toBe(true);
        });

        it("does not send events when not ready", async () => {
                const fetchSpy = vi.fn();
                vi.stubGlobal("fetch", fetchSpy);
                await logEvent("test");
                expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("sends events to the Firestore REST endpoint when ready", async () => {
                const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
                vi.stubGlobal("fetch", fetchSpy);
                settings.value.firebaseEnabled = true;
                settings.value.firebaseProjectId = "my-app";
                settings.value.firebaseApiKey = "AIzaTest";

                const result = await logEvent("chat_sent", { model: "llama" });

                expect(result).toBe(true);
                const [url, options] = fetchSpy.mock.calls[0];
                expect(url).toContain("projects/my-app/databases/(default)/documents/xcoder_events");
                expect(url).toContain("key=AIzaTest");
                expect(options.method).toBe("POST");
                const body = JSON.parse(options.body);
                expect(body.fields.name.stringValue).toBe("chat_sent");
                expect(body.fields.model.stringValue).toBe("llama");
        });

        it("returns false on network failure", async () => {
                vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
                settings.value.firebaseEnabled = true;
                const result = await logEvent("x");
                expect(result).toBe(false);
        });

        it("reads documents and converts fields back to plain values", async () => {
                settings.value.firebaseEnabled = true;
                settings.value.firebaseProjectId = "my-app";
                settings.value.firebaseApiKey = "AIzaTest";
                vi.stubGlobal(
                        "fetch",
                        vi.fn().mockResolvedValue({
                                ok: true,
                                json: async () => ({
                                        fields: {
                                                title: { stringValue: "Hello" },
                                                pinned: { booleanValue: true },
                                                version: { integerValue: "7" },
                                        },
                                }),
                        }),
                );
                const doc = await getDocument("xcoder_config", "announcements");
                expect(doc).toEqual({ title: "Hello", pinned: true, version: 7 });
        });

        it("field converters round-trip scalars", () => {
                const plain = { a: "x", b: true, c: 3, d: 1.5 };
                expect(fromFirestoreFields(toFirestoreFields(plain))).toEqual(plain);
        });
});

afterEach(() => {
        vi.unstubAllGlobals();
        settings.value.firebaseEnabled = false;
        settings.value.firebaseProjectId = "";
        settings.value.firebaseApiKey = "";
});
