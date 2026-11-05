/**
 * Desktop (Electron) menu → app command bridge.
 *
 * The native menu (desktop/main.cjs) sends command ids over the
 * "xcoder:menu-command" IPC channel; the desktop preload re-emits them as a
 * `xcoder:menu-command` CustomEvent in the page world. This module maps
 * those ids onto the very same command registry the app UI uses, so the
 * menu can never drift from the app's own actions — and user-remapped key
 * bindings keep working because the menu accelerators are displayed but
 * registered by the page (registerAccelerator: false).
 */

import commands from "lib/commands";

/** Command ids the native menu may send, executed via lib/commands. */
const MENU_COMMANDS = new Set([
	"close-all-tabs",
	"close-current-tab",
	"command-palette",
	"console",
	"find-file",
	"new-file",
	"new-terminal",
	"open-file",
	"open-folder",
	"save",
	"save-all-changes",
	"toggle-fullscreen",
	"toggle-sidebar",
]);

/** Editor (CodeMirror) commands that go through xcoder.execCommand. */
const EDITOR_COMMANDS = new Set(["redo", "selectall", "undo"]);

/**
 * Runs one menu command. Exported for tests.
 * @param {string} command command id sent by the native menu
 * @returns {boolean} whether the command was recognized
 */
export function handleMenuCommand(command) {
	if (typeof command !== "string" || !command) return false;

	if (EDITOR_COMMANDS.has(command)) {
		return Boolean(window.xcoder?.execCommand?.(command));
	}

	if (command === "settings") {
		commands.open("settings");
		return true;
	}

	if (!MENU_COMMANDS.has(command)) return false;
	const run = commands[command];
	if (typeof run !== "function") return false;
	run.call(commands);
	return true;
}

/**
 * Installs the listener for native menu events. No-op outside the
 * Electron desktop (window.xcoderDesktop is set by the preload).
 */
export default function initDesktopMenu() {
	if (!window.xcoderDesktop) return;
	window.addEventListener("xcoder:menu-command", (event) => {
		try {
			handleMenuCommand(event.detail);
		} catch (error) {
			window.log?.("error", `Menu command failed: ${error.message || error}`);
		}
	});
}
