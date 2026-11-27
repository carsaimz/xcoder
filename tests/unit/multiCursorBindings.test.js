/**
 * Multi-cursor (VS Code parity): Ctrl-D adds a cursor at the next
 * occurrence of the selection/word, Ctrl-Shift-L selects all
 * occurrences. selectWord loses Ctrl-D (the binding was a no-op —
 * no commands.js action existed for "select-word").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	selectNextOccurrence,
	selectSelectionMatches,
} from "@codemirror/search";
import { describe, expect, it } from "vitest";
import keyBindings from "lib/keyBindings";

const commandsSource = readFileSync(
	join(process.cwd(), "src/lib/commands.js"),
	"utf8",
);

describe("multi-cursor bindings", () => {
	it("Ctrl-D adds a cursor at the next occurrence", () => {
		expect(keyBindings.selectNextOccurrence).toMatchObject({
			key: "Ctrl-D",
			action: "select-next-occurrence",
			editorOnly: true,
			readOnly: false,
		});
	});

	it("Ctrl-Shift-L selects all occurrences", () => {
		expect(keyBindings.selectAllOccurrences).toMatchObject({
			key: "Ctrl-Shift-L",
			action: "select-all-occurrences",
			editorOnly: true,
			readOnly: false,
		});
	});

	it("selectWord no longer claims Ctrl-D", () => {
		expect(keyBindings.selectWord?.key ?? null).toBeNull();
	});

	it("commands.js runs the CodeMirror occurrence commands", () => {
		expect(commandsSource).toContain('"select-next-occurrence"');
		expect(commandsSource).toContain("selectNextOccurrence(view)");
		expect(commandsSource).toContain('"select-all-occurrences"');
		expect(commandsSource).toContain("selectSelectionMatches(view)");
	});

	it("the CodeMirror primitives exist", () => {
		expect(typeof selectNextOccurrence).toBe("function");
		expect(typeof selectSelectionMatches).toBe("function");
	});
});
