// @vitest-environment happy-dom
/**
 * Desktop (Electron) menu → app command bridge.
 *
 * The native menu sends command ids as `xcoder:menu-command` CustomEvents;
 * the bridge must map them onto lib/commands (and CodeMirror commands via
 * xcoder.execCommand), ignore unknown/invalid ids and stay inert outside
 * the desktop runtime.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.mock is hoisted — the mock object must be hoisted with it.
const commandsMock = vi.hoisted(() => ({
	open: vi.fn(),
	"new-file": vi.fn(),
	"open-file": vi.fn(),
	"open-folder": vi.fn(),
	save: vi.fn(),
	"save-all-changes": vi.fn(),
	"close-current-tab": vi.fn(),
	"close-all-tabs": vi.fn(),
	"toggle-sidebar": vi.fn(),
	"toggle-fullscreen": vi.fn(),
	"new-terminal": vi.fn(),
	console: vi.fn(),
	"find-file": vi.fn(),
	"command-palette": vi.fn(),
}));

vi.mock("lib/commands", () => ({ default: commandsMock }));
vi.mock("lib/settings", () => ({
	default: { value: {}, on: () => {}, get: () => ({}) },
}));
vi.mock("lib/logger", () => ({
	default: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}));

import initDesktopMenu, { handleMenuCommand } from "lib/desktopMenu";

describe("desktopMenu bridge", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete window.xcoder;
		delete window.xcoderDesktop;
	});

	it("executes app commands by id", () => {
		expect(handleMenuCommand("open-folder")).toBe(true);
		expect(commandsMock["open-folder"]).toHaveBeenCalledTimes(1);

		expect(handleMenuCommand("save-all-changes")).toBe(true);
		expect(commandsMock["save-all-changes"]).toHaveBeenCalledTimes(1);
	});

	it("routes settings through commands.open('settings')", () => {
		expect(handleMenuCommand("settings")).toBe(true);
		expect(commandsMock.open).toHaveBeenCalledWith("settings");
	});

	it("executes editor commands through xcoder.execCommand", () => {
		const execCommand = vi.fn(() => true);
		window.xcoder = { execCommand };

		expect(handleMenuCommand("undo")).toBe(true);
		expect(execCommand).toHaveBeenCalledWith("undo");
		expect(handleMenuCommand("selectall")).toBe(true);
		expect(execCommand).toHaveBeenCalledWith("selectall");
	});

	it("returns false for unknown or invalid ids", () => {
		expect(handleMenuCommand("definitely-not-a-command")).toBe(false);
		expect(handleMenuCommand("")).toBe(false);
		expect(handleMenuCommand(null)).toBe(false);
		expect(handleMenuCommand(42)).toBe(false);
	});

	it("returns false when the editor command cannot run", () => {
		expect(handleMenuCommand("undo")).toBe(false);
	});

	it("initDesktopMenu is a no-op outside the desktop runtime", () => {
		const addEventListener = vi.spyOn(window, "addEventListener");
		initDesktopMenu();
		expect(addEventListener).not.toHaveBeenCalledWith(
			"xcoder:menu-command",
			expect.any(Function),
		);
		addEventListener.mockRestore();
	});

	it("listens and dispatches inside the desktop runtime", () => {
		window.xcoderDesktop = true;
		initDesktopMenu();

		window.dispatchEvent(
			new CustomEvent("xcoder:menu-command", { detail: "new-file" }),
		);
		expect(commandsMock["new-file"]).toHaveBeenCalledTimes(1);

		// unknown command inside the listener must not throw
		expect(() =>
			window.dispatchEvent(
				new CustomEvent("xcoder:menu-command", { detail: "nope" }),
			),
		).not.toThrow();

		// failing command is logged, not propagated
		commandsMock.save.mockImplementationOnce(() => {
			throw new Error("boom");
		});
		expect(() =>
			window.dispatchEvent(
				new CustomEvent("xcoder:menu-command", { detail: "save" }),
			),
		).not.toThrow();
	});
});
