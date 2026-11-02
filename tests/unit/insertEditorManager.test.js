// @vitest-environment node
/**
 * Regression guard for the "no file is open in the editor" toast:
 * devtools and libs imported the lib/editorManager ASYNC FACTORY and
 * read .activeFile off the function itself — always undefined, so the
 * insert buttons failed even with a file open. They must use the live
 * window.editorManager instance instead.
 */
import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function sourceOf(...parts) {
	return readFileSync(join(root, ...parts), "utf-8");
}

describe("insert uses the live editor manager", () => {
	test("devtools does not import the editorManager factory", () => {
		const source = sourceOf("src", "sidebarApps", "devtools", "index.js");
		assert.ok(
			!source.includes('from "lib/editorManager"'),
			"devtools must not import lib/editorManager — the export is an async " +
				"factory, reading .activeFile from it always yields undefined " +
				'("No file is open in the editor")',
		);
		assert.ok(
			source.includes("window.editorManager"),
			"devtools insert path must use window.editorManager",
		);
	});

	test("libs does not import the editorManager factory", () => {
		const source = sourceOf("src", "sidebarApps", "libs", "index.js");
		assert.ok(
			!source.includes('from "lib/editorManager"'),
			"libs must not import lib/editorManager — same factory trap as devtools",
		);
		assert.ok(
			source.includes("window.editorManager"),
			"libs insert path must use window.editorManager",
		);
	});

	test("ai app keeps using window.editorManager", () => {
		const source = sourceOf("src", "sidebarApps", "ai", "index.js");
		assert.ok(
			source.includes("window.editorManager"),
			"ai insert path must use window.editorManager",
		);
	});
});
