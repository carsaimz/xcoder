#!/usr/bin/env node
/**
 * Fixes "tech cat framework" (and a few other tech terms) where Google
 * Translate produced a linguistics term instead of the tech word — in
 * tech UIs "Framework(s)" stays as-is in most languages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANG_DIR = path.join(
	path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
	"src",
	"lang",
);

// language file -> fixes {key: value}
const FIXES = {
	"ar-ye.json": { "tech cat framework": "Frameworks" },
	"be-by.json": { "tech cat framework": "Фрэймворкі" },
	"cs-cz.json": { "tech cat framework": "Frameworky" },
	"de-de.json": { "tech cat framework": "Frameworks" },
	"es-sv.json": { "tech cat framework": "Frameworks" },
	"fr-fr.json": { "tech cat framework": "Frameworks" },
	"he-il.json": { "tech cat framework": "Frameworks" },
	"hu-hu.json": { "tech cat framework": "Keretrendszerek" },
	"id-id.json": { "tech cat framework": "Framework" },
	"ir-fa.json": { "tech cat framework": "فریمورک‌ها" },
	"it-it.json": { "tech cat framework": "Framework" },
	"ml-in.json": { "tech cat framework": "ഫ്രെയിംവർക്കുകൾ" },
	"mm-unicode.json": { "tech cat framework": "ဖရိမ်ဝက်များ" },
	"mm-zawgyi.json": { "tech cat framework": "ဖရိမ်ဝက်များ" },
	"pl-pl.json": { "tech cat framework": "Frameworki" },
	"ru-ru.json": { "tech cat framework": "Фреймворки" },
	"tr-tr.json": { "tech cat framework": "Framework'ler" },
	"uk-ua.json": { "tech cat framework": "Фреймворки" },
	"uz-uz.json": { "tech cat framework": "Freyvorklar" },
	"vi-vn.json": { "tech cat framework": "Framework" },
};

for (const [file, fixes] of Object.entries(FIXES)) {
	const target = path.join(LANG_DIR, file);
	const data = JSON.parse(fs.readFileSync(target, "utf8"));
	let changed = 0;
	for (const [key, value] of Object.entries(fixes)) {
		if (data[key] !== value) {
			data[key] = value;
			changed += 1;
		}
	}
	fs.writeFileSync(target, `${JSON.stringify(data, null, "\t")}\n`);
	console.log(`${file}: ${changed} fixed`);
}
