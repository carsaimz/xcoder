// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v1.8.14 — VS Code structural round (user: "reestruturação completa",
 * "painel de IA ancorado", "minimapa", "sidebar expande mais", buscas,
 * filtro free/paid, economia de tokens):
 *  - minimap: pure helpers + editor wiring
 *  - breadcrumbs: path segments + pane wiring
 *  - right dock: anchored AI panel (prefs + singleton API)
 *  - sidebar: 90% max width, labels in front of glyphs, rail-only hides them
 *  - activity bar order: files, search, git, ai, extensions
 *  - libs + devtools search boxes
 *  - model picker free/paid filter chips
 *  - agent token economy: compactForRequest + capped tool results
 */

const read = (p) => readFileSync(resolve(__dirname, "../../", p), "utf8");

vi.mock("lib/actionStack", () => ({
        default: {
                push: vi.fn(),
                remove: vi.fn(),
        },
}));

describe("minimap helpers", () => {
        it("classifies lezer node names into color roles", async () => {
                const { tokenRole } = await import("components/minimap/utils");
                expect(tokenRole("LineComment")).toBe("comment");
                expect(tokenRole("BlockComment")).toBe("comment");
                expect(tokenRole("String")).toBe("string");
                expect(tokenRole("Number")).toBe("number");
                expect(tokenRole("keyword")).toBe("keyword");
                expect(tokenRole("Element")).toBe("tag");
                expect(tokenRole("VariableName")).toBe("text");
                expect(tokenRole("")).toBe("text");
        });

        it("measures line indent and trimmed length (tabs expand)", async () => {
                const { lineMetrics } = await import("components/minimap/utils");
                expect(lineMetrics("  code();", 2)).toEqual({ indent: 2, length: 7 });
                expect(lineMetrics("\t\tdeep()", 2)).toEqual({ indent: 4, length: 6 });
                expect(lineMetrics("no indent", 2)).toEqual({ indent: 0, length: 9 });
        });

        it("maps minimap clicks to editor scroll offsets", async () => {
                const { scrollToFromClick } = await import("components/minimap/utils");
                // viewport (100px) centers on the clicked document position
                expect(scrollToFromClick(50, 100, 500, 100)).toBe(200);
                expect(scrollToFromClick(0, 100, 500, 100)).toBe(0);
                expect(scrollToFromClick(100, 100, 500, 100)).toBe(400);
                // short docs never scroll
                expect(scrollToFromClick(50, 100, 100, 200)).toBe(0);
        });

        it("colors adapt to dark/light themes", async () => {
                const { roleColor } = await import("components/minimap/utils");
                expect(roleColor("comment", true)).not.toBe(roleColor("comment", false));
                expect(roleColor("string", true)).toContain("rgba(");
        });

        it("is wired into the editor (panes + settings toggle)", () => {
                const manager = read("src/lib/editorManager.js");
                expect(manager).toContain('import minimap, { attachMinimap } from "components/minimap";');
                expect(manager).toContain("attachMinimap(editor, primaryPane.editorContainer)");
                expect(manager).toContain('appSettings.on("update:minimap"');
                const settings = read("src/lib/settings.js");
                expect(settings).toMatch(/minimap: true/);
                const editorSettings = read("src/settings/editorSettings.js");
                expect(editorSettings).toContain('key: "minimap"');
                // the CodeMirror update bridge exists
                const ext = read("src/cm/minimapExtension.ts");
                expect(ext).toContain("EditorView.updateListener.of");
        });
});

describe("breadcrumbs", () => {
        it("splits paths into segments (relative to the workspace root)", async () => {
                const { crumbSegments } = await import("components/breadcrumbs/index.js");
                expect(
                        crumbSegments("file:///storage/app/project/src/App.js", "file:///storage/app/project"),
                ).toEqual(["src", "App.js"]);
                expect(crumbSegments("file:///a/b/c/d/e/f.js")).toEqual(["c", "d", "e", "f.js"]);
                expect(crumbSegments("")).toEqual([]);
                expect(crumbSegments(undefined, "file:///x")).toEqual([]);
        });

        it("renders segments with separators only for editor files", async () => {
                const { updateCrumbs, default: createBreadcrumbs } = await import(
                        "components/breadcrumbs/index.js"
                );
                const $crumbs = createBreadcrumbs();
                updateCrumbs($crumbs, { type: "editor", uri: "file:///proj/lib/app.js" }, "file:///proj");
                expect($crumbs.classList.contains("has-path")).toBe(true);
                expect($crumbs.querySelectorAll(".editor-crumbs-seg").length).toBe(2);
                expect($crumbs.querySelectorAll(".editor-crumbs-sep").length).toBe(1);
                expect($crumbs.textContent).toBe("lib›app.js");

                updateCrumbs($crumbs, { type: "terminal" });
                expect($crumbs.classList.contains("has-path")).toBe(false);
                expect($crumbs.textContent).toBe("");
        });

        it("each editor pane owns a crumbs element (tabs > crumbs > code)", () => {
                const manager = read("src/lib/editorManager.js");
                expect(manager).toContain("crumbs: createBreadcrumbs()");
                expect(manager).toContain("pane.element.append(pane.tabList, pane.crumbs, pane.content)");
                expect(manager).toContain('["switch-file", "file-loaded", "rename-file", "remove-file"]');
        });
});

describe("right dock (painel de IA ancorado)", () => {
        beforeEach(() => {
                localStorage.clear();
        });

        it("persists the anchored preference per app (AI anchored by default)", async () => {
                const dock = await import("components/rightDock/index.js");
                expect(dock.prefEnabled("ai")).toBe(true); // default: anchored
                expect(dock.prefEnabled("git")).toBe(false); // others: window
                dock.setPref("ai", false);
                expect(dock.prefEnabled("ai")).toBe(false);
                dock.setPref("git", true);
                expect(dock.prefEnabled("git")).toBe(true);
                dock.setPref("ai", true);
                expect(dock.prefEnabled("ai")).toBe(true);
        });

        it("tracks the open app id", async () => {
                const dock = await import("components/rightDock/index.js");
                expect(dock.isOpenFor("ai")).toBe(false);
                expect(dock.activeWindowId()).toBe(null);
        });

        it("AI app is dock-capable and the header has the anchor button", () => {
                const ai = read("src/sidebarApps/ai/index.js");
                expect(ai).toContain('dock: "right"');
                expect(ai).toContain('className="icon push_pin ai-act ai-anchor"');
                expect(ai).toContain("toggleAnchored");
                expect(ai).toContain('isAppAnchored?.("ai")');
        });

        it("sidebarApp opens dock-capable apps in the right dock", () => {
                const app = read("src/sidebarApps/sidebarApp.js");
                expect(app).toContain('import rightDock from "components/rightDock"');
                expect(app).toContain("rightDock.prefEnabled(this.#id)");
                expect(app).toContain("setAnchored(anchored)");
        });

        it("the registry toggles anchoring and closes the dock on second tap", () => {
                const registry = read("src/sidebarApps/index.js");
                expect(registry).toContain("setAppAnchored");
                expect(registry).toContain("isAppAnchored");
                expect(registry).toContain("rightDock.isOpenFor(id)");
                expect(registry).toContain('addEventListener("sidebar-app-undock"');
        });

        it("floating windows avoid the right dock too", () => {
                const fw = read("src/components/sidebar/floatingWindow.js");
                expect(fw).toContain('document.getElementById("right-dock")');
        });
});

describe("sidebar expansion (90% da tela)", () => {
        it("max width is 90% of the screen and the default is generous", () => {
                const sidebar = read("src/components/sidebar/index.js");
                expect(sidebar).toContain("innerWidth * 0.9");
                expect(sidebar).toContain("innerWidth * 0.62");
                expect(sidebar).toContain("innerWidth * 0.92");
        });

        it("labels sit IN FRONT of the glyphs (row layout), hidden in rail-only", () => {
                const css = read("src/components/sidebar/style.scss");
                expect(css).toMatch(/\.app-icons-container\.with-labels\s*\{[^}]*flex-direction:\s*row/s);
                expect(css).toMatch(/#sidebar\.rail-only \.app-icons-container\.with-labels \.icon\s*\{[^}]*\.app-label\s*\{[^}]*display:\s*none/s);
        });

        it("activity bar order matches VS Code (files, search, git, ai, extensions)", () => {
                const registry = read("src/sidebarApps/index.js");
                const files = registry.indexOf('["files", () => import("./files")]');
                const search = registry.indexOf('["searchInFiles", () => import("./searchInFiles")]');
                const git = registry.indexOf('["git", () => import("./git")]');
                const ai = registry.indexOf('["ai", () => import("./ai")]');
                const ext = registry.indexOf('["extensions", () => import("./extensions")]');
                expect(files).toBeGreaterThanOrEqual(0);
                expect(search).toBeGreaterThan(files);
                expect(git).toBeGreaterThan(search);
                expect(ai).toBeGreaterThan(git);
                expect(ext).toBeGreaterThan(ai);
        });
});

describe("search in libraries and web tools", () => {
        it("libs list has a live search box with a stable focus", () => {
                const libs = read("src/sidebarApps/libs/index.js");
                expect(libs).toContain('className="libs-search"');
                expect(libs).toContain("renderList()");
                expect(libs).toContain("filterLibs(ALL_LIBS, libQuery)");
        });

        it("devtools picker has a search box that filters rows", () => {
                const devtools = read("src/sidebarApps/devtools/index.js");
                expect(devtools).toContain('className="devtools-tool-search"');
                expect(devtools).toContain("applyToolFilter");
                expect(devtools).toContain("data-search");
        });
});

describe("model picker free/paid filter", () => {
        it("filterModelItems filters by price and keeps group headers", async () => {
                const { filterModelItems } = await import("components/modelPicker/utils");
                const items = [
                        { header: true, text: "Groq" },
                        { value: "a", text: "a", type: "free" },
                        { value: "b", text: "b", type: "paid" },
                        { value: "c", text: "c", type: "free" },
                ];
                expect([...filterModelItems(items, "", "free")].sort()).toEqual([0, 1, 3]);
                expect([...filterModelItems(items, "", "paid")].sort()).toEqual([0, 2]);
                expect([...filterModelItems(items, "")].sort()).toEqual([0, 1, 2, 3]);
                // query + type combine
                expect([...filterModelItems(items, "b", "free")]).toEqual([]);
                expect([...filterModelItems(items, "b", "paid")].sort()).toEqual([0, 2]);
        });

        it("the picker renders persisted All/Free/Paid chips", () => {
                const src = read("src/components/modelPicker/index.js");
                expect(src).toContain('localStorage.getItem("modelTypeFilter")');
                expect(src).toContain("mp-chips");
                expect(src).toContain("filterModelItems(items, $search.value, typeFilter)");
        });
});

describe("AI token economy", () => {
        it("requests use the compacted payload, tool results are capped", () => {
                const agent = read("src/lib/ai/agent.js");
                expect(agent).toContain("messages: compactForRequest(this.messages)");
                expect(agent).toContain("capToolResult(result)");
                expect(agent).toContain("HISTORY_WINDOW = 24");
                expect(agent).toContain("OLD_TOOL_CAP = 400");
        });

        it("compactForRequest compacts old tool outputs and slides the window", async () => {
                vi.mock("fileSystem", () => ({ default: vi.fn(() => ({})) }));
                vi.mock("components/toast", () => ({ default: vi.fn() }));
                vi.mock("dialogs/confirm", () => ({ default: vi.fn() }));
                vi.mock("dialogs/prompt", () => ({ default: vi.fn() }));
                vi.mock("lib/premium", () => ({
                        canUseAgentTurn: vi.fn(() => true),
                        trackAgentTurn: vi.fn(),
                        FREE_AGENT_DAILY_LIMIT: 25,
                }));
                vi.mock("lib/premiumUI", () => ({ openSupportPage: vi.fn() }));
                vi.mock("lib/settings", () => ({
                        default: {
                                value: {},
                                on: vi.fn(),
                                off: vi.fn(),
                                update: vi.fn(),
                        },
                }));
                const { compactForRequest } = await import("lib/ai/agent");

                // small transcript: unchanged apart from old tool stubs
                const small = [
                        { role: "system", content: "sys" },
                        { role: "user", content: "hi" },
                        { role: "tool", tool_call_id: "t1", content: "x".repeat(500) },
                        { role: "user", content: "second" },
                ];
                const out = compactForRequest(small);
                expect(out.length).toBe(4);
                expect(out[2].content).toContain("truncated to save tokens");
                expect(out[2].content.length).toBeLessThan(500);
                // current-turn tool output (after the last user message) stays full
                const current = [
                        { role: "system", content: "sys" },
                        { role: "user", content: "hi" },
                        { role: "tool", tool_call_id: "t2", content: "y".repeat(500) },
                ];
                expect(compactForRequest(current)[2].content).toBe("y".repeat(500));

                // big transcript: collapses into marker + safe window
                const big = [{ role: "system", content: "sys" }];
                for (let i = 0; i < 60; i++) {
                        big.push({ role: "user", content: `u${i}` });
                        big.push({ role: "assistant", content: `a${i}` });
                }
                const slid = compactForRequest(big);
                expect(slid[0].role).toBe("system");
                expect(slid[1].content).toContain("earlier messages");
                expect(slid[2].role).toBe("user");
                // the payload never starts with a tool message
                expect(slid[2].role).not.toBe("tool");
                expect(slid.length).toBeLessThanOrEqual(27);
                // original transcript untouched
                expect(big.length).toBe(121);
        });

        it("workspace context caps shrank (12 files / 25 entries)", () => {
                const agent = read("src/lib/ai/agent.js");
                expect(agent).toContain("open.slice(0, 12)");
                expect(agent).toContain(".slice(0, 25)");
        });
});

describe("translations for the new features", () => {
        const KEYS = [
                "minimap",
                "settings-info-editor-minimap",
                "ai anchor",
                "right dock undock",
                "ai models all",
                "local libs search",
                "local libs no results",
                "dev tools search",
        ];

        it("exist in en-us and pt-br", () => {
                const en = JSON.parse(read("src/lang/en-us.json"));
                const pt = JSON.parse(read("src/lang/pt-br.json"));
                for (const key of KEYS) {
                        expect(en[key], `en-us: ${key}`).toBeTruthy();
                        expect(pt[key], `pt-br: ${key}`).toBeTruthy();
                }
        });
});
