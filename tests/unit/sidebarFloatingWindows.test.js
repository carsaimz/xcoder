// @vitest-environment happy-dom
/**
 * Floating sidebar windows — panels open as independent windows above
 * the editor ("após sidebar abrissem como janelas independentes de
 * sidebar"), with tap-again-to-close, category captions and icon labels.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

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
window.strings = { "local libs": "Bibliotecas" };
globalThis.strings = window.strings;

localStorage.setItem("sidebarAppsLastSection", "files");

import sidebarApps from "sidebarApps";
import floatingWindow from "components/sidebar/floatingWindow";

const $sidebar = tag("div", { className: "sidebar" });
const $apps = tag("div", { className: "app-icons-container" });
$sidebar.append($apps);
document.body.append($sidebar);
sidebarApps.init($apps.parentElement || $sidebar);

beforeEach(() => {
	localStorage.setItem("sidebarFloatingWindows", "1");
	floatingWindow.setBootHold(false);
	floatingWindow.reset();
	$sidebar.get(".container")?.remove?.();
	$apps.textContent = "";
	sidebarApps.remove("libs");
});

async function installLibs() {
	const libs = (await import("sidebarApps/libs")).default;
	sidebarApps.add(...libs);
	return $apps.get('[data-id="libs"]');
}

describe("floating sidebar windows", () => {
	test("tapping an icon opens an independent window with the panel", async () => {
		const $icon = await installLibs();
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const $win = document.body.querySelector(".sidebar-float");
		assert.ok($win, "floating window missing from the document");
		assert.ok($win.classList.contains("show"), "window not shown");
		assert.equal($win.dataset.app, "libs");
		assert.equal(
			$win.get(".sidebar-float-title").textContent,
			"Bibliotecas",
			"window header lacks the app title",
		);
		// the panel content rendered inside the window body
		assert.ok(
			$win.get(".sidebar-float-body .libs-root"),
			"panel container not moved into the window",
		);
	});

	test("tapping the same icon again closes the window", async () => {
		const $icon = await installLibs();
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.ok(floatingWindow.isOpenFor("libs"));

		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.ok(
			!document.body.querySelector(".sidebar-float.show"),
			"window still shown after second tap",
		);
	});

	test("the close button deactivates the app and clears the section", async () => {
		const $icon = await installLibs();
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		const $close = document.body.querySelector(".sidebar-float-close");
		assert.ok($close, "close button missing");

		$close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.ok(
			!document.body.querySelector(".sidebar-float.show"),
			"window still shown after close",
		);
		// the icon is no longer active
		assert.ok(!$icon.classList.contains("active"), "icon still active");
		assert.equal(
			localStorage.getItem("sidebarAppsLastSection"),
			null,
			"last-section not cleared",
		);
	});

	test("dock mode (setting off) keeps the classic panel", async () => {
		localStorage.setItem("sidebarFloatingWindows", "0");
		const $icon = await installLibs();
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		assert.ok(
			!document.body.querySelector(".sidebar-float.show"),
			"window opened in dock mode",
		);
		assert.ok(
			$sidebar.get(".container .libs-root") || $sidebar.get(".libs-root"),
			"docked panel missing",
		);
	});

	test("icon labels are rendered and captions categorize the groups", async () => {
		const $icon = await installLibs();
		const $label = $icon.querySelector(":scope > .app-label");
		assert.ok($label, "app-label missing from the icon");
		assert.equal($label.textContent, "Bibliotecas");

		assert.ok(
			$apps.classList.contains("with-labels"),
			"with-labels class not applied",
		);
		const $group = $icon.closest(".apps-group");
		assert.ok($group, "icon outside a group");
		assert.ok(
			$group.dataset.label?.length > 0,
			"group has no category caption",
		);
	});
});
