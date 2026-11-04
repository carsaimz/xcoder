// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v1.8.16 — VS Code structure deepening (user: "Continue com melhorias"):
 *  - view title actions in the sidebar panel title bar (Explorer parity)
 *  - files app: new file / new folder / refresh / collapse-all actions
 *  - Quick Open fuzzy ranking with matched-character highlight
 *  - local file timeline: snapshot on save + restore page + settings toggle
 *  - prefers-reduced-motion global kill switch
 */

const read = (p) => readFileSync(resolve(__dirname, "../../", p), "utf8");

vi.mock("components/sidebar", () => ({
	default: {
		show: vi.fn(),
		hide: vi.fn(),
		toggle: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		setRailOnly: vi.fn(),
	},
}));
vi.mock("components/rightDock", () => ({
	default: {
		show: vi.fn(),
		reset: vi.fn(),
		close: vi.fn(),
		isOpenFor: vi.fn(() => false),
		setPref: vi.fn(),
		prefEnabled: vi.fn(() => false),
		activeWindowId: vi.fn(() => null),
	},
}));
vi.mock("components/sidebar/floatingWindow", () => ({
	default: {
		floatingEnabled: vi.fn(() => false),
		avoidSidebar: vi.fn(),
		activeWindowId: vi.fn(() => null),
		reset: vi.fn(),
		close: vi.fn(),
		isOpenFor: vi.fn(() => false),
		isMinimized: vi.fn(() => false),
		toggleMinimize: vi.fn(),
	},
}));
vi.mock("utils/svgIcons", () => ({
	default: vi.fn(() => document.createElementNS("http://www.w3.org/2000/svg", "svg")),
	hasIcon: vi.fn(() => true),
	iconNames: [],
}));

import SidebarApp from "sidebarApps/sidebarApp";

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

describe("SidebarApp.titleActions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a static array as-is", () => {
		const actions = [{ icon: "plus", onclick: () => {} }];
		const app = new SidebarApp("svg:files", "files", "Files", () => {}, () => {}, {
			titleActions: actions,
		});
		expect(app.titleActions).toBe(actions);
	});

	it("calls a factory on every read (language-change safe)", () => {
		let calls = 0;
		const app = new SidebarApp("svg:files", "files", "Files", () => {}, () => {}, {
			titleActions: () => {
				calls++;
				return [{ icon: "plus", onclick: () => {} }];
			},
		});
		app.titleActions;
		app.titleActions;
		expect(calls).toBe(2);
	});

	it("degrades to [] when the factory throws", () => {
		const app = new SidebarApp("svg:files", "files", "Files", () => {}, () => {}, {
			titleActions: () => {
				throw new Error("boom");
			},
		});
		expect(app.titleActions).toEqual([]);
	});

	it("returns [] when no actions are registered", () => {
		const app = new SidebarApp("svg:files", "files", "Files", () => {}, () => {}, {});
		expect(app.titleActions).toEqual([]);
	});
});

describe("panel title actions wiring", () => {
	it("sidebar renders title text + action containers", () => {
		const src = read("src/components/sidebar/index.js");
		expect(src).toContain('className="panel-title-text"');
		expect(src).toContain('className="panel-title-actions"');
		expect(src).toContain("function setPanelTitle(title, actions)");
		expect(src).toContain("panel-title-action xc-svgicon");
	});

	it("registry passes app actions to the title bar", () => {
		const src = read("src/sidebarApps/index.js");
		expect(src).toContain("app.titleActions");
		expect(src).toContain('floatMode ? [] : app.titleActions');
	});

	it("files app registers explorer title actions", () => {
		const src = read("src/sidebarApps/files/index.js");
		expect(src).toContain("titleActions: getTitleActions");
		expect(src).toContain('icon: "file-plus"');
		expect(src).toContain('icon: "folder-plus"');
		expect(src).toContain('icon: "refresh-cw"');
		expect(src).toContain('icon: "chevrons-down"');
	});

	it("svg icon pack ships the new action glyphs", () => {
		const src = read("src/utils/svgIcons.js");
		expect(src).toContain('"folder-plus"');
		expect(src).toContain('"chevrons-down"');
		expect(src).toContain("history:");
	});
});

describe("quick open fuzzy", () => {
	it("findFile palette ranks candidates fuzzily", () => {
		const src = read("src/palettes/findFile/index.js");
		expect(src).toContain('from "utils/fuzzyMatch"');
		expect(src).toContain("rankCandidates(candidates, query, 50)");
		expect(src).toContain("highlightMatches(name, indices)");
	});

	it("palette styles highlight the matched characters", () => {
		const src = read("src/components/palette/style.scss");
		expect(src).toContain("mark.xc-fuzzy-hit");
	});
});

describe("local file timeline", () => {
	it("records a snapshot after every successful save", () => {
		const src = read("src/lib/saveFile.js");
		expect(src).toContain('import fileTimeline from "./fileTimeline"');
		expect(src).toContain("fileTimeline.recordSnapshot(file.uri, data, file.filename)");
		expect(src).toContain("appSettings.value.fileTimeline");
	});

	it("settings default to on and expose a toggle", () => {
		const settings = read("src/lib/settings.js");
		expect(settings).toMatch(/fileTimeline: true/);
		const editorSettings = read("src/settings/editorSettings.js");
		expect(editorSettings).toContain('key: "fileTimeline"');
	});

	it("file menu opens the timeline page", () => {
		const menu = read("src/views/file-menu.hbs");
		expect(menu).toContain('<li action="file-timeline">');
		const commands = read("src/lib/commands.js");
		expect(commands).toContain('"file-timeline"');
		expect(commands).toContain('import(\n\t\t\t/* webpackChunkName: "timeline" */ "pages/timeline"\n\t\t)');
	});
});

describe("reduced motion", () => {
	it("ships a global kill switch", () => {
		const src = read("src/styles/effects.scss");
		expect(src).toContain("@media (prefers-reduced-motion: reduce)");
		expect(src).toContain("animation-duration: 0.01ms !important");
		expect(src).toContain("scroll-behavior: auto !important");
	});
});
