#!/usr/bin/env node
/**
 * checkWikiBilingual.mjs — valida a política bilíngue das páginas da wiki:
 *
 *   - TODAS as páginas (incluindo _Sidebar/_Footer) usam o formato de duas
 *     secções com âncoras canónicas (<a id="português"></a> /
 *     <a id="english"></a>) e conteúdo não vazio em pt e en.
 *   - Páginas de conteúdo (com H1) também exigem a linha de navegação
 *     `[🇧🇷 Português](#português) | [🇺🇸 English](#english)`.
 *
 * Rodar: node wiki/checkWikiBilingual.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractLangSection } from "./wikiLang.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(["README.md", "publish-wiki.mjs", "checkWikiBilingual.mjs", "wikiLang.mjs"]);

let failures = 0;
for (const file of readdirSync(HERE).filter((f) => f.endsWith(".md") && !SKIP.has(f))) {
	const raw = readFileSync(join(HERE, file), "utf8");
	const problems = [];
	const pt = extractLangSection(raw, "pt");
	const en = extractLangSection(raw, "en");

	if (!pt.extracted) problems.push("secção PT ausente (âncora português)");
	if (!en.extracted) problems.push("secção EN ausente (âncora english)");
	if (pt.extracted && pt.text.trim().length < 40) problems.push("secção PT curta demais");
	if (en.extracted && en.text.trim().length < 40) problems.push("secção EN curta demais");
	if (/^# /m.test(raw) &&
		!/^\[🇧🇷 Português\]\(#português\) \| \[🇺🇸 English\]\(#english\)/m.test(raw))
		problems.push("linha de navegação de idiomas ausente");

	if (problems.length) {
		failures++;
		console.error(`✗ ${file}: ${problems.join("; ")}`);
	} else {
		console.log(`✓ ${file}`);
	}
}
if (failures) {
	console.error(`\n${failures} página(s) com problema.`);
	process.exit(1);
}
console.log("\nPolítica bilíngue da wiki OK.");
