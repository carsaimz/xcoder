import { afterEach, describe, expect, it, vi } from "vitest";
import { detectDefaultLanguage } from "lib/lang";

function stubDeviceLanguage(language) {
	vi.stubGlobal("navigator", { language });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("lib/lang detectDefaultLanguage", () => {
	it("uses Portuguese as the ultimate default", () => {
		stubDeviceLanguage(undefined);
		expect(detectDefaultLanguage()).toBe("pt-br");
		stubDeviceLanguage("");
		expect(detectDefaultLanguage()).toBe("pt-br");
		stubDeviceLanguage("sw-KE");
		expect(detectDefaultLanguage()).toBe("pt-br");
	});

	it("matches Portuguese variants to pt-br", () => {
		stubDeviceLanguage("pt-BR");
		expect(detectDefaultLanguage()).toBe("pt-br");
		stubDeviceLanguage("pt");
		expect(detectDefaultLanguage()).toBe("pt-br");
		stubDeviceLanguage("pt-AO");
		expect(detectDefaultLanguage()).toBe("pt-br");
	});

	it("matches exact language codes", () => {
		stubDeviceLanguage("de-DE");
		expect(detectDefaultLanguage()).toBe("de-de");
		stubDeviceLanguage("zh-TW");
		expect(detectDefaultLanguage()).toBe("zh-tw");
		stubDeviceLanguage("mm-unicode");
		expect(detectDefaultLanguage()).toBe("mm-unicode");
	});

	it("falls back to a matching base language", () => {
		stubDeviceLanguage("en-GB");
		expect(detectDefaultLanguage()).toBe("en-us");
		stubDeviceLanguage("de-AT");
		expect(detectDefaultLanguage()).toBe("de-de");
		stubDeviceLanguage("es-419");
		expect(detectDefaultLanguage()).toBe("es-sv");
	});

	it("maps special subtags", () => {
		stubDeviceLanguage("fa-IR");
		expect(detectDefaultLanguage()).toBe("ir-fa");
		stubDeviceLanguage("fil-PH");
		expect(detectDefaultLanguage()).toBe("tl-ph");
		stubDeviceLanguage("my-MM");
		expect(detectDefaultLanguage()).toBe("mm-unicode");
		stubDeviceLanguage("pa-IN");
		expect(detectDefaultLanguage()).toBe("pu-in");
	});

	it("maps Chinese variants", () => {
		stubDeviceLanguage("zh-CN");
		expect(detectDefaultLanguage()).toBe("zh-cn");
		stubDeviceLanguage("zh-HK");
		expect(detectDefaultLanguage()).toBe("zh-hant");
		stubDeviceLanguage("zh-Hans");
		expect(detectDefaultLanguage()).toBe("zh-cn");
	});
});
