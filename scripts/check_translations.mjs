#!/usr/bin/env node
/**
 * Translation coverage scanner.
 *
 * Compares every src/lang/*.json against the primary locale (en-us.json)
 * and reports:
 *  - missing keys (present in primary, absent in the language file)
 *  - extra keys (present in the language file, absent in the primary)
 *  - empty values
 *
 * Usage:
 *   node scripts/check_translations.mjs            # summary for all files
 *   node scripts/check_translations.mjs --verbose  # list every key
 *   node scripts/check_translations.mjs --lang pt-br
 */
import fs from "fs";
import path from "path";

const LANG_DIR = path.join(
	path.resolve(new URL("..", import.meta.url).pathname),
	"src",
	"lang",
);
const PRIMARY = "en-us.json";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const langArgIdx = args.indexOf("--lang");
const onlyLang = langArgIdx !== -1 ? args[langArgIdx + 1] : null;

const primary = JSON.parse(
	fs.readFileSync(path.join(LANG_DIR, PRIMARY), "utf8"),
);
const primaryKeys = new Set(Object.keys(primary));

const files = fs
	.readdirSync(LANG_DIR)
	.filter((f) => f.endsWith(".json") && f !== PRIMARY)
	.filter((f) => !onlyLang || f === `${onlyLang}.json`)
	.sort();

let totalMissing = 0;
let totalExtra = 0;
let totalEmpty = 0;
const rows = [];

for (const file of files) {
	const json = JSON.parse(fs.readFileSync(path.join(LANG_DIR, file), "utf8"));
	const keys = new Set(Object.keys(json));

	const missing = [...primaryKeys].filter((k) => !keys.has(k));
	const extra = [...keys].filter((k) => !primaryKeys.has(k));
	const empty = [...keys].filter((k) => {
		const v = json[k];
		return typeof v === "string" && v.trim() === "";
	});

	totalMissing += missing.length;
	totalExtra += extra.length;
	totalEmpty += empty.length;

	const coverage = (
		((primaryKeys.size - missing.length) / primaryKeys.size) *
		100
	).toFixed(1);
	rows.push({ file, coverage, missing: missing.length, extra: extra.length });

	if (verbose) {
		if (missing.length) {
			console.log(`\n[${file}] MISSING ${missing.length}:`);
			for (const k of missing) console.log(`  - ${k} = ${JSON.stringify(primary[k])}`);
		}
		if (extra.length) {
			console.log(`\n[${file}] EXTRA ${extra.length}:`);
			for (const k of extra) console.log(`  + ${k}`);
		}
		if (empty.length) {
			console.log(`\n[${file}] EMPTY ${empty.length}:`);
			for (const k of empty) console.log(`  ! ${k}`);
		}
	}
}

rows.sort((a, b) => parseFloat(b.coverage) - parseFloat(a.coverage));
console.log(`Primary: ${PRIMARY} (${primaryKeys.size} keys)\n`);
console.log("language      coverage  missing  extra");
console.log("----------   --------  -------  -----");
for (const r of rows) {
	console.log(
		`${r.file.padEnd(12)} ${String(r.coverage + "%").padStart(8)} ${String(r.missing).padStart(8)} ${String(r.extra).padStart(6)}`,
	);
}
console.log(
	`\nTotals — missing: ${totalMissing}, extra: ${totalExtra}, empty: ${totalEmpty}`,
);
console.log(
	"Note: missing keys fall back to English at runtime (strings[key] || \"...\").",
);
