#!/usr/bin/env node
/**
 * Translates the missing keys of every src/lang/*.json against en-us.json
 * using Google's public translate endpoint (dict-chrome-ex), with
 * placeholder protection ({name} → {0} → restored), batching, retries and
 * a mymemory fallback. Writes results back with the original key order
 * (missing keys appended) and TAB indentation.
 *
 * Usage: node scripts/translate_missing.mjs [--only=de-de] [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANG_DIR = path.join(
	path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
	"src",
	"lang",
);
const PRIMARY = "en-us.json";

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1] || null;
const dry = args.includes("--dry");

const GOOGLE_TARGETS = {
	"es-sv": "es",
	"ar-ye": "ar",
	"be-by": "be",
	"bn-bd": "bn",
	"cs-cz": "cs",
	"de-de": "de",
	"fr-fr": "fr",
	"he-il": "he",
	"hi-in": "hi",
	"hu-hu": "hu",
	"id-id": "id",
	"ir-fa": "fa",
	"it-it": "it",
	"ja-jp": "ja",
	"ko-kr": "ko",
	"ml-in": "ml",
	"mm-unicode": "my",
	"mm-zawgyi": "my",
	"pl-pl": "pl",
	"pu-in": "pa",
	"ru-ru": "ru",
	"tl-ph": "tl",
	"tr-tr": "tr",
	"uk-ua": "uk",
	"uz-uz": "uz",
	"vi-vn": "vi",
	"zh-cn": "zh-CN",
	"zh-hant": "zh-TW",
	"zh-tw": "zh-TW",
};

// Context helps Google produce UI-grade translations for bare verbs.
const CONTEXT_KEYS = [
	"search",
	"cancel",
	"settings",
	"save",
	"open",
	"close",
	"delete",
	"rename",
	"copy",
	"cut",
	"paste",
	"terminal",
	"themes",
	"plugins",
	"files",
	"editor",
	"backup",
	"run",
	"format",
	"find",
	"replace",
	"share",
	"export",
];

const primary = JSON.parse(fs.readFileSync(path.join(LANG_DIR, PRIMARY), "utf8"));
const primaryKeys = Object.keys(primary);

const protect = (text) => {
	const tokens = [];
	const replaced = String(text).replace(/\{[^{}]+\}/g, (m) => {
		tokens.push(m);
		return `{${tokens.length - 1}}`;
	});
	return { replaced, tokens };
};

const restore = (text, tokens) =>
	String(text).replace(/\{(\d+)\}/g, (m, i) => tokens[Number(i)] ?? m);

function chunk(arr, size) {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(texts, target, attempt = 1) {
	const url =
		`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${target}` +
		texts.map((t) => `&q=${encodeURIComponent(t)}`).join("");
	const res = await fetch(url, {
		headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/126" },
	});
	if (!res.ok) throw new Error(`google ${res.status}`);
	const data = await res.json();
	// response shapes: [ "...", ... ] or [[ "..." ], ...]
	const flat = Array.isArray(data) && Array.isArray(data[0]) ? data.flat() : data;
	if (!Array.isArray(flat) || flat.length < texts.length) {
		throw new Error(`google shape ${flat?.length}`);
	}
	return flat.slice(0, texts.length).map((v) => {
		if (Array.isArray(v)) return v[0] ?? "";
		return String(v ?? "");
	});
}

async function translateOne(text, target, attempt = 1) {
	// mymemory fallback for stubborn singles
	const res = await fetch(
		`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`,
	);
	if (!res.ok) throw new Error(`mymemory ${res.status}`);
	const data = await res.json();
	const out = data?.responseData?.translatedText;
	if (!out || /NO QUERY SPECIFIED|INVALID/i.test(out)) {
		throw new Error("mymemory empty");
	}
	return out;
}

async function run(langFile, target) {
	const filePath = path.join(LANG_DIR, `${langFile}.json`);
	const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
	const missing = primaryKeys.filter(
		(k) =>
			!(k in json) ||
			(typeof json[k] === "string" && json[k].trim() === ""),
	);
	if (!missing.length) {
		console.log(`${langFile}: complete, nothing to do`);
		return;
	}
	console.log(`${langFile}: translating ${missing.length} keys → ${target}`);

	// add context to bare single words so Google doesn't return grammar junk
	const withCtx = missing.map((k) => {
		const text = primary[k];
		if (!/^[a-z ]{1,12}$/i.test(text) || !CONTEXT_KEYS.includes(k)) return text;
		return `UI button "${text}"`;
	});

	const batched = chunk(missing, 18);
	const translated = new Array(missing.length);
	let index = 0;
	let failures = 0;

	async function worker() {
		while (index < batched.length) {
			const my = index++;
			const keys = batched[my];
			const items = keys.map((k) => {
				const { replaced, tokens } = protect(
					withCtx[missing.indexOf(k)] ?? primary[k],
				);
				return { k, text: replaced, tokens };
			});
			let done = false;
			for (let attempt = 1; attempt <= 3 && !done; attempt += 1) {
				try {
					const outs = await translateBatch(
						items.map((i) => i.text),
						target,
					);
					items.forEach((item, i) => {
						translated[missing.indexOf(item.k)] = restore(outs[i], item.tokens);
					});
					done = true;
				} catch (error) {
					if (attempt === 3) {
						// per-string fallback
						for (const item of items) {
							try {
								const one = await translateOne(item.text, target);
								translated[missing.indexOf(item.k)] = restore(
									one,
									item.tokens,
								);
							} catch {
								translated[missing.indexOf(item.k)] = primary[item.k];
								failures += 1;
							}
						}
					} else {
						await sleep(600 * attempt + Math.random() * 400);
					}
				}
			}
			if (my % 10 === 0) {
				console.log(`  ${langFile}: ${Math.min(my * 18, missing.length)}/${missing.length}`);
			}
			await sleep(120);
		}
	}

	await Promise.all(Array.from({ length: 6 }, () => worker()));

	if (!dry) {
		missing.forEach((k, i) => {
			json[k] = translated[i];
		});
		// zawgyi is a legacy encoding Google cannot emit — keep the Unicode
		// Burmese translation (modern Android renders it fine, and it beats
		// falling back to English)
		fs.writeFileSync(filePath, JSON.stringify(json, null, "\t") + "\n");
	}
	console.log(`${langFile}: done (${failures} fell back to English)`);
}

const targets = only ? [only] : Object.keys(GOOGLE_TARGETS);
for (const lang of targets) {
	const target = GOOGLE_TARGETS[lang];
	if (!target) {
		console.error(`unknown language ${lang}`);
		process.exit(1);
	}
	// mm-zawgyi copies mm-unicode's results (same Burmese text)
	if (lang === "mm-zawgyi") {
		const uniPath = path.join(LANG_DIR, "mm-unicode.json");
		const zawPath = path.join(LANG_DIR, "mm-zawgyi.json");
		const uni = JSON.parse(fs.readFileSync(uniPath, "utf8"));
		const zaw = JSON.parse(fs.readFileSync(zawPath, "utf8"));
		let copied = 0;
		for (const k of primaryKeys) {
			if (uni[k] && !(k in zaw)) {
				zaw[k] = uni[k];
				copied += 1;
			}
		}
		fs.writeFileSync(zawPath, JSON.stringify(zaw, null, "\t") + "\n");
		console.log(`mm-zawgyi: copied ${copied} entries from mm-unicode`);
		continue;
	}
	await run(lang, target);
}
console.log("ALL DONE");
