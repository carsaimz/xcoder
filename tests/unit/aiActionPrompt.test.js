import { describe, expect, it } from "vitest";
import {
        buildActionPrompt,
        MUTATING_KINDS,
} from "lib/ai/actionPrompt";

describe("buildActionPrompt", () => {
        const ctx = {
                fileName: "src/app.js",
        };

        it("does not embed file content (the agent reads the file itself)", () => {
                const prompt = buildActionPrompt("explain", {
                        ...ctx,
                        // the old API sent code along; the new one must ignore it
                        code: "const x = 1; // SHOULD NOT APPEAR",
                });

                expect(prompt).toContain("src/app.js");
                expect(prompt).not.toContain("const x = 1;");
                expect(prompt).not.toContain("```");
                expect(prompt.toLowerCase()).toContain("read");
        });

        it("tells mutating actions to apply changes with tools", () => {
                for (const kind of MUTATING_KINDS) {
                        const prompt = buildActionPrompt(kind, ctx);
                        expect(prompt.toLowerCase()).toContain("edit");
                }
        });

        it("references the selection line range when provided", () => {
                const prompt = buildActionPrompt("explain", {
                        ...ctx,
                        lineStart: 42,
                        lineEnd: 57,
                        selectionChars: 300,
                });

                expect(prompt).toContain("42-57");
                expect(prompt).toContain("selection");
        });

        it("does not mention lines when there is no selection", () => {
                const prompt = buildActionPrompt("explain", ctx);

                expect(prompt).not.toContain("selection");
                expect(prompt).not.toContain("truncated");
        });

        it("custom kind uses the user instruction", () => {
                const prompt = buildActionPrompt("custom", {
                        ...ctx,
                        instruction: "How can I make this testable?",
                });

                expect(prompt).toContain("How can I make this testable?");
                expect(prompt).toContain("src/app.js");
        });

        it("custom kind falls back to a review request when empty", () => {
                const prompt = buildActionPrompt("custom", { ...ctx, instruction: "  " });

                expect(prompt.toLowerCase()).toContain("review");
        });

        it("falls back to explain for unknown kinds", () => {
                const prompt = buildActionPrompt("nonsense", ctx);

                expect(prompt).toContain("Explain");
        });
});
