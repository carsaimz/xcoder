import { beforeEach, describe, expect, it } from "vitest";
import {
        MAX_SESSION_EVENTS,
        MAX_SESSIONS,
        deriveTitle,
        formatSessionTime,
        loadActiveId,
        loadSessions,
        newSession,
        saveActiveId,
        saveSessions,
        setStorage,
        touchSession,
} from "lib/ai/sessions";

/** Map-backed storage adapter isolated per test. */
function makeStorage() {
        const map = new Map();
        return {
                getItem: (key) => (map.has(key) ? map.get(key) : null),
                setItem: (key, value) => map.set(key, value),
                removeItem: () => map.clear(),
        };
}

describe("ai sessions store", () => {
        beforeEach(() => {
                setStorage(makeStorage());
        });

        it("starts empty and round-trips sessions", () => {
                expect(loadSessions()).toEqual([]);

                const session = newSession("My chat");
                session.events = [{ type: "user", payload: "hi" }];
                saveSessions([session]);
                saveActiveId(session.id);

                const loaded = loadSessions();
                expect(loaded).toHaveLength(1);
                expect(loaded[0].title).toBe("My chat");
                expect(loaded[0].events).toEqual([{ type: "user", payload: "hi" }]);
                expect(loadActiveId()).toBe(session.id);
        });

        it("survives corrupted storage", () => {
                setStorage({
                        // simulate a corrupted sessions payload (active id key stays intact)
                        getItem: (key) => (key.includes("active") ? null : "{not json"),
                        setItem: () => {},
                        removeItem: () => {},
                });
                expect(loadSessions()).toEqual([]);
                expect(loadActiveId()).toBeNull();
        });

        it("caps events per session", () => {
                const session = newSession();
                session.events = Array.from({ length: MAX_SESSION_EVENTS + 50 }, (_, i) => ({
                        type: "user",
                        payload: i,
                }));
                touchSession(session);

                expect(session.events).toHaveLength(MAX_SESSION_EVENTS);
                expect(session.events[0].payload).toBe(50);
        });

        it("caps the number of sessions, dropping the oldest updates first", () => {
                const sessions = [];
                for (let i = 0; i < MAX_SESSIONS + 5; i++) {
                        const session = newSession(`chat ${i}`);
                        session.createdAt = i;
                        session.updatedAt = i;
                        sessions.push(session);
                }
                const stored = saveSessions(sessions);

                expect(stored).toHaveLength(MAX_SESSIONS);
                // oldest updatedAt (0..4) dropped, the rest kept ordered by createdAt
                expect(stored[0].title).toBe("chat 5");
                expect(stored[stored.length - 1].title).toBe(`chat ${MAX_SESSIONS + 4}`);
        });

        it("deriveTitle uses the first non-empty line, collapsed and capped", () => {
                expect(deriveTitle("  \n\n   ")).toBe("New chat");
                expect(deriveTitle("fix the   bug\nin parser")).toBe("fix the bug");
                const long = "a".repeat(60);
                const title = deriveTitle(long);
                expect(title).toHaveLength(43); // 42 + ellipsis
                expect(title.endsWith("…")).toBe(true);
        });

        it("formatSessionTime renders compact labels", () => {
                expect(formatSessionTime(Date.now())).toBe("now");
                expect(formatSessionTime(Date.now() - 5 * 60000)).toBe("5m");
                expect(formatSessionTime(Date.now() - 3 * 3600000)).toBe("3h");
                expect(formatSessionTime(Date.now() - 2 * 86400000)).toBe("2d");
        });
});
