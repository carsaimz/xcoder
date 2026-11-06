#!/usr/bin/env node
/**
 * Applies the GitHub sign-in fixes (v1.5.4) via exact string-replace,
 * preserving the original TAB indentation (the Edit tool normalizes
 * tabs to spaces and would explode the diff — see worklog Task 15).
 *
 * Every replacement must match EXACTLY ONCE, otherwise the script fails
 * without writing anything (atomic per file).
 */
import { readFileSync, writeFileSync } from "node:fs";

const files = {
        config: "/home/z/my-project/xcoder/src/lib/config.js",
        signIn: "/home/z/my-project/xcoder/src/lib/ghSignIn.js",
        auth: "/home/z/my-project/xcoder/src/lib/ghAuth.js",
        gitApp: "/home/z/my-project/xcoder/src/sidebarApps/git/index.js",
};

/** Applies one replacement, failing loudly when the anchor is not unique. */
function replaceOnce(source, name, oldStr, newStr) {
        const count = source.split(oldStr).length - 1;
        if (count !== 1) {
                throw new Error(
                        `anchor for ${name} matched ${count} times (expected 1):\n${oldStr.slice(0, 120)}`,
                );
        }
        return source.replace(oldStr, newStr);
}

function apply(file, edits) {
        let source = readFileSync(file, "utf8");
        for (const [name, oldStr, newStr] of edits) {
                source = replaceOnce(source, name, oldStr, newStr);
        }
        writeFileSync(file, source);
        console.log(`OK ${file} (${edits.length} edits)`);
}

// 1) config.js — SKIPPED: the parallel v1.5.4 already ships the official
//    client id (Ov23li...) and its policy test covers it.

// 2) ghSignIn.js — tryFetchGhUser helper + session guard + device flow fix
apply(files.signIn, [
        [
                "tryFetchGhUser helper",
                'import settings from "lib/settings";\n\n/**\n * Resolves the OAuth App client id',
                'import settings from "lib/settings";\n\n/**\n' +
                        " * Fetches the profile for a token, tolerating failures (the token\n" +
                        " * itself is already valid — the profile is cosmetic and can be\n" +
                        " * refreshed later from the settings page).\n" +
                        " * @param {string} token\n" +
                        " * @returns {Promise<object|null>}\n" +
                        " */\n" +
                        "async function tryFetchGhUser(token) {\n" +
                        "\ttry {\n" +
                        "\t\treturn await fetchGhUser(token);\n" +
                        "\t} catch {\n" +
                        "\t\t// profile is cosmetic — the session stays valid without it\n" +
                        "\t\treturn null;\n" +
                        "\t}\n" +
                        "}\n\n" +
                        "/**\n * Resolves the OAuth App client id",
        ],
        [
                "saveGhSession guard",
                'export async function saveGhSession(token, user) {\n\tsettings.value.ghToken = token;',
                'export async function saveGhSession(token, user) {\n' +
                        '\tif (!token) throw new Error("Cannot save a GitHub session without a token");\n' +
                        '\tsettings.value.ghToken = token;',
        ],
        [
                "device flow destructuring fix",
                "\t\t\tconst { token, user } = await pollForToken(\n" +
                        "\t\t\t\tclientId,\n" +
                        "\t\t\t\tcode.deviceCode,\n" +
                        "\t\t\t\tcode.interval,\n" +
                        "\t\t\t\t{ maxMs: code.expiresIn * 1000 },\n" +
                        "\t\t\t);\n" +
                        "\t\t\tawait saveGhSession(token, user);",
                "\t\t\t// pollForToken resolves with the access token STRING (not an\n" +
                        "\t\t\t// object) — destructuring it left token/user undefined and\n" +
                        "\t\t\t// silently saved an EMPTY session (v1.5.3 bug: \"connected\"\n" +
                        "\t\t\t// toast, but no account data and no repositories).\n" +
                        "\t\t\tconst token = await pollForToken(\n" +
                        "\t\t\t\tclientId,\n" +
                        "\t\t\t\tcode.deviceCode,\n" +
                        "\t\t\t\tcode.interval,\n" +
                        "\t\t\t\t{ maxMs: code.expiresIn * 1000 },\n" +
                        "\t\t\t);\n" +
                        "\t\t\tconst user = await tryFetchGhUser(token);\n" +
                        "\t\t\tawait saveGhSession(token, user);",
        ],
]);

// 3) ghAuth.js — native (CORS-free) profile fetch
apply(files.auth, [
        [
                "cordovaGetJson helper",
                "/**\n * Fetches the authenticated user profile for a token.",
                "/**\n" +
                        " * Native (CORS-free) GET via cordova-plugin-advanced-http — same\n" +
                        " * strategy as the token endpoints, because api.github.com requests\n" +
                        " * from the webview can fail CORS preflight on some Android versions.\n" +
                        " * @param {string} url\n" +
                        " * @param {Record<string, string>} headers\n" +
                        " * @returns {Promise<any>} parsed JSON body\n" +
                        " */\n" +
                        "function cordovaGetJson(url, headers) {\n" +
                        "\treturn new Promise((resolve, reject) => {\n" +
                        "\t\tcordova.plugin.http.sendRequest(\n" +
                        "\t\t\turl,\n" +
                        "\t\t\t{\n" +
                        '\t\t\t\tmethod: "GET",\n' +
                        "\t\t\t\theaders,\n" +
                        '\t\t\t\tserializer: "json",\n' +
                        '\t\t\t\tresponseType: "json",\n' +
                        "\t\t\t\ttimeout: 20000,\n" +
                        "\t\t\t},\n" +
                        "\t\t\t(response) => {\n" +
                        "\t\t\t\tlet data = response.data;\n" +
                        '\t\t\t\tif (typeof data === "string") {\n' +
                        "\t\t\t\t\ttry {\n" +
                        "\t\t\t\t\t\tdata = JSON.parse(data);\n" +
                        "\t\t\t\t\t} catch {\n" +
                        "\t\t\t\t\t\tdata = null;\n" +
                        "\t\t\t\t\t}\n" +
                        "\t\t\t\t}\n" +
                        "\t\t\t\tresolve(data);\n" +
                        "\t\t\t},\n" +
                        "\t\t\t(error) => {\n" +
                        "\t\t\t\treject(\n" +
                        '\t\t\t\t\tnew Error(\n' +
                        '\t\t\t\t\t\t`GitHub ${error?.status || ""}: ${error?.error || error?.statusText || "request failed"}`,\n' +
                        "\t\t\t\t\t),\n" +
                        "\t\t\t\t);\n" +
                        "\t\t\t},\n" +
                        "\t\t);\n" +
                        "\t});\n" +
                        "}\n\n" +
                        "/**\n * Fetches the authenticated user profile for a token.",
        ],
        [
                "fetchGhUser native path",
                '\tif (!token) throw new Error("No token provided");\n' +
                        "\n" +
                        '\tconst doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);\n' +
                        '\tif (!doFetch) throw new Error("No HTTP client available");\n' +
                        "\n" +
                        "\tconst res = await doFetch(USER_URL, {\n" +
                        "\t\theaders: {\n" +
                        '\t\t\tAccept: "application/vnd.github+json",\n' +
                        "\t\t\tAuthorization: `Bearer ${token}`,\n" +
                        "\t\t},\n" +
                        "\t});",
                '\tif (!token) throw new Error("No token provided");\n' +
                        "\n" +
                        "\tconst headers = {\n" +
                        '\t\tAccept: "application/vnd.github+json",\n' +
                        "\t\tAuthorization: `Bearer ${token}`,\n" +
                        '\t\t"X-GitHub-Api-Version": "2022-11-28",\n' +
                        "\t};\n" +
                        "\n" +
                        '\tif (typeof cordova !== "undefined" && cordova?.plugin?.http?.sendRequest) {\n' +
                        "\t\tconst user = await cordovaGetJson(USER_URL, headers);\n" +
                        '\t\tif (!user?.login) throw new Error("GitHub user request failed");\n' +
                        "\t\treturn {\n" +
                        '\t\t\tlogin: user?.login || "",\n' +
                        '\t\t\tname: user?.name || "",\n' +
                        '\t\t\tavatarUrl: user?.avatar_url || "",\n' +
                        "\t\t};\n" +
                        "\t}\n" +
                        "\n" +
                        '\tconst doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);\n' +
                        '\tif (!doFetch) throw new Error("No HTTP client available");\n' +
                        "\n" +
                        "\tconst res = await doFetch(USER_URL, { headers });",
        ],
]);

// 4) git sidebar app — live account card refresh on session change
apply(files.gitApp, [
        [
                "git app account listeners",
                "\treturn () => {\n" +
                        "\t\tcontainer = null;\n" +
                        "\t\tclearInterval(refreshTimer);\n" +
                        "\t};\n" +
                        "}",
                "\t// refresh the account card as soon as the session changes —\n" +
                        "\t// sign-in can happen from the settings page while this app is open\n" +
                        '\tsettings.on("update:ghUserLogin", onAccountChanged);\n' +
                        '\tsettings.on("update:ghToken", onAccountChanged);\n' +
                        "\n" +
                        "\treturn () => {\n" +
                        "\t\tcontainer = null;\n" +
                        "\t\tclearInterval(refreshTimer);\n" +
                        '\t\tsettings.off("update:ghUserLogin", onAccountChanged);\n' +
                        '\t\tsettings.off("update:ghToken", onAccountChanged);\n' +
                        "\t};\n" +
                        "}\n" +
                        "\n" +
                        "/** Re-renders the account + GitHub cards when the session changes. */\n" +
                        "function onAccountChanged() {\n" +
                        "\tif (!container?._$accountBody?.isConnected) return;\n" +
                        "\trenderAccount();\n" +
                        "\trenderGh();\n" +
                        "}",
        ],
]);

console.log("All gh fixes applied.");
