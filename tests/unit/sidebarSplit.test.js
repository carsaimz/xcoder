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
		setRailOnly: vi.fn(),
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

/** Fires the listeners registered on the Sidebar "show" event (same path as the sidebar "show" event). */
function fireShow() {
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
	vi.mocked(SidebarModule.setRailOnly).mockClear();
	$apps.textContent = "";
	sidebarApps.remove("toolApp");
	sidebarApps.remove("nativeApp");
	sidebarApps.remove("bootNative");
	fireShow();
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
		// the docked panel owns the panel space — rail-only must be off
		assert.ok(
			vi.mocked(SidebarModule.setRailOnly).mock.calls.some(
				([value]) => value === false,
			),
			"rail-only not disabled for a docked app",
		);
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
		// the freed space collapses the sidebar to the rail
		assert.ok(
			vi.mocked(SidebarModule.setRailOnly).mock.calls.some(
				([value]) => value === true,
			),
			"sidebar not collapsed after the tool took over",
		);
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

	test("rail badges stay on the rail icons", () => {
		addTool();
		const $icon = addNative();

		assert.ok(sidebarApps.setBadge("nativeApp", 3), "setBadge failed");
		assert.equal(
			$icon.get(":scope > .app-badge")?.textContent,
			"3",
			"rail badge missing",
		);
		sidebarApps.setBadge("nativeApp", null);
		assert.ok(!$icon.get(":scope > .app-badge"), "badge not cleared");
	});
});
