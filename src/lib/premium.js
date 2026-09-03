import { backendConfig } from "lib/backend";

/**
 * XCoder support & premium system.
 *
 * The editor stays 100% free. People who donate unlock "Premium", which:
 *  - removes house ads completely (ads.js checks isPremium()),
 *  - unlocks exclusive premium themes (theme list),
 *  - lifts the daily AI agent turn limit (free: 20 runs/day),
 *  - shows a supporter badge (About + welcome).
 *
 * Donations are collected through the links below (GitHub Sponsors,
 * PayPal, Buy Me a Coffee and Pix). The Pix key is served by the site's
 * remote config (/api/config → support.pixKey) so the owner can change it
 * without an app release.
 *
 * Unlock codes are generated offline by the project owner with
 * scripts/generate-premium-codes.mjs (HMAC-SHA256 over a build secret).
 * The verifier runs fully offline — no account, no network. It is
 * deliberately lightweight (client-side), which is fine: the point is to
 * make honest support easy, not to fight determined crackers.
 */

const PREMIUM_KEY = "xcoder.premium";
const AGENT_USE_KEY = "xcoder.premium.agent";

/** Free tier: AI agent runs per calendar day. Premium: unlimited. */
export const FREE_AGENT_DAILY_LIMIT = 20;

/** Donation destinations (Pix comes from the site remote config). */
const SUPPORT_LINKS = {
	sponsors: "https://github.com/sponsors/carsaimz",
	paypal: "https://www.paypal.me/carsaimz",
	coffee: "https://www.buymeacoffee.com/carsaimz",
};

/**
 * Build secret for code verification. Split so a plain grep for the
 * secret doesn't trivially find it; regenerate codes when rotating.
 */
const SECRET_PARTS = ["xcoder", "premium", "v1", "carsaimz"];

function codeSecret() {
	return SECRET_PARTS.join("·");
}

/** RFC-4231-style HMAC-SHA256 over the secret (Web Crypto, async). */
async function hmac(message) {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(codeSecret());
	const messageData = encoder.encode(message);
	try {
		const key = await crypto.subtle.importKey(
			"raw",
			keyData,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const signature = await crypto.subtle.sign("HMAC", key, messageData);
		return new Uint8Array(signature);
	} catch {
		// very old WebViews without WebCrypto: deterministic fallback
		let h1 = 0xdeadbeef ^ messageData.length;
		let h2 = 0x41c6ce57 ^ messageData.length;
		for (const byte of messageData) {
			h1 = Math.imul(h1 ^ byte, 2654435761);
			h2 = Math.imul(h2 ^ byte, 1597334677);
		}
		h1 =
			Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
			Math.imul(h2 ^ (h2 >>> 13), 3266489909);
		h2 =
			Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
			Math.imul(h1 ^ (h1 >>> 13), 3266489909);
		const out = new Uint8Array(32);
		for (let i = 0; i < 32; i++) {
			out[i] = ((i % 2 ? h1 : h2) >>> (i % 8)) & 0xff;
		}
		return out;
	}
}

function base32(bytes) {
	const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/L/0/1
	let bits = 0;
	let value = 0;
	let output = "";
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += alphabet[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
	return output.slice(0, 10);
}

/**
 * Verifies an unlock code.
 *  - lifetime: "XCP-SSSSS-XXXXX-XXXXX"  (salt + signature, never expires)
 *  - yearly:   "XCP-YYYY-SSSSS-XXXXX-XXXXX" (until Dec 31 of YYYY)
 * The 5-char salt is embedded in the code, so every code is unique and
 * the signature verifies fully offline.
 * @param {string} input
 * @returns {Promise<{ok: boolean, kind?: "lifetime"|"yearly", expiresAt?: number, reason?: string}>}
 */
export async function verifyCode(input) {
	const raw = String(input || "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	if (!raw.startsWith("XCP")) {
		return { ok: false, reason: "format" };
	}
	const body = raw.slice(3);

	// yearly: 4-digit year + 5-char salt + 10-char signature
	const yearMatch = /^(20\d{2})([A-Z2-9]{5})([A-Z2-9]{10})$/.exec(body);
	// lifetime: 5-char salt + 10-char signature
	const lifeMatch = /^([A-Z2-9]{5})([A-Z2-9]{10})$/.exec(body);

	if (!yearMatch && !lifeMatch) {
		return { ok: false, reason: "format" };
	}

	if (yearMatch) {
		const year = Number(yearMatch[1]);
		const salt = yearMatch[2];
		const digest = await hmac(`year:${year}:${salt}`);
		if (base32(digest) !== yearMatch[3]) {
			return { ok: false, reason: "signature" };
		}
		const expiresAt = Date.UTC(year, 11, 31, 23, 59, 59);
		if (Date.now() > expiresAt) {
			return { ok: false, reason: "expired" };
		}
		return { ok: true, kind: "yearly", expiresAt };
	}

	const salt = lifeMatch[1];
	const digest = await hmac(`lifetime:${salt}`);
	if (base32(digest) !== lifeMatch[2]) {
		return { ok: false, reason: "signature" };
	}
	return { ok: true, kind: "lifetime", expiresAt: 0 };
}

// ----------------------------------------------------------------- storage

/**
 * @returns {{active: boolean, since?: number, kind?: string, expiresAt?: number} | null}
 */
function readState() {
	try {
		const raw = localStorage.getItem(PREMIUM_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

function writeState(state) {
	try {
		if (state) localStorage.setItem(PREMIUM_KEY, JSON.stringify(state));
		else localStorage.removeItem(PREMIUM_KEY);
	} catch {
		/* best effort */
	}
}

/**
 * Whether premium is active right now (honours yearly expiry).
 * @returns {boolean}
 */
export function isPremium() {
	const state = readState();
	if (!state?.active) return false;
	if (state.expiresAt && Date.now() > state.expiresAt) {
		writeState({ ...state, active: false, expired: true });
		return false;
	}
	return true;
}

/**
 * @returns {{active: boolean, since?: number, kind?: string} | null}
 */
export function getPremiumStatus() {
	const state = readState();
	return state?.active ? state : null;
}

/**
 * Redeems an unlock code and activates premium.
 * @param {string} input
 * @returns {Promise<{kind: string, expiresAt: number}>}
 */
export async function redeemCode(input) {
	const result = await verifyCode(input);
	if (!result.ok) {
		const messages = {
			format: "Código inválido — formato esperado: XCP-XXXXX-XXXXX",
			signature: "Código não reconhecido — confira com quem doou",
			expired: "Este código anual expirou",
		};
		throw new Error(messages[result.reason] || "Código inválido");
	}
	writeState({
		active: true,
		since: Date.now(),
		kind: result.kind,
		expiresAt: result.expiresAt || 0,
	});
	try {
		document.dispatchEvent(new CustomEvent("premiumchange", { detail: true }));
	} catch {
		/* non-DOM environment (tests) */
	}
	return { kind: result.kind, expiresAt: result.expiresAt || 0 };
}

/**
 * Removes premium from this device (debugging / goodwill).
 */
export function removePremium() {
	writeState(null);
	try {
		document.dispatchEvent(new CustomEvent("premiumchange", { detail: false }));
	} catch {
		/* non-DOM environment (tests) */
	}
}

// ------------------------------------------------------------- agent quota

function todayStamp() {
	const now = new Date();
	return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function readAgentUse() {
	try {
		const raw = JSON.parse(localStorage.getItem(AGENT_USE_KEY) || "null");
		if (raw?.day === todayStamp()) return Number(raw.count) || 0;
	} catch {
		/* fresh day */
	}
	return 0;
}

/**
 * Whether one more AI agent run is allowed today.
 * @returns {boolean}
 */
export function canUseAgentTurn() {
	if (isPremium()) return true;
	return readAgentUse() < FREE_AGENT_DAILY_LIMIT;
}

/**
 * Counts one agent run (call when a run actually starts).
 */
export function trackAgentTurn() {
	try {
		const count = readAgentUse() + 1;
		localStorage.setItem(
			AGENT_USE_KEY,
			JSON.stringify({ day: todayStamp(), count }),
		);
	} catch {
		/* best effort */
	}
}

/**
 * Remaining free agent runs today (0 for premium — unlimited).
 * @returns {number}
 */
export function agentTurnsLeft() {
	if (isPremium()) return Number.POSITIVE_INFINITY;
	return Math.max(0, FREE_AGENT_DAILY_LIMIT - readAgentUse());
}

// ---------------------------------------------------------------- support

/**
 * Support links + Pix key from the site remote config (when available).
 * @returns {{pixKey?: string, pixName?: string, links: {id: string, label: string, url: string}[]}}
 */
export function supportInfo() {
	const config = backendConfig() || {};
	const support = config.support || {};
	const links = [
		{
			id: "sponsors",
			label: "GitHub Sponsors",
			url: support.sponsorsUrl || SUPPORT_LINKS.sponsors,
		},
		{
			id: "paypal",
			label: "PayPal",
			url: support.paypalUrl || SUPPORT_LINKS.paypal,
		},
		{
			id: "coffee",
			label: "Buy Me a Coffee",
			url: support.coffeeUrl || SUPPORT_LINKS.coffee,
		},
	].filter((link) => Boolean(link.url));
	return {
		pixKey: support.pixKey || "",
		pixName: support.pixName || "",
		links,
	};
}

// --------------------------------------------------------------- themes

/** App themes reserved for supporters (free users keep every other one). */
export const PREMIUM_THEMES = ["neon", "sunset", "obsidian"];

/**
 * Whether the theme id requires premium.
 * @param {string} id
 */
export function isThemePremium(id) {
	return PREMIUM_THEMES.includes(String(id || "").toLowerCase());
}

/**
 * Whether the user may apply that theme right now.
 * @param {string} id
 */
export function canUseTheme(id) {
	return isPremium() || !isThemePremium(id);
}

export default {
	isPremium,
	getPremiumStatus,
	redeemCode,
	removePremium,
	verifyCode,
	canUseAgentTurn,
	trackAgentTurn,
	agentTurnsLeft,
	isThemePremium,
	canUseTheme,
	PREMIUM_THEMES,
	FREE_AGENT_DAILY_LIMIT,
	supportInfo,
};
