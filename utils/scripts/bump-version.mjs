#!/usr/bin/env node
/**
 * Version bumper for XCoder releases.
 *
 * Updates the version in BOTH package.json and config.xml (the Cordova
 * versionName) and recomputes `android-versionCode`.
 *
 * versionCode scheme: major * 10000 + minor * 100 + patch
 *   1.3.0 -> 10300, 1.10.0 -> 11000 (monotonic, always above the legacy 103)
 * Pre-release suffixes (1.4.0-beta.1) keep the base version code.
 *
 * Usage:
 *   node utils/scripts/bump-version.mjs <version> [options]
 *   node utils/scripts/bump-version.mjs --suffix debug
 *
 * Options:
 *   --greater-than <version>  require the new version to compare greater
 *   --check-only              validate / compare without writing files
 *   --suffix <name>           stamp config.xml only: version becomes
 *                             "<base>-<name>" (package.json untouched)
 *
 * Prints "version=<v>" and "versionCode=<n>" for CI to consume.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const CONFIG_XML = path.join(ROOT, "config.xml");

const SEMVER_PATTERN =
	/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z][0-9A-Za-z.-]*))?$/;

/**
 * Strips a leading "v"/"V" and surrounding whitespace.
 * @param {string} input
 * @returns {string}
 */
export function normalizeVersion(input) {
	return String(input ?? "")
		.trim()
		.replace(/^v/i, "");
}

/**
 * Parses "X.Y.Z" with an optional pre-release suffix.
 * @param {string} version
 * @returns {{major: number, minor: number, patch: number, prerelease: string | null} | null}
 */
export function parseSemver(version) {
	const match = normalizeVersion(version).match(SEMVER_PATTERN);
	if (!match) return null;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] || null,
	};
}

/**
 * Semver comparison including pre-release rules:
 * release > pre-release, numeric identifiers compare numerically,
 * alphanumeric compare lexically, numeric < alphanumeric.
 * @param {string} a
 * @param {string} b
 * @returns {number} 1 when a > b, -1 when a < b, 0 when equal
 */
export function compareSemver(a, b) {
	const left = parseSemver(a);
	const right = parseSemver(b);
	if (!left || !right) throw new Error(`Cannot compare versions: ${a} vs ${b}`);

	for (const key of ["major", "minor", "patch"]) {
		if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
	}

	if (!left.prerelease && !right.prerelease) return 0;
	if (!left.prerelease) return 1;
	if (!right.prerelease) return -1;

	const leftIds = left.prerelease.split(".");
	const rightIds = right.prerelease.split(".");
	for (let i = 0; i < Math.max(leftIds.length, rightIds.length); i++) {
		const l = leftIds[i];
		const r = rightIds[i];
		if (l === undefined) return -1; // shorter prefix sorts lower
		if (r === undefined) return 1;
		if (l === r) continue;
		const ln = /^\d+$/.test(l);
		const rn = /^\d+$/.test(r);
		if (ln && rn) return Number(l) > Number(r) ? 1 : -1;
		if (ln) return -1; // numeric < alphanumeric
		if (rn) return 1;
		return l > r ? 1 : -1;
	}
	return 0;
}

/**
 * Android version code (see scheme in the header).
 * @param {string} version
 * @returns {number}
 */
export function computeVersionCode(version) {
	const parsed = parseSemver(version);
	if (!parsed) throw new Error(`Invalid version: ${version}`);
	return parsed.major * 10000 + parsed.minor * 100 + parsed.patch;
}

/**
 * Builds the debug/pre-release app version, e.g. "1.3.0" + "debug".
 * @param {string} version
 * @param {string} suffix
 * @returns {string}
 */
export function suffixVersion(version, suffix) {
	const base = normalizeVersion(version);
	const clean = String(suffix ?? "").trim();
	return clean ? `${base}-${clean}` : base;
}

/**
 * Rewrites the "version" field of package.json contents.
 * @param {string} content
 * @param {string} version
 * @returns {string}
 */
export function applyVersionToPackageJson(content, version) {
	if (!parseSemver(version)) throw new Error(`Invalid version: ${version}`);
	const next = content.replace(
		/("version"\s*:\s*")[^"]*(")/,
		`$1${version}$2`,
	);
	if (next === content) {
		throw new Error('package.json: no "version" field found');
	}
	return next;
}

/**
 * Rewrites version + android-versionCode in config.xml. The XML
 * declaration uses single quotes (version='1.0') and is never matched.
 * @param {string} content
 * @param {string} version full versionName (may carry -debug etc.)
 * @param {number | null} [versionCode] when null the attribute is untouched
 * @returns {string}
 */
export function applyVersionToConfigXml(content, version, versionCode = null) {
	if (!content.includes("<widget")) {
		throw new Error("config.xml: <widget> tag not found");
	}
	let next = content.replace(/version="[^"]*"/, `version="${version}"`);
	if (versionCode !== null && versionCode !== undefined) {
		next = next.replace(
			/android-versionCode="\d+"/,
			`android-versionCode="${versionCode}"`,
		);
	}
	return next;
}

/** CLI entry point. */
function main() {
	const args = process.argv.slice(2);

	const suffixFlag = args.indexOf("--suffix");
	if (suffixFlag !== -1) {
		const suffix = args[suffixFlag + 1];
		if (!suffix) fail("--suffix requires a name (e.g. debug)");
		const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
		const stamped = suffixVersion(pkg.version, suffix);
		const xml = fs.readFileSync(CONFIG_XML, "utf8");
		fs.writeFileSync(
			CONFIG_XML,
			applyVersionToConfigXml(xml, stamped, null),
		);
		console.log(`version=${stamped}`);
		return;
	}

	const version = args.find((arg, index) => arg && !arg.startsWith("--") && args[index - 1] !== "--greater-than" && args[index - 1] !== "--suffix");
	const greaterIndex = args.indexOf("--greater-than");
	const greaterThan = greaterIndex !== -1 ? args[greaterIndex + 1] : null;
	const checkOnly = args.includes("--check-only");

	if (!version) {
		fail(
			"Usage: node utils/scripts/bump-version.mjs <version> [--greater-than <version>] [--check-only]\n" +
				"       node utils/scripts/bump-version.mjs --suffix debug",
		);
	}
	const normalized = normalizeVersion(version);
	if (!parseSemver(normalized)) {
		fail(`Invalid version: "${version}" (expected e.g. 1.4.0 or 1.4.0-beta.1)`);
	}
	if (greaterThan) {
		if (!parseSemver(greaterThan)) {
			fail(`Invalid --greater-than version: "${greaterThan}"`);
		}
		if (compareSemver(normalized, greaterThan) <= 0) {
			fail(
				`Version ${normalized} is not greater than ${normalizeVersion(greaterThan)} — refusing to release backwards`,
			);
		}
	}

	const code = computeVersionCode(normalized);

	if (checkOnly) {
		console.log(`version=${normalized}`);
		console.log(`versionCode=${code}`);
		return;
	}

	fs.writeFileSync(
		PACKAGE_JSON,
		applyVersionToPackageJson(fs.readFileSync(PACKAGE_JSON, "utf8"), normalized),
	);
	fs.writeFileSync(
		CONFIG_XML,
		applyVersionToConfigXml(
			fs.readFileSync(CONFIG_XML, "utf8"),
			normalized,
			code,
		),
	);
	console.log(`version=${normalized}`);
	console.log(`versionCode=${code}`);
}

/** @param {string} message */
function fail(message) {
	console.error(`::error::${message}`);
	process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	main();
}
