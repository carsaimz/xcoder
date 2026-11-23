// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { ensureAcodeCompat } from "lib/acodeCompat";

describe("acodeCompat — the Acode bridge", () => {
	beforeEach(() => {
		delete window.acode;
		delete window.xcoder;
	});

	it("exposes the XCoder API under window.acode", () => {
		const api = {
			setPluginInit: () => {},
			setPluginUnmount: () => {},
			require: (name) => ({ name }),
			execCommand: () => {},
		};
		const bridged = ensureAcodeCompat(api);
		expect(bridged).toBe(api);
		expect(window.acode).toBe(api);
		expect(window.acode.setPluginInit).toBe(api.setPluginInit);
		expect(window.acode.require("fsOperation").name).toBe("fsOperation");
	});

	it("falls back to window.xcoder when no api is passed", () => {
		const api = { require: () => null };
		window.xcoder = api;
		ensureAcodeCompat();
		expect(window.acode).toBe(api);
	});

	it("is idempotent — always the same instance", () => {
		const api = { require: () => null };
		expect(ensureAcodeCompat(api)).toBe(api);
		expect(ensureAcodeCompat(api)).toBe(api);
		expect(window.acode).toBe(api);
	});

	it("flags the bridged instance for diagnostics", () => {
		const api = { require: () => null };
		ensureAcodeCompat(api);
		expect(api.isAcodeCompatBridge).toBe(true);
	});

	it("returns null safely when no api is available", () => {
		expect(ensureAcodeCompat()).toBeNull();
		expect(window.acode).toBeUndefined();
	});
});
