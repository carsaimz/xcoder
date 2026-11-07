// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
	exitSelectionMode,
	isSelected,
	isSelectionMode,
	enterSelectionMode,
	onSelectionChange,
	selectAll,
	selectRange,
	selectedUrls,
	selectionCount,
	toggle,
	unselect,
	resetSelection,
} from "lib/fileSelection";

describe("fileSelection (explorer multi-select)", () => {
	it("toggle adds and removes rows and tracks mode", () => {
		resetSelection();
		toggle("a", ["a", "b", "c"]);
		expect(isSelected("a")).toBe(true);
		expect(isSelectionMode()).toBe(true);
		toggle("a", []);
		expect(isSelected("a")).toBe(false);
		expect(isSelectionMode()).toBe(false);
	});

	it("selectRange fills between anchor and clicked row", () => {
		resetSelection();
		toggle("a", ["a", "b", "c", "d"]);
		selectRange("c", ["a", "b", "c", "d"]);
		expect(selectedUrls().sort()).toEqual(["a", "b", "c"]);
	});

	it("selectRange works backwards", () => {
		resetSelection();
		toggle("c", ["a", "b", "c", "d"]);
		selectRange("a", ["a", "b", "c", "d"]);
		expect(selectedUrls().sort()).toEqual(["a", "b", "c"]);
	});

	it("selectAll selects everything in the list context", () => {
		resetSelection();
		selectAll(["x", "y", "z"]);
		expect(selectionCount()).toBe(3);
		expect(isSelectionMode()).toBe(true);
	});

	it("enterSelectionMode seeds the first row", () => {
		resetSelection();
		enterSelectionMode("seed");
		expect(selectedUrls()).toEqual(["seed"]);
		exitSelectionMode();
		expect(selectionCount()).toBe(0);
	});

	it("unselect drops urls and leaves mode when empty", () => {
		resetSelection();
		selectAll(["1", "2"]);
		unselect(["1", "2"]);
		expect(isSelectionMode()).toBe(false);
	});

	it("notifies listeners with urls + active state", () => {
		resetSelection();
		const seen = [];
		const off = onSelectionChange((state) => seen.push(state));
		toggle("a", ["a"]);
		off();
		toggle("b");
		expect(seen).toEqual([
			{ urls: ["a"], active: true },
		]);
	});
});
