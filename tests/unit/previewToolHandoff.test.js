// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fileSystem", () => ({ default: vi.fn() }));
vi.mock("lib/config", () => ({ default: {} }));
vi.mock("lib/openFile", () => ({ default: vi.fn(async () => {}) }));
vi.mock("utils/helpers", () => ({
	default: { error: vi.fn() },
}));

const apps = vi.hoisted(() => {
	const state = { apps: {} };
	state.get = vi.fn((id) => state.apps[id]);
	state.setActiveApp = vi.fn(() => {});
	state.registry = {};
	state.reset = () => {
		state.registry = {};
		state.get.mockImplementation((id) => state.registry[id]);
		state.setActiveApp.mockClear();
	};
	return state;
});

vi.mock("sidebarApps", () => ({ default: apps }));

const inspector = vi.hoisted(() => ({ openInspectorWith: vi.fn(async () => {}) }));
const scraper = vi.hoisted(() => ({ openScraperWith: vi.fn(async () => {}) }));

vi.mock("sidebarApps/inspector", () => inspector);
vi.mock("sidebarApps/scrape", () => scraper);

const { default: HandleIntent, processPendingIntents } = await import(
	"handlers/intent"
);

describe("preview tool hand-off intents", () => {
	beforeEach(() => {
		sessionStorage.setItem("isfilesRestored", "true");
		apps.reset();
	});

	afterEach(() => {
		sessionStorage.removeItem("isfilesRestored");
		vi.clearAllMocks();
	});

	it("opens the Inspector with the previewed URL", async () => {
		await HandleIntent({
			action: "android.intent.action.MAIN",
			extras: {
				xcoder_tool: "inspector",
				xcoder_url: "http://localhost:8345/index.html",
			},
		});

		// the tool panel is activated (SidebarApp.active, via setActiveApp)
		expect(apps.setActiveApp).toHaveBeenCalledWith("inspectorApp");
		expect(inspector.openInspectorWith).toHaveBeenCalledWith(
			"http://localhost:8345/index.html",
		);
		expect(scraper.openScraperWith).not.toHaveBeenCalled();
	});

	it("opens the Scraper in rendered mode", async () => {
		await HandleIntent({
			action: "android.intent.action.MAIN",
			extras: { xcoder_tool: "scrape", xcoder_url: "http://localhost:8345/" },
		});

		expect(apps.setActiveApp).toHaveBeenCalledWith("scrapeApp");
		expect(scraper.openScraperWith).toHaveBeenCalledWith(
			"http://localhost:8345/",
			"rendered",
		);
	});

	it("opens the tool without a URL when none was handed over", async () => {
		await HandleIntent({
			action: "android.intent.action.MAIN",
			extras: { xcoder_tool: "inspector" },
		});

		expect(apps.setActiveApp).toHaveBeenCalledWith("inspectorApp");
		expect(inspector.openInspectorWith).not.toHaveBeenCalled();
	});

	it("queues the hand-off before files are restored, then drains it", async () => {
		sessionStorage.setItem("isfilesRestored", "false");

		await HandleIntent({
			extras: { xcoder_tool: "scrape", xcoder_url: "https://exemplo.com" },
		});
		expect(apps.setActiveApp).not.toHaveBeenCalled();
		expect(scraper.openScraperWith).not.toHaveBeenCalled();

		sessionStorage.setItem("isfilesRestored", "true");
		await processPendingIntents();

		expect(apps.setActiveApp).toHaveBeenCalledWith("scrapeApp");
		expect(scraper.openScraperWith).toHaveBeenCalledWith(
			"https://exemplo.com",
			"rendered",
		);
	});

	it("ignores intents without tool extras", async () => {
		await HandleIntent({ action: "android.intent.action.MAIN", extras: {} });

		expect(apps.setActiveApp).not.toHaveBeenCalled();
		expect(inspector.openInspectorWith).not.toHaveBeenCalled();
		expect(scraper.openScraperWith).not.toHaveBeenCalled();
	});
});
