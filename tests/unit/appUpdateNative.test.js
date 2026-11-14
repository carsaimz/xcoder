// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runUpdateFlow } from "../../src/lib/appUpdateDownload";

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

const ANDROID_ENV = {
	cordova: { plugin: { http: { downloadFile: () => {} } } },
	system: { fileAction: () => {} },
	platform: "Android",
};

const UPDATE = {
	hasUpdate: true,
	tag: "v1.8.29",
	url: "https://github.com/carsaimz/xcoder/releases/tag/v1.8.29",
	assets: [{ name: "XCoder-1.8.29.apk", size: 40_000_000, browser_download_url: "https://github.com/carsaimz/xcoder/releases/download/v1.8.29/XCoder-1.8.29.apk" }],
};

describe("runUpdateFlow — native DownloadManager path", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("downloads via the system DownloadManager and opens the installer", async () => {
		const nativeDownload = vi.fn(async (url, name) => {
			expect(url).toContain("XCoder-1.8.29.apk");
			expect(name).toBe("XCoder-1.8.29.apk");
			return { localUri: "file:///storage/emulated/0/Download/XCoder-1.8.29.apk", bytes: 40_000_000, total: 40_000_000 };
		});
		const install = vi.fn(async () => true);
		const openInBrowser = vi.fn();

		const result = await runUpdateFlow(UPDATE, {
			env: ANDROID_ENV,
			nativeAvailable: true,
			nativeDownload,
			install,
			openInBrowser,
		});

		expect(nativeDownload).toHaveBeenCalledTimes(1);
		expect(install).toHaveBeenCalledWith(
			"file:///storage/emulated/0/Download/XCoder-1.8.29.apk",
			"XCoder-1.8.29.apk",
		);
		expect(result).toEqual({ ok: true, installed: true });
		expect(openInBrowser).not.toHaveBeenCalled();
	});

	it("falls back to the in-app download when the DownloadManager fails", async () => {
		const nativeDownload = vi.fn(async () => {
			throw new Error("download failed (reason 1006)");
		});
		const download = vi.fn(async () => "file:///cache/XCoder-1.8.29.apk");
		const install = vi.fn(async () => true);
		const openInBrowser = vi.fn();

		const result = await runUpdateFlow(UPDATE, {
			env: ANDROID_ENV,
			nativeAvailable: true,
			nativeDownload,
			download,
			install,
			openInBrowser,
		});

		expect(nativeDownload).toHaveBeenCalledTimes(1);
		expect(download).toHaveBeenCalledTimes(1);
		expect(install).toHaveBeenCalledWith(
			"file:///cache/XCoder-1.8.29.apk",
			"XCoder-1.8.29.apk",
		);
		expect(result).toEqual({ ok: true, installed: true });
	});

	it("keeps the browser fallback when neither path exists", async () => {
		const openInBrowser = vi.fn();
		const result = await runUpdateFlow(UPDATE, {
			env: { platform: "Android" },
			nativeAvailable: false,
			openInBrowser,
		});
		expect(result).toEqual({ ok: true, fallback: "browser" });
		expect(openInBrowser).toHaveBeenCalledTimes(1);
	});

	it("still prefers the browser when no APK asset exists", async () => {
		const openInBrowser = vi.fn();
		const result = await runUpdateFlow({ ...UPDATE, assets: [] }, {
			env: ANDROID_ENV,
			nativeAvailable: true,
			openInBrowser,
		});
		expect(result).toEqual({ ok: true, fallback: "browser" });
	});
});
