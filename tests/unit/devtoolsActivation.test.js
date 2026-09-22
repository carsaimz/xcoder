// @vitest-environment happy-dom
/**
 * Regression test — "ícone de tools não faz nada" (v1.8.x).
 *
 * The Dev Tools sidebar app builds its picker in initApp() while the
 * app container is still DETACHED, and renderPanel() early-returns
 * while `$panel?.isConnected` is false. onSelected() only scrolled the
 * (nonexistent) output — nothing ever rendered the panel on the first
 * activation, so tapping the palette icon showed an empty panel:
 * "the icon does nothing". A second bug hid inside: refresh() called
 * `gradientCSS` which was missing from the lib/webdevTools import list
 * (ReferenceError as soon as the Gradient tool rendered).
 *
 * The test goes through the REAL sidebarApps module (add() + delegated
 * click → pulseApp → setActiveApp → onSelected) rendering the REAL
 * devtools module under happy-dom.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

// --- module stubs for the heavy app dependencies ---------------------------
vi.mock("fileSystem", () => ({ default: vi.fn(() => ({})) }));
vi.mock("lib/editorManager", () => ({
        default: {
                activeEditor: null,
                AddEditor: vi.fn(),
        },
}));
vi.mock("lib/ai/editorBridge", () => ({
        applyToEditor: vi.fn(() => true),
}));
vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("lib/logger", () => ({
        default: {
                log: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn(),
                debug: vi.fn(),
        },
}));
vi.mock("lib/settings", () => ({
        default: {
                value: {},
                on: vi.fn(),
        },
}));

import tag from "html-tag-js";

// html-tag-js polyfill replica (the UMD does not import cleanly under vitest)
if (!("get" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "get", {
                value(selector) {
                        return this.querySelector(selector);
                },
                configurable: true,
                writable: true,
        });
}
if (!("getAll" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "getAll", {
                value(selector) {
                        return [...this.querySelectorAll(selector)];
                },
                configurable: true,
                writable: true,
        });
}

window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);

window.strings = {
        "dev tools": "Dev Tools",
        "dev tools shadow": "Sombra",
        "dev tools shadow desc": "Gerador de box-shadow",
        "dev tools gradient": "Gradiente",
        "dev tools gradient desc": "Gradientes CSS",
        "dev tools radius": "Border radius",
        "dev tools radius desc": "Raio das bordas",
        copy: "Copiar",
        copied: "Copiado ✓",
        insert: "Inserir",
};

// pretend another section was last active so devtools does NOT
// auto-activate when added — the test then exercises the real tap path
localStorage.setItem("sidebarAppsLastSection", "files");

import sidebarApps from "sidebarApps";

// all 18 tools registered in src/sidebarApps/devtools/index.js TOOL_LIST
const TOOL_ORDER = [
        "shadow",
        "gradient",
        "card",
        "placeholder",
        "cta",
        "section",
        "form",
        "table",
        "boilerplate",
        "json",
        "base64",
        "ids",
        "timestamp",
        "color",
        "lorem",
        "slug",
        "grid",
        "radius",
];

// minimal sidebar shell — sidebarApps.init stores both nodes
const $sidebar = tag("div", { className: "sidebar" });
const $apps = tag("div", { className: "app-icons-container" });
$sidebar.append($apps);
document.body.append($sidebar);
sidebarApps.init($sidebar);

beforeEach(() => {
        $sidebar.get(".container")?.remove?.();
        $apps.textContent = "";
        sidebarApps.remove("devtools");
});

/** Installs the real devtools app and taps its icon like pulseApp does. */
async function installAndTap() {
        const devtools = (await import("sidebarApps/devtools")).default;
        sidebarApps.add(...devtools);

        const $icon = $apps.get('[data-id="devtools"]');
        assert.ok($icon, "devtools icon missing from the sidebar");
        $icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("devtools sidebar app activation", () => {
        test("first tap on the palette icon renders the tool UI", async () => {
                await installAndTap();

                const $root = $sidebar.get(".devtools-root");
                assert.ok($root, "devtools root not attached to the sidebar");

                const $panel = $root.get(".devtools-panel");
                assert.ok($panel, "devtools panel missing");

                // THE BUG: the panel stayed empty before the fix (renderPanel
                // early-returned while detached and onSelected never rendered)
                assert.ok(
                        $panel.get(".devtools-controls"),
                        "panel has no controls after first activation",
                );
                assert.ok(
                        $panel.get(".devtools-preview"),
                        "panel has no preview after first activation",
                );
                assert.ok(
                        $panel.get(".devtools-output"),
                        "panel has no output after first activation",
                );

                // output shows the generated CSS for the default tool (shadow)
                const output = $panel.get(".devtools-output").textContent || "";
                assert.match(output, /box-shadow/, "output lacks the shadow CSS");

                // picker header is filled with the active tool title
                const title = $root.get(".devtools-tool-title").textContent;
                assert.ok(title && title.length > 0, "picker header title is empty");
        });

        test("every tool renders output without throwing", async () => {
                await installAndTap();

                for (const id of TOOL_ORDER) {
                        const $row = $sidebar.get(`.devtools-tool-item[data-tool="${id}"]`);
                        assert.ok($row, `${id} row missing from the picker`);
                        $row.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                        const $panel = $sidebar.get(".devtools-panel");
                        const output = $panel?.get(".devtools-output")?.textContent || "";
                        assert.ok(
                                output.trim().length > 0,
                                `${id} produced empty output`,
                        );
                }
        });

        test("gradient tool renders CSS (missing import regression)", async () => {
                await installAndTap();

                const $row = $sidebar.get('.devtools-tool-item[data-tool="gradient"]');
                $row.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                const output = $sidebar.get(".devtools-output").textContent || "";
                assert.match(
                        output,
                        /linear-gradient|radial-gradient|conic-gradient/,
                        "gradient CSS not rendered after switching tools",
                );
        });
});
