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
