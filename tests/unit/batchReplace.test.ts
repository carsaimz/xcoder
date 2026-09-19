// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistReplacedFiles } from "lib/batchReplace";

const state = vi.hoisted(() => ({
	defaultEncoding: "utf-8",
	fsByPath: {} as Record<string, { writeFile: ReturnType<typeof vi.fn>; stat?: ReturnType<typeof vi.fn> }>,
	getFile: undefined as any,
}));

vi.mock("lib/settings", () => ({
	default: {
		get value() {
			return { defaultFileEncoding: state.defaultEncoding };
		},
		on() {},
		off() {},
	},
}));

vi.mock("fileSystem", () => ({
	default: (path: string) => {
		const fs =
			state.fsByPath[path] ||
			(state.fsByPath[path] = {
				writeFile: vi.fn(async () => {}),
				stat: vi.fn(async () => ({ mtime: 1234 })),
			});
		return fs;
	},
}));

vi.mock("utils/helpers", () => ({
	default: {
		getStatMtime: () => 1234,
	},
}));

function makeManager() {
	return {
		getFile: vi.fn(() => null),
	};
}

describe("batch replace persistence", () => {
	beforeEach(() => {
		for (const key of Object.keys(state.fsByPath)) {
			delete state.fsByPath[key];
		}
		state.defaultEncoding = "utf-8";
		state.getFile = undefined;
		(window as any).editorManager = makeManager();
	});

	it("writes closed files with the default encoding", async () => {
		const summary = await persistReplacedFiles([
			{ url: "file:///a.txt", text: "new a" },
			{ url: "file:///b.txt", text: "new b" },
		]);

		expect(summary.saved).toEqual(["file:///a.txt", "file:///b.txt"]);
		expect(summary.updated).toEqual([]);
		expect(summary.failed).toEqual([]);
		const fs = state.fsByPath["file:///a.txt"];
		expect(fs.writeFile).toHaveBeenCalledWith("new a", "utf-8");
	});

	it("uses the open tab encoding and syncs + marks loaded tabs as saved", async () => {
		const openFile = {
			loaded: true,
			encoding: "latin1",
			session: { setValue: vi.fn(), doc: { toString: () => "new a" } },
			markSaved: vi.fn(),
		};
		(window as any).editorManager.getFile.mockReturnValue(openFile);

		const summary = await persistReplacedFiles([
			{ url: "file:///a.txt", text: "new a" },
		]);

		expect(summary.saved).toEqual(["file:///a.txt"]);
		expect(summary.updated).toEqual(["file:///a.txt"]);
		expect(state.fsByPath["file:///a.txt"].writeFile).toHaveBeenCalledWith(
			"new a",
			"latin1",
		);
		expect(openFile.session.setValue).toHaveBeenCalledWith("new a");
		expect(openFile.markSaved).toHaveBeenCalledWith(
			expect.objectContaining({ mtime: 1234 }),
		);
	});

	it("keeps writing after a failure and reports it in the summary", async () => {
		state.fsByPath["file:///bad.txt"] = {
			writeFile: vi.fn(async () => {
				throw new Error("read-only");
			}),
		};

		const summary = await persistReplacedFiles([
			{ url: "file:///bad.txt", text: "x" },
			{ url: "file:///good.txt", text: "y" },
		]);

		expect(summary.saved).toEqual(["file:///good.txt"]);
		expect(summary.failed).toEqual([
			{ url: "file:///bad.txt", error: "read-only" },
		]);
	});

	it("reports progress for every entry", async () => {
		const onProgress = vi.fn();
		await persistReplacedFiles(
			[
				{ url: "file:///a.txt", text: "1" },
				{ url: "file:///b.txt", text: "2" },
			],
			onProgress,
		);

		expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
		expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
	});

	it("skips malformed entries without writing", async () => {
		const summary = await persistReplacedFiles([
			{ url: "", text: "x" },
			{ url: "file:///a.txt", text: undefined as any },
		]);

		expect(summary.saved).toEqual([]);
		expect(Object.keys(state.fsByPath)).toEqual([]);
	});
});
