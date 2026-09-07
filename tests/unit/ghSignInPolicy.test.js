import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GitHub sign-in policy (user request: "não precisa de clientes próprios
 * — ou nós integramos no app ou a pessoa usa seu token"):
 *  - users are NEVER asked to create their own OAuth Apps;
 *  - sign-in is PAT-first, with the official Device Flow available when
 *    the built-in client id exists (config.GH_OAUTH_CLIENT_ID or legacy
 *    setting);
 *  - both entry points (settings page + git sidebar) share the flow in
 *    lib/ghSignIn.js.
 */

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

describe("no user-owned OAuth clients", () => {
        it("no source file asks users to create an OAuth App", () => {
                const offenders = [
                        "src/settings/ghSettings.js",
                        "src/sidebarApps/git/index.js",
                        "src/lib/ghSignIn.js",
                        "src/lib/ghAuth.js",
                ].filter((p) => read(p).match(/settings\/developers|Create an OAuth App/i));
                expect(offenders).toEqual([]);
        });

        it("the OAuth client id row is gone from the settings page", () => {
                const source = read("src/settings/ghSettings.js");
                expect(source).not.toMatch(/ghOAuthClientId/);
        });
});

describe("shared sign-in flow", () => {
        const ghSignIn = read("src/lib/ghSignIn.js");

        it("prefers the built-in client id over the legacy setting", () => {
                const resolveFn = ghSignIn.slice(
                        ghSignIn.indexOf("export function resolveGhClientId"),
                );
                const builtinPos = resolveFn.indexOf("config.GH_OAUTH_CLIENT_ID");
                const legacyPos = resolveFn.indexOf("settings.value.ghOAuthClientId");
                expect(builtinPos).toBeGreaterThan(-1);
                expect(legacyPos).toBeGreaterThan(builtinPos);
        });

        it("offers PAT first and hides the device flow without a client id", () => {
                const chooseFn = ghSignIn.slice(
                        ghSignIn.indexOf("export async function chooseGhSignInMethod"),
                        ghSignIn.indexOf("export async function saveGhSession"),
                );
                expect(chooseFn.indexOf('"pat"')).toBeGreaterThan(-1);
                expect(chooseFn.indexOf("resolveGhClientId()")).toBeGreaterThan(-1);
        });

        it("both entry points delegate to signInGitHubFlow", () => {
                expect(read("src/settings/ghSettings.js")).toMatch(
                        /await signInGitHubFlow\(\)/,
                );
                expect(read("src/sidebarApps/git/index.js")).toMatch(
                        /await signInGitHubFlow\(\)/,
                );
        });

        it("config exposes the built-in client id slot (empty until keys ship)", () => {
                const config = read("src/lib/config.js");
                expect(config).toMatch(/const GH_OAUTH_CLIENT_ID = "";/);
                expect(config).toMatch(/\tGH_OAUTH_CLIENT_ID,/);
        });
});
