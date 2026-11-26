// @vitest-environment happy-dom
/**
 * v1.8.40 — tools are INDEPENDENT FULL-SCREEN PAGES.
 *
 * Root cause of «só analisa e retorna 200, mas nada aparece»: the tools
 * lived behind the sidebar rail → floating window → bootHold chain. A
 * boot restore could mark a floating app active while its window was
 * never opened, and the SidebarApp active-setter early-returned on
 * re-activation — so fetches ran with HTTP 200 into a container that
 * was never in the document. Pages remove that entire class of failure.
 *
 * These tests pin the new contract:
 *   1. openAnalyzerWith builds and connects the page SYNCHRONOUSLY (no
 *      polling loop), the input exists immediately
 *   2. the page + actionStack entry + cached container behave like the
 *      Problems page (back button, reopen keeps state)
 *   3. the sidebar registry no longer registers the tool apps
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

window.tag = tag;
// html-tag-js polyfill replica: `el.content = x` REPLACES the element's
// children (the tool apps build their UI through it)
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
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
window.strings = { analyzer: "Analisador de Sites" };
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

describe("independent tool pages", () => {
	test("openAnalyzerWith connects the page synchronously (input ready)", async () => {
		const analyzer = await import("pages/tools/analyzer");

		// hand-off with an unreachable URL: the fetch will fail, but the
		// PAGE MUST BE IN THE DOCUMENT before any await happens
		let pageConnectedBeforeFetch = false;
		await analyzer.openAnalyzerWith("https://exemplo.invalid");
		pageConnectedBeforeFetch = Boolean(
			window.app.querySelector(".wc-page-fake .ana-app"),
		);

		assert.ok(
			pageConnectedBeforeFetch,
			"analyzer container not connected after openAnalyzerWith",
		);
		assert.ok(
			pushed.some((entry) => entry.id === "analyzer-page"),
			"actionStack back-button entry missing",
		);
	});

	test("the analyzer page renders the input, tabs and panels", async () => {
		const analyzer = await import("pages/tools/analyzer");
		analyzer.openAnalyzerPage();

		const $root = window.app.querySelector(".ana-app");
		assert.ok($root, "analyzer root missing");
		assert.ok($root.querySelector(".scr-url.ana-url"), "url input missing");
		assert.ok($root.querySelector(".scr-tabs"), "tabs missing");
		assert.ok(
			$root.querySelector('[data-panel="tech"]:not(.hidden)'),
			"tech panel should start visible",
		);
	});

	test("closing the page keeps the cached state for the next open", async () => {
		const { openAnalyzerPage } = await import("pages/tools/analyzer");

		const $fresh = await import("pages/tools/analyzer");
		$fresh.openAnalyzerPage();
		const $page = window.app.querySelector(".wc-page-fake");
		assert.ok($page, "page not in the document before hide");
		$page.hide();

		assert.ok(
			!window.app.querySelector(".ana-app"),
			"container still connected after hide",
		);
		assert.ok(
			!pushed.some((entry) => entry.id === "analyzer-page"),
			"actionStack entry not removed on hide",
		);

		// reopen — same container comes back with its UI intact
		openAnalyzerPage();
		const $root = window.app.querySelector(".ana-app");
		assert.ok($root, "cached container not reattached");
		assert.ok($root.querySelector(".scr-url.ana-url"), "state lost on reopen");
	});

	test("sidebar registry no longer registers the tool apps", async () => {
		const fs = await import("node:fs");
		const source = fs.readFileSync("src/sidebarApps/index.js", "utf8");
		for (const tool of [
			"repl",
			"inspector",
			"scrape",
			"analyzer",
			"libs",
			"learn",
			"websiteApp",
		]) {
			expect(source).not.toContain(`["${tool}", () => import("./${tool.replace("App", "")})"]`);
		}
		// the ONLY tool left in the sidebar is webdev (devtools)
		expect(source).toContain('["devtools", () => import("./devtools")]');
	});

	test("tools hub exposes every independent tool", async () => {
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
		]) {
			expect(hub).toContain(opener);
		}
	});
});
