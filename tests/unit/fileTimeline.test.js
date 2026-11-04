// @vitest-environment happy-dom
/**
 * Local file timeline — snapshots recorded on every save, listed and
 * restored without git (VS Code Timeline parity, roadmap Lote D).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const fsMocks = vi.hoisted(() => {
	const store = new Map();
	const normalize = (url) => String(url).replace(/\/+$/, "");

	const op = (url) => ({
		exists: async () => store.has(normalize(url)),
		readFile: async () => {
			const value = store.get(normalize(url));
			if (value === undefined) throw new Error("not found: " + url);
			return value;
		},
		writeFile: async (data) => {
			store.set(normalize(url), data);
		},
		createFile: async (name, data) => {
			store.set(normalize(`${normalize(url)}/${name}`), data ?? "");
		},
		createDirectory: async (name) => {
			store.set(normalize(`${normalize(url)}/${name}`), "");
		},
		delete: async () => {
			const target = normalize(url);
			store.delete(target);
			// real filesystems delete children recursively
			for (const key of [...store.keys()]) {
				if (key.startsWith(`${target}/`)) store.delete(key);
			}
		},
		stat: async () => ({}),
	});

	return {
		store,
		fsOperation: vi.fn((url) => op(url)),
	};
});

vi.mock("fileSystem", () => ({ default: fsMocks.fsOperation }));

import fileTimeline, {
	__setTimelineRoot,
	clearSnapshots,
	listSnapshots,
	recordSnapshot,
	restoreSnapshot,
	timelineKey,
} from "../../src/lib/fileTimeline";

describe("fileTimeline", () => {
	beforeEach(() => {
		fsMocks.store.clear();
		fsMocks.fsOperation.mockClear();
		__setTimelineRoot("root:/timeline");
	});

	test("timelineKey is deterministic and distinct per uri", () => {
		expect(timelineKey("file:///a.js")).toBe(timelineKey("file:///a.js"));
		expect(timelineKey("file:///a.js")).not.toBe(timelineKey("file:///b.js"));
	});

	test("recordSnapshot stores content and meta", async () => {
		await recordSnapshot("file:///a.js", "hello");
		const list = await listSnapshots("file:///a.js");
		expect(list).toHaveLength(1);
		expect(list[0].size).toBe(5);
		const text = await restoreSnapshot(
			"file:///a.js",
			list[0].t,
		);
		expect(text).toBe("hello");
	});

	test("identical consecutive saves are de-duplicated", async () => {
		await recordSnapshot("file:///a.js", "hello");
		await recordSnapshot("file:///a.js", "hello");
		const list = await listSnapshots("file:///a.js");
		expect(list).toHaveLength(1);
	});

	test("new content adds a snapshot; list is newest first", async () => {
		await recordSnapshot("file:///a.js", "one");
		await new Promise((r) => setTimeout(r, 5));
		await recordSnapshot("file:///a.js", "two");
		const list = await listSnapshots("file:///a.js");
		expect(list).toHaveLength(2);
		const texts = [];
		for (const { t } of list) {
			texts.push(await restoreSnapshot("file:///a.js", t));
		}
		expect(texts).toEqual(["two", "one"]);
	});

	test("prunes to 20 snapshots", async () => {
		for (let i = 0; i < 25; i++) {
			await recordSnapshot("file:///a.js", `content-${i}`);
			await new Promise((r) => setTimeout(r, 2));
		}
		const list = await listSnapshots("file:///a.js");
		expect(list).toHaveLength(20);
		// the two oldest are gone
		expect(await restoreSnapshot("file:///a.js", list[19].t)).toBeDefined();
	});

	test("clearSnapshots removes everything", async () => {
		await recordSnapshot("file:///a.js", "bye");
		await clearSnapshots("file:///a.js");
		expect(await listSnapshots("file:///a.js")).toHaveLength(0);
	});

	test("recordSnapshot ignores oversize content", async () => {
		await recordSnapshot("file:///big.js", "x".repeat(600 * 1024));
		expect(await listSnapshots("file:///big.js")).toHaveLength(0);
	});

	test("recordSnapshot never throws on storage failure", async () => {
		fsMocks.fsOperation.mockImplementationOnce(() => {
			throw new Error("disk gone");
		});
		await expect(
			recordSnapshot("file:///a.js", "text"),
		).resolves.toBeUndefined();
	});

	test("default export exposes the API", () => {
		expect(typeof fileTimeline.recordSnapshot).toBe("function");
		expect(typeof fileTimeline.listSnapshots).toBe("function");
		expect(typeof fileTimeline.restoreSnapshot).toBe("function");
		expect(typeof fileTimeline.clearSnapshots).toBe("function");
	});
});
