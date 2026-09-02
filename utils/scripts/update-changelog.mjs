#!/usr/bin/env node
/**
 * CHANGELOG.md updater for XCoder releases.
 *
 * Collects conventional commits between the previous tag and HEAD,
 * categorizes them (Added / Fixed / Changed / Performance / Docs) and
 * prepends (or replaces) the "## [version] - date" section in
 * CHANGELOG.md — keeping a Changelog format, matching the section
 * parser used by the in-app About/Changelog pages and the site API.
 *
 * Usage:
 *   node utils/scripts/update-changelog.mjs 1.5.0 [--from <tag>]
 *
 * Options:
 *   --from <tag>  previous tag (default: `git describe --tags --abbrev=0 HEAD^`)
 *
 * The script never deletes existing content — sections for other versions
 * are preserved. Safe to run twice (same version = section replaced).
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHANGELOG = path.join(ROOT, "CHANGELOG.md");

const args = process.argv.slice(2);
const version = args.find((a, i) => a === args[0]);
const fromIdx = args.indexOf("--from");
const fromTag = fromIdx !== -1 ? args[fromIdx + 1] : undefined;

if (!version || /^--/.test(version)) {
	console.error("Usage: node utils/scripts/update-changelog.mjs <version> [--from <tag>]");
	process.exit(1);
}

function gitOr(pattern, fallback) {
	try {
		return execSync(pattern, { cwd: ROOT, encoding: "utf8" }).trim();
	} catch {
		return fallback;
	}
}

const prevTag =
	fromTag ||
	gitOr('git describe --tags --abbrev=0 "HEAD^" 2>/dev/null', "");

const range = prevTag ? `${prevTag}..HEAD` : "HEAD";
const subjectRegex = /^([a-z_]+)(?:\([^)]*\))?!?: (.+)$/;

/** conventional commit type -> changelog section */
const SECTIONS = {
	feat: "Added",
	fix: "Fixed",
	perf: "Performance",
	refactor: "Changed",
	revert: "Changed",
	docs: "Documentation",
	chore: "Maintenance",
	ci: "Maintenance",
	build: "Maintenance",
	test: "Maintenance",
	style: "Changed",
};

const SECTION_ORDER = [
	"Added",
	"Fixed",
	"Changed",
	"Performance",
	"Documentation",
	"Maintenance",
];

let commits = [];
try {
	const raw = execSync(`git log --format="%s" ${range}`, {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	});
	commits = raw
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean)
		// skip release bumps themselves
		.filter((s) => !/^chore\((pre-)?release\)/i.test(s));
} catch {
	// no git history available (shallow checkout) — keep going, section may
	// already exist or will be filled by the release workflow
}

/** @type {Map<string, string[]>} */
const grouped = new Map();
for (const subject of commits) {
	const match = subject.match(subjectRegex);
	if (!match) continue;
	const type = match[1];
	const text = match[2].replace(/\s+$/, "");
	const section = SECTIONS[type];
	if (!section) continue;
	const bucket = grouped.get(section) || [];
	bucket.push(text);
	grouped.set(section, bucket);
}

const today = new Date().toISOString().slice(0, 10);
const header = `## [${version}] - ${today}`;

let body = "";
for (const section of SECTION_ORDER) {
	const items = grouped.get(section);
	if (!items?.length) continue;
	body += `### ${section}\n`;
	for (const item of items) {
		body += `- ${item.charAt(0).toUpperCase()}${item.slice(1)}\n`;
	}
	body += "\n";
}

const current = fs.existsSync(CHANGELOG) ? fs.readFileSync(CHANGELOG, "utf8") : "# Changelog\n";

// replace an existing section for this version, or insert after the header
const sectionRegex = new RegExp(
	`^## \\[${version.replace(/\./g, "\\.")}\\][^\\n]*\\n([\\s\\S]*?)(?=^## |$)`,
	"m",
);

let next;
if (sectionRegex.test(current)) {
	next = current.replace(sectionRegex, `${header}\n${body ? `\n${body}` : "\n"}`);
} else {
	const lines = current.split("\n");
	// find the first "## " section after the intro lines
	const insertAt = lines.findIndex((l, i) => i > 0 && l.startsWith("## "));
	const insertBlock = `${header}\n${body ? `\n${body}` : "\n"}`;
	if (insertAt === -1) {
		next = `${current.replace(/\s*$/, "\n")}\n${insertBlock}`;
	} else {
		lines.splice(insertAt, 0, insertBlock);
		next = lines.join("\n");
	}
}

fs.writeFileSync(CHANGELOG, next);
console.log(
	`changelog: ${version} <- ${prevTag || "no previous tag"} (${commits.length} commits, ` +
		`${[...grouped.values()].reduce((n, list) => n + list.length, 0)} entries)`,
);
