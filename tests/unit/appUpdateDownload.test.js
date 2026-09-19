import { describe, expect, it, vi } from "vitest";

import {
        canInstallInApp,
        formatBytesShort,
        pickApkAsset,
        runUpdateFlow,
} from "../../src/lib/appUpdateDownload";

vi.mock("components/toast", () => ({
        default: () => {},
}));
vi.mock("dialogs/confirm", () => ({
        default: async () => true,
}));
vi.mock("dialogs/loader", () => ({
        default: {
                create: () => ({ setMessage: () => {}, destroy: () => {} }),
                destroy: () => {},
        },
}));
vi.mock("fileSystem", () => ({
        default: () => ({
                exists: async () => false,
                stat: async () => ({ size: 0 }),
                writeFile: async () => {},
        }),
}));

describe("appUpdateDownload", () => {
        describe("pickApkAsset", () => {
                it("returns null when there are no assets", () => {
                        expect(pickApkAsset({})).toBeNull();
                        expect(pickApkAsset({ assets: [] })).toBeNull();
                });

                it("skips AAB bundles and checksum files", () => {
                        const asset = pickApkAsset({
                                assets: [
                                        { name: "XCoder-v1.7.8.aab", size: 1 },
                                        { name: "XCoder-v1.7.8.apk.sha256", size: 1 },
                                        { name: "XCoder-v1.7.8.apk", size: 33_000_000 },
                                ],
                        });
                        expect(asset?.name).toBe("XCoder-v1.7.8.apk");
                        expect(asset?.size).toBe(33_000_000);
                });

                it("prefers the official XCoder-*.apk name", () => {
                        const asset = pickApkAsset({
                                assets: [
                                        { name: "app-release.apk", size: 1 },
                                        { name: "XCoder-v2.0.0.apk", size: 2 },
                                ],
                        });
                        expect(asset?.name).toBe("XCoder-v2.0.0.apk");
                });

                it("falls back to the only APK available", () => {
                        const asset = pickApkAsset({
                                assets: [{ name: "app-release.apk", size: 5 }],
                        });
                        expect(asset?.name).toBe("app-release.apk");
                });
        });

        describe("formatBytesShort", () => {
                it("formats MB and GB sizes", () => {
                        expect(formatBytesShort(0)).toBe("0 MB");
                        expect(formatBytesShort(33_000_000)).toMatch(/MB$/);
                        expect(formatBytesShort(1_500_000_000)).toMatch(/GB$/);
                });
        });

        describe("canInstallInApp", () => {
                it("requires native http, fileAction and Android", () => {
                        const full = {
                                cordova: { plugin: { http: { downloadFile() {} } } },
                                system: { fileAction() {} },
                                platform: "Android",
                        };
                        expect(canInstallInApp(full)).toBe(true);
                        expect(
                                canInstallInApp({ ...full, platform: "Browser" }),
                        ).toBe(false);
                        expect(
                                canInstallInApp({
                                        ...full,
                                        system: { fileAction: undefined },
                                }),
                        ).toBe(false);
                        expect(
                                canInstallInApp({
                                        ...full,
                                        cordova: { plugin: { http: {} } },
                                }),
                        ).toBe(false);
                });
        });

        describe("runUpdateFlow", () => {
                const update = {
                        hasUpdate: true,
                        tag: "v1.7.8",
                        url: "https://github.com/carsaimz/xcoder/releases",
                        assets: [{ name: "XCoder-v1.7.8.apk", size: 33_000_000 }],
                };

                it("falls back to the browser when install is not possible", async () => {
                        let opened = false;
                        const result = await runUpdateFlow(update, {
                                env: { platform: "Browser" },
                                openInBrowser: () => {
                                        opened = true;
                                },
                                toast: () => {},
                                confirm: async () => true,
                        });
                        expect(result.fallback).toBe("browser");
                        expect(opened).toBe(true);
                });

                it("falls back to the browser when no APK asset exists", async () => {
                        let opened = false;
                        const result = await runUpdateFlow(
                                { ...update, assets: [{ name: "XCoder.aab", size: 1 }] },
                                {
                                        env: {
                                                platform: "Android",
                                                cordova: { plugin: { http: { downloadFile() {} } } },
                                                system: { fileAction() {} },
                                        },
                                        openInBrowser: () => {
                                                opened = true;
                                        },
                                        toast: () => {},
                                        confirm: async () => true,
                                },
                        );
                        expect(result.fallback).toBe("browser");
                        expect(opened).toBe(true);
                });

                it("downloads then installs on the happy path", async () => {
                        let confirmed = false;
                        let downloaded = false;
                        let installed = false;
                        let progressFired = false;
                        const result = await runUpdateFlow(update, {
                                env: {
                                        platform: "Android",
                                        cordova: { plugin: { http: { downloadFile() {} } } },
                                        system: { fileAction() {} },
                                },
                                confirm: async () => {
                                        confirmed = true;
                                        return true;
                                },
                                download: async (_asset, opts) => {
                                        downloaded = true;
                                        opts?.onProgress?.(16_500_000, 33_000_000);
                                        return "cache/XCoder-v1.7.8.apk";
                                },
                                install: async (fileUrl, name) => {
                                        installed = true;
                                        expect(fileUrl).toBe("cache/XCoder-v1.7.8.apk");
                                        expect(name).toBe("XCoder-v1.7.8.apk");
                                        return true;
                                },
                                toast: () => {},
                                loaderFactory: {
                                        create: () => {
                                                progressFired = true;
                                                return {
                                                        setMessage: () => {},
                                                        destroy: () => {},
                                                };
                                        },
                                },
                        });
                        expect(confirmed).toBe(true);
                        expect(downloaded).toBe(true);
                        expect(installed).toBe(true);
                        expect(progressFired).toBe(true);
                        expect(result).toEqual({ ok: true, installed: true });
                });

                it("never downloads when the user cancels the confirm", async () => {
                        let downloaded = false;
                        const result = await runUpdateFlow(update, {
                                env: {
                                        platform: "Android",
                                        cordova: { plugin: { http: { downloadFile() {} } } },
                                        system: { fileAction() {} },
                                },
                                confirm: async () => false,
                                download: async () => {
                                        downloaded = true;
                                        return "cache/x.apk";
                                },
                                toast: () => {},
                        });
                        expect(downloaded).toBe(false);
                        expect(result.cancelled).toBe(true);
                });

                it("falls back to the browser when the download fails", async () => {
                        let opened = false;
                        let errored = false;
                        const result = await runUpdateFlow(update, {
                                env: {
                                        platform: "Android",
                                        cordova: { plugin: { http: { downloadFile() {} } } },
                                        system: { fileAction() {} },
                                },
                                confirm: async () => true,
                                download: async () => {
                                        throw new Error("network gone");
                                },
                                openInBrowser: () => {
                                        opened = true;
                                },
                                toast: () => {
                                        errored = true;
                                },
                        });
                        expect(opened).toBe(true);
                        expect(errored).toBe(true);
                        expect(result.ok).toBe(false);
                        expect(result.error).toContain("network gone");
                });

                it("falls back to the browser when the installer refuses", async () => {
                        let opened = false;
                        const result = await runUpdateFlow(update, {
                                env: {
                                        platform: "Android",
                                        cordova: { plugin: { http: { downloadFile() {} } } },
                                        system: { fileAction() {} },
                                },
                                confirm: async () => true,
                                download: async () => "cache/x.apk",
                                install: async () => {
                                        throw new Error("no app to handle the APK");
                                },
                                openInBrowser: () => {
                                        opened = true;
                                },
                                toast: () => {},
                        });
                        expect(opened).toBe(true);
                        expect(result.ok).toBe(false);
                });
        });
});
