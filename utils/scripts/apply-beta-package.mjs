#!/usr/bin/env node
/**
 * Beta package switcher for XCoder pre-releases.
 *
 * Pre-releases install SIDE BY SIDE with the stable app instead of
 * overwriting it (user request, v1.8.45):
 *
 *   application id : com.carsaimz.xcoder  ->  com.carsaimz.xcoder.beta
 *   app name       : XCoder               ->  XCoder Beta
 *   versionName    : 1.8.45               ->  1.8.45-beta
 *   versionCode    : 10845                ->  2084501  (base * 100 + 1,000,000 + beta number)
 *
 * The +1,000,000 offset keeps the beta series above the stable series
 * (stable grows in the 10xxx range), so Android always treats a newer
 * beta as an upgrade WITHIN the beta app, never touching the stable one.
 * The beta NUMBER gets its own units digit (base * 100), so beta.1 ->
 * beta.2 -> beta.3 and 1.8.46-beta all produce strictly increasing
 * versionCodes — Android refuses same-code upgrades.
 *
 * Usage:
 *   node utils/scripts/apply-beta-package.mjs 1.8.45-beta
 *
 * Prints "version=<v>" and "versionCode=<n>" for CI to consume.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);
const CONFIG_XML = path.join(ROOT, "config.xml");
const PACKAGE_JSON = path.join(ROOT, "package.json");

const STABLE_ID = "com.carsaimz.xcoder";
const BETA_ID = "com.carsaimz.xcoder.beta";
const BETA_OFFSET = 1000000;

const version = String(process.argv[2] ?? "").trim().replace(/^v/i, "");
if (!/^\d+\.\d+\.\d+-beta/.test(version)) {
	console.error(
		"Usage: apply-beta-package.mjs <X.Y.Z-beta[.N]> — the version must carry the -beta suffix",
	);
	process.exit(1);
}

const baseMatch = version.match(/^(\d+)\.(\d+)\.(\d+)/);
const baseCode =
	Number(baseMatch[1]) * 10000 + Number(baseMatch[2]) * 100 + Number(baseMatch[3]);
// "-beta" counts as 1, "-beta.2" as 2, ... (stable promotion never sees this)
const betaNumberMatch = version.match(/-beta\.?(\d+)?$/);
const betaNumber = betaNumberMatch ? Number(betaNumberMatch[1] || 1) : 1;
const betaCode = baseCode * 100 + BETA_OFFSET + betaNumber;

// ---- config.xml: id, name, version, android-versionCode ----
let xml = fs.readFileSync(CONFIG_XML, "utf8");

xml = xml.replace(/id="[^"]*"/, `id="${BETA_ID}"`);
if (!xml.includes(BETA_ID)) {
	console.error("Failed to rewrite the widget id in config.xml");
	process.exit(1);
}

xml = xml.replace(/android-versionCode="\d+"/, `android-versionCode="${betaCode}"`);
xml = xml.replace(/version="[^"]*"/, `version="${version}"`);

// Launcher name — only inside <name>...</name>
xml = xml.replace(/<name>[^<]*<\/name>/, "<name>XCoder Beta</name>");

fs.writeFileSync(CONFIG_XML, xml);

// ---- package.json: version only (name stays) ----
const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
pkg.version = version;
fs.writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, "\t")}\n`);

console.log(`version=${version}`);
console.log(`versionCode=${betaCode}`);
console.log(`appId=${BETA_ID}`);
