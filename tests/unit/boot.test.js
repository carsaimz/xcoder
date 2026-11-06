// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// src/boot.js is www/index.html's real entry point. It executes at import
// time, so every case re-imports it after vi.resetModules() and wires the
// __DEV_* globals that rspack inlines into the production bundle.
describe("boot.js routing", () => {
	const added = [];
	const loadBoot = () => import("../../src/boot.js");
	// DOM .src/.href reflect the absolutized URL — read the raw attributes so
	// relative prod assets ("./build/main.js") compare exactly.
	const assetUrls = () =>
		added.map((node) => node.getAttribute("src") ?? node.getAttribute("href"));
	const setDevGlobals = () => {
		globalThis.__DEV_MODE__ = true;
		globalThis.__DEV_HOST__ = "localhost";
		globalThis.__DEV_PORT__ = "7000";
		globalThis.__DEV_PROTO__ = "http";
	};
	const stubWebSocket = () => {
		const sockets = [];
		vi.stubGlobal(
			"WebSocket",
			class {
				constructor(url) {
					sockets.push(url);
				}
			},
		);
		return sockets;
	};

	beforeEach(() => {
		vi.resetModules();
		added.length = 0;
		delete globalThis.__DEV_MODE__;
		delete globalThis.__DEV_HOST__;
		delete globalThis.__DEV_PORT__;
		delete globalThis.__DEV_PROTO__;
		vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
			added.push(node);
			return node;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("production: loads local assets without touching the dev server", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false });
		vi.stubGlobal("fetch", fetchMock);

		await loadBoot();

		expect(assetUrls()).toEqual(["./build/main.css", "./build/main.js"]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("dev mode: probes the dev server, loads its assets and opens the reload WebSocket", async () => {
		const sockets = stubWebSocket();
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		setDevGlobals();

		await loadBoot();
		await vi.waitFor(() => expect(added).toHaveLength(2));

		expect(assetUrls()).toEqual([
			"http://localhost:7000/build/main.css",
			"http://localhost:7000/build/main.js",
		]);
		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:7000/build/main.js",
			expect.objectContaining({ method: "HEAD" }),
		);
		expect(sockets).toEqual(["ws://localhost:7000"]);
	});

	it("dev mode: falls back to local assets when the dev server is gone", async () => {
		const sockets = stubWebSocket();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
		setDevGlobals();

		await loadBoot();
		await vi.waitFor(() => expect(added).toHaveLength(2));

		expect(assetUrls()).toEqual(["./build/main.css", "./build/main.js"]);
		expect(sockets).toEqual([]);
	});

	it("dev mode: falls back to local assets when the dev-server probe fails", async () => {
		const sockets = stubWebSocket();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("offline")),
		);
		setDevGlobals();

		await loadBoot();
		await vi.waitFor(() => expect(added).toHaveLength(2));

		expect(assetUrls()).toEqual(["./build/main.css", "./build/main.js"]);
		expect(sockets).toEqual([]);
	});
});
