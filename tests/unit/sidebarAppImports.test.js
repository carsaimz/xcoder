// @vitest-environment happy-dom
/**
 * "Sidebar is not defined" boot-crash regression guard.
 *
 * Root cause (v1.4.19 → v1.5.0): src/sidebarApps/ai/index.js used
 * `Sidebar.on("show", onSelected)` inside its init function WITHOUT a
 * top-level `import Sidebar from "components/sidebar"`. The free identifier
 * only exploded at RUNTIME, when loadApps() constructed the app
 * (sidebarApps/index.js → add() → new SidebarApp() → init()). The throw
 * rejected loadApps(), which — via the unguarded
 * `await sidebarApps.loadApps()` in main.js — aborted the ENTIRE boot chain:
 *
 *   - sidebar apps after "ai" never registered (git, website, notification,
 *     profile, settings, about) → empty sidebar rail
 *   - editorManager.onupdate never wired → header without file/terminal/
 *     command-palette icons
 *   - welcome tab, folders and files restore never ran → editor with no file
 *   - quicktools stayed hidden; terminal never initialized
 *
 * tsc cannot catch this (checkJs:false) and biome has no
 * noUndeclaredVariables rule enabled — so this test pins two nets:
 *
 *   1. a source-level sweep: every src file using the free identifier
 *      `Sidebar` must import it (top-level or same-scope local destructure)
 *   2. every builtin sidebar app module must evaluate and export a
 *      well-formed descriptor (the same evaluation loadApps performs)
 *
 * plus a structural guard for the per-app try/catch isolation in loadApps().
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "vitest";
import tag from "html-tag-js";

// --- app bootstrap globals the app modules expect at evaluation time ------
window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
window.root = document.createElement("div");
window.editorManager = null;
// main.js sets these before loadApps(); installState.js (extensions app
// graph) reads window.DATA_STORAGE at module evaluation time.
window.DATA_STORAGE = "file:///data/user/0/com.carsaimz.xcoder/files/";
window.CACHE_STORAGE = "file:///data/user/0/com.carsaimz.xcoder/cache/";
// Sidebar app descriptors read strings["..."] at module level; the app
// sets window.strings during lang.set() long before loadApps() runs.
window.strings = new Proxy(
        {},
        { get: (_target, key) => (typeof key === "string" ? "" : undefined) },
);
// lib/polyfill adds String.prototype.capitalize at app boot; descriptors
// like `strings.settings?.capitalize()` rely on it.
if (!String.prototype.capitalize) {
        Object.defineProperty(String.prototype, "capitalize", {
                value: function capitalize() {
                        const str = this.toString();
                        return str.length === 0
                                ? str
                                : str[0].toUpperCase() + str.slice(1);
                },
                writable: true,
                configurable: true,
        });
}

const SIDEBAR_APPS = [
        ["files", () => import("sidebarApps/files")],
        ["searchInFiles", () => import("sidebarApps/searchInFiles")],
        ["extensions", () => import("sidebarApps/extensions")],
        ["ai", () => import("sidebarApps/ai")],
        ["git", () => import("sidebarApps/git")],
        ["website", () => import("sidebarApps/website")],
        ["notification", () => import("sidebarApps/notification")],
        ["profile", () => import("sidebarApps/profile")],
        ["settings", () => import("sidebarApps/settings")],
        ["about", () => import("sidebarApps/about")],
];

const stripComments = (src) =>
        src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// length-preserving string filler: identifiers inside strings can't
// false-positive, and match indexes stay aligned with the source
const stripStringsKeepLength = (src) =>
        src
                .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => '"' + "x".repeat(m.length - 2) + '"')
                .replace(/'(?:[^'\\\n]|\\.)*'/g, (m) => "'" + "x".repeat(m.length - 2) + "'")
                .replace(/`(?:[^`\\]|\\.)*`/g, (m) => "`" + "x".repeat(m.length - 2) + "`");

const FREE_SIDEBAR = /(?<![.\w/"'-])Sidebar(?![\w'-])/;
const TOP_IMPORT_SIDEBAR =
        /^import\s+(?:Sidebar(?:\s*,\s*\{[^}]*\})?|\{[^}]*\bSidebar\b[^}]*\})\s+from\s+["']components\/sidebar["']/m;
const LOCAL_IMPORT_SIDEBAR =
        /const\s*\{\s*default\s*:\s*Sidebar\s*\}\s*=\s*await\s+import\(\s*["']components\/sidebar["']\s*\)/;

function listSrcJsFiles(dir) {
        const out = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                        out.push(...listSrcJsFiles(full));
                } else if (/\.(js|jsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
                        out.push(full);
                }
        }
        return out;
}

describe("sidebar app import guard (boot crash regression)", () => {
        test("every src file using free `Sidebar` imports it from components/sidebar", () => {
                const srcDir = path.resolve(process.cwd(), "src");
                const failures = [];

                for (const file of listSrcJsFiles(srcDir)) {
                        const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
                        const raw = fs.readFileSync(file, "utf8");
                        const noComments = stripComments(raw);
                        const code = stripStringsKeepLength(noComments);

                        // the defining module itself
                        if (rel === "src/components/sidebar/index.js") continue;

                        const firstUse = code.search(FREE_SIDEBAR);
                        if (firstUse < 0) continue; // only comments/strings mention Sidebar

                        const hasTop = TOP_IMPORT_SIDEBAR.test(noComments);
                        const local = LOCAL_IMPORT_SIDEBAR.exec(noComments);
                        const hasLocal = Boolean(local && local.index < firstUse);

                        if (!hasTop && !hasLocal) failures.push(rel);
                }

                assert.deepEqual(
                        failures,
                        [],
                        `Files using \`Sidebar\` without importing it from "components/sidebar" ` +
                                `(this is the exact bug that crashed the app boot with ` +
                                `"Sidebar is not defined"): ${failures.join(", ")}`,
                );
        });

        for (const [app, load] of SIDEBAR_APPS) {
                test(`sidebar app "${app}" evaluates and exports a valid descriptor`, async () => {
                        const mod = await load();
                        const descriptor = mod.default;

                        assert.ok(Array.isArray(descriptor), `${app}: descriptor is an array`);
                        assert.ok(descriptor.length >= 4, `${app}: descriptor has 4+ slots`);
                        const [icon, id, title, init, prepend, onSelected, opts] = descriptor;
                        assert.equal(typeof icon, "string", `${app}: icon is a string`);
                        assert.ok(icon.length > 0, `${app}: icon is non-empty`);
                        assert.equal(typeof id, "string", `${app}: id is a string`);
                        assert.ok(id.length > 0, `${app}: id is non-empty`);
                        assert.equal(typeof title, "string", `${app}: title is a string`);
                        assert.equal(typeof init, "function", `${app}: init is a function`);
                        if (prepend !== undefined) {
                                assert.equal(typeof prepend, "boolean", `${app}: prepend is boolean`);
                        }
                        if (onSelected !== undefined) {
                                assert.equal(
                                        typeof onSelected,
                                        "function",
                                        `${app}: onSelected is a function`,
                                );
                        }
                        if (opts !== undefined) {
                                assert.equal(typeof opts, "object", `${app}: opts is an object`);
                        }
                });
        }

        test("loadApps() isolates each registration (per-app try/catch)", () => {
                const source = fs.readFileSync(
                        path.resolve(process.cwd(), "src/sidebarApps/index.js"),
                        "utf8",
                );
                const loadAppsBody = /async function loadApps\(\)[\s\S]*?\n\}/.exec(source)?.[0];
                assert.ok(loadAppsBody, "loadApps() found in sidebarApps/index.js");
                assert.match(
                        loadAppsBody,
                        /for\s*\(const \[id, loader\] of loaders\)/,
                        "loadApps iterates isolated loaders",
                );
                assert.match(
                        loadAppsBody,
                        /try\s*\{[\s\S]*?await loader\(\)[\s\S]*?\}\s*catch\s*\(error\)/,
                        "each loader() + add() is wrapped in try/catch — one broken app must " +
                                "never reject the whole loadApps() promise again",
                );
        });
});
