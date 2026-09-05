import { describe, expect, it } from "vitest";
import {
	SLASH_COMMANDS,
	expandSlashCommand,
	matchSlashCommands,
} from "lib/ai/slashCommands";

describe("slash commands", () => {
	it("exposes the full command catalog", () => {
		const ids = SLASH_COMMANDS.map((command) => command.id);
		expect(ids).toEqual([
			"image",
			"explain",
			"fix",
			"refactor",
			"tests",
			"review",
			"analyse",
			"read",
			"skill",
			"commit",
		]);
	});

	it("matches commands by typed prefix for the popup", () => {
		expect(matchSlashCommands("")).toEqual([]);
		expect(matchSlashCommands("hello")).toEqual([]);
		expect(matchSlashCommands("/")).toHaveLength(SLASH_COMMANDS.length);
		expect(matchSlashCommands("/fi").map((c) => c.id)).toEqual(["fix"]);
		// a space after the word stops the popup
		expect(matchSlashCommands("/fix ")).toEqual([]);
	});

	it("expands /explain with the selection inline", () => {
		const prompt = expandSlashCommand("/explain step by step", {
			hasFile: true,
			fileName: "app.js",
			selection: "const x = 1;",
		});

		expect(prompt).toContain("Explain");
		expect(prompt).toContain("step by step");
		expect(prompt).toContain("const x = 1;");
		expect(prompt).toContain("```");
	});

	it("expands mutating commands to mention the editing tools", () => {
		for (const id of ["fix", "refactor"]) {
			const prompt = expandSlashCommand(`/${id}`, { hasFile: false });
			expect(prompt).toContain("edit_file");
		}
	});

	it("/commit builds a vcs workflow prompt", () => {
		const prompt = expandSlashCommand("/commit add parser module");
		expect(prompt).toContain("vcs status");
		expect(prompt).toContain("vcs commit");
		expect(prompt).toContain("add parser module");
	});

	it("falls back to the active file when there is no selection", () => {
		const prompt = expandSlashCommand("/review", {
			hasFile: true,
			fileName: "src/lib/fs.js",
		});
		expect(prompt).toContain("src/lib/fs.js");
		expect(prompt).toContain("read_active_file");
	});

	it("warns the model when nothing is open", () => {
		const prompt = expandSlashCommand("/fix", { hasFile: false });
		expect(prompt).toContain("no file is open");
	});

	it("caps very long selections", () => {
		const prompt = expandSlashCommand("/explain", {
			selection: "a".repeat(9000),
		});
		expect(prompt).toContain("selection truncated");
	});

	it("passes plain input through untouched", () => {
		expect(expandSlashCommand("hello world")).toBeNull();
		expect(expandSlashCommand("/unknowncmd")).toBeNull();
		expect(expandSlashCommand("")).toBeNull();
	});

	it("is case-insensitive on the command id", () => {
		const prompt = expandSlashCommand("/FIX bug", { hasFile: false });
		expect(prompt).not.toBeNull();
		expect(prompt).toContain("fix");
	});
});
