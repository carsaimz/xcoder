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
 * O script clona o wiki repo num diretório temporário, copia todos os
 * *.md desta pasta (menos README.md) e faz commit + push.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = "carsaimz/xcoder";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
        console.error("Defina GITHUB_TOKEN (PAT clássico com escopo repo).");
        process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "xcoder-wiki-"));
const url = `https://x-access-token:${TOKEN}@github.com/${REPO}.wiki.git`;

try {
        console.log("Clonando wiki repo...");
        execSync(`git clone ${url} ${tmp}`, { stdio: "inherit" });

        console.log("Copiando páginas...");
        for (const file of readdirSync(HERE)) {
                if (file.endsWith(".md") && file !== "README.md") {
                        copyFileSync(join(HERE, file), join(tmp, file));
                        console.log("  +", file);
                }
        }

        console.log("Commit + push...");
        const git = (cmd) =>
                execSync(`git -C ${tmp} ${cmd}`, { stdio: "inherit" });
        git("add -A");
        git(
                '-c user.name=xcoder-bot -c user.email=bot@xcoder.local commit -m "docs(wiki): sync pages with wiki/"',
        );
        git("push origin master");
        console.log("Wiki publicada ✔");
} finally {
        rmSync(tmp, { recursive: true, force: true });
}
