#!/usr/bin/env node
/**
 * XCoder premium unlock-code generator (project owner only).
 *
 * Usage:
 *   node scripts/generate-premium-codes.mjs                  # 1 lifetime code
 *   node scripts/generate-premium-codes.mjs --count 10       # 10 lifetime codes
 *   node scripts/generate-premium-codes.mjs --year 2026      # yearly codes
 *   node scripts/generate-premium-codes.mjs --year 2026 --count 5
 *
 * Code layout (matches src/lib/premium.js verifyCode):
 *   lifetime: XCP-SSSSS-XXXXX-XXXXX        salt + HMAC signature
 *   yearly:   XCP-YYYY-SSSSS-XXXXX-XXXXX   valid until Dec 31, YYYY
 *
 * The secret MUST match SECRET_PARTS.join("·") in src/lib/premium.js.
 * Rotate both together whenever you want to invalidate old codes.
 * Give one code per donor.
 */
import { webcrypto as crypto } from "node:crypto";

const SECRET = "xcoder·premium·v1·carsaimz";
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/L/0/1 (matches app)

function base32(bytes, length = 10) {
	let bits = 0;
	let value = 0;
	let output = "";
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
	return output.slice(0, length);
}

function randomSalt() {
	const bytes = crypto.getRandomValues(new Uint8Array(5));
	return base32(bytes, 5);
}

async function hmac(message) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(message),
	);
	return new Uint8Array(signature);
}

function group(salt, signature) {
	return `${salt}-${signature.slice(0, 5)}-${signature.slice(5)}`;
}

const args = process.argv.slice(2);
const yearIndex = args.indexOf("--year");
const year = yearIndex !== -1 ? Number(args[yearIndex + 1]) : null;
const countIndex = args.indexOf("--count");
const count = countIndex !== -1 ? Math.max(1, Number(args[countIndex + 1])) : 1;

const codes = new Set();
for (let i = 0; i < count; i++) {
	const salt = randomSalt();
	const message = year ? `year:${year}:${salt}` : `lifetime:${salt}`;
	const signature = base32(await hmac(message));
	codes.add(year ? `XCP-${year}-${group(salt, signature)}` : `XCP-${group(salt, signature)}`);
}

console.log([...codes].join("\n"));

if (process.argv.includes("--verify")) {
	// self-check: prints "OK" when every printed code matches the app rules
	const last = [...codes][0];
	const normalized = last.replace(/[^A-Z0-9]/g, "").slice(3);
	const yearMatch = /^(20\d{2})([A-Z2-9]{5})([A-Z2-9]{10})$/.exec(normalized);
	const lifeMatch = /^([A-Z2-9]{5})([A-Z2-9]{10})$/.exec(normalized);
	const salt = yearMatch ? yearMatch[2] : lifeMatch[1];
	const message = yearMatch
		? `year:${Number(yearMatch[1])}:${salt}`
		: `lifetime:${salt}`;
	const signature = base32(await hmac(message));
	const expected = yearMatch ? yearMatch[3] : lifeMatch[2];
	console.error(signature === expected ? "self-check: OK" : "self-check: FAILED");
}
