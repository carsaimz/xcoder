import { describe, expect, it, vi } from "vitest";

vi.mock("fileSystem", () => ({ default: vi.fn(() => ({})) }));
vi.mock("lib/openFolder", () => ({ addedFolder: [] }));
vi.mock("lib/ai/vshell", () => ({
	default: {
		exec: vi.fn(),
		getRoot: () => "file:///workspace",
		getCwd: () => "file:///workspace",
		setCwd: vi.fn(),
		resolvePath: vi.fn(),
	},
	exec: vi.fn(),
}));

import { diffTrees, isTextFile, preparedCommands } from "lib/gitPanel";

describe("diffTrees", () => {
	const last = {
		"src/a.js": "old",
		"src/b.js": "same",
		"src/old.js": "bye",
	};
	const current = {
		"src/a.js": "new",
		"src/b.js": "same",
		"src/new.js": "hi",
	};

	it("classifies modified, added and deleted files", () => {
		const diff = diffTrees(last, current);
		expect(diff).toEqual({
			modified: ["src/a.js"],
			added: ["src/new.js"],
			deleted: ["src/old.js"],
		});
	});

	it("handles empty snapshot (everything added)", () => {
		const diff = diffTrees({}, { "a.md": "x", "b.md": "y" });
		expect(diff.added).toEqual(["a.md", "b.md"]);
		expect(diff.modified).toEqual([]);
		expect(diff.deleted).toEqual([]);
	});

	it("sorts results alphabetically", () => {
		const diff = diffTrees(
			{ "z.js": "1", "a.js": "1" },
			{ "z.js": "2", "a.js": "2" },
		);
		expect(diff.modified).toEqual(["a.js", "z.js"]);
	});
});

describe("isTextFile", () => {
	it("accepts common code/text extensions", () => {
		for (const name of ["app.js", "index.tsx", "style.scss", "README.md", "data.json", "main.py", "Makefile.txt"]) {
			expect(isTextFile(`file:///p/${name}`)).toBe(true);
		}
	});

	it("rejects binaries", () => {
		for (const name of ["app.apk", "logo.png", "font.ttf", "song.mp3", "archive.zip"]) {
			expect(isTextFile(`file:///p/${name}`)).toBe(false);
		}
	});
});

describe("preparedCommands", () => {
	it("always offers the init/commit baseline", () => {
		const commands = preparedCommands("", "feat: x");
		expect(commands).toHaveLength(1);
		expect(commands[0].command).toContain('git commit -m "feat: x"');
	});

	it("includes remote, pr, release and clone when a repo is set", () => {
		const commands = preparedCommands(
			"https://github.com/carsaimz/xcoder.git",
			"fix: bug",
		);
		const all = commands.map((entry) => entry.command).join("\n");
		expect(all).toContain("git remote add origin https://github.com/carsaimz/xcoder.git");
		expect(all).toContain("gh pr create");
		expect(all).toContain("gh release create");
		expect(all).toContain("gh repo clone carsaimz/xcoder");
	});

	it("escapes double quotes in the commit message", () => {
		const commands = preparedCommands("", 'fix: say "hi"');
		expect(commands[0].command).toContain('\\"hi\\"');
	});
});
