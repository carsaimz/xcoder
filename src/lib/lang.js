const langMap = {
	"en-us": {
		name: "English",
		async strings() {
			return await import("../lang/en-us.json");
		},
	},
	"es-sv": {
		name: "Español",
		async strings() {
			return await import("../lang/es-sv.json");
		},
	},
	"fr-fr": {
		name: "Francais",
		async strings() {
			return await import("../lang/fr-fr.json");
		},
	},
	"tl-ph": {
		name: "Tagalog",
		async strings() {
			return await import("../lang/tl-ph.json");
		},
	},
	"de-de": {
		name: "Deutsch",
		async strings() {
			return await import("../lang/de-de.json");
		},
	},
	"id-id": {
		name: "Bahasa Indonesia",
		async strings() {
			return await import("../lang/id-id.json");
		},
	},
	"uz-uz": {
		name: "O'zbekcha",
		async strings() {
			return await import("../lang/uz-uz.json");
		},
	},
	"ru-ru": {
		name: "Русский",
		async strings() {
			return await import("../lang/ru-ru.json");
		},
	},
	"pl-pl": {
		name: "Polski",
		async strings() {
			return await import("../lang/pl-pl.json");
		},
	},
	"pt-br": {
		name: "Português",
		async strings() {
			return await import("../lang/pt-br.json");
		},
	},
	"pu-in": {
		name: "ਪੰਜਾਬੀ",
		async strings() {
			return await import("../lang/pu-in.json");
		},
	},
	"tr-tr": {
		name: "Türkçe",
		async strings() {
			return await import("../lang/tr-tr.json");
		},
	},
	"uk-ua": {
		name: "Українська",
		async strings() {
			return await import("../lang/uk-ua.json");
		},
	},
	"hi-in": {
		name: "हिंदी",
		async strings() {
			return await import("../lang/hi-in.json");
		},
	},
	"zh-cn": {
		name: "中文简体",
		async strings() {
			return await import("../lang/zh-cn.json");
		},
	},
	"zh-hant": {
		name: "繁體中文",
		async strings() {
			return await import("../lang/zh-hant.json");
		},
	},
	"zh-tw": {
		name: "繁體中文 (台灣)",
		async strings() {
			return await import("../lang/zh-tw.json");
		},
	},
	"ir-fa": {
		name: "فارسی",
		async strings() {
			return await import("../lang/ir-fa.json");
		},
	},
	"ar-ye": {
		name: "العربية",
		async strings() {
			return await import("../lang/ar-ye.json");
		},
	},
	"ja-jp": {
		name: "日本語",
		async strings() {
			return await import("../lang/ja-jp.json");
		},
	},
	"bn-bd": {
		name: "বাংলা",
		async strings() {
			return await import("../lang/bn-bd.json");
		},
	},
	"cs-cz": {
		name: "Čeština",
		async strings() {
			return await import("../lang/cs-cz.json");
		},
	},
	"vi-vn": {
		name: "Tiếng Việt",
		async strings() {
			return await import("../lang/vi-vn.json");
		},
	},
	"be-by": {
		name: "Беларуская",
		async strings() {
			return await import("../lang/be-by.json");
		},
	},
	"hu-hu": {
		name: "Magyar",
		async strings() {
			return await import("../lang/hu-hu.json");
		},
	},
	"ml-in": {
		name: "മലയാളം",
		async strings() {
			return await import("../lang/ml-in.json");
		},
	},
	"mm-unicode": {
		name: "ဗမာစာ(Unicode)",
		async strings() {
			return await import("../lang/mm-unicode.json");
		},
	},
	"mm-zawgyi": {
		name: "ဗမာစာ(Zawgyi)",
		async strings() {
			return await import("../lang/mm-zawgyi.json");
		},
	},
	"ko-kr": {
		name: "한국어",
		async strings() {
			return await import("../lang/ko-kr.json");
		},
	},
	"it-it": {
		name: "Italiano",
		async strings() {
			return await import("../lang/it-it.json");
		},
	},
	"he-il": {
		name: "Hebrew",
		async strings() {
			return await import("../lang/he-il.json");
		},
	},
};

const intlLocaleOverrides = {
	"ir-fa": "fa-IR",
	"mm-unicode": "my-MM",
	"mm-zawgyi": "my-MM",
	"pu-in": "pa-IN",
};
const rtlLanguages = new Set(["ar", "fa", "he"]);

// Device language subtags that do not match the first subtag of a lang code
// (e.g. navigator.language "fa-IR" maps to "ir-fa").
const languageSubtagFallbacks = {
	pt: "pt-br",
	fa: "ir-fa",
	tl: "tl-ph",
	fil: "tl-ph",
	my: "mm-unicode",
	pa: "pu-in",
};

const DEFAULT_LANGUAGE = "pt-br";

/**
 * Picks the initial UI language: the device language when it maps to an
 * available translation, Portuguese (pt-br) otherwise.
 * @returns {string} a language code present in langMap
 */
export function detectDefaultLanguage() {
	try {
		const device = globalThis.navigator?.language?.toLowerCase?.();
		if (!device) return DEFAULT_LANGUAGE;
		if (device in langMap) return device;
		if (device.startsWith("pt")) return "pt-br";
		if (device.startsWith("zh")) {
			return /(^|[_-])(hant|hk|mo|tw)($|[_-])/.test(device)
				? "zh-hant"
				: "zh-cn";
		}
		const base = device.split("-")[0];
		if (languageSubtagFallbacks[base]) return languageSubtagFallbacks[base];
		const match = Object.keys(langMap).find(
			(code) => code.split("-")[0] === base,
		);
		return match || DEFAULT_LANGUAGE;
	} catch {
		return DEFAULT_LANGUAGE;
	}
}

export function getIntlLocale(code) {
	const normalizedCode = code?.toLowerCase();
	const locale =
		intlLocaleOverrides[normalizedCode] ||
		(normalizedCode in langMap
			? normalizedCode
			: globalThis.navigator?.language || "en-US");

	try {
		return Intl.getCanonicalLocales(locale)[0];
	} catch {
		return "en-US";
	}
}

export function getLocaleDirection(locale) {
	const language = locale?.split("-")[0]?.toLowerCase();
	return rtlLanguages.has(language) ? "rtl" : "ltr";
}

let currentLang = "en-us";

export default {
	async set(code) {
		code = code?.toLowerCase();
		// Unknown codes fall back to the device-appropriate language
		// (Portuguese when nothing matches), then to English.
		const resolved =
			code in langMap
				? code
				: detectDefaultLanguage() in langMap
					? detectDefaultLanguage()
					: "en-us";
		const lang = langMap[resolved];
		const strings = await lang.strings();
		window.strings = strings.default;
		currentLang = resolved;
		document.documentElement.lang = getIntlLocale(resolved);
		document.documentElement.dir = getLocaleDirection(resolved);

		// Let every mounted view retranslate itself immediately
		// instead of waiting for an app restart.
		document.dispatchEvent(
			new CustomEvent("langchange", { detail: { code: resolved } }),
		);
	},
	/** @returns {string} currently active language code */
	get code() {
		return currentLang;
	},
	list: Object.keys(langMap).map((code) => [code, langMap[code].name]),
	getName(code) {
		code = code?.toLowerCase();
		code = code in langMap ? code : "en-us";
		return langMap[code].name;
	},
};
