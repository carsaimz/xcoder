// @vitest-environment happy-dom
/**
 * Sidebar split — native Acode apps (files, plugins, notifications,
 * search) open inline in the sidebar again ("apps sidebar nativos de
 * Acode podem abrirem no sidebar mesmo"), while implemented tools
 * (git, AI, libs, dev tools…) keep opening as independent floating
 * windows. Switching modes hands the sidebar area over: a docked panel
 * replaces the categorized menu, a floating window restores it.
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
	"sidebar menu title": "Painéis",
	"sidebar menu hint": "Toque para abrir",
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

/** Re-mounts the categorized menu (same path as the sidebar "show" event). */
function remountMenu() {
	for (const call of vi.mocked(SidebarModule.on).mock.calls) {
		const [event, callback] = call;
		if (event === "show") callback?.();
	}
}

beforeEach(() => {
	localStorage.setItem("sidebarFloatingWindows", "1");
	floatingWindow.setBootHold(false);
	floatingWindow.reset();
	vi.mocked(SidebarModule.hide).mockClear();
	$apps.textContent = "";
	sidebarApps.remove("toolApp");
	sidebarApps.remove("nativeApp");
	sidebarApps.remove("bootNative");
	remountMenu();
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

describe("sidebar split (native inline / tools floating)", () => {
	test("docked native app restores its panel at boot in floating mode", () => {
		const $icon = addNative("bootNative");
		assert.ok($icon.classList.contains("active"), "boot app not activated");
		assert.ok(
			$sidebar.get(".native-panel"),
			"native panel not docked at boot",
		);
		assert.ok(
			!document.body.querySelector(".sidebar-float.show"),
			"boot must not pop a window",
		);
	});

	test("tapping a native app docks the panel inside the sidebar", () => {
		addTool(); // first add swallows the null currentSection
		const $icon = addNative();
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		assert.ok(
			$sidebar.get(".native-panel"),
			"native panel not docked",
		);
		assert.ok(
			!document.body.querySelector(".sidebar-float.show"),
			"native app must not open a window",
		);
		// a docked panel takes the whole area — the menu goes away
		assert.ok(!$sidebar.get(".sidebar-menu"), "menu still mounted");
	});

	test("tapping a tool opens the window and the docked panel yields", () => {
		const $tool = addTool();
		const $native = addNative();
		$native.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		$tool.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const $win = document.body.querySelector(".sidebar-float");
		assert.ok($win?.classList.contains("show"), "tool window not shown");
		assert.equal($win.dataset.app, "toolApp");
		assert.ok(
			$win.get(".sidebar-float-body .tool-panel"),
			"tool panel not moved into the window",
		);
		// the native panel gave its place back to the sidebar
		assert.ok(!$sidebar.get(".native-panel"), "native panel still docked");
		// float mode keeps the categorized menu visible
		assert.ok($sidebar.get(".sidebar-menu"), "menu missing in float mode");
	});

	test("tapping a docked app while a window is open drops the window", () => {
		const $tool = addTool();
		const $native = addNative();
		$tool.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.ok(
			document.body.querySelector(".sidebar-float.show"),
			"window missing before switch",
		);

		$native.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		assert.ok(
			!document.body.querySelector(".sidebar-float.show"),
			"window kept open after docking a native app",
		);
		assert.ok($sidebar.get(".native-panel"), "panel not docked");
	});

	test("tapping the active docked icon hides the sidebar (classic toggle)", async () => {
		addTool();
		const $icon = addNative();
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		$icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		// hideSidebar resolves through a dynamic import — let it land
		await new Promise((resolve) => setTimeout(resolve, 0));

		assert.ok(
			vi.mocked(SidebarModule.hide).mock.calls.length > 0,
			"sidebar was not hidden on the second tap",
		);
		// the panel stays docked and active — reopening shows it again
		assert.ok($icon.classList.contains("active"), "app lost active state");
		assert.ok($sidebar.get(".native-panel"), "panel undocked");
	});

	test("menu affordance differs per mode (window vs panel)", () => {
		addTool();
		addNative();
		const $menu = $sidebar.get(".sidebar-menu");
		assert.ok($menu, "menu not mounted");

		const $toolRow = $menu.get('.sidebar-menu-item[data-id="toolApp"]');
		const $nativeRow = $menu.get('.sidebar-menu-item[data-id="nativeApp"]');
		assert.ok($toolRow?.get(".open_in_new"), "tool row lacks window affordance");
		assert.ok(
			$nativeRow?.get(".chevron_right"),
			"native row lacks panel affordance",
		);
	});
});
