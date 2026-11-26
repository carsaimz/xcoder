// @vitest-environment happy-dom
/**
 * Regression test — "opção com ícone de livro não abre nada" (v1.8.6),
 * updated for v1.8.40: the Local Libraries app is now an INDEPENDENT
 * PAGE (pages/tools/libs) instead of a sidebar app.
 *
 * The libs module renders its list in initApp() while the tool container
 * is still DETACHED (openToolPage builds the container before appending
 * the page), and render() early-returns while `$panel?.isConnected` is
 * false. openLibsPage() therefore passes onShow: render() — the first
 * page open must (re)render the list, otherwise the tool page opens
 * empty («não abre nada» again).
 *
 * The test goes through the REAL openToolPage machinery (cached
 * container + Page shell + actionStack) rendering the REAL libs module
 * under happy-dom, with a lightweight Page replacement.
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

// lightweight wc-page replacement: .main body + append/hide contract
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
	$page.classList = $page.classList;
	return $page;
};

vi.mock("components/page", () => ({ default: makePage }));
vi.mock("lib/actionStack", () => ({
	default: { push: vi.fn(), remove: vi.fn() },
}));

beforeEach(() => {
	window.app.textContent = "";
});

/** Opens the real libs page like the hub / hand-off entries do. */
async function openLibs() {
	const libs = await import("pages/tools/libs");
	return libs.openLibsPage();
}

/** The tool container lives inside the opened page. */
function $panelRoot() {
	return document.body.querySelector(".libs-root");
}

describe("libs tool page activation (book entry)", () => {
	test("first open renders the library list inside the page", async () => {
		await openLibs();

		const $root = $panelRoot();
		assert.ok($root, "libs root not rendered after opening the page");

		// THE BUG: the panel stayed empty when render early-returned while
		// detached and nothing re-rendered after the page connected
		const $list = $root.get(".libs-list");
		assert.ok($list, "library list missing after first open");

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
		await openLibs();

		const $card = $panelRoot().querySelector(".libs-card");
		$card.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		const $detail = $panelRoot().querySelector(".libs-detail");
		assert.ok($detail, "detail view missing after tapping a card");
		assert.ok(
			$panelRoot().querySelector(".libs-actions"),
			"detail view has no action buttons",
		);
	});

	test("closing and reopening the page keeps the cached container", async () => {
		const $page = await openLibs();
		assert.ok(
			document.body.querySelector(".libs-root"),
			"page did not mount",
		);

		$page.hide();
		assert.ok(
			!document.body.querySelector(".libs-root"),
			"container still connected after hide",
		);

		// reopen — the cached container (with state) is reattached
		await openLibs();
		assert.ok(
			document.body.querySelector(".libs-root"),
			"container not reattached on reopen",
		);
	});
});
