import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	nativeDownload,
	nativeDownloaderAvailable,
} from "../../src/lib/nativeDownloader";

/** Fake window.Downloader with scripted query responses. */
function fakeDownloader(states, { onDownload } = {}) {
	let downloadId = 0;
	const downloader = {
		download: vi.fn((url, filename) => {
			downloadId += 1;
			onDownload?.(url, filename, String(downloadId));
			return Promise.resolve(String(downloadId));
		}),
		query: vi.fn((id) => {
			const state = states[Number(id)] ?? states[0];
			return Promise.resolve(
				typeof state === "function" ? state() : state,
			);
		}),
		cancel: vi.fn(() => Promise.resolve(1)),
	};
	globalThis.Downloader = downloader;
	return downloader;
}

const RUNNING = (bytes, total) => ({
	status: "running",
	bytes,
	total,
	reason: 0,
});
const DONE = { status: "successful", bytes: 40_000_000, total: 40_000_000, localUri: "file:///storage/emulated/0/Download/XCoder.apk" };

describe("nativeDownloader", () => {
	beforeEach(() => {
		delete globalThis.Downloader;
	});
	afterEach(() => {
		delete globalThis.Downloader;
	});

	it("detects the plugin availability", () => {
		expect(nativeDownloaderAvailable()).toBe(false);
		fakeDownloader({});
		expect(nativeDownloaderAvailable()).toBe(true);
	});

	it("polls until success and reports the local file", async () => {
		let polls = 0;
		fakeDownloader([
			() => {
				polls += 1;
				return polls < 3 ? RUNNING(10_000_000, 40_000_000) : DONE;
			},
		]);
		const progress = [];
		const info = await nativeDownload("https://github.com/a/release.apk", "XCoder.apk", {
			onProgress: (loaded, total) => progress.push([loaded, total]),
		});
		expect(info.localUri).toContain("/Download/XCoder.apk");
		expect(info.total).toBe(40_000_000);
		expect(progress.length).toBeGreaterThan(0);
	});

	it("throws with the reason when the download fails", async () => {
		fakeDownloader([{ status: "failed", bytes: 5, total: 40_000_000, reason: 1006 }]);
		await expect(
			nativeDownload("https://github.com/a/release.apk", "XCoder.apk"),
		).rejects.toThrow(/failed \(reason 1006\)/);
	});

	it("cancels the queue entry when the caller aborts", async () => {
		const downloader = fakeDownloader([
			() => RUNNING(1_000_000, 40_000_000),
		]);
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 50);
		await expect(
			nativeDownload("https://github.com/a/release.apk", "XCoder.apk", {
				signal: controller.signal,
			}),
		).rejects.toThrow(/cancelled/);
		expect(downloader.cancel).toHaveBeenCalled();
	});

	it("errors immediately when the download id disappears", async () => {
		fakeDownloader([() => Promise.reject(new Error("id not found"))]);
		await expect(
			nativeDownload("https://github.com/a/release.apk", "XCoder.apk"),
		).rejects.toThrow(/native download lost/);
	});
});
