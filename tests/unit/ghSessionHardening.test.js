import { describe, expect, it } from "vitest";

import {
        describeGhError,
        fetchGhUser,
        looksLikeGhToken,
        normalizeGhToken,
} from "../../src/lib/ghAuth";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GitHub session hardening (v1.8.0) — the "bad credentials" report:
 * even with a valid PAT the sidebar showed no account and no repos.
 * Defense layers now: token normalisation (whitespace/zero-width
 * chars), PAT option in the sign-in chooser, friendly 401 mapping and
 * a profile refresh for "token set — no profile" sessions.
 */

describe("normalizeGhToken", () => {
        it("strips whitespace anywhere in the token", () => {
                expect(normalizeGhToken("  ghp_abc def\n")).toBe("ghp_abcdef");
                expect(normalizeGhToken("ghp_ab\tcd\nef")).toBe("ghp_abcdef");
                expect(normalizeGhToken(" ghp_x ")).toBe("ghp_x");
        });

        it("strips zero-width characters and BOM", () => {
                expect(normalizeGhToken("ghp_ab\u200bc\u200dd\u2060e\ufeff")).toBe(
                        "ghp_abcde",
                );
        });

        it("survives empty/undefined input", () => {
                expect(normalizeGhToken("")).toBe("");
                expect(normalizeGhToken(undefined)).toBe("");
                expect(normalizeGhToken(null)).toBe("");
        });
});

describe("looksLikeGhToken", () => {
        it("accepts known GitHub token prefixes", () => {
                expect(looksLikeGhToken("ghp_" + "a".repeat(36))).toBe(true);
                expect(looksLikeGhToken("github_pat_" + "a".repeat(22))).toBe(true);
                expect(looksLikeGhToken("gho_" + "a".repeat(36))).toBe(true);
                expect(looksLikeGhToken("ghu_" + "a".repeat(36))).toBe(true);
        });

        it("rejects random strings but stays non-blocking (hint only)", () => {
                expect(looksLikeGhToken("hello-world-token")).toBe(false);
                expect(looksLikeGhToken("")).toBe(false);
        });
});

describe("describeGhError", () => {
        it("maps 401 to a friendly re-connect hint while keeping the code", () => {
                const message = describeGhError(401, "Bad credentials");
                expect(message).toContain("GitHub 401:");
                expect(message).toContain("Bad credentials");
        });

        it("maps 'Bad credentials' bodies even without a status", () => {
                const message = describeGhError(0, "Bad credentials");
                expect(message).toContain("401");
        });

        it("keeps other statuses transparent", () => {
                expect(describeGhError(404, "Not Found")).toBe("GitHub 404: Not Found");
        });
});

describe("fetchGhUser normalises before sending", () => {
        it("sends the cleaned token in the Authorization header", async () => {
                let seen = "";
                const fetchImpl = async (url, options) => {
                        seen = options.headers.Authorization;
                        return {
                                ok: true,
                                status: 200,
                                json: async () => ({ login: "carsaimz", name: "Carsai" }),
                        };
                };
                const user = await fetchGhUser(" ghp_ab\tcd\u200b", { fetchImpl });
                expect(seen).toBe("Bearer ghp_abcd");
                expect(user.login).toBe("carsaimz");
        });

        it("rejects empty tokens before any request", async () => {
                await expect(fetchGhUser("   ", { fetchImpl: async () => {} })).rejects.toThrow(
                        "No token provided",
                );
        });
});

describe("sign-in chooser offers PAT (sidebar session bug)", () => {
        const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

        it("chooseGhSignInMethod always pushes the pat option", () => {
                const source = read("src/lib/ghSignIn.js");
                const chooseFn = source.slice(
                        source.indexOf("export async function chooseGhSignInMethod"),
                        source.indexOf("export async function saveGhSession"),
                );
                expect(chooseFn).toContain('"pat"');
                // unconditional push (not behind ghWebFlowEnabled/resolveGhClientId)
                expect(chooseFn).toMatch(/\n\s*options\.push\(\[\s*"pat"/);
        });

        it("signInGitHubFlow still routes pat to signInWithPat", () => {
                const source = read("src/lib/ghSignIn.js");
                expect(source).toContain('if (method === "pat") return signInWithPat();');
        });

        it("exposes refreshGhProfile for the token-set-no-profile state", () => {
                const source = read("src/lib/ghSignIn.js");
                expect(source).toContain("export async function refreshGhProfile()");
        });

        it("the git sidebar account card offers the profile refresh", () => {
                const source = read("src/sidebarApps/git/index.js");
                expect(source).toContain("refreshGhProfile");
        });
});
