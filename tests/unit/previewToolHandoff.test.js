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
	state.registry = {};
	state.reset = () => {
		state.registry = {};
		state.get.mockImplementation((id) => state.registry[id]);
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

function makeApp() {
	const app = { active: false };
	// mimic the SidebarApp setter that opens the floating panel
	Object.defineProperty(app, "active", {
		set(value) {
			app.activated = !!value;
		},
		get() {
			return !!app.activated;
		},
	});
	return app;
}

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
		const app = makeApp();
		apps.registry.inspectorApp = app;

		await HandleIntent({
			action: "android.intent.action.MAIN",
			extras: {
				xcoder_tool: "inspector",
				xcoder_url: "http://localhost:8345/index.html",
			},
		});

		expect(inspector.openInspectorWith).toHaveBeenCalledWith(
			"http://localhost:8345/index.html",
		);
		expect(app.activated).toBe(true);
		expect(scraper.openScraperWith).not.toHaveBeenCalled();
	});

	it("opens the Scraper in rendered mode", async () => {
		const app = makeApp();
		apps.registry.scrapeApp = app;

		await HandleIntent({
			action: "android.intent.action.MAIN",
			extras: { xcoder_tool: "scrape", xcoder_url: "http://localhost:8345/" },
		});

		expect(scraper.openScraperWith).toHaveBeenCalledWith(
			"http://localhost:8345/",
			"rendered",
		);
		expect(app.activated).toBe(true);
	});

	it("opens the tool without a URL when none was handed over", async () => {
		const app = makeApp();
		apps.registry.inspectorApp = app;

		await HandleIntent({
			action: "android.intent.action.MAIN",
			extras: { xcoder_tool: "inspector" },
		});

		expect(app.activated).toBe(true);
		expect(inspector.openInspectorWith).not.toHaveBeenCalled();
	});

	it("queues the hand-off before files are restored, then drains it", async () => {
		sessionStorage.setItem("isfilesRestored", "false");
		const app = makeApp();
		apps.registry.scrapeApp = app;

		await HandleIntent({
			extras: { xcoder_tool: "scrape", xcoder_url: "https://exemplo.com" },
		});
		expect(app.activated).toBeFalsy();
		expect(scraper.openScraperWith).not.toHaveBeenCalled();

		sessionStorage.setItem("isfilesRestored", "true");
		await processPendingIntents();

		expect(scraper.openScraperWith).toHaveBeenCalledWith(
			"https://exemplo.com",
			"rendered",
		);
		expect(app.activated).toBe(true);
	});

	it("ignores intents without tool extras", async () => {
		await HandleIntent({ action: "android.intent.action.MAIN", extras: {} });

		expect(apps.get).not.toHaveBeenCalled();
		expect(inspector.openInspectorWith).not.toHaveBeenCalled();
		expect(scraper.openScraperWith).not.toHaveBeenCalled();
	});
});
