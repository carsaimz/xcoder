// @vitest-environment happy-dom
/**
 * lib/siteDownloadBridge — the embedded site postMessages
 * `{ type: "xcoder:download", url }` when the user taps a download
 * link (the webview iframe swallows those navigations, which is why
 * "download dentro do app não funcionava"). The bridge routes them
 * into the download manager, flagging APKs for auto-install.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

const { startDownloadMock } = vi.hoisted(() => ({
	startDownloadMock: vi.fn(),
}));

vi.mock("lib/downloadManager", () => ({
	startDownload: startDownloadMock,
}));
vi.mock("components/toast", () => ({ default: vi.fn() }));

import {
	SITE_DOWNLOAD_MSG,
	handleSiteMessage,
	installSiteDownloadBridge,
} from "lib/siteDownloadBridge";

beforeEach(() => {
	startDownloadMock.mockClear();
	// detach a previous bridge (the flag lives on globalThis)
	globalThis.__xcoderSiteDownloadBridge = false;
});

function msg(data) {
	return new MessageEvent("message", { data, origin: "https://xcoder.app" });
}

describe("siteDownloadBridge.handleSiteMessage", () => {
	test("accepts a download message and routes it to the manager", () => {
		const handled = handleSiteMessage(
			msg({ type: SITE_DOWNLOAD_MSG, url: "https://x.com/app.apk" }),
		);
		assert.equal(handled, true);
		assert.deepEqual(startDownloadMock.mock.calls, [
			[{ url: "https://x.com/app.apk", install: true }],
		]);
	});

	test("flags non-apk downloads without install", () => {
		handleSiteMessage(msg({ type: SITE_DOWNLOAD_MSG, url: "https://x.com/lib.zip" }));
		assert.deepEqual(startDownloadMock.mock.calls, [
			[{ url: "https://x.com/lib.zip", install: false }],
		]);
	});

	test("honours an explicit install flag from the site", () => {
		handleSiteMessage(
			msg({ type: SITE_DOWNLOAD_MSG, url: "https://x.com/tool.bin", install: true }),
		);
		assert.deepEqual(startDownloadMock.mock.calls, [
			[{ url: "https://x.com/tool.bin", install: true }],
		]);
	});

	test("ignores foreign messages and non-http urls", () => {
		assert.equal(handleSiteMessage(msg({ type: "other", url: "https://x.com/a" })), false);
		assert.equal(handleSiteMessage(msg({ type: SITE_DOWNLOAD_MSG, url: "file:///etc" })), false);
		assert.equal(handleSiteMessage(msg(null)), false);
		assert.equal(handleSiteMessage(null), false);
		assert.equal(startDownloadMock.mock.calls.length, 0);
	});
});

describe("siteDownloadBridge.installSiteDownloadBridge", () => {
	test("installs once and routes window messages", () => {
		const detach = installSiteDownloadBridge();
		installSiteDownloadBridge(); // idempotent

		window.dispatchEvent(
			msg({ type: SITE_DOWNLOAD_MSG, url: "https://x.com/app.apk" }),
		);
		assert.equal(startDownloadMock.mock.calls.length, 1);

		detach();
		window.dispatchEvent(
			msg({ type: SITE_DOWNLOAD_MSG, url: "https://x.com/app2.apk" }),
		);
		assert.equal(startDownloadMock.mock.calls.length, 1, "detached listener still active");

		// the flag is cleared — installing again attaches a fresh listener
		const detach2 = installSiteDownloadBridge();
		window.dispatchEvent(
			msg({ type: SITE_DOWNLOAD_MSG, url: "https://x.com/app3.apk" }),
		);
		assert.equal(startDownloadMock.mock.calls.length, 2);
		detach2();
	});
});
