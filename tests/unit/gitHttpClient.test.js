// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	collectBody,
	corsProxy,
	headersLike,
	bodyIterator,
	nativeAvailable,
	proxyUrl,
	request,
	setGitHttpPorts,
	DEFAULT_CORS_PROXY,
} from "../../src/lib/git/httpClient";

describe("git httpClient", () => {
	beforeEach(() => {
		setGitHttpPorts(null);
	});

	it("builds proxy urls like isomorphic-git expects", () => {
		expect(proxyUrl("https://proxy.example", "https://github.com/a/b")).toBe(
			"https://proxy.example/https://github.com/a/b",
		);
		expect(proxyUrl("https://proxy.example/", "https://github.com/a/b")).toBe(
			"https://proxy.example/https://github.com/a/b",
		);
	});

	it("defaults the proxy through settings (disable with \"\")", () => {
		expect(corsProxy()).toBe(DEFAULT_CORS_PROXY);
	});

	it("collects an async body into one ArrayBuffer", async () => {
		const body = (async function* () {
			yield new Uint8Array([1, 2, 3]);
			yield new Uint8Array([4, 5]);
		})();
		const buffer = await collectBody(body);
		expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
	});

	it("headersLike is a case-insensitive Headers view", () => {
		const headers = headersLike({ "Content-Type": "text/plain" });
		expect(headers.get("content-type")).toBe("text/plain");
		expect(headers.get("Content-Type")).toBe("text/plain");
		expect(headers.has("CONTENT-TYPE")).toBe(true);
		expect(headers.get("missing")).toBeNull();
		const seen = [];
		headers.forEach((value, name) => seen.push([name, value]));
		expect(seen).toEqual([["Content-Type", "text/plain"]]);
	});

	it("bodyIterator yields the full payload once", async () => {
		const chunks = [];
		for await (const chunk of bodyIterator(new Uint8Array([9, 8]))) {
			chunks.push(chunk);
		}
		expect(chunks.length).toBe(1);
		expect(chunks[0]).toEqual(new Uint8Array([9, 8]));
		for await (const chunk of bodyIterator(null)) {
			chunks.push(chunk);
		}
		expect(chunks.length).toBe(1);
	});

	it("uses the native transport first (CORS-free)", async () => {
		const native = vi.fn((_url, _options, success) => {
			success({
				status: 200,
				statusText: "OK",
				data: new Uint8Array([1]).buffer,
				headers: { "content-type": "application/x-git" },
			});
		});
		setGitHttpPorts({ native: { sendRequest: native } });
		const response = await request({ url: "https://github.com/x/y/info/refs" });
		expect(native).toHaveBeenCalled();
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/x-git");
		const chunks = [];
		for await (const chunk of response.body) chunks.push(chunk);
		expect(chunks[0]).toEqual(new Uint8Array([1]));
	});

	it("returns HTTP-level native failures as responses (401 auth flow)", async () => {
		const native = vi.fn((_url, _options, _success, failure) => {
			failure({ status: 401, error: "Unauthorized" });
		});
		setGitHttpPorts({ native: { sendRequest: native } });
		const response = await request({ url: "https://github.com/x/y/info/refs" });
		expect(response.status).toBe(401);
	});

	it("falls back to fetch when the native transport errors", async () => {
		const native = vi.fn(() => Promise.reject(new Error("transport broke")));
		const fetchMock = vi.fn(() =>
			Promise.resolve({
				status: 200,
				statusText: "OK",
				text: () => Promise.resolve("packdata"),
				headers: new Map([["a", "b"]]),
			}),
		);
		setGitHttpPorts({ native, fetch: fetchMock });
		const response = await request({ url: "https://gitlab.com/a/b" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
		for await (const chunk of response.body) {
			expect(new TextDecoder().decode(chunk)).toBe("packdata");
		}
	});

	it("retries through the CORS proxy when direct fetch throws", async () => {
		const fetchMock = vi.fn(async (url) => {
			if (String(url).startsWith("https://proxy")) {
				return {
					status: 200,
					statusText: "OK",
					text: () => Promise.resolve("proxied"),
					headers: new Map(),
				};
			}
			throw new TypeError("Failed to fetch");
		});
		setGitHttpPorts({ native: null, fetch: fetchMock, proxy: "https://proxy.example" });
		const response = await request({ url: "https://github.com/a/b/info/refs" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(response.status).toBe(200);
		const chunks = [];
		for await (const chunk of response.body) chunks.push(chunk);
		expect(new TextDecoder().decode(chunks[0])).toBe("proxied");
	});

	it("composes one actionable error when every transport fails", async () => {
		setGitHttpPorts({ fetch: () => Promise.reject(new TypeError("boom")), proxy: "" });
		await expect(
			request({ url: "https://github.com/a/b/info/refs" }),
		).rejects.toThrow(/não foi possível conectar a github\.com/);
	});

	it("sends binary bodies through the native raw serializer", async () => {
		let captured;
		const native = vi.fn((url, options, success) => {
			captured = {
				url,
				method: options.method,
				payload: options.data,
				serializer: options.serializer,
			};
			success({ status: 200, data: new Uint8Array([7]).buffer, headers: {} });
		});
		setGitHttpPorts({ native: { sendRequest: native } });
		const body = (async function* () {
			yield new Uint8Array([1, 2]);
		})();
		await request({
			url: "https://github.com/a/b/git-upload-pack",
			method: "POST",
			headers: { Authorization: "Basic abc" },
			body,
		});
		expect(captured.method).toBe("POST");
		expect(captured.serializer).toBe("raw");
		expect(new Uint8Array(captured.payload)).toEqual(new Uint8Array([1, 2]));
		expect(nativeAvailable()).toBe(true);
	});
});
