import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("devtools sidebar app wiring", () => {
        const repoRoot = path.resolve(__dirname, "../..");

        it("is registered in the sidebarApps loaders list", () => {
                const source = readFileSync(
                        path.join(repoRoot, "src/sidebarApps/index.js"),
                        "utf-8",
                );
                expect(source).toContain('["devtools", () => import("./devtools")]');
        });

        it("exports the sidebar app tuple with a palette icon", () => {
                const source = readFileSync(
                        path.join(repoRoot, "src/sidebarApps/devtools/index.js"),
                        "utf-8",
                );
                expect(source).toContain('"svg:palette"');
                expect(source).toContain('"devtools"');
                expect(source).toContain("{ titleKey: \"dev tools\" }");
        });

        it("generators live in lib/webdevTools.js (not the Eruda devTools)", () => {
                const app = readFileSync(
                        path.join(repoRoot, "src/sidebarApps/devtools/index.js"),
                        "utf-8",
                );
                expect(app).toContain('from "lib/webdevTools"');
        });

        it("has i18n keys in en-us and pt-br", () => {
                const en = JSON.parse(
                        readFileSync(path.join(repoRoot, "src/lang/en-us.json"), "utf-8"),
                );
                const pt = JSON.parse(
                        readFileSync(path.join(repoRoot, "src/lang/pt-br.json"), "utf-8"),
                );
                const keys = [
                        "dev tools",
                        "dev tools shadow",
                        "dev tools gradient",
                        "dev tools card",
                        "dev tools placeholder",
                        "dev tools insert",
                        "dev tools save svg",
                        "update download prompt",
                        "downloading update",
                        "update downloaded",
                        "update download failed",
                        "update install failed",
                ];
                for (const key of keys) {
                        expect(en[key], `en-us missing "${key}"`).toBeTruthy();
                        expect(pt[key], `pt-br missing "${key}"`).toBeTruthy();
                }
        });

        it("offers a VERTICAL tool list with a title and description per tool", () => {
                const app = readFileSync(
                        path.join(repoRoot, "src/sidebarApps/devtools/index.js"),
                        "utf-8",
                );
                // picker structure: collapsible header + vertical list rows
                expect(app).toContain("buildToolPicker");
                expect(app).toContain("devtools-tool-list");
                expect(app).toContain("devtools-tool-item-title");
                expect(app).toContain("devtools-tool-item-desc");
                // every TOOL_LIST row carries id, title key AND description key
                const listBlock = app.slice(
                        app.indexOf("const TOOL_LIST"),
                        app.indexOf("];", app.indexOf("const TOOL_LIST")),
                );
                const descKeys = listBlock.match(/"dev tools [a-z 0-9/]+ desc"/g) || [];
                expect(descKeys.length).toBeGreaterThanOrEqual(16);
        });

        it("ships the programmer tools (json, base64, ids, timestamp, color, lorem, slug)", () => {
                const lib = readFileSync(
                        path.join(repoRoot, "src/lib/webdevTools.js"),
                        "utf-8",
                );
                for (const name of [
                        "formatJson",
                        "base64Convert",
                        "uuidIds",
                        "timestampConvert",
                        "colorConvert",
                        "loremText",
                        "slugText",
                ]) {
                        expect(lib).toContain(`export function ${name}`);
                }
                const en = JSON.parse(
                        readFileSync(path.join(repoRoot, "src/lang/en-us.json"), "utf-8"),
                );
                const pt = JSON.parse(
                        readFileSync(path.join(repoRoot, "src/lang/pt-br.json"), "utf-8"),
                );
                for (const key of [
                        "dev tools json desc",
                        "dev tools base64 desc",
                        "dev tools ids desc",
                        "dev tools timestamp desc",
                        "dev tools color desc",
                        "dev tools lorem desc",
                        "dev tools slug desc",
                        "dev tools regenerate",
                ]) {
                        expect(en[key], `en-us missing "${key}"`).toBeTruthy();
                        expect(pt[key], `pt-br missing "${key}"`).toBeTruthy();
                }
        });
});
