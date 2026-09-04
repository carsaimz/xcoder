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
 * Donations are collected through the payment methods stored in the
 * project database (PayPal, Stripe, Buy Me a Coffee, M-Pesa, e-Mola,
 * GitHub Sponsors…). The list is served by the site's remote config
 * (/api/config → support.methods) and managed in the site's /admin, so
 * the owner can add/change methods without an app release. The owner is
 * Mozambican — M-Pesa/e-Mola sit next to the international options; no
 * Pix anywhere.
 *
 * Two ways to unlock:
 *  1. Account (recommended): sign in with the Supabase account used for
 *     the donation — the site admin confirms it and the grant lands in
 *     `premium_grants`; syncCloudPremium() picks it up on every device.
 *  2. Unlock codes, generated offline by the project owner with
 *     scripts/generate-premium-codes.mjs (HMAC-SHA256 over a build
 *     secret). The verifier runs fully offline — no account, no network.
 *     It is deliberately lightweight (client-side), which is fine: the
 *     point is to make honest support easy, not to fight determined
 *     crackers.
 */

const PREMIUM_KEY = "xcoder.premium";
const AGENT_USE_KEY = "xcoder.premium.agent";

/** Free tier: AI agent runs per calendar day. Premium: unlimited. */
export const FREE_AGENT_DAILY_LIMIT = 20;

/**
 * Fallback donation methods (used when the site hasn't served the
 * database list yet). Mirrors the seed rows in supabase/schema.sql.
 */
const SUPPORT_LINKS = {
	sponsors: "https://github.com/sponsors/carsaimz",
	coffee: "https://www.buymeacoffee.com/carsaimz",
};
/** PayPal receives to this e-mail (account method — value is copied). */
const PAYPAL_EMAIL = "carimosaidempinda@gmail.com";

const FALLBACK_METHODS = [
	{
		method: "github_sponsors",
		label: "GitHub Sponsors",
		url: SUPPORT_LINKS.sponsors,
	},
	{
		method: "buymeacoffee",
		label: "Buy Me a Coffee",
		url: SUPPORT_LINKS.coffee,
	},
	{
		method: "paypal",
		label: "PayPal",
		account: PAYPAL_EMAIL,
		accountLabel: "E-mail PayPal",
	},
];

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
 * Normalizes one payment-method row (site DB shape → app shape).
 * @param {any} raw
 * @returns {object | null}
 */
function normalizeMethod(raw) {
	if (!raw || typeof raw !== "object") return null;
	const method = String(raw.method || "other").slice(0, 40);
	const label = String(raw.label || "").slice(0, 60);
	const url = String(raw.url || "").trim();
	const account = String(raw.account || "").trim();
	if (!label || (!url && !account)) return null;
	return {
		method,
		label,
		url,
		account,
		// the site serves raw DB rows (snake_case); accept both
		accountLabel: String(raw.accountLabel ?? raw.account_label ?? "").slice(
			0,
			60,
		),
		instructions: String(raw.instructions || "").slice(0, 300),
	};
}

/**
 * Payment methods from the project database (served by the site remote
 * config), falling back to the built-in donation links.
 * @returns {{methods: {method: string, label: string, url: string, account: string, accountLabel: string, instructions: string}[], links: {id: string, label: string, url: string}[]}}
 */
export function supportInfo() {
	const support = backendConfig()?.support || {};
	const remote = Array.isArray(support.methods)
		? support.methods.map(normalizeMethod).filter(Boolean)
		: [];
	const methods = remote.length
		? remote
		: FALLBACK_METHODS.map(normalizeMethod).filter(Boolean);
	// `links` kept for callers/tests that only care about URL methods
	const links = methods
		.filter((m) => m.url)
		.map((m) => ({ id: m.method, label: m.label, url: m.url }));
	return { methods, links };
}

// ------------------------------------------------------------ cloud grants

/**
 * Syncs the premium entitlement from the project database: when the user
 * is signed in (Supabase auth) and the owner granted them premium
 * (`premium_grants` table), the state is activated locally — and keeps
 * expiring/expiry info in sync across devices.
 * @returns {Promise<boolean>} true when a grant is active after the sync
 */
export async function syncCloudPremium() {
	try {
		const supabase = await import("lib/supabase");
		if (!supabase.default?.supabaseConfigured?.()) return isPremium();
		const user = supabase.default.getUser();
		if (!user?.id) return isPremium();

		const rows = await supabase.default
			.from("premium_grants")
			.select(
				`select=kind,expires_at&or=(user_id.eq.${encodeURIComponent(user.id)},email.eq.${encodeURIComponent(String(user.email || "").toLowerCase())})&limit=1`,
			);
		const grant = Array.isArray(rows) ? rows[0] : null;
		if (!grant) return isPremium();

		const expiresAt = grant.expires_at
			? new Date(grant.expires_at).getTime()
			: 0;
		if (expiresAt && Date.now() > expiresAt) {
			if (readState()?.active) removePremium();
			return false;
		}
		const state = readState();
		const alreadyActive =
			state?.active && (state.expiresAt || 0) === (expiresAt || 0);
		if (!alreadyActive) {
			writeState({
				active: true,
				since: state?.since || Date.now(),
				kind: grant.kind || "lifetime",
				expiresAt,
				source: "cloud",
			});
			try {
				document.dispatchEvent(
					new CustomEvent("premiumchange", { detail: true }),
				);
			} catch {
				/* non-DOM environment (tests) */
			}
		}
		return true;
	} catch {
		return isPremium();
	}
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

// --------------------------------------------------------------- feature gates

/** Cap of the AI "Max tokens" slider for free accounts. */
export const FREE_MAX_TOKENS = 4096;
/** Slider cap once Premium is active. */
export const PREMIUM_MAX_TOKENS = 8192;

/**
 * Effective slider max for the AI max-tokens setting.
 * @returns {number}
 */
export function maxTokensLimit() {
	return isPremium() ? PREMIUM_MAX_TOKENS : FREE_MAX_TOKENS;
}

/**
 * Alias kept for readable call sites ("may I use a premium feature?").
 * @returns {boolean}
 */
export function hasPremium() {
	return isPremium();
}

/**
 * Friendly gate: answers whether a premium feature may be used and, when
 * denied, points the user to the site account / support dialog. The toast
 * is imported lazily so this module stays JSX/SCSS-free for unit tests.
 * @param {boolean} [silent] when true, nothing is shown
 * @returns {Promise<boolean>} true when the feature may be used
 */
export async function requirePremium(silent = false) {
	if (isPremium()) return true;
	if (!silent) {
		try {
			const { default: toast } = await import("components/toast");
			toast(
				strings["premium required"] ||
					"Recurso Premium — apoie o projeto para desbloquear (conta do site)",
				3500,
			);
		} catch {
			/* non-DOM environment (tests) */
		}
	}
	return false;
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
	maxTokensLimit,
	hasPremium,
	requirePremium,
	PREMIUM_THEMES,
	FREE_AGENT_DAILY_LIMIT,
	supportInfo,
	syncCloudPremium,
};
