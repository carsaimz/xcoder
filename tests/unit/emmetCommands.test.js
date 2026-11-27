/**
 * Full Emmet command port.
 *
 * commandRegistry.js pulls the whole app graph (LSP, quickTools, dialogs…)
 * which is too heavy to import in unit tests, so the registration wiring is
 * pinned at source level (same strategy as keybindingsEditor.test.js) plus
 * a functional test of the emmet-core expansion contract used by the wrap
 * command.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import emmetExpand from "emmet";

const root = process.cwd();
const registrySource = readFileSync(join(root, "src/cm/commandRegistry.js"), "utf8");
const editorManagerSource = readFileSync(join(root, "src/lib/editorManager.js"), "utf8");
const sidebarSource = readFileSync(join(root, "src/sidebarApps/index.js"), "utf8");

const EMMET_NAMES = [
	"emmet.expandAbbreviation",
	"emmet.wrapWithAbbreviation",
	"emmet.balanceInward",
	"emmet.balanceOutward",
	"emmet.selectNextItem",
	"emmet.selectPreviousItem",
	"emmet.incrementNumber1",
	"emmet.incrementNumber10",
	"emmet.incrementNumber01",
	"emmet.decrementNumber1",
	"emmet.decrementNumber10",
	"emmet.decrementNumber01",
	"emmet.evaluateMath",
	"emmet.goToNextEditPoint",
	"emmet.goToPreviousEditPoint",
	"emmet.goToTagPair",
	"emmet.removeTag",
	"emmet.splitJoinTag",
	"emmet.enterAbbreviationMode",
];

describe("full Emmet command port", () => {
	it("registers every Emmet command from the plugin", () => {
		for (const name of EMMET_NAMES) {
			expect(registrySource).toContain(`"${name}"`);
		}
	});

	it("routes the commands through the registry init sequence", () => {
		expect(registrySource).toContain("registerEmmetCommands();");
		expect(registrySource).toMatch(
			/function registerEmmetCommands\(\)\s*\{[\s\S]*?addCommand\(\{/,
		);
	});

	it("gives VS Code-like default keys and stays rebindable", () => {
		expect(registrySource).toContain('"Mod-e"');
		expect(registrySource).toContain('"Mod-Shift-."');
		expect(registrySource).toContain('"Mod-Shift-,"');
		// no more hardcoded Mod-e keymap inside the emmet extension set —
		// the registry keymap is the single source of truth
		expect(editorManagerSource).not.toContain('key: "Mod-e"');
	});

	it("no-ops when Emmet is disabled in settings", () => {
		expect(registrySource).toMatch(
			/useEmmet === false[\s\S]{0,120}return false/,
		);
	});

	it("keeps the interactive wrap command prompting for an abbreviation", () => {
		expect(registrySource).toContain("wrapWithEmmetCommand");
		expect(registrySource).toContain('"wrap with abbreviation"');
		expect(registrySource).toContain("emmetExpandAbbreviation(");
	});

	it("registers the task runner palette commands", () => {
		expect(registrySource).toContain('"runNpmTask"');
		expect(registrySource).toContain('"stopRunningTask"');
		expect(registrySource).toContain("registerTaskRunnerCommands();");
	});

	it("mounts the Tasks sidebar app next to git", () => {
		expect(sidebarSource).toContain('["tasks", () => import("./tasks")]');
	});
});

describe("emmet-core wrap contract (used by the wrap command)", () => {
	it("expands a markup abbreviation", () => {
		const out = emmetExpand("ul.wrap>li.item*2", {
			syntax: "html",
		});
		expect(out).toContain('<ul class="wrap">');
		expect(out).toContain('<li class="item">');
		expect(out.match(/<li/g).length).toBe(2);
	});

	it("wraps provided text lines (the selection)", () => {
		const out = emmetExpand("div.card", {
			syntax: "html",
			text: ["hello", "world"],
			options: { "output.indent": "    ", "output.newline": "\n" },
		});
		expect(out).toContain("<div class=\"card\">");
		expect(out).toContain("hello");
		expect(out).toContain("world");
		expect(out.split("\n").length).toBeGreaterThan(2);
	});

	it("honours the indent option", () => {
		const out = emmetExpand("div>p", {
			syntax: "html",
			options: { "output.indent": "\t", "output.newline": "\n" },
		});
		expect(out).toContain('\t<p>');
	});

	it("throws on garbage abbreviations so the command can toast", () => {
		expect(() =>
			emmetExpand(">", { syntax: "html" }),
		).toThrow();
	});
});
