// @vitest-environment happy-dom
/**
 * v1.6.2 regression tests — the four user-reported app bugs:
 *
 *  1. "Não tem ícones nas opções Fontes e Sessões SSH" — the settings
 *     rows reference svg:server / svg:type, but those names were MISSING
 *     from the SVG pack and the fallback class ("icon svg:server")
 *     matches no icon-font glyph, so nothing rendered. Guard: EVERY
 *     svg:<name> referenced in src/ must exist in the pack, and the
 *     select dialog must render pack icons as real vectors.
 *
 *  2. "Página de conta continua Convidado" — the website and the app
 *     keep separate sessions; the app now exposes the site handoff
 *     (appHandoffUrl + /auth/app-handoff) and the profile page reacts to
 *     authchange + shows inline form errors.
 *
 *  3. "Conectei via PAT e os repos não aparecem" — ghSettings assumed
 *     the settings kit persists prompt values; it does not. The page
 *     must persist ghToken / gitRemoteUrl / ghBranch itself.
 *
 *  4. "Reorganize as opções" — the main settings page groups items into
 *     Core / Appearance / Code & tools / Connections / Data / About.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test, vi } from "vitest";

const ROOT = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../..",
);

function read(...parts) {
        return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

// heavy runtime deps of the two DOM tests — stubbed at module level
const settingsStub = vi.hoisted(() => ({
        default: {
                value: {},
                on: () => undefined,
                off: () => undefined,
                update: async () => undefined,
        },
}));
vi.mock("lib/settings", () => settingsStub);
vi.mock("lib/restoreTheme", () => ({ default: () => undefined }));
vi.mock("lib/actionStack", () => ({
        default: { push: () => undefined, remove: () => undefined, has: () => false },
}));
vi.mock("dompurify", () => ({
        default: { sanitize: (value) => value },
}));

// ---------------------------------------------------------------- 1. icons

describe("svg icon pack completeness (Fontes / Sessões SSH icons)", () => {
        test("every svg:<name> referenced in src/ exists in the pack", async () => {
                const { iconNames } = await import("utils/svgIcons");
                const pack = new Set(iconNames);

                const used = new Set();
                const walk = (dir) => {
                        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                                const full = path.join(dir, entry.name);
                                if (entry.isDirectory()) {
                                        walk(full);
                                        continue;
                                }
                                if (!/\.(js|jsx|ts|tsx)$/.test(entry.name)) continue;
                                const content = fs.readFileSync(full, "utf8");
                                for (const match of content.matchAll(/svg:([a-z0-9-]+)/g)) {
                                        used.add(match[1]);
                                }
                        }
                };
                walk(path.join(ROOT, "src"));

                const missing = [...used].filter((name) => !pack.has(name));
                assert.deepEqual(
                        missing,
                        [],
                        `svg: icons referenced but not in the pack: ${missing.join(", ")}`,
                );
                // the two the user explicitly reported
                assert.ok(pack.has("server"), "svg:server (Sessões SSH) missing");
                assert.ok(pack.has("type"), "svg:type (Fontes) missing");
        });

        test("select dialog renders svg: icons as real vectors", async () => {
                const tag = (await import("html-tag-js")).default;
                window.tag = tag;
                window.app = document.createElement("div");
                document.body.append(window.app);
                globalThis.strings = globalThis.strings || {};

                const { default: select } = await import("dialogs/select");
                const promise = select("title", [["a", "Item A", "svg:server"]]);
                const lead = document.querySelector(".prompt.select li i");
                assert.ok(lead, "select item has a lead icon element");
                assert.ok(
                        lead.querySelector("svg.xc-svg"),
                        "svg: icons must render an inline <svg>, not a dead class",
                );
                assert.ok(
                        !lead.className.includes("svg:"),
                        "the literal svg: name must never leak into a class name",
                );
                // pick the item — resolves the dialog promise
                const $item = document.querySelector(".prompt.select li");
                $item?.click();
                assert.equal(await promise, "a");
        });
});

// ------------------------------------------------------------- 2. account

describe("account page — site session handoff (fim do 'Convidado')", () => {
        test("supabase exposes appHandoffUrl + ensureFreshSession", async () => {
                const supabase = await import("lib/supabase");
                assert.equal(typeof supabase.appHandoffUrl, "function");
                assert.equal(typeof supabase.ensureFreshSession, "function");
                assert.equal(
                        supabase.appHandoffUrl(),
                        "https://xcoderapp.vercel.app/auth/app-handoff",
                );
        });

        test("profile page wires the handoff button, authchange and inline errors", () => {
                const src = read("src/pages/profile/profile.js");
                assert.match(src, /async function onSiteHandoff/);
                assert.match(src, /appHandoffUrl\(\)/);
                assert.match(src, /addEventListener\("authchange"/);
                assert.match(src, /removeEventListener\("authchange"/);
                assert.match(src, /data-form-error/);
                assert.match(src, /function showFormError/);
                // the mount stays synchronous (first paint + tests)
                assert.match(src, /ensureFreshSession\(\)\s*\n\s*\.then/);
        });

        test("the site ships the /auth/app-handoff bridge page", () => {
                const sitePath = path.join(
                        ROOT,
                        "../xcoder-web/src/app/auth/app-handoff/page.tsx",
                );
                if (!fs.existsSync(sitePath)) {
                        // CI checks out THIS repo only — the sibling xcoder-web
                        // checkout exists in the local workspace, so this guard
                        // runs there
                        console.warn("sibling xcoder-web not present — skipping");
                        return;
                }
                const site = fs.readFileSync(sitePath, "utf8");
                assert.match(site, /xcoder:\/\/auth\/oauth#/);
                assert.match(site, /AuthForm/);
        });
});

// ----------------------------------------------------------------- 3. PAT

describe("GitHub PAT persistence (repos que não apareciam)", () => {
        test("ghSettings persists ghToken/gitRemoteUrl/ghBranch itself", () => {
                const src = read("src/settings/ghSettings.js");
                assert.ok(
                        !src.includes("already persisted the prompt value"),
                        "the wrong 'settings kit persists' assumption is still there",
                );
                assert.match(src, /settings\.value\.ghToken = token/);
                assert.match(src, /await settings\.update\(\)/);
                assert.match(src, /settings\.value\[key\] = trimmed/);
                // profile is fetched right after a manual token save
                assert.match(src, /fetchProfile\(settings\.value\.ghToken\)/);
        });
});

// ----------------------------------------------------- 4. settings groups

describe("main settings regrouped by category", () => {
        test("categories map has the 6 groups and logical order", () => {
                const src = read("src/settings/mainSettings.js");
                const groups = [
                        "settings-category-core",
                        "settings-category-appearance",
                        "settings-category-code",
                        "settings-category-connections",
                        "settings-category-data",
                        "settings-category-about-xcoder",
                ];
                for (const group of groups) {
                        assert.ok(
                                src.includes(group),
                                `missing category string reference: ${group}`,
                        );
                }
                // appearance (theme) comes BEFORE connections (github) in the items
                const themeIdx = src.indexOf('key: "theme"');
                const ghIdx = src.indexOf('key: "gh-settings"');
                const sshIdx = src.indexOf('key: "ssh-settings"');
                const fontIdx = src.indexOf('key: "font-settings"');
                assert.ok(themeIdx > -1 && fontIdx > -1 && ghIdx > -1 && sshIdx > -1);
                assert.ok(
                        themeIdx < ghIdx && fontIdx < ghIdx,
                        "appearance items must be listed before connections items",
                );
                assert.ok(ghIdx < sshIdx, "GitHub comes before SSH inside Connections");
        });

        test("language files carry the new category strings", () => {
                const en = JSON.parse(read("src/lang/en-us.json"));
                const pt = JSON.parse(read("src/lang/pt-br.json"));
                for (const key of [
                        "settings-category-appearance",
                        "settings-category-code",
                        "settings-category-connections",
                        "continue on site",
                        "site handoff hint",
                        "site handoff browser hint",
                ]) {
                        assert.ok(en[key], `en-us missing ${key}`);
                        assert.ok(pt[key], `pt-br missing ${key}`);
                }
        });
});
