import { describe, expect, it } from "vitest";
import {
        BUILTIN_SKILLS,
        buildSkillsSection,
        parseSkillMarkdown,
        slugify,
} from "lib/ai/skills";

describe("skills", () => {
        it("parses frontmatter (name + description)", () => {
                const skill = parseSkillMarkdown(
                        "---\nname: Debug Build\ndescription: Fix compile errors\n---\nStep 1. Reproduce.",
                        "fallback",
                );
                expect(skill.name).toBe("debug-build");
                expect(skill.description).toBe("Fix compile errors");
                expect(skill.body).toBe("Step 1. Reproduce.");
        });

        it("falls back to the file name and derives a description", () => {
                const skill = parseSkillMarkdown("Just the instructions body.", "my-skill");
                expect(skill.name).toBe("my-skill");
                expect(skill.description).toContain("Just the instructions");
                expect(skill.body).toBe("Just the instructions body.");
        });

        it("returns null for empty documents", () => {
                expect(parseSkillMarkdown("   ")).toBeNull();
                expect(parseSkillMarkdown("")).toBeNull();
        });

        it("slugifies names", () => {
                expect(slugify("  Debug Build! ")).toBe("debug-build");
                expect(slugify("code-review v2")).toBe("code-review-v2");
        });

        it("ships a non-empty builtin catalog with unique names", () => {
                expect(BUILTIN_SKILLS.length).toBeGreaterThanOrEqual(3);
                const names = BUILTIN_SKILLS.map((skill) => skill.name);
                expect(new Set(names).size).toBe(names.length);
        });

        it("builds a prompt section only from enabled skills", () => {
                const skills = BUILTIN_SKILLS.slice(0, 2);
                const section = buildSkillsSection(skills);
                expect(section).toContain("- SKILLS:");
                expect(section).toContain(skills[0].name);
        });
});

describe("skills io (imported dirs)", () => {
	it("merges builtin + imported + workspace skills in order", async () => {
		const { listSkills } = await import("lib/ai/skills");
		const io = {
			workspaceUrl: "file:///ws",
			dirs: [{ url: "file:///data/skills", source: "imported" }],
			listDir: (url) =>
				url === "file:///data/skills"
					? ["jwt.md"]
					: [".xcoder/skills/custom.md".split("/").pop()],
			readFile: (url) =>
				url.includes("jwt")
					? "---\nname: jwt helper\n---\nbody"
					: "---\nname: custom skill\n---\nbody",
		};
		const skills = await listSkills(io);
		const sources = skills.map((s) => s.source);
		expect(sources).toContain("builtin");
		expect(sources).toContain("imported");
		expect(sources).toContain("workspace");
	});

	it("skips duplicate names (first source wins)", async () => {
		const { listSkills } = await import("lib/ai/skills");
		const io = {
			dirs: [{ url: "/x", source: "imported" }],
			listDir: () => ["debug-build.md"],
			readFile: () => "duplicate body",
		};
		const skills = await listSkills(io);
		const found = skills.filter((s) => s.name === "debug-build");
		expect(found).toHaveLength(1);
		expect(found[0].source).toBe("builtin");
	});

	it("continues when a folder cannot be listed", async () => {
		const { listSkills } = await import("lib/ai/skills");
		const io = {
			dirs: [{ url: "/bad", source: "imported" }],
			listDir: () => Promise.reject(new Error("no dir")),
			readFile: () => "x",
		};
		const skills = await listSkills(io);
		expect(skills.every((s) => s.source === "builtin")).toBe(true);
	});
});

describe("githubToRaw", () => {
	it("converts github blob URLs to raw", async () => {
		const { githubToRaw } = await import("lib/ai/skills");
		expect(
			githubToRaw("https://github.com/u/r/blob/main/skills/a.md"),
		).toBe("https://raw.githubusercontent.com/u/r/main/skills/a.md");
		expect(githubToRaw("https://raw.githubusercontent.com/u/r/main/a.md")).toBe(
			"https://raw.githubusercontent.com/u/r/main/a.md",
		);
		expect(githubToRaw("https://example.com/skill.md")).toBe(
			"https://example.com/skill.md",
		);
	});
});
