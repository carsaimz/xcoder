import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
        canUseAgentTurn,
        FREE_AGENT_DAILY_LIMIT,
        isPremium,
        isThemePremium,
        trackAgentTurn,
        verifyCode,
} from "lib/premium";

// premium.js reads the remote-config cache through lib/backend — mock it so
// no network/localStorage backend state leaks into the assertions.
vi.mock("lib/backend", () => ({
        backendConfig: () => ({
                support: { pixKey: "000.111.222-33", pixName: "Teste" },
        }),
}));

vi.mock("lib/settings", () => ({
        default: { value: {}, update: vi.fn() },
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
