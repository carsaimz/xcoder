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

        it("offers the web flow first, device flow with a client id, PAT last", () => {
                const chooseFn = ghSignIn.slice(
                        ghSignIn.indexOf("export async function chooseGhSignInMethod"),
                        ghSignIn.indexOf("export async function saveGhSession"),
                );
                const webPos = chooseFn.indexOf("ghWebFlowEnabled()");
                const devicePos = chooseFn.indexOf("resolveGhClientId()");
                expect(chooseFn.indexOf('"web"')).toBeGreaterThan(-1);
                expect(webPos).toBeGreaterThan(-1);
                expect(devicePos).toBeGreaterThan(webPos);
        });

        it("the client SECRET never reaches the app source", () => {
                const offenders = [
                        "src/lib/config.js",
                        "src/lib/ghSignIn.js",
                        "src/lib/ghAuth.js",
                        "src/lib/ghWebFlow.js",
                        "src/settings/ghSettings.js",
                        "src/sidebarApps/git/index.js",
                ].filter((p) =>
                        read(p).match(/client_secret|GITHUB_APP_CLIENT_SECRET|3668a226/),
                );
                expect(offenders).toEqual([]);
        });

        it("main.js registers the xcoder://github/session intent handler", () => {
                expect(read("src/main.js")).toMatch(/registerGhIntentHandler\(\)/);
        });

        it("the git sidebar renders the account even when local status fails", () => {
                const sidebar = read("src/sidebarApps/git/index.js");
                const refreshFn = sidebar.slice(
                        sidebar.indexOf("async function refresh()"),
                        sidebar.indexOf("function renderError"),
                );
                const accountPos = refreshFn.indexOf("renderAccount()");
                const tryPos = refreshFn.indexOf("try {");
                expect(accountPos).toBeGreaterThan(-1);
                expect(tryPos).toBeGreaterThan(accountPos);
        });

        it("both entry points delegate to signInGitHubFlow", () => {
                expect(read("src/settings/ghSettings.js")).toMatch(
                        /await signInGitHubFlow\(\)/,
                );
                expect(read("src/sidebarApps/git/index.js")).toMatch(
                        /await signInGitHubFlow\(\)/,
                );
        });

        it("config embeds the official GitHub App client id (Ov23li*)", () => {
                const config = read("src/lib/config.js");
                expect(config).toMatch(/const GH_OAUTH_CLIENT_ID = "Ov23li[^"]+";/);
                expect(config).toMatch(/\tGH_OAUTH_CLIENT_ID,/);
        });
});
