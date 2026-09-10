#!/usr/bin/env node
/**
 * publish-wiki.mjs — publica os fontes de wiki/*.md no GitHub Wiki real
 * (https://github.com/carsaimz/xcoder.wiki).
 *
 * O GitHub só cria o repositório da wiki depois que a PRIMEIRA página é
 * criada pela interface web. Fluxo:
 *
 *   1. (uma vez) Abra https://github.com/carsaimz/xcoder/wiki e salve
 *      uma página "Home" com qualquer conteúdo — isso inicializa o repo.
 *   2. Rode:  GITHUB_TOKEN=ghp_xxx node wiki/publish-wiki.mjs
 *      (o token precisa ser um PAT clássico com escopo "repo" — PATs
 *      fine-grained ainda não escrevem em wikis).
 *
 * As páginas-fonte são bilíngues (secção 🇧🇷 + secção 🇺🇸 no mesmo
 * ficheiro). Na publicação, apenas a secção ativa é extraída:
 *
 *   WIKI_LANG=pt  → publica só a secção 🇧🇷 Português (padrão)
 *   WIKI_LANG=en  → publica só a secção 🇺🇸 English
 *
 * A extração procura as âncoras <a id="português"></a> / <a id="english"></a>.
 * Páginas sem marcadores (ex.: _Footer bilíngue inline) são publicadas
 * como estão.
 *
 * O script clona o wiki repo num diretório temporário, converte e copia
 * todos os *.md desta pasta (menos README.md) e faz commit + push.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractLangSection } from "./wikiLang.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = "carsaimz/xcoder";
const TOKEN = process.env.GITHUB_TOKEN;
const LANG = (process.env.WIKI_LANG || "pt").toLowerCase();

if (!TOKEN) {
        console.error("Defina GITHUB_TOKEN (PAT clássico com escopo repo).");
        process.exit(1);
}
if (LANG !== "pt" && LANG !== "en") {
        console.error(`WIKI_LANG inválida: "${LANG}" (use pt ou en).`);
        process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "xcoder-wiki-"));
const url = `https://x-access-token:${TOKEN}@github.com/${REPO}.wiki.git`;

try {
        console.log("Clonando wiki repo...");
        execSync(`git clone ${url} ${tmp}`, { stdio: "inherit" });

        console.log(`Copiando páginas (WIKI_LANG=${LANG})...`);
        for (const file of readdirSync(HERE)) {
                if (file.endsWith(".md") && file !== "README.md") {
                        const raw = readFileSync(join(HERE, file), "utf8");
                        const { text, extracted } = extractLangSection(raw, LANG);
                        writeFileSync(join(tmp, file), extracted ? text : raw);
                        console.log("  +", file, extracted ? `(${LANG})` : "(inteiro)");
                }
        }

        console.log("Commit + push...");
        const git = (cmd) =>
                execSync(`git -C ${tmp} ${cmd}`, { stdio: "inherit" });
        git("add -A");
        git(
                `-c user.name=xcoder-bot -c user.email=bot@xcoder.local commit -m "docs(wiki): sync pages with wiki/ (${LANG})"`,
        );
        git("push origin master");
        console.log("Wiki publicada ✔");
} finally {
        rmSync(tmp, { recursive: true, force: true });
}
