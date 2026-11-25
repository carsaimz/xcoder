import { afterEach, describe, expect, it, vi } from "vitest";
import { beautifyCode, disposeBeautifyWorker } from "../../src/lib/webScraper";

/**
 * Worker-free environments (old WebViews, node tests) must fall back to
 * the inline formatter for small sources and fail fast for big ones.
 * A real Worker proves the fast path: prettier runs off the main thread
 * (v1.8.38 — inline prettier froze the whole app on minified pages).
 */
describe("beautifyCode worker pipeline", () => {
        const originalWorker = globalThis.Worker;

        afterEach(() => {
                if (originalWorker === undefined) {
                        delete globalThis.Worker;
                } else {
                        globalThis.Worker = originalWorker;
                }
                vi.restoreAllMocks();
                disposeBeautifyWorker();
        });

        it("falls back to the inline formatter when Worker is unavailable (small source)", async () => {
                delete globalThis.Worker;
                const pretty = await beautifyCode(
                        "body{margin:0;padding:0}",
                        "css",
                );
                expect(pretty).toContain("margin: 0;");
        });

        it("fails fast with a clear error when Worker is unavailable and the source is big", async () => {
                delete globalThis.Worker;
                const big = `body{color:#fff}${"a".repeat(30000)}`;
                await expect(beautifyCode(big, "css")).rejects.toThrow(
                        /unavailable|timeout/i,
                );
        });

        it("formats through the worker when one is provided", async () => {
                class FakeWorker {
                        constructor() {
                                this.onmessage = null;
                                this.onerror = null;
                                this.terminated = false;
                        }
                        postMessage(message) {
                                // answer like the real beautifyWorker: {id, ok, value}
                                setTimeout(() => {
                                        this.onmessage?.({
                                                data: {
                                                        id: message.id,
                                                        ok: true,
                                                        value: `WORKER-FORMATTED(${message.lang})`,
                                                },
                                        });
                                });
                        }
                        terminate() {
                                this.terminated = true;
                        }
                }
                globalThis.Worker = FakeWorker;
                const result = await beautifyCode("x", "html");
                expect(result).toBe("WORKER-FORMATTED(html)");
        });

        it("rejects and recovers when the worker reports an error", async () => {
                class BrokenWorker {
                        constructor() {
                                this.onmessage = null;
                        }
                        postMessage(message) {
                                setTimeout(() => {
                                        this.onmessage?.({
                                                data: { id: message.id, ok: false, error: "boom" },
                                        });
                                });
                        }
                }
                globalThis.Worker = BrokenWorker;
                // a worker error (prettier failed) surfaces as a rejection — the
                // inline fallback is only for missing workers, not parser failures
                await expect(beautifyCode("a{color:red}", "css")).rejects.toThrow("boom");
        });

        it("times out a stuck worker (timeout that actually fires, off-thread)", async () => {
                class StuckWorker {
                        constructor() {
                                this.onmessage = null;
                                this.onerror = null;
                        }
                        postMessage() {
                                /* never replies */
                        }
                        terminate() {}
                }
                globalThis.Worker = StuckWorker;
                // big source (> inline limit): no fallback possible, the
                // timeout error surfaces — and unlike the old inline
                // prettier path, this timeout can actually fire
                const big = `${"a".repeat(30000)};`;
                await expect(
                        beautifyCode(big, "js", { timeoutMs: 50 }),
                ).rejects.toThrow(/timeout/i);
        });
});
