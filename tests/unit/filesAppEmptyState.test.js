// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	sidebar: { on: vi.fn() },
	settings: { value: {}, OPEN_FILE_LIST_POS_SIDEBAR: "sidebar" },
}));

vi.mock("components/sidebar", () => ({ default: mocks.sidebar }));
vi.mock("lib/settings", () => ({ default: mocks.settings }));
vi.mock("lib/fileIcons", () => ({
	default: { refreshRenderedIcons: vi.fn() },
}));

describe("files app — explorer empty state", () => {
	let container;
	let editorManager;
	let welcomeOpener;

	beforeEach(async () => {
		document.body.innerHTML = "";
		welcomeOpener = vi.fn();
		vi.doMock("pages/welcome", () => ({
			default: welcomeOpener,
		}));
		vi.stubGlobal("strings", {
			files: "Files",
			"open folder": "Open folder",
			"explorer title": "Explorer",
			"explorer empty title": "No folder opened",
			"explorer empty desc": "Open a project folder to start working.",
		});
		editorManager = {
			files: [],
			on: vi.fn(),
			getFile: vi.fn(() => null),
		};
		vi.stubGlobal("editorManager", editorManager);
		vi.stubGlobal("xcoder", { exec: vi.fn() });

		const { default: filesApp } = await import(
			"../../src/sidebarApps/files/index.js"
		);
		container = document.createElement("div");
		container.get = (selector) => container.querySelector(selector);
		container.getAll = (selector) =>
			Array.from(container.querySelectorAll(selector));
		const init = filesApp[3];
		init(container);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.doUnmock("pages/welcome");
		vi.resetModules();
	});

	const emitFolderEvent = (type, payload = { url: "file:///p" }) => {
		const call = editorManager.on.mock.calls.find(
			([events]) =>
				events === type ||
				(Array.isArray(events) && events.includes(type)),
		);
		call?.[1]?.(payload);
	};

	it("shows the empty state with an Open Folder button when no project is open", () => {
		const empty = container.querySelector(":scope > .explorer-empty");
		expect(empty).toBeTruthy();
		expect(empty.textContent).toContain("No folder opened");
		const button = empty.querySelector(".explorer-empty-btn");
		expect(button?.textContent).toBe("Open folder");

		button.click();
		expect(xcoder.exec).toHaveBeenCalledWith("open-folder");
	});

	it("hides the empty state while a project is open", () => {
		container.innerHTML =
			'<div class="list collapsible"><div class="tile" data-type="root"></div></div>';

		emitFolderEvent("add-folder");

		expect(
			container.querySelector(":scope > .explorer-empty"),
		).toBeNull();
	});

	it("brings the empty state back after the last project closes", () => {
		container.innerHTML =
			'<div class="list collapsible"><div class="tile" data-type="root"></div></div>';
		emitFolderEvent("add-folder");
		expect(container.querySelector(".explorer-empty")).toBeNull();

		container.innerHTML = "";
		emitFolderEvent("remove-folder");

		expect(
			container.querySelector(":scope > .explorer-empty"),
		).toBeTruthy();
	});

	it("reopens the Welcome tab when the last project closes with no files", async () => {
		container.innerHTML =
			'<div class="list collapsible"><div class="tile" data-type="root"></div></div>';
		editorManager.files = [];

		container.innerHTML = "";
		emitFolderEvent("remove-folder");
		// dynamic import inside the handler resolves on a later microtask
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(welcomeOpener).toHaveBeenCalledTimes(1);
	});

	it("does not reopen the Welcome tab while editor files are open", async () => {
		container.innerHTML = "";
		editorManager.files = [{ id: "f1" }];

		emitFolderEvent("remove-folder");
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(welcomeOpener).not.toHaveBeenCalled();
	});
});
