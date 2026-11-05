// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
	const addedFolder = [];
	const settings = {
		value: {
			rememberFiles: true,
			rememberFolders: true,
		},
	};
	return { addedFolder, settings };
});

vi.mock("cm/editorUtils", () => ({
	getAllFolds: vi.fn(() => []),
	getScrollPosition: vi.fn(() => ({ scrollTop: 0, scrollLeft: 0 })),
	getSelection: vi.fn(() => ({
		ranges: [{ from: 0, to: 0 }],
		mainIndex: 0,
	})),
}));
vi.mock("lib/editorHistoryState", () => ({
	serializeEditorHistory: vi.fn(() => []),
}));
vi.mock("fileSystem", () => ({ default: vi.fn() }));
vi.mock("lib/config", () => ({
	default: { DEFAULT_FILE_SESSION: "default-session" },
}));
vi.mock("lib/openFolder", () => ({
	default: vi.fn(),
	addedFolder: runtime.addedFolder,
}));
vi.mock("lib/settings", () => ({ default: runtime.settings }));

import saveState from "lib/saveState";

const { addedFolder } = runtime;

function seedFolders(urls) {
	addedFolder.length = 0;
	for (const url of urls) {
		addedFolder.push({
			url,
			saveState: true,
			title: url.split("/").pop() || url,
			listState: {},
			listFiles: true,
		});
	}
}

beforeEach(() => {
	window.localStorage.clear();
	seedFolders([]);
	window.editorManager = {
		editor: {},
		files: [],
		activeFile: null,
		editorHistory: [],
		editorHistoryIndex: 0,
	};
});

describe("saveState folder persistence", () => {
	it("stores open folders with their options", () => {
		seedFolders(["file:///storage/emulated/0/Project"]);
		saveState();
		const saved = JSON.parse(window.localStorage.folders);
		expect(saved).toHaveLength(1);
		expect(saved[0].url).toBe("file:///storage/emulated/0/Project");
		expect(saved[0].opts.name).toBe("Project");
	});

	it("deduplicates the same project saved with a trailing slash", () => {
		// legacy sessions could hold both variants of one folder
		seedFolders([
			"file:///storage/emulated/0/Project",
			"file:///storage/emulated/0/Project/",
		]);
		saveState();
		const saved = JSON.parse(window.localStorage.folders);
		expect(saved).toHaveLength(1);
	});

	it("keeps genuinely different folders", () => {
		seedFolders([
			"file:///storage/emulated/0/Alpha",
			"file:///storage/emulated/0/Beta",
		]);
		saveState();
		const saved = JSON.parse(window.localStorage.folders);
		expect(saved).toHaveLength(2);
	});
});
