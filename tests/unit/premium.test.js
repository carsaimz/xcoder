import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("premium themes", () => {
	it("marks the supporter themes", () => {
		expect(PREMIUM_THEMES.length).toBeGreaterThan(0);
		for (const id of PREMIUM_THEMES) {
			expect(isThemePremium(id)).toBe(true);
		}
		expect(isThemePremium("dark")).toBe(false);
	});

	it("blocks premium themes for free accounts and allows the rest", () => {
		const premium = PREMIUM_THEMES[0];
		expect(canUseTheme(premium)).toBe(false);
		expect(canUseTheme("dark")).toBe(true);
	});

	it("unlocks premium themes for supporters", () => {
		setState({ active: true, kind: "lifetime", expiresAt: 0 });
		for (const id of PREMIUM_THEMES) {
			expect(canUseTheme(id)).toBe(true);
		}
	});
});
