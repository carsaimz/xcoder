// @vitest-environment happy-dom
/**
 * v1.8.42 — Scraper / Inspector / Analyzer REMOVED (user: "não funcionam,
 * não importa o que faça, nunca funcionaram").
 *
 * Pins the removal contract:
 *   1. the three tool pages, their hub entries, the intent hand-off and
 *      the native preview menu items are all gone
 *   2. openToolPage still guarantees the page-caching contract (the
 *      bullet-proof shell the remaining pages share)
 */
import assert from "node:assert/strict";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("fileSystem", () => ({ default: vi.fn(() => ({})) }));
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
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, "content")) {
        Object.defineProperty(HTMLElement.prototype, "content", {
                set(value) {
                        this.innerHTML = "";
                        if (!Array.isArray(value)) value = [value];
                        for (const child of value) {
                                if (child) this.append(child);
                        }
                },
                get() {
                        const children = [...this.children];
                        return children.length === 0
                                ? null
                                : children.length === 1
                                        ? children[0]
                                        : children;
                },
                configurable: true,
        });
}
window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
window.strings = {};
globalThis.strings = window.strings;

const pushed = [];
vi.mock("lib/actionStack", () => ({
        default: {
                push: (entry) => pushed.push(entry),
                remove: (id) => {
                        const i = pushed.findIndex((e) => e.id === id);
                        if (i >= 0) pushed.splice(i, 1);
                },
        },
}));

const makePage = (title) => {
        const $page = tag("div", { className: "wc-page-fake" });
        const $main = tag("div", { className: "main" });
        $page.append($main);
        const appendBody = (...$els) => {
                for (const $el of $els) $main.append($el);
        };
        $page.appendBody = appendBody;
        $page.append = appendBody;
        $page.hide = () => {
                if (typeof $page.onhide === "function") $page.onhide();
                $page.remove();
        };
        return $page;
};
vi.mock("components/page", () => ({ default: makePage }));

beforeEach(() => {
        window.app.textContent = "";
        pushed.length = 0;
});

describe("openToolPage caching contract", () => {
        test("builds and connects synchronously, caches the container", async () => {
                const { openToolPage } = await import("pages/tools/toolPage");

                let built = 0;
                const open = () =>
                        openToolPage({
                                id: "fake-page",
                                titleKey: "fake",
                                title: "Fake",
                                build($container) {
                                        built += 1;
                                        $container.append(tag("div", { className: "fake-tool" }));
                                },
                        });

                const $page = open();
                assert.ok(window.app.querySelector(".fake-tool"), "not connected");
                assert.ok(built === 1, "built more than once");
                assert.ok(
                        pushed.some((entry) => entry.id === "fake-page"),
                        "actionStack entry missing",
                );

                // reopening while open never stacks a second page
                open();
                assert.ok(built === 1, "second build while open");
                assert.ok(window.app.querySelectorAll(".wc-page-fake").length === 1);

                // closing keeps the cached container for the next open
                $page.hide();
                assert.ok(!window.app.querySelector(".fake-tool"));
                assert.ok(!pushed.some((entry) => entry.id === "fake-page"));

                open();
                assert.ok(built === 1, "container rebuilt instead of reused");
                assert.ok(window.app.querySelector(".fake-tool"), "state lost on reopen");
        });
});

describe("structural restoration contract (v1.8.45)", () => {
        test("internal tools are back: pages, hub, hand-off and preview menu", async () => {
                const fs = await import("node:fs");
                // the intent hand-off carries the native preview URL to the tool pages
                const intent = fs.readFileSync("src/handlers/intent.js", "utf8");
                expect(intent).toContain("pages/tools/scrape");
                expect(intent).toContain("pages/tools/inspector");
                expect(intent).toContain("pages/tools/analyzer");
                expect(intent).toContain("TOOL_APPS");
                expect(intent).toContain("xcoder_tool");
                expect(intent).toContain("pendingTools");

                // the native preview menu hands the URL over
                const browser = fs.readFileSync(
                        "src/plugins/browser/android/com/xcoder/browser/Browser.java",
                        "utf8",
                );
                expect(browser).toContain('"Inspect"');
                expect(browser).toContain('"Scrape"');
                expect(browser).toContain('"Analyze"');
                // SEO audit stays
                expect(browser).toContain('"SEO"');

                // the AI chat keeps its v1.8.42 cleanup (no scraper shortcut there)
                const chat = fs.readFileSync("src/sidebarApps/ai/index.js", "utf8");
                expect(chat).not.toContain("openChatUrlInScraper");

                // the Learn catalog keeps its v1.8.42 cleanup too
                const learn = fs.readFileSync("src/pages/tools/learn/index.js", "utf8");
                expect(learn).not.toContain("openInScraper");
        });

        test("tools hub lists every restored tool plus the webdev page", async () => {
                const fs = await import("node:fs");
                const hub = fs.readFileSync("src/pages/tools/hub.js", "utf8");
                for (const opener of [
                        "openAnalyzerPage",
                        "openInspectorPage",
                        "openScraperPage",
                        "openLearnPage",
                        "openLibsPage",
                        "openReplPage",
                        "openWebsitePage",
                        "openWebdevPage",
                ]) {
                        expect(hub).toContain(opener);
                }
        });
});
