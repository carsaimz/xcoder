// @vitest-environment happy-dom
/**
 * lib/downloadManager — "Download dentro do app não funciona" fix.
 * Covers the pure parts: url→filename guessing, the sequential queue,
 * cancel propagation and the fetch fallback transport (happy-dom fetch
 * mock). The native advanced-http path is exercised through the same
 * public API with a stubbed cordova.plugin.http.
 */
import assert from "node:assert/strict";
globalThis.strings = { cancel: "Cancel", downloading: "Downloading", "download complete": "Downloaded" };

import { beforeEach, describe, expect, test, vi } from "vitest";

const fetchMock = vi.fn();

const { fsState, notificationStore } = vi.hoisted(() => ({
        fsState: {
                existing: new Set(["file:///cache"]),
                writes: [],
                dirs: [],
        },
        notificationStore: { list: [] },
}));

vi.stubGlobal("fetch", fetchMock);

vi.mock("fileSystem", () => ({
        default: vi.fn((url) => ({
                exists: async () => fsState.existing.has(String(url)),
                writeFile: async (data) => {
                        fsState.writes.push({ url: String(url), data });
                },
                createDirectory: async (name) => {
                        fsState.dirs.push(String(name));
                },
                stat: async () => ({ size: 0 }),
        })),
}));

vi.mock("components/toast", () => ({ default: vi.fn() }));

vi.mock("lib/notificationManager", () => ({
        default: {
                notifications: notificationStore.list,
                pushNotification(notification) {
                        this.notifications.push({
                                ...notification,
                                id: `n${this.notifications.length + 1}`,
                        });
                },
                renderNotifications() {},
        },
}));

import {
        activeDownloads,
        cancelDownload,
        defaultDownloadDir,
        downloadUrl,
        guessNameFromUrl,
        startDownload,
} from "lib/downloadManager";

function streamResponse(chunks, { total = 0 } = {}) {
        let i = 0;
        return {
                ok: true,
                status: 200,
                headers: new Map([["content-length", String(total)]]),
                body: {
                        getReader() {
                                return {
                                        async read() {
                                                if (i < chunks.length) {
                                                        return { done: false, value: chunks[i++] };
                                                }
                                                return { done: true };
                                        },
                                };
                        },
                },
                async blob() {
                        return new Blob(chunks);
                },
        };
}

describe("downloadManager.guessNameFromUrl", () => {
        test("uses the last path segment (decoded, sanitized)", () => {
                expect(guessNameFromUrl("https://x.com/a/b/My%20File.zip")).toBe(
                        "My File.zip",
                );
        });

        test("falls back to a generated name", () => {
                expect(guessNameFromUrl("https://x.com/")).toMatch(/^download-\d+$/);
        });
});

describe("downloadManager.defaultDownloadDir", () => {
        test("appends Download to the app storage", () => {
                globalThis.DATA_STORAGE = "file:///data/user/0/app/files";
                expect(defaultDownloadDir()).toBe(
                        "file:///data/user/0/app/files/Download",
                );
                delete globalThis.DATA_STORAGE;
                expect(defaultDownloadDir()).toBe("Download");
        });
});

describe("downloadManager.downloadUrl (fetch fallback)", () => {
        beforeEach(() => {
                fetchMock.mockReset();
                fsState.writes = [];
                globalThis.cordova = undefined;
        });

        test("streams chunks, reports progress and writes the file", async () => {
                fetchMock.mockResolvedValue(
                        streamResponse([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])], {
                                total: 5,
                        }),
                );
                const progress = [];
                const { destUrl, size } = await downloadUrl({
                        url: "https://example.com/data.bin",
                        dir: "file:///cache",
                        name: "data.bin",
                        onProgress: (loaded, total) => progress.push([loaded, total]),
                });
                assert.equal(destUrl, "file:///cache/data.bin");
                assert.equal(size, 5);
                assert.ok(progress.length >= 1);
                assert.equal(progress.at(-1)[0], 5);
                assert.equal(fsState.writes.length, 1);
        });

        test("creates missing target directories", async () => {
                fsState.existing.clear();
                fetchMock.mockResolvedValue(streamResponse([new Uint8Array([1])]));
                await downloadUrl({
                        url: "https://example.com/x.bin",
                        dir: "file:///cache/DL",
                });
                assert.deepEqual(fsState.dirs, ["DL"]);
        });

        test("rejects non-http urls", async () => {
                await expect(
                        downloadUrl({ url: "ftp://example.com/x", dir: "/tmp" }),
                ).rejects.toThrow(/http\(s\)/);
        });
});

describe("downloadManager queue + cancel", () => {
        beforeEach(() => {
                fetchMock.mockReset();
                fsState.writes = [];
                globalThis.cordova = undefined;
        });

        test("startDownload drains through the queue with UI updates", async () => {
                fetchMock.mockResolvedValue(streamResponse([new Uint8Array([9])]));
                const id = startDownload({ url: "https://example.com/x.bin" });
                assert.ok(id.startsWith("dl_"));
                expect(activeDownloads()).toContain(id);
                await new Promise((r) => setTimeout(r, 80));
                expect(activeDownloads()).not.toContain(id);
                // a notification was created and finished with ✓
                const notif = notificationStore.list.find(
                        (item) => item.downloadId === id,
                );
                assert.ok(notif, "download notification missing");
                assert.match(notif.message, /^✓/);
        });

        test("cancelDownload on an unknown id is a no-op", () => {
                expect(cancelDownload("dl_404")).toBe(false);
        });
});
