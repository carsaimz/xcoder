import { describe, expect, it } from "vitest";
import {
	pushReplEntry,
	loadReplHistory,
	saveReplHistory,
	REPL_HISTORY_CAP,
} from "../../src/lib/replHistory";
import {
	loadReplSnippets,
	saveReplSnippets,
	upsertSnippet,
	removeSnippet,
	REPL_SNIPPETS_CAP,
} from "../../src/lib/replSnippets";
import {
	isRelativeSpec,
	resolveSpec,
	normalizePath,
	parseImportClause,
	buildSnippetImport,
	rewriteSnippetImports,
	rewriteModuleImports,
	resolveSnippetImports,
	collectSpecs,
	MODULE_COUNT_CAP,
} from "../../src/lib/replImports";

/** Minimal Storage-like stub. */
function fakeStorage() {
	const map = new Map();
	return {
		getItem: (key) => (map.has(key) ? map.get(key) : null),
		setItem: (key, value) => map.set(key, String(value)),
		_dump: map,
	};
}

describe("replHistory", () => {
	it("starts empty without storage data", () => {
		expect(loadReplHistory(null)).toEqual([]);
		expect(loadReplHistory(fakeStorage())).toEqual([]);
	});

	it("round-trips through storage", () => {
		const storage = fakeStorage();
		const list = pushReplEntry([], "1+1");
		saveReplHistory(storage, list);
		expect(loadReplHistory(storage)).toEqual(["1+1"]);
	});

	it("collapses consecutive duplicates", () => {
		const list = pushReplEntry(pushReplEntry([], "a"), "a");
		expect(list).toEqual(["a"]);
	});

	it("enforces the cap keeping the newest entries", () => {
		let list = [];
		for (let i = 0; i < REPL_HISTORY_CAP + 10; i++) {
			list = pushReplEntry(list, `code-${i}`);
		}
		expect(list).toHaveLength(REPL_HISTORY_CAP);
		expect(list[0]).toBe(`code-${10}`);
		expect(list[list.length - 1]).toBe(`code-${REPL_HISTORY_CAP + 9}`);
	});

	it("ignores blank entries", () => {
		expect(pushReplEntry([], "   ")).toEqual([]);
	});

	it("recovers from corrupt storage", () => {
		const storage = fakeStorage();
		storage.setItem("repl.history", "{not json");
		expect(loadReplHistory(storage)).toEqual([]);
		storage.setItem("repl.history", JSON.stringify(["ok", 42, null]));
		expect(loadReplHistory(storage)).toEqual(["ok"]);
	});

	it("saveReplHistory swallows storage failures", () => {
		expect(() =>
			saveReplHistory({ setItem: () => { throw new Error("quota"); } }, ["x"]),
		).not.toThrow();
	});
});

describe("replSnippets", () => {
	it("round-trips snippets through storage", () => {
		const storage = fakeStorage();
		const { list } = upsertSnippet([], "hello", "console.log('hi')");
		saveReplSnippets(storage, list);
		expect(loadReplSnippets(storage)).toEqual([
			{ name: "hello", code: "console.log('hi')", ts: expect.any(Number) },
		]);
	});

	it("replaces snippets with the same name", () => {
		let { list } = upsertSnippet([], "s", "one");
		({ list } = upsertSnippet(list, "s", "two"));
		expect(list).toHaveLength(1);
		expect(list[0].code).toBe("two");
	});

	it("rejects empty names or code", () => {
		expect(upsertSnippet([], "  ", "code").saved).toBe(false);
		expect(upsertSnippet([], "name", "   ").saved).toBe(false);
	});

	it("removes snippets and reports misses", () => {
		const { list } = upsertSnippet([], "a", "1");
		expect(removeSnippet(list, "a")).toBe(true);
		expect(removeSnippet(list, "a")).toBe(false);
		expect(list).toEqual([]);
	});

	it("caps the snippet count", () => {
		let list = [];
		for (let i = 0; i < REPL_SNIPPETS_CAP + 5; i++) {
			list = upsertSnippet(list, `s${i}`, "1").list;
		}
		expect(list).toHaveLength(REPL_SNIPPETS_CAP);
		expect(list[0].name).toBe("s5");
	});

	it("recovers from corrupt storage", () => {
		const storage = fakeStorage();
		storage.setItem("repl.snippets", "nope");
		expect(loadReplSnippets(storage)).toEqual([]);
		storage.setItem("repl.snippets", JSON.stringify([{ name: "x" }, "junk"]));
		expect(loadReplSnippets(storage)).toEqual([]);
	});
});

describe("replImports — paths", () => {
	it("detects relative specs only", () => {
		expect(isRelativeSpec("./a.js")).toBe(true);
		expect(isRelativeSpec("../a.js")).toBe(true);
		expect(isRelativeSpec("lodash")).toBe(false);
		expect(isRelativeSpec("/abs.js")).toBe(false);
		expect(isRelativeSpec("https://x/y.js")).toBe(false);
	});

	it("normalizes dot segments without touching the scheme", () => {
		expect(normalizePath("/a/b/./c.js")).toBe("/a/b/c.js");
		expect(normalizePath("/a/b/../c.js")).toBe("/a/c.js");
		expect(normalizePath("file:///x/y/./z.js")).toBe("file:///x/y/z.js");
		expect(normalizePath("file:///x/y/../z.js")).toBe("file:///x/z.js");
		expect(normalizePath("content://host/tree/A%2Fdir/./m.js")).toBe(
			"content://host/tree/A%2Fdir/m.js",
		);
	});

	it("resolves specs against a base dir", () => {
		expect(resolveSpec("file:///proj", "./lib/a.js")).toBe(
			"file:///proj/lib/a.js",
		);
		expect(resolveSpec("file:///proj/src", "../lib/a.js")).toBe(
			"file:///proj/lib/a.js",
		);
		expect(resolveSpec("", "./a.js")).toBeNull();
		expect(resolveSpec("file:///proj", "lodash")).toBeNull();
	});
});

describe("replImports — clauses", () => {
	it("parses default, named and namespace clauses", () => {
		expect(parseImportClause("fs")).toEqual({
			defaultName: "fs",
			namespaceName: null,
			named: [],
		});
		expect(parseImportClause("{ a, b as c }")).toEqual({
			defaultName: null,
			namespaceName: null,
			named: [
				{ imported: "a", local: "a" },
				{ imported: "b", local: "c" },
			],
		});
		expect(parseImportClause("* as ns")).toEqual({
			defaultName: null,
			namespaceName: "ns",
			named: [],
		});
		expect(parseImportClause("def, { a }")).toEqual({
			defaultName: "def",
			namespaceName: null,
			named: [{ imported: "a", local: "a" }],
		});
		expect(parseImportClause("")).toBeNull();
		expect(parseImportClause("...bad")).toBeNull();
	});

	it("builds await-import statements", () => {
		expect(buildSnippetImport(parseImportClause("fs"), "blob:1")).toBe(
			'const default: fs = await import("blob:1");'.replace("default: fs", "{default: fs}"),
		);
		expect(buildSnippetImport(parseImportClause("* as ns"), "blob:1")).toBe(
			'const ns = await import("blob:1");',
		);
		expect(buildSnippetImport(parseImportClause("{a as b}"), "blob:1")).toBe(
			'const {a: b} = await import("blob:1");',
		);
	});
});

describe("replImports — snippet rewriting", () => {
	const urls = { "./x.js": "blob:x", "../y.mjs": "blob:y" };
	const resolve = (spec) => urls[spec] || null;

	it("rewrites default imports", () => {
		const out = rewriteSnippetImports(
			'import x from "./x.js";\nx();',
			resolve,
		);
		expect(out.code).toContain('const {default: x} = await import("blob:x")');
		expect(out.rewritten).toEqual([{ spec: "./x.js", url: "blob:x" }]);
	});

	it("rewrites named and namespace imports", () => {
		const out = rewriteSnippetImports(
			'import {a as b, c} from "./x.js";\nimport * as ns from "./x.js";',
			resolve,
		);
		expect(out.code).toContain('const {a: b, c} = await import("blob:x")');
		expect(out.code).toContain('const ns = await import("blob:x")');
	});

	it("rewrites bare and dynamic imports", () => {
		const out = rewriteSnippetImports(
			'import "./x.js";\nconst m = await import("./x.js");',
			resolve,
		);
		expect(out.code).toContain('await import("blob:x");');
		expect(out.code).toContain('import("blob:x")');
	});

	it("leaves external and bare specifiers alone", () => {
		const source =
			"import fs from 'fs';\nimport app from 'https://cdn/x.js';";
		const out = rewriteSnippetImports(source, resolve);
		expect(out.code).toBe(source);
		expect(out.rewritten).toEqual([]);
	});

	it("handles multi-line named imports", () => {
		const out = rewriteSnippetImports(
			'import {\n  one,\n  two as dos,\n} from "./x.js";',
			resolve,
		);
		expect(out.code).toContain("one");
		expect(out.code).toContain("dos");
		expect(out.code).toContain("blob:x");
	});
});

describe("replImports — module rewriting", () => {
	it("keeps static import syntax with swapped specifiers", () => {
		const out = rewriteModuleImports(
			'import {h} from "./h.js";\nexport * from "./all.js";\nexport {x} from "./x.js";',
			() => "blob:m",
		);
		expect(out.code).toContain('import {h} from "blob:m"');
		expect(out.code).toContain('export * from "blob:m"');
		expect(out.code).toContain('export {x} from "blob:m"');
	});

	it("leaves unresolvable specifiers in place", () => {
		const source = 'import {h} from "./missing.js";';
		const out = rewriteModuleImports(source, () => null);
		expect(out.code).toBe(source);
	});
});

describe("resolveSnippetImports", () => {
	function makeIo(files, base = "file:///proj/src") {
		let counter = 0;
		const reads = [];
		return {
			baseDir: base,
			readFile: async (uri) => {
				reads.push(uri);
				if (!(uri in files)) throw new Error("not found");
				return files[uri];
			},
			createObjectUrl: () => `blob:${++counter}`,
			reads,
		};
	}

	it("inlines a single module and rewrites the snippet", async () => {
		const io = makeIo({
			"file:///proj/src/helper.js": "export const answer = 42;",
		});
		const out = await resolveSnippetImports(
			'import {answer} from "./helper.js";\nanswer',
			io,
		);
		expect(out.missing).toEqual([]);
		expect(out.urls).toHaveLength(1);
		expect(out.code).toContain('await import("blob:1")');
		expect(out.modules).toEqual(["file:///proj/src/helper.js"]);
	});

	it("resolves transitive dependencies bottom-up", async () => {
		const io = makeIo({
			"file:///proj/src/a.js": 'import {b} from "./b.js";\nexport const a = b + 1;',
			"file:///proj/src/b.js": "export const b = 1;",
		});
		const out = await resolveSnippetImports(
			'import {a} from "./a.js";\na',
			io,
		);
		expect(out.missing).toEqual([]);
		expect(out.modules.sort()).toEqual([
			"file:///proj/src/a.js",
			"file:///proj/src/b.js",
		]);
		// a.js blob must reference b.js's blob URL
		const aEntry = out.urls.find((entry) => entry.uri.endsWith("a.js"));
		const bEntry = out.urls.find((entry) => entry.uri.endsWith("b.js"));
		const aSource = io.createObjectUrlMock?.() || null;
		expect(aEntry.url).toBeTruthy();
		expect(bEntry.url).toBeTruthy();
		expect(Number(aEntry.url.split(":")[1])).toBeGreaterThan(
			Number(bEntry.url.split(":")[1]),
		);
	});

	it("reports missing modules instead of throwing", async () => {
		const io = makeIo({});
		const out = await resolveSnippetImports(
			'import x from "./nope.js";\nx',
			io,
		);
		expect(out.missing).toEqual([
			{ spec: "file:///proj/src/nope.js", from: "<snippet>" },
		]);
		expect(out.urls).toEqual([]);
	});

	it("survives import cycles without hanging", async () => {
		const io = makeIo({
			"file:///proj/src/a.js": 'import {b} from "./b.js";\nexport const a = 1;',
			"file:///proj/src/b.js": 'import {a} from "./a.js";\nexport const b = 2;',
		});
		const out = await resolveSnippetImports(
			'import {a} from "./a.js";\na',
			io,
		);
		expect(out.missing).toEqual([]);
		expect(out.urls).toHaveLength(2);
		expect(out.code).toContain("blob:");
	});

	it("enforces the module count cap", async () => {
		const files = {};
		for (let i = 0; i < MODULE_COUNT_CAP + 4; i++) {
			files[`file:///proj/src/m${i}.js`] =
				i < MODULE_COUNT_CAP + 3
					? `import "./m${i + 1}.js";`
					: "export const end = 1;";
		}
		const io = makeIo(files);
		const out = await resolveSnippetImports(
			'import "./m0.js";\n1',
			io,
		);
		expect(out.missing.length).toBeGreaterThan(0);
		expect(out.modules.length).toBeLessThanOrEqual(MODULE_COUNT_CAP + 1);
	});

	it("ignores external specifiers entirely", async () => {
		const io = makeIo({});
		const out = await resolveSnippetImports(
			"import fs from 'fs';\nimport x from 'https://cdn.example.com/x.js';\n1",
			io,
		);
		expect(out.missing).toEqual([]);
		expect(out.urls).toEqual([]);
		expect(out.code).toBe("import fs from 'fs';\nimport x from 'https://cdn.example.com/x.js';\n1");
	});
});

describe("replImports — collectSpecs", () => {
	it("collects every import form", () => {
		const specs = collectSpecs(
			[
				'import a from "./a.js";',
				'import "./b.js";',
				'const c = await import("./c.js");',
				'export {d} from "./d.js";',
				'export * from "./e.js";',
			].join("\n"),
		);
		const specsOnly = specs.map((entry) => entry.spec);
		expect(specsOnly).toEqual([
			"./a.js",
			"./d.js",
			"./e.js",
			"./c.js",
			"./b.js",
		]);
	});
});

describe("repl app wiring", () => {
	const { readFileSync } = require("node:fs");
	const source = readFileSync(
		new URL("../../src/sidebarApps/repl/index.js", import.meta.url),
		"utf8",
	);

	it("persists history through the pure helpers", () => {
		expect(source).toContain("loadReplHistory(safeStorage())");
		expect(source).toContain("pushReplEntry(history, code)");
		expect(source).toContain("saveReplHistory(safeStorage(), history)");
	});

	it("persists snippets through the pure helpers", () => {
		expect(source).toContain("loadReplSnippets(safeStorage())");
		expect(source).toContain("upsertSnippet(snippets");
		expect(source).toContain("removeSnippet(snippets");
		expect(source).toContain("saveReplSnippets(safeStorage(), snippets)");
	});

	it("resolves workspace imports before running", () => {
		expect(source).toContain("resolveSnippetImports(");
		expect(source).toContain("revokeActiveUrls()");
		expect(source).toContain("activeFileDir()");
	});
});
