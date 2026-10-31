// @vitest-environment happy-dom
/**
 * Sidebar menu — with floating windows the docked-panel area of the
 * sidebar stays empty, so it now hosts the option titles grouped by
 * category ("usar o lugar para títulos de opções e categorias").
 * Rows open the app's floating window; rail badges mirror into the rows.
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
window.strings = {
	"local libs": "Bibliotecas",
	"sidebar menu title": "Painéis",
	"sidebar menu hint": "Toque para abrir numa janela",
	"sidebar group primary": "Vistas",
	"sidebar group tools": "Ferramentas",
	"sidebar group bottom": "Conta",
};
globalThis.strings = window.strings;

import sidebarApps from "sidebarApps";
import floatingWindow from "components/sidebar/floatingWindow";

const $sidebar = tag("div", { className: "sidebar tab" });
const $apps = tag("div", { className: "app-icons-container" });
const $container = tag("div", { className: "container" });
const $resize = tag("div", { className: "resize-bar w-resize" });
$sidebar.append($apps, $container, $resize);
document.body.append($sidebar);
sidebarApps.init($sidebar);

beforeEach(() => {
	localStorage.setItem("sidebarFloatingWindows", "1");
	floatingWindow.setBootHold(false);
	floatingWindow.reset();
	$apps.textContent = "";
	$container.textContent = "";
	sidebarApps.remove("libs");
	// re-mount the menu after the previous test may have replaced things
	floatingWindow.setBootHold(true);
	floatingWindow.setBootHold(false);
});

async function installLibs() {
	const libs = (await import("sidebarApps/libs")).default;
	sidebarApps.add(...libs);
	return $apps.get('[data-id="libs"]');
}

describe("sidebar menu (categorized option titles)", () => {
	test("floating mode mounts the menu inside the freed panel area", async () => {
		await installLibs();
		const $menu = $sidebar.get(".sidebar-menu");
		assert.ok($menu, "menu not mounted in floating mode");
		// the menu is a sibling inserted before the panel container, which
		// the CSS hides while the menu is mounted (& ~ .container)
		assert.ok(
			$menu.parentElement === $sidebar && $menu.nextElementSibling === $container,
			"menu not placed in the freed panel area",
		);

		// only sections with registered apps get a caption (libs = tools)
		const captions = [...$menu.getAll(".sidebar-menu-caption")].map(
			($c) => $c.textContent,
		);
		assert.ok(captions.includes("Ferramentas"), "tools caption missing");
		assert.ok(!captions.includes("Vistas"), "empty primary section rendered");
		assert.ok(!captions.includes("Conta"), "empty bottom section rendered");

		// the libs row carries the app name
		const $row = $menu.get('.sidebar-menu-item[data-id="libs"]');
		assert.ok($row, "libs row missing");
		assert.equal(
			$row.get(".sidebar-menu-name")?.textContent,
			"Bibliotecas",
			"row name mismatch",
		);
	});

	test("tapping a menu row opens the floating window", async () => {
		await installLibs();
		const $row = $sidebar.get('.sidebar-menu .sidebar-menu-item[data-id="libs"]');
		assert.ok($row, "libs row missing");
		$row.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const $win = document.body.querySelector(".sidebar-float");
		assert.ok($win?.classList.contains("show"), "window not shown");
		assert.equal($win.dataset.app, "libs");
	});

	test("rail badges mirror into the matching menu row", async () => {
		await installLibs();
		const $row = $sidebar.get('.sidebar-menu .sidebar-menu-item[data-id="libs"]');

		assert.ok(sidebarApps.setBadge("libs", 3), "setBadge failed");
		assert.equal($row.get(".app-badge")?.textContent, "3", "badge not mirrored");

		sidebarApps.setBadge("libs", 120);
		assert.equal($row.get(".app-badge")?.textContent, "99+", "99+ cap missing");

		sidebarApps.setBadge("libs", null);
		assert.ok(!$row.get(".app-badge"), "badge not cleared");
	});

	test("langchange re-renders the menu titles", async () => {
		await installLibs();
		const $row = $sidebar.get('.sidebar-menu .sidebar-menu-item[data-id="libs"]');
		assert.equal($row.get(".sidebar-menu-name")?.textContent, "Bibliotecas");

		window.strings["local libs"] = "Libraries";
		document.dispatchEvent(new Event("langchange"));
		// the rebuild runs on a macrotask, after the per-app listeners
		await new Promise((resolve) => setTimeout(resolve, 5));

		const $rowAfter = $sidebar.get(
			'.sidebar-menu .sidebar-menu-item[data-id="libs"]',
		);
		assert.equal(
			$rowAfter.get(".sidebar-menu-name")?.textContent,
			"Libraries",
			"menu not retranslated",
		);
		window.strings["local libs"] = "Bibliotecas";
	});

	test("dock mode unmounts the menu (classic panel takes the area)", async () => {
		await installLibs();
		assert.ok($sidebar.get(".sidebar-menu"), "menu missing in floating mode");

		localStorage.setItem("sidebarFloatingWindows", "0");
		const $icon = $apps.get('[data-id="libs"]');
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		assert.ok(
			!$sidebar.get(".sidebar-menu"),
			"menu still mounted in dock mode",
		);
		// the classic panel docked into the sidebar
		assert.ok(
			$sidebar.get(".container .libs-root") || $sidebar.get(".libs-root"),
			"docked panel missing",
		);
	});
});
