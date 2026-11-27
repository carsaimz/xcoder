/**
 * Keybindings editor plumbing.
 *
 * normalizeKeyCombo validates typed combinations (the settings UI uses
 * it as promptOptions.test); saveKeyBindings persists overrides and
 * re-resolves the keymap — its file side effect is covered by the
 * commandRegistry integration, here we assert the module surface and
 * the validation rules.
 */
import { describe, expect, it } from "vitest";
import { normalizeKeyCombo } from "cm/keyBindingUtils";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const registrySource = readFileSync(
	join(process.cwd(), "src/cm/commandRegistry.js"),
	"utf8",
);

describe("keybindings editor", () => {
	it("accepts single combos, chords and clears", () => {
		expect(normalizeKeyCombo("Ctrl-D")).toMatch(/mod/i);
		expect(normalizeKeyCombo("Ctrl-K Ctrl-C")).toContain(" ");
		expect(normalizeKeyCombo("  Alt-Shift-F ")).toMatch(/alt/i);
		expect(normalizeKeyCombo("")).toBe("");
		expect(normalizeKeyCombo("   ")).toBe("");
	});

	it("rejects garbage combos", () => {
		expect(normalizeKeyCombo("not-a-key")).toBeNull();
		expect(normalizeKeyCombo(null)).toBe("");
	});

	it("commandRegistry exposes saveKeyBindings", () => {
		expect(registrySource).toContain("export async function saveKeyBindings");
		expect(registrySource).toContain("return setKeyBindings()");
	});

	it("the commands hub wires the editor action", () => {
		const commandsSource = readFileSync(
			join(process.cwd(), "src/lib/commands.js"),
			"utf8",
		);
		expect(commandsSource).toContain('"open-keybindings"');
		expect(commandsSource).toContain("keybindingsEditor()");
	});
});
