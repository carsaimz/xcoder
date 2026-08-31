import { describe, expect, it } from "vitest";
import {
	MAX_CODE_CHARS,
	buildActionPrompt,
	MUTATING_KINDS,
} from "lib/ai/actionPrompt";

describe("buildActionPrompt", () => {
	const ctx = {
		fileName: "src/app.js",
		code: "const x = 1;",
	};

	it("explains without modifying anything", () => {
		const prompt = buildActionPrompt("explain", ctx);

		expect(prompt).toContain("src/app.js");
		expect(prompt).toContain("const x = 1;");
		expect(prompt).toContain("```");
		expect(prompt).not.toContain("edit_file");
	});

	it("tells mutating actions to apply changes with tools", () => {
		for (const kind of MUTATING_KINDS) {
			const prompt = buildActionPrompt(kind, ctx);
			expect(prompt).toContain("edit_file");
		}
	});

	it("warns when the code was truncated", () => {
		const prompt = buildActionPrompt("explain", {
			...ctx,
			truncated: true,
		});

		expect(prompt).toContain(String(MAX_CODE_CHARS));
		expect(prompt).toContain("truncated");
	});

	it("does not warn when nothing was truncated", () => {
		const prompt = buildActionPrompt("explain", ctx);

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

	it("annotates the start line for selections", () => {
		const prompt = buildActionPrompt("explain", { ...ctx, lineStart: 42 });

		expect(prompt).toContain("line 42");
	});

	it("falls back to explain for unknown kinds", () => {
		const prompt = buildActionPrompt("nonsense", ctx);

		expect(prompt).toContain("Explain");
	});
});
