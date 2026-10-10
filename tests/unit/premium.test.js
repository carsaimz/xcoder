import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backendConfig } from "lib/backend";

vi.mock("lib/backend", () => ({
	backendConfig: vi.fn(() => null),
}));

import {
	canUseTheme,
	FREE_MAX_TOKENS,
	hasPremium,
	isPremium,
	isThemePremium,
	maxTokensLimit,
	PREMIUM_MAX_TOKENS,
	PREMIUM_THEMES,
	requirePremium,
	supportInfo,
} from "lib/premium";

/** localStorage is not available in the node test environment. */
function makeStorage() {
	const map = new Map();
	return {
		getItem: (key) => (map.has(key) ? map.get(key) : null),
		setItem: (key, value) => map.set(key, String(value)),
		removeItem: (key) => map.delete(key),
		clear: () => map.clear(),
	};
}

let storage;
beforeEach(() => {
	storage = makeStorage();
	vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function setState(state) {
	if (state === null) storage.removeItem("xcoder.premium");
	else storage.setItem("xcoder.premium", JSON.stringify(state));
}

describe("premium state", () => {
	it("starts inactive without stored state", () => {
		expect(isPremium()).toBe(false);
		expect(hasPremium()).toBe(false);
	});

	it("is active with a lifetime grant", () => {
		setState({ active: true, kind: "lifetime", expiresAt: 0 });
		expect(isPremium()).toBe(true);
	});

	it("expires yearly grants", () => {
		setState({ active: true, kind: "yearly", expiresAt: Date.now() - 1000 });
		expect(isPremium()).toBe(false);
	});

	it("keeps unexpired yearly grants active", () => {
		setState({ active: true, kind: "yearly", expiresAt: Date.now() + 60_000 });
		expect(isPremium()).toBe(true);
	});
});

describe("feature gates", () => {
	it("caps max tokens at the free limit for free accounts", () => {
		expect(maxTokensLimit()).toBe(FREE_MAX_TOKENS);
		expect(FREE_MAX_TOKENS).toBe(4096);
	});

	it("raises the max tokens cap for premium accounts", () => {
		setState({ active: true, kind: "lifetime", expiresAt: 0 });
		expect(maxTokensLimit()).toBe(PREMIUM_MAX_TOKENS);
		expect(PREMIUM_MAX_TOKENS).toBe(8192);
	});

	it("requirePremium denies free accounts (toast import fails silently in node)", async () => {
		await expect(requirePremium()).resolves.toBe(false);
		await expect(requirePremium(true)).resolves.toBe(false);
	});

	it("requirePremium allows premium accounts", async () => {
		setState({ active: true, kind: "lifetime", expiresAt: 0 });
		await expect(requirePremium()).resolves.toBe(true);
	});
});

describe("themes are free (v1.4.18)", () => {
	it("no theme requires premium anymore", () => {
		expect(PREMIUM_THEMES).toEqual([]);
		for (const id of ["neon", "sunset", "obsidian", "dark", "xcoder"]) {
			expect(isThemePremium(id)).toBe(false);
			// even a previously "premium" id must stay free
		}
	});

	it("allows every theme with and without premium", () => {
		for (const id of ["neon", "sunset", "obsidian", "dark"]) {
			expect(canUseTheme(id)).toBe(true);
		}
		setState({ active: true, kind: "lifetime", expiresAt: 0 });
		expect(canUseTheme("neon")).toBe(true);
	});
});

describe("supportInfo (payment methods from the site remote config)", () => {
	it("keeps qr_image_url and normalizes snake_case fields", () => {
		backendConfig.mockReturnValueOnce({
			support: {
				methods: [
					{
						method: "kofi",
						label: "Ko-fi",
						url: "https://ko-fi.com/carsaimz",
						account: null,
						account_label: "Ko-fi page",
						instructions: "Apoie no Ko-fi",
						qr_image_url: "https://cdn.example.com/kofi-qr.png",
					},
					{
						method: "mpesa",
						label: "M-Pesa",
						url: null,
						account: "258841234567",
						qr_image_url: "https://cdn.example.com/mpesa-qr.png",
					},
					// QR-only row (no url, no account) must NOT be dropped
					{
						method: "emola",
						label: "e-Mola",
						url: null,
						account: null,
						qr_image_url: "https://cdn.example.com/emola-qr.png",
					},
				],
			},
		});
		const { methods } = supportInfo();
		expect(methods.length).toBe(3);
		expect(methods[0].qr_image_url).toBe("https://cdn.example.com/kofi-qr.png");
		expect(methods[0].accountLabel).toBe("Ko-fi page");
		expect(methods[1].account).toBe("258841234567");
		expect(methods[2].qr_image_url).toBe("https://cdn.example.com/emola-qr.png");
	});

	it("falls back to built-in methods without remote config", () => {
		backendConfig.mockReturnValueOnce(null);
		const { methods } = supportInfo();
		expect(methods.length).toBeGreaterThan(0);
	});
});
