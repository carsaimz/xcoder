// @vitest-environment happy-dom
/**
 * Sidebar rail-only mode — the docked-panel space exists ONLY while a
 * docked app (files, notifications, plugins…) owns it ("o espaço de apps
 * ou ferramentas só aparecer quando é escolhido que abre nele"). With
 * only windowed tools active the sidebar collapses to the icon rail, and
 * the rail shows each option title IN FRONT of its glyph.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

vi.hoisted(() => {
        localStorage.setItem("sidebarAppsLastSection", "bootNative");
});

vi.mock("components/sidebar", () => ({
        default: {
                hide: vi.fn(),
                show: vi.fn(),
                toggle: vi.fn(),
                on: vi.fn(),
                off: vi.fn(),
                setRailOnly: vi.fn(),
                setPanelTitle: vi.fn(),
        },
}));
vi.mock("fileSystem", () => ({ default: vi.fn(() => ({})) }));
vi.mock("lib/editorManager", () => ({
        default: { activeFile: null, activeEditor: null, AddEditor: vi.fn() },
}));
vi.mock("lib/ai/editorBridge", () => ({
        applyToEditor: vi.fn(() => ({ ok: true })),
}));
vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("lib/lang", () => ({ default: { code: "pt-br" } }));
vi.mock("lib/logger", () => ({
        default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("lib/settings", () => ({
        default: { value: {}, on: vi.fn(), off: vi.fn() },
}));

import tag from "html-tag-js";

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
document.body.append(window.app);
window.strings = {
        files: "Arquivos",
        "local libs": "Bibliotecas",
};
globalThis.strings = window.strings;

import sidebarApps from "sidebarApps";
import floatingWindow from "components/sidebar/floatingWindow";
import SidebarModule from "components/sidebar";

const $sidebar = tag("div", { className: "sidebar tab" });
const $apps = tag("div", { className: "app-icons-container" });
const $panel = tag("div", { className: "container" });
const $resize = tag("div", { className: "resize-bar w-resize" });
$sidebar.append($apps, $panel, $resize);
document.body.append($sidebar);
sidebarApps.init($sidebar);

beforeEach(() => {
        localStorage.setItem("sidebarFloatingWindows", "1");
        floatingWindow.setBootHold(false);
        floatingWindow.reset();
        vi.mocked(SidebarModule.hide).mockClear();
        vi.mocked(SidebarModule.setRailOnly).mockClear();
        $apps.textContent = "";
        $panel.textContent = "";
        sidebarApps.remove("toolApp");
        sidebarApps.remove("nativeApp");
        sidebarApps.remove("bootNative");
});

/** Registers a native-style (docked) app. */
function addNative(id = "nativeApp") {
        sidebarApps.add(
                "edit",
                id,
                "Files",
                (/** @type {HTMLElement} */ el) => el.classList.add("native-panel"),
                false,
                () => {},
                { titleKey: "files" },
        );
        return $apps.get(`[data-id="${id}"]`);
}

/** Registers a tool-style (floating) app. */
function addTool() {
        sidebarApps.add(
                "build",
                "toolApp",
                "Git",
                (/** @type {HTMLElement} */ el) => el.classList.add("tool-panel"),
                false,
                () => {},
                { titleKey: "git panel", floating: true },
        );
        return $apps.get('[data-id="toolApp"]');
}

describe("sidebar rail-only mode", () => {
        test("activating a floating tool collapses the sidebar to the rail", () => {
                addNative("bootNative");
                const $tool = addTool();

                $tool.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                assert.ok(
                        document.body.querySelector(".sidebar-float.show"),
                        "tool window not shown",
                );
                assert.ok(
                        vi.mocked(SidebarModule.setRailOnly).mock.calls.some(
                                ([value]) => value === true,
                        ),
                        "sidebar not collapsed to the rail for a windowed tool",
                );
        });

        test("choosing a docked app restores the full panel space", () => {
                addTool();
                const $native = addNative();
                $native.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                assert.ok($sidebar.get(".native-panel"), "panel not docked");
                assert.ok(
                        vi.mocked(SidebarModule.setRailOnly).mock.calls.some(
                                ([value]) => value === false,
                        ),
                        "sidebar not restored for a docked app",
                );
        });

        test("boot restore of a docked app never opens a window", () => {
                const $icon = addNative("bootNative");
                assert.ok($icon.classList.contains("active"), "boot app not activated");
                assert.ok($sidebar.get(".native-panel"), "panel not docked at boot");
                assert.ok(
                        !document.body.querySelector(".sidebar-float.show"),
                        "boot must not pop a window",
                );
        });

        test("undocked panel leaves an empty container (CSS collapses it)", () => {
                addNative("bootNative");
                const $tool = addTool();
                $tool.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                assert.ok(
                        !$sidebar.get(".native-panel"),
                        "docked panel should have been undocked",
                );
                // the placeholder container is empty -> matches :empty in CSS
                const $container = $sidebar.get(":scope > .container");
                assert.ok($container, "panel container missing");
                assert.equal($container.childElementCount, 0, "container not empty");
        });

        test("rail is glyphs-only; the name goes to the panel title bar", async () => {
                const $icon = addNative();
                // titles retranslate through the app's langchange listener
                document.dispatchEvent(new Event("langchange"));
                await new Promise((resolve) => setTimeout(resolve, 5));
                assert.equal(
                        $icon.get(":scope > .app-label"),
                        null,
                        "app-label must not render next to the glyph",
                );
                // activating the docked app pushes its name to the title bar
                const calls = SidebarModule.setPanelTitle?.mock?.calls ?? [];
                const last = calls.at(-1)?.[0];
                assert.equal(
                        last,
                        "Arquivos",
                        "panel title bar must show the translated app name",
                );
        });

        test("no categorized menu is mounted in the panel area anymore", () => {
                addNative();
                addTool();
                assert.ok(
                        !$sidebar.get(".sidebar-menu"),
                        "menu should be gone — the space is for docked apps only",
                );
        });
});
