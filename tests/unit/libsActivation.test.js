// @vitest-environment happy-dom
/**
 * Regression test — "opção com ícone de livro não abre nada" (v1.8.6).
 *
 * The Local Libraries (Bibliotecas) sidebar app renders its list in
 * initApp() while the app container is still DETACHED, and render()
 * early-returns while `$panel?.isConnected` is false. onSelected() only
 * scrolled the panel — nothing ever rendered on the first activation,
 * so tapping the book icon showed an empty panel: "não abre nada".
 * Exactly the bug the devtools palette icon had before v1.8.3.
 *
 * The test goes through the REAL sidebarApps module (add() + delegated
 * click → pulseApp → setActiveApp → onSelected) rendering the REAL
 * libs module under happy-dom.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

// --- module stubs for the heavy app dependencies ---------------------------
vi.mock("fileSystem", () => ({ default: vi.fn(() => ({})) }));
vi.mock("lib/editorManager", () => ({
        default: {
                activeFile: null,
                activeEditor: null,
                AddEditor: vi.fn(),
        },
}));
vi.mock("lib/ai/editorBridge", () => ({
        applyToEditor: vi.fn(() => ({ ok: true })),
}));
vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("lib/lang", () => ({
        default: { code: "pt-br" },
}));
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
        "local libs": "Bibliotecas",
        "local libs all": "Todas as bibliotecas",
        "local libs copied": "Copiado para a área de transferência",
};

// pretend another section was last active so libs does NOT
// auto-activate when added — the test then exercises the real tap path
localStorage.setItem("sidebarAppsLastSection", "files");

import sidebarApps from "sidebarApps";

// minimal sidebar shell — sidebarApps.init stores both nodes
const $sidebar = tag("div", { className: "sidebar" });
const $apps = tag("div", { className: "app-icons-container" });
$sidebar.append($apps);
document.body.append($sidebar);
sidebarApps.init($sidebar);

beforeEach(() => {
        $sidebar.get(".container")?.remove?.();
        $apps.textContent = "";
        sidebarApps.remove("libs");
});

/** Installs the real libs app and taps its icon like pulseApp does. */
async function installAndTap() {
        const libs = (await import("sidebarApps/libs")).default;
        sidebarApps.add(...libs);

        const $icon = $apps.get('[data-id="libs"]');
        assert.ok($icon, "libs icon missing from the sidebar");
        $icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("libs sidebar app activation (book icon)", () => {
        test("first tap on the book icon renders the library list", async () => {
                await installAndTap();

                const $root = $sidebar.get(".libs-root");
                assert.ok($root, "libs root not attached to the sidebar");

                // THE BUG: the panel stayed empty before the fix (render
                // early-returned while detached and onSelected never rendered)
                const $list = $root.get(".libs-list");
                assert.ok($list, "library list missing after first activation");

                const cards = $list.getAll(".libs-card");
                assert.ok(
                        cards.length > 0,
                        "library list rendered zero cards — panel is empty",
                );

                // the bundled registry ships htmx, Alpine, jQuery, Bootstrap…
                const names = cards.map(($c) => $c.get(".libs-name")?.textContent);
                assert.ok(names.includes("htmx"), "htmx card missing from the list");
        });

        test("opening a card shows the detail view with actions", async () => {
                await installAndTap();

                const $card = $sidebar.get(".libs-card");
                $card.dispatchEvent(new MouseEvent("click", { bubbles: true }));

                const $detail = $sidebar.get(".libs-detail");
                assert.ok($detail, "detail view missing after tapping a card");
                assert.ok(
                        $sidebar.get(".libs-actions"),
                        "detail view has no action buttons",
                );
        });
});
