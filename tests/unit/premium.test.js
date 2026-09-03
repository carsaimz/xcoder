import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
        canUseAgentTurn,
        FREE_AGENT_DAILY_LIMIT,
        isPremium,
        isThemePremium,
        supportInfo,
        syncCloudPremium,
        trackAgentTurn,
        verifyCode,
} from "lib/premium";

// premium.js reads the remote-config cache through lib/backend — mock it so
// no network/localStorage backend state leaks into the assertions.
const backendState = { support: {} };
vi.mock("lib/backend", () => ({
        backendConfig: () => backendState,
}));

// lib/supabase is imported lazily by syncCloudPremium() — mock it with a
// configurable user + premium_grants table.
const supabaseState = {
        configured: false,
        user: null,
        grants: [],
};
vi.mock("lib/supabase", () => ({
        default: {
                supabaseConfigured: () => supabaseState.configured,
                getUser: () => supabaseState.user,
                from: (table) => ({
                        select: async (query) => {
                                expect(table).toBe("premium_grants");
                                const uid = /user_id=eq\.([^&]+)/.exec(query)?.[1];
                                return supabaseState.grants.filter(
                                        (g) => !uid || g.user_id === decodeURIComponent(uid),
                                );
                        },
                }),
        },
}));

vi.mock("lib/settings", () => ({
        default: { value: {}, update: vi.fn() },
}));

vi.mock("lib/config", () => ({
        default: { SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "" },
}));

// minimal localStorage stub (premium state + agent quota live there)
const store = new Map();
vi.stubGlobal("localStorage", {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
});

describe("premium state", () => {
        beforeEach(() => {
                store.clear();
        });

        it("is off by default", () => {
                expect(isPremium()).toBe(false);
        });

        it("recognises well-formed lifetime codes and activates premium", async () => {
                const { code } = await makeCode("lifetime");
                const result = await verifyCode(code);
                expect(result.ok).toBe(true);
                expect(result.kind).toBe("lifetime");
        });

        it("rejects tampered codes", async () => {
                const { code } = await makeCode("lifetime");
                const digits = code.replace(/[^A-Z0-9]/g, "").slice(3);
                const flipped = digits.slice(0, 14) + (digits[14] === "A" ? "B" : "A");
                const result = await verifyCode(`XCP-${flipped}`);
                expect(result.ok).toBe(false);
        });

        it("rejects garbage input", async () => {
                expect((await verifyCode("hello")).ok).toBe(false);
                expect((await verifyCode("")).ok).toBe(false);
        });

        it("rejects expired yearly codes", async () => {
                const { code, year } = await makeCode("yearly");
                const result = await verifyCode(code);
                expect(result.ok).toBe(year >= new Date().getFullYear());
        });
});

describe("agent quota", () => {
        beforeEach(() => {
                store.clear();
        });

        it("allows free users up to the daily limit", () => {
                expect(canUseAgentTurn()).toBe(true);
                for (let i = 0; i < FREE_AGENT_DAILY_LIMIT; i++) trackAgentTurn();
                expect(canUseAgentTurn()).toBe(false);
        });

        it("resets the next day", () => {
                for (let i = 0; i < FREE_AGENT_DAILY_LIMIT; i++) trackAgentTurn();
                // age the stored day stamp
                const raw = JSON.parse(store.get("xcoder.premium.agent"));
                raw.day = "2000-1-1";
                store.set("xcoder.premium.agent", JSON.stringify(raw));
                expect(canUseAgentTurn()).toBe(true);
        });
});

describe("premium themes", () => {
        it("flags only the supporter theme ids", () => {
                expect(isThemePremium("neon")).toBe(true);
                expect(isThemePremium("NEON")).toBe(true);
                expect(isThemePremium("obsidian")).toBe(true);
                expect(isThemePremium("dark")).toBe(false);
                expect(isThemePremium("")).toBe(false);
        });
});

describe("support payment methods", () => {
        beforeEach(() => {
                backendState.support = {};
        });

        it("falls back to the built-in donation links (no Pix)", () => {
                const info = supportInfo();
                expect(info.methods.length).toBeGreaterThanOrEqual(3);
                expect(info.methods.some((m) => /pix/i.test(m.method))).toBe(false);
                expect(
                        info.methods.every((m) => Boolean(m.url) || Boolean(m.account)),
                ).toBe(true);
                expect(info.links.every((l) => Boolean(l.url))).toBe(true);
        });

        it("uses the database methods served by the site (M-Pesa copy row)", () => {
                backendState.support = {
                        methods: [
                                {
                                        method: "paypal",
                                        label: "PayPal",
                                        url: "https://paypal.me/owner",
                                },
                                {
                                        method: "mpesa",
                                        label: "M-Pesa",
                                        account: "258 84 000 0000",
                                        account_label: "Número M-Pesa",
                                        instructions: "Envie e confirme",
                                },
                                { method: "broken", label: "" },
                        ],
                };
                const info = supportInfo();
                expect(info.methods.length).toBe(2);
                expect(info.methods[1].method).toBe("mpesa");
                expect(info.methods[1].account).toBe("258 84 000 0000");
                expect(info.methods[1].accountLabel).toBe("Número M-Pesa");
                expect(info.links.length).toBe(1);
        });
});

describe("cloud premium sync", () => {
        beforeEach(() => {
                store.clear();
                supabaseState.configured = false;
                supabaseState.user = null;
                supabaseState.grants = [];
        });

        it("keeps free tier when signed out", async () => {
                expect(await syncCloudPremium()).toBe(false);
        });

        it("activates premium from a database grant and expires yearly ones", async () => {
                supabaseState.configured = true;
                supabaseState.user = { id: "uuid-1", email: "a@b.c" };
                supabaseState.grants = [
                        { kind: "lifetime", expires_at: null, user_id: "uuid-1" },
                ];
                expect(await syncCloudPremium()).toBe(true);
                expect(isPremium()).toBe(true);

                // expired yearly grant → premium goes away
                supabaseState.grants = [
                        {
                                kind: "yearly",
                                expires_at: new Date(Date.now() - 86400000).toISOString(),
                                user_id: "uuid-1",
                        },
                ];
                expect(await syncCloudPremium()).toBe(false);
                expect(isPremium()).toBe(false);
        });
});

// -- helpers --------------------------------------------------------------

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SECRET = "xcoder·premium·v1·carsaimz";

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

/**
 * Builds a REAL valid code with the same algorithm/secret as the owner
 * generator script (scripts/generate-premium-codes.mjs) using node's
 * WebCrypto, so the verifier path is exercised end to end.
 * @param {"lifetime"|"yearly"} kind
 */
async function makeCode(kind) {
        const year = new Date().getFullYear() + 1;
        const salt = "TE5T5";
        const message =
                kind === "yearly" ? `year:${year}:${salt}` : `lifetime:${salt}`;
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
        const sig = base32(new Uint8Array(signature));
        const grouped = `${salt}-${sig.slice(0, 5)}-${sig.slice(5)}`;
        return { code: kind === "yearly" ? `XCP-${year}-${grouped}` : `XCP-${grouped}`, year };
}
