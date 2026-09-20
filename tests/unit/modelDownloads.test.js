import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * In-memory fs + scripted http so the download manager is fully
 * deterministic (no cordova, no network).
 */

/** url → {size, bytes} backing store shared with the fs stub. */
const files = new Map();

vi.mock("fileSystem", () => ({
        default: vi.fn((url) => ({
                exists: async () => files.has(url),
                writeFile: async (data) => {
                        const bytes =
                                typeof data === "string"
                                        ? new TextEncoder().encode(data).length
                                        : (data?.byteLength ?? data?.size ?? 0);
                        files.set(url, { data, size: bytes });
                        return url;
                },
                delete: async () => {
                        // recursive like cordova's removeRecursively
                        for (const key of [...files.keys()]) {
                                if (key === url || key.startsWith(`${url}/`)) files.delete(key);
                        }
                        return url;
                },
                stat: async () => ({ size: files.get(url)?.size || 0 }),
                readFile: async () => files.get(url)?.data ?? "",
                createDirectory: async (name) => {
                        // strict like cordova-plugin-file: the PARENT must exist,
                        // otherwise it rejects with "Path does not exist"
                        if (!files.has(url) || files.get(url)?.dir === false) {
                                throw new Error("Path does not exist");
                        }
                        const child = `${url}/${name}`;
                        files.set(child, { data: "", size: 0, dir: true });
                        return child;
                },
                createFile: async (name, data) => {
                        const child = `${url}/${name}`;
                        const bytes =
                                typeof data === "string"
                                        ? new TextEncoder().encode(data).length
                                        : (data?.byteLength ?? data?.size ?? 0);
                        files.set(child, { data, size: bytes });
                        return child;
                },
        })),
}));

vi.mock("utils/Url", () => ({
        default: {
                join: (...parts) => parts.filter(Boolean).join("/"),
                dirname: (value) => value.split("/").slice(0, -1).join("/"),
                basename: (value) => value.split("/").pop(),
        },
}));

globalThis.DATA_STORAGE = "file:///data/xcoder";

const { getLocalModel } = await import("lib/ai/localModels");
let downloads;
let LOCAL;

beforeEach(async () => {
        files.clear();
        // the app storage root exists by the time downloads run (main.js)
        files.set(globalThis.DATA_STORAGE, { data: "", size: 0, dir: true });
        vi.resetModules();
        downloads = await import("lib/ai/modelDownloads");
        LOCAL = await import("lib/ai/localModels");
});

afterEach(() => {
        downloads.setModelDownloadPorts(null);
});

/** Fake http transport: writes the file like the native plugin would. */
function fakeHttp(sizes) {
        return {
                async download(url, destUrl, { onProgress } = {}) {
                        const size = sizes[url] || 100;
                        onProgress?.(size, size);
                        files.set(destUrl, { size });
                        return destUrl;
                },
        };
}

describe("model download manager", () => {
        it("downloads all files and writes a manifest", async () => {
                const model = LOCAL.getLocalModel("mms-tts-por");
                const events = [];
                downloads.setModelDownloadPorts({ http: fakeHttp({}) });
                const result = await downloads.downloadModel(model, {
                        onEvent: (event) => events.push(event),
                });
                expect(result.ok).toBe(true);
                expect(events.at(-1).status).toBe("done");

                expect(await downloads.isModelDownloaded(model.id)).toBe(true);
                const usage = await downloads.localStorageUsage();
                expect(usage.count).toBe(1);
                expect(usage.bytes).toBeGreaterThan(0);
        });

        it("creates the whole directory chain on first install (path bug)", async () => {
                // regression: the first download ever used to fail with
                // cordova's "Path does not exist" because the parent
                // `xcoder-models/` directory was never created first
                const model = LOCAL.getLocalModel("smollm2-135m");
                downloads.setModelDownloadPorts({ http: fakeHttp({}) });
                const result = await downloads.downloadModel(model);
                expect(result.ok).toBe(true);

                const root = globalThis.DATA_STORAGE;
                expect(files.has(`${root}/xcoder-models`)).toBe(true);
                expect(files.has(`${root}/xcoder-models/${model.id}`)).toBe(true);
                expect(
                        files.has(`${root}/xcoder-models/${model.id}/onnx`),
                ).toBe(true);
                expect(
                        files.has(
                                `${root}/xcoder-models/${model.id}/onnx/model_q4f16.onnx`,
                        ),
                ).toBe(true);
        });

        it("emits progress events during download", async () => {
                const model = LOCAL.getLocalModel("whisper-base");
                downloads.setModelDownloadPorts({ http: fakeHttp({}) });
                const events = [];
                await downloads.downloadModel(model, {
                        onEvent: (event) => events.push(event),
                });
                const downloading = events.filter((event) => event.status === "downloading");
                expect(downloading.length).toBeGreaterThanOrEqual(model.files.length);
                expect(downloading[0].file).toBeTruthy();
        });

        it("resumes: files matching the previous manifest size are skipped", async () => {
                const model = LOCAL.getLocalModel("mms-tts-por");
                downloads.setModelDownloadPorts({ http: fakeHttp({}) });
                await downloads.downloadModel(model);

                // second pass with a transport that MUST NOT be called
                const broken = {
                        download: async () => {
                                throw new Error("should not download again");
                        },
                };
                downloads.setModelDownloadPorts({ http: broken });
                const result = await downloads.downloadModel(model);
                expect(result.ok).toBe(true);
                expect(await downloads.isModelDownloaded(model.id)).toBe(true);
        });

        it("marks a model not downloaded when the manifest is absent", async () => {
                expect(await downloads.isModelDownloaded("whisper-small")).toBe(false);
                expect(await downloads.downloadedLocalModels()).toEqual([]);
        });

        it("cancel surfaces a cancelled result", async () => {
                const model = LOCAL.getLocalModel("mms-tts-por");
                let release;
                const gate = new Promise((resolve) => {
                        release = resolve;
                });
                downloads.setModelDownloadPorts({
                        http: {
                                async download(url, destUrl, { signal, onProgress } = {}) {
                                        await gate;
                                        if (signal?.aborted) {
                                                throw Object.assign(new Error("cancelled"), { code: "cancelled" });
                                        }
                                        files.set(destUrl, { size: 10 });
                                        onProgress?.(10, 10);
                                },
                        },
                });
                const pending = downloads.downloadModel(model);
                // wait one tick so the first file enters the gate, then cancel
                await new Promise((resolve) => setTimeout(resolve, 5));
                downloads.cancelDownload(model.id);
                release();
                const result = await pending;
                expect(result.ok).toBe(false);
                expect(result.cancelled).toBe(true);
        });

        it("deletes an installed model (manifest gone)", async () => {
                const model = LOCAL.getLocalModel("mms-tts-por");
                downloads.setModelDownloadPorts({ http: fakeHttp({}) });
                await downloads.downloadModel(model);
                expect(await downloads.isModelDownloaded(model.id)).toBe(true);
                await downloads.deleteLocalModel(model.id);
                expect(await downloads.isModelDownloaded(model.id)).toBe(false);
        });

        it("refuses a concurrent download of the same model", async () => {
                const model = LOCAL.getLocalModel("mms-tts-por");
                let release;
                const gate = new Promise((resolve) => {
                        release = resolve;
                });
                downloads.setModelDownloadPorts({
                        http: {
                                download: async (...args) => {
                                        await gate;
                                        return fakeHttp({}).download(...args);
                                },
                        },
                });
                const first = downloads.downloadModel(model);
                await new Promise((resolve) => setTimeout(resolve, 5));
                const second = await downloads.downloadModel(model);
                expect(second.ok).toBe(false);
                release();
                await first;
        });

        it("catalog ids resolve through getLocalModel", () => {
                expect(getLocalModel("nope")).toBeNull();
        });
});
