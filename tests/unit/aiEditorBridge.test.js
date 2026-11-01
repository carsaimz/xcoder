import { describe, expect, it } from "vitest";
import {
	applyToEditor,
	formatEditorContext,
	getEditorContext,
	listOpenFiles,
	pickEditorFile,
	readActiveBuffer,
} from "lib/ai/editorBridge";

/**
 * Minimal CodeMirror-like EditorView fake.
 * @param {string} text initial buffer
 * @param {number} from selection start
 * @param {number} to selection end
 */
function makeView(text, from = 0, to = 0) {
	const lines = text.split("\n");
	const offsets = [];
	let acc = 0;
	for (const line of lines) {
		offsets.push(acc);
		acc += line.length + 1;
	}

	const doc = {
		get lines() {
			return lines.length;
		},
		get length() {
			return text.length;
		},
		toString: () => lines.join("\n"),
		lineAt(offset) {
			for (let i = lines.length - 1; i >= 0; i--) {
				if (offset >= offsets[i]) {
					return {
						number: i + 1,
						text: lines[i],
						from: offsets[i],
						to: offsets[i] + lines[i].length,
					};
				}
			}
			return { number: 1, text: lines[0] || "", from: 0, to: lines[0]?.length || 0 };
		},
	};

	const transactions = [];
	const view = {
		state: {
			doc,
			selection: { main: { from, to, head: to, get empty() { return from === to; } } },
		},
		dispatch: (tr) => {
			transactions.push(tr);
			const change = tr?.changes;
			if (change) {
				const value = lines.join("\n");
				const updated =
					value.slice(0, change.from ?? 0) +
					(change.insert ?? "") +
					value.slice(change.to ?? change.from ?? 0);
				lines.length = 0;
				lines.push(...updated.split("\n"));
				// recompute offsets for subsequent assertions
				let a = 0;
				offsets.length = 0;
				for (const line of lines) {
					offsets.push(a);
					a += line.length + 1;
				}
			}
		},
		transactions,
	};
	return view;
}

function makeManager(view, extra = {}) {
	return {
		activeFile: {
			type: "editor",
			uri: "file:///project/src/app.js",
			filename: "app.js",
			isUnsaved: false,
		},
		editor: view,
		files: [],
		...extra,
	};
}

describe("getEditorContext", () => {
	it("reports no file when the editor is empty", () => {
		expect(getEditorContext(null)).toEqual({ hasFile: false });
		expect(getEditorContext({ activeFile: null })).toEqual({ hasFile: false });
	});

	it("collects cursor, selection and dirty state", () => {
		const view = makeView("line one\nline two", 9, 17); // selection = "two"
		const context = getEditorContext(makeManager(view, { activeFile: { type: "editor", uri: "u", filename: "a.js", isUnsaved: true } }));

		expect(context.hasFile).toBe(true);
		expect(context.name).toBe("a.js");
		expect(context.dirty).toBe(true);
		expect(context.lines).toBe(2);
		expect(context.hasSelection).toBe(true);
		expect(context.selectionChars).toBe(8);
		expect(context.selectionLines).toBe(1);
		expect(context.cursorLine).toBe(2);
	});
});

describe("formatEditorContext", () => {
	it("formats the no-file case", () => {
		expect(formatEditorContext({ hasFile: false })).toContain("No file");
	});

	it("lists path, lines, dirty and selection", () => {
		const text = formatEditorContext({
			hasFile: true,
			path: "file:///a.js",
			name: "a.js",
			lines: 42,
			dirty: true,
			hasSelection: true,
			selectionChars: 30,
			selectionLines: 3,
			cursorLine: 10,
			cursorColumn: 4,
		});
		expect(text).toContain("a.js");
		expect(text).toContain("lines: 42");
		expect(text).toContain("unsaved changes: yes");
		expect(text).toContain("30 chars across 3 line(s)");
		expect(text).toContain("line 10");
	});
});

describe("readActiveBuffer", () => {
	it("errors without an active editor", () => {
		expect(readActiveBuffer({ activeFile: null })).toMatch(/^ERROR/);
	});

	it("returns numbered lines from the live buffer", () => {
		const view = makeView("alpha\nbeta\ngamma");
		const result = readActiveBuffer(makeManager(view), { startLine: 2 });
		expect(result).toBe("2: beta\n3: gamma");
	});

	it("clamps ranges and reports out-of-bounds starts", () => {
		const view = makeView("one\ntwo");
		expect(readActiveBuffer(makeManager(view), { startLine: 99 })).toMatch(
			/ERROR.*beyond the end/,
		);
		const capped = readActiveBuffer(makeManager(view), { lineCount: 99999 });
		expect(capped.split("\n")).toHaveLength(2);
	});
});

describe("listOpenFiles", () => {
	it("reports when nothing is open", () => {
		expect(listOpenFiles({})).toContain("No files are open");
	});

	it("marks active and unsaved files", () => {
		const active = { type: "editor", uri: "u1", filename: "one.js", isUnsaved: true };
		const manager = {
			activeFile: active,
			editor: makeView(""),
			files: [active, { type: "editor", uri: "u2", filename: "two.js", isUnsaved: false }],
		};
		const result = listOpenFiles(manager);
		expect(result).toContain("one.js (active, unsaved)");
		expect(result).toContain("two.js");
	});
});

describe("applyToEditor", () => {
	it("errors without a file", () => {
		const result = applyToEditor({ activeFile: null }, { action: "insert", text: "x" });
		expect(result.ok).toBe(false);
	});

	it("inserts at cursor and leaves it unsaved in the UI terms", () => {
		const view = makeView("hello world", 5, 5);
		const result = applyToEditor(makeManager(view), {
			action: "insert",
			text: " -",
		});
		expect(result.ok).toBe(true);
		expect(view.transactions).toHaveLength(1);
		expect(view.transactions[0].changes).toEqual({ from: 5, to: 5, insert: " -" });
	});

	it("replaces the selection", () => {
		const view = makeView("hello world", 6, 11);
		const result = applyToEditor(makeManager(view), {
			action: "replace_selection",
			text: "there",
		});
		expect(result.ok).toBe(true);
		expect(view.transactions[0].changes).toEqual({ from: 6, to: 11, insert: "there" });
	});

	it("refuses replace_selection with an empty selection", () => {
		const view = makeView("abc", 1, 1);
		const result = applyToEditor(makeManager(view), {
			action: "replace_selection",
			text: "x",
		});
		expect(result.ok).toBe(false);
		expect(result.message).toContain("no selection");
	});

	it("replaces the whole buffer", () => {
		const view = makeView("old content", 0, 0);
		const result = applyToEditor(makeManager(view), {
			action: "replace_all",
			text: "new content",
		});
		expect(result.ok).toBe(true);
		expect(view.transactions[0].changes).toEqual({
			from: 0,
			to: 11,
			insert: "new content",
		});
	});

	it("rejects unknown actions and oversized text", () => {
		const view = makeView("abc");
		expect(applyToEditor(makeManager(view), { action: "nope", text: "x" }).ok).toBe(false);
		expect(
			applyToEditor(makeManager(view), { action: "insert", text: "a".repeat(40000) })
				.message,
		).toContain("too large");
	});
});

describe("pickEditorFile + applyToEditor recovery", () => {
	it("prefers the most recent editor tab from the history", () => {
		const terminalFile = {
			type: "terminal",
			uri: "terminal:1",
			filename: "Terminal 1",
		};
		const jsFile = { type: "editor", uri: "u:js", filename: "app.js" };
		const htmlFile = {
			type: "editor",
			uri: "u:html",
			filename: "index.html",
		};
		const manager = {
			activeFile: terminalFile,
			files: [jsFile, htmlFile, terminalFile],
			editorHistory: [jsFile, terminalFile, htmlFile],
		};
		expect(pickEditorFile(manager)).toBe(htmlFile);
	});

	it("falls back to the last open editor tab when history is empty", () => {
		const jsFile = { type: "editor", uri: "u:js", filename: "app.js" };
		const manager = { activeFile: null, files: [jsFile], editorHistory: [] };
		expect(pickEditorFile(manager)).toBe(jsFile);
	});

	it("returns null when nothing editable is open", () => {
		const terminalFile = { type: "terminal", uri: "t:1", filename: "T" };
		expect(
			pickEditorFile({ files: [terminalFile], editorHistory: [terminalFile] }),
		).toBeNull();
	});

	it("activates the last editor tab when a terminal tab is active", () => {
		const htmlView = makeView("<p>page</p>", 11, 11);
		const htmlFile = {
			type: "editor",
			uri: "file:///project/index.html",
			filename: "index.html",
			isUnsaved: false,
		};
		const terminalFile = {
			type: "terminal",
			uri: "terminal:1",
			filename: "Terminal 1",
		};
		const manager = {
			activeFile: terminalFile,
			editor: null,
			files: [htmlFile, terminalFile],
			editorHistory: [terminalFile, htmlFile],
		};
		htmlFile.makeActive = () => {
			manager.activeFile = htmlFile;
			manager.editor = htmlView;
		};

		const result = applyToEditor(manager, {
			action: "insert",
			text: "<b>hi</b>",
		});

		expect(result.ok).toBe(true);
		expect(manager.activeFile).toBe(htmlFile);
		expect(htmlView.transactions[0].changes).toEqual({
			from: 11,
			to: 11,
			insert: "<b>hi</b>",
		});
	});

	it("still reports no file when only non-editor tabs exist", () => {
		const terminalFile = {
			type: "terminal",
			uri: "terminal:1",
			filename: "Terminal 1",
		};
		const manager = {
			activeFile: terminalFile,
			editor: null,
			files: [terminalFile],
			editorHistory: [terminalFile],
		};
		const result = applyToEditor(manager, { action: "insert", text: "x" });
		expect(result.ok).toBe(false);
		expect(result.message).toContain("no file is open");
	});
});

describe("insertIntoEditorFile + editorFilesOf + waitForEditorView", () => {
	it("collects editor files from files and panes without duplicates", async () => {
		const { editorFilesOf } = await import("lib/ai/editorBridge");
		const htmlFile = { type: "editor", filename: "index.html" };
		const cssFile = { type: "editor", filename: "style.css" };
		const page = { type: "page", filename: "AI" };
		const manager = {
			files: [htmlFile, page],
			panes: [{ files: [htmlFile, cssFile] }, { files: [page] }],
		};
		expect(editorFilesOf(manager)).toEqual([htmlFile, cssFile]);
		expect(editorFilesOf(null)).toEqual([]);
	});

	it("inserts into the edited file even when a page tab is active", async () => {
		const { insertIntoEditorFile } = await import("lib/ai/editorBridge");
		const htmlFile = {
			type: "editor",
			filename: "index.html",
			makeActive() {
				this.wasActivated = true;
			},
		};
		const aiTab = { type: "page", filename: "AI" };
		const view = makeView("<html>\n</html>", 0, 0);
		const manager = {
			activeFile: aiTab,
			editor: view,
			files: [htmlFile, aiTab],
			editorHistory: [htmlFile, aiTab],
		};

		const result = await insertIntoEditorFile(manager, "<p>hi</p>");

		expect(result.ok).toBe(true);
		expect(result.file).toBe(htmlFile);
		expect(htmlFile.wasActivated).toBe(true);
		expect(view.transactions[0].changes).toEqual({
			from: 0,
			to: 0,
			insert: "<p>hi</p>",
		});
	});

	it("keeps the active editor file and skips re-activation", async () => {
		const { insertIntoEditorFile } = await import("lib/ai/editorBridge");
		const htmlFile = {
			type: "editor",
			filename: "app.js",
			makeActive() {
				throw new Error("should not be needed");
			},
		};
		const view = makeView("const a = 1;", 11, 11);
		const manager = {
			activeFile: htmlFile,
			editor: view,
			files: [htmlFile],
			editorHistory: [htmlFile],
		};

		const result = await insertIntoEditorFile(manager, " // done");

		expect(result.ok).toBe(true);
		expect(view.transactions[0].changes).toEqual({
			from: 11,
			to: 11,
			insert: " // done",
		});
	});

	it("waits for the editor view of a freshly activated file", async () => {
		const { insertIntoEditorFile } = await import("lib/ai/editorBridge");
		const htmlFile = {
			type: "editor",
			filename: "late.html",
			makeActive() {
				/* tab switches synchronously; editor builds later */
			},
		};
		const view = makeView("", 0, 0);
		let reads = 0;
		const manager = {
			activeFile: htmlFile,
			get editor() {
				reads += 1;
				// the view only exists after ~120ms of polling
				return reads > 3 ? view : null;
			},
			files: [htmlFile],
			editorHistory: [htmlFile],
		};

		const result = await insertIntoEditorFile(manager, "x");

		expect(result.ok).toBe(true);
		expect(view.transactions[0].changes.insert).toBe("x");
	});

	it("replaces the selection when asked", async () => {
		const { insertIntoEditorFile } = await import("lib/ai/editorBridge");
		const htmlFile = { type: "editor", filename: "sel.html" };
		const view = makeView("hello world", 0, 5);
		const manager = {
			activeFile: htmlFile,
			editor: view,
			files: [htmlFile],
			editorHistory: [htmlFile],
		};

		const result = await insertIntoEditorFile(manager, "goodbye", {
			replaceSelection: true,
		});

		expect(result.ok).toBe(true);
		expect(view.transactions[0].changes).toEqual({
			from: 0,
			to: 5,
			insert: "goodbye",
		});
	});

	it("reports no file when nothing is open anywhere", async () => {
		const { insertIntoEditorFile } = await import("lib/ai/editorBridge");
		const welcome = { type: "page", filename: "Welcome" };
		const manager = {
			activeFile: welcome,
			editor: null,
			files: [welcome],
			panes: [{ files: [welcome] }],
			editorHistory: [welcome],
		};

		const result = await insertIntoEditorFile(manager, "x");

		expect(result.ok).toBe(false);
		expect(result.message).toContain("no file is open");
	});

	it("rejects oversized payloads without touching the editor", async () => {
		const { insertIntoEditorFile } = await import("lib/ai/editorBridge");
		const htmlFile = { type: "editor", filename: "big.html" };
		const view = makeView("content", 0, 0);
		const manager = {
			activeFile: htmlFile,
			editor: view,
			files: [htmlFile],
			editorHistory: [htmlFile],
		};

		const result = await insertIntoEditorFile(manager, "a".repeat(30001));

		expect(result.ok).toBe(false);
		expect(view.transactions).toHaveLength(0);
	});

	it("waitForEditorView gives up after the polling budget", async () => {
		const { waitForEditorView } = await import("lib/ai/editorBridge");
		const view = makeView("x", 0, 0);
		let reads = 0;
		const manager = {
			get editor() {
				reads += 1;
				// only becomes ready far beyond the 8-attempt budget
				return reads > 100 ? view : null;
			},
		};

		const result = await waitForEditorView(manager, 8, 1);
		expect(result).toBeNull();
	});
});
