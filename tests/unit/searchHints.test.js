// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

// html-tag-js JSX shim used by the checkbox component.
vi.mock("html-tag-js", async (importOriginal) => ({
	...(await importOriginal()),
}));

const tooltipApi = vi.hoisted(() => ({
	show: vi.fn(),
	hide: vi.fn(),
}));

vi.mock("components/tooltip", () => ({
	showTooltip: tooltipApi.show,
	hideTooltip: tooltipApi.hide,
}));

const { default: Checkbox } = await import("components/checkbox");
const { installIconTooltips } = await import("components/tooltip/longPress");

describe("checkbox hints", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.clearAllMocks();
	});

	it("sets title, aria-label and data-description when provided", () => {
		const $box = Checkbox({
			text: "aA",
			checked: false,
			title: "Case sensitive",
			description: "Match letter case exactly",
		});

		expect($box.getAttribute("title")).toBe("Case sensitive");
		expect($box.getAttribute("aria-label")).toBe("Case sensitive");
		expect($box.dataset.description).toBe("Match letter case exactly");
	});

	it("uses ariaLabel over title for the accessible name", () => {
		const $box = Checkbox({
			text: ".*",
			checked: false,
			title: "Regex",
			ariaLabel: "Regular expression",
		});

		expect($box.getAttribute("aria-label")).toBe("Regular expression");
		expect($box.getAttribute("title")).toBe("Regex");
	});
});

describe("long-press tooltips", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.clearAllMocks();
	});

	function install() {
		const root = document.createElement("div");
		document.body.append(root);
		const instance = installIconTooltips(root, tooltipApi.show, tooltipApi.hide);
		return { root, instance };
	}

	function pointerEvent(type, target, x = 10, y = 10) {
		return new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			composed: true,
			clientX: x,
			clientY: y,
			button: 0,
			pointerId: 1,
		});
	}

	it("shows a hint after a long press on a titled checkbox", async () => {
		const { root } = install();
		const $box = Checkbox({
			text: "IDX",
			checked: false,
			title: "Use native index",
			description: "Search with the workspace index",
		});
		root.append($box);

		$box.dispatchEvent(pointerEvent("pointerdown"));
		await new Promise((resolve) => setTimeout(resolve, 550));

		expect(tooltipApi.show).toHaveBeenCalled();
		const [target, label, description] = tooltipApi.show.mock.calls.at(-1);
		expect(target).toBe($box);
		expect(label).toBe("Use native index");
		expect(description).toBe("Search with the workspace index");
	});

	it("dismisses on quick release without showing", async () => {
		const { root } = install();
		const $button = document.createElement("button");
		$button.setAttribute("title", "Run");
		root.append($button);

		$button.dispatchEvent(pointerEvent("pointerdown"));
		$button.dispatchEvent(pointerEvent("pointerup"));
		await new Promise((resolve) => setTimeout(resolve, 550));

		expect(tooltipApi.show).not.toHaveBeenCalled();
	});

	it("ignores targets without a label", async () => {
		const { root } = install();
		const $button = document.createElement("button");
		root.append($button);

		$button.dispatchEvent(pointerEvent("pointerdown"));
		await new Promise((resolve) => setTimeout(resolve, 550));

		expect(tooltipApi.show).not.toHaveBeenCalled();
	});
});
