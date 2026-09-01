import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkAppUpdate,
	isNewerVersion,
	parseLooseVersion,
} from "lib/checkAppUpdate";

const RELEASE_URL =
	"https://api.github.com/repos/carsaimz/xcoder/releases/latest";

function stubBuildInfo(version) {
	vi.stubGlobal("BuildInfo", { version });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("lib/checkAppUpdate parseLooseVersion", () => {
	it("parses numeric prefixes of tags and versions", () => {
		expect(parseLooseVersion("v1.2.3")).toEqual([1, 2, 3]);
		expect(parseLooseVersion("1.2.3")).toEqual([1, 2, 3]);
		expect(parseLooseVersion("1.2.3-debug")).toEqual([1, 2, 3]);
		expect(parseLooseVersion("v1.4.0-beta.1")).toEqual([1, 4, 0]);
		expect(parseLooseVersion("1.2")).toEqual([1, 2, 0]);
		expect(parseLooseVersion("v1")).toEqual([1, 0, 0]);
	});

	it("returns null for invalid input", () => {
		expect(parseLooseVersion("")).toBeNull();
		expect(parseLooseVersion("abc")).toBeNull();
		expect(parseLooseVersion("beta")).toBeNull();
		expect(parseLooseVersion(null)).toBeNull();
		expect(parseLooseVersion(undefined)).toBeNull();
	});
});

describe("lib/checkAppUpdate isNewerVersion", () => {
	it("detects strictly newer versions", () => {
		expect(isNewerVersion("v1.4.1", "1.4.0")).toBe(true);
		expect(isNewerVersion("1.5.0", "1.4.9")).toBe(true);
		expect(isNewerVersion("1.4.0", "1.3")).toBe(true);
	});

	it("ignores equal and older versions", () => {
		expect(isNewerVersion("v1.4.0", "1.4.0")).toBe(false);
		expect(isNewerVersion("1.3.9", "1.4.0")).toBe(false);
		expect(isNewerVersion("1.4.0", "1.4.0-debug")).toBe(false);
	});

	it("ignores pre-release suffixes", () => {
		// numeric parts equal — a beta build is not offered the same stable
		expect(isNewerVersion("v1.4.0", "1.4.0-beta.1")).toBe(false);
		expect(isNewerVersion("v1.4.1", "1.4.0-beta.1")).toBe(true);
	});

	it("returns false when versions cannot be parsed", () => {
		expect(isNewerVersion("garbage", "1.0.0")).toBe(false);
		expect(isNewerVersion("1.0.0", "")).toBe(false);
	});
});

describe("lib/checkAppUpdate checkAppUpdate", () => {
	it("uses cordova http and reports an update", async () => {
		stubBuildInfo("1.4.0");
		vi.stubGlobal("cordova", {
			plugin: {
				http: {
					sendRequest(url, options, success, error) {
						expect(url).toBe(RELEASE_URL);
						expect(options.method).toBe("GET");
						success({
							data: {
								tag_name: "v1.5.0",
								html_url: "https://github.com/carsaimz/xcoder/releases/tag/v1.5.0",
							},
						});
					},
				},
			},
		});

		const update = await checkAppUpdate();
		expect(update).toEqual({
			hasUpdate: true,
			tag: "v1.5.0",
			url: "https://github.com/carsaimz/xcoder/releases/tag/v1.5.0",
		});
	});

	it("reports no update when the release is not newer", async () => {
		stubBuildInfo("1.5.0");
		vi.stubGlobal("cordova", {
			plugin: {
				http: {
					sendRequest(url, options, success) {
						success({ data: { tag_name: "v1.4.0", html_url: "x" } });
					},
				},
			},
		});

		const update = await checkAppUpdate();
		expect(update.hasUpdate).toBe(false);
	});

	it("falls back to fetch when cordova http is unavailable", async () => {
		stubBuildInfo("1.4.0");
		vi.stubGlobal("cordova", undefined);
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							tag_name: "v2.0.0",
							html_url: "https://github.com/carsaimz/xcoder/releases/tag/v2.0.0",
						}),
				}),
			),
		);

		const update = await checkAppUpdate();
		expect(update.hasUpdate).toBe(true);
		expect(update.tag).toBe("v2.0.0");
	});

	it("returns null when the payload has no tag", async () => {
		stubBuildInfo("1.4.0");
		vi.stubGlobal("cordova", {
			plugin: {
				http: {
					sendRequest(url, options, success) {
						success({ data: {} });
					},
				},
			},
		});

		expect(await checkAppUpdate()).toBeNull();
	});

	it("rejects when the request fails", async () => {
		stubBuildInfo("1.4.0");
		vi.stubGlobal("cordova", {
			plugin: {
				http: {
					sendRequest(url, options, success, error) {
						error({ status: 403 });
					},
				},
			},
		});

		await expect(checkAppUpdate()).rejects.toThrow("403");
	});

	it("rejects when fetch responds with an http error", async () => {
		stubBuildInfo("1.4.0");
		vi.stubGlobal("cordova", undefined);
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.resolve({ ok: false, status: 500 })),
		);

		await expect(checkAppUpdate()).rejects.toThrow("500");
	});
});
