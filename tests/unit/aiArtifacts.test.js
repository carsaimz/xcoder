import { describe, expect, it } from "vitest";
import {
	buildUserContent,
	collectArtifacts,
	formatTokenCount,
} from "lib/ai/artifacts";

describe("collectArtifacts", () => {
	const transcript = [
		{ type: "user", payload: "create a util" },
		{
			type: "assistant",
			payload: "",
			toolCalls: [
				{
					id: "c1",
					function: {
						name: "create_file",
						arguments: '{"path":"src/util.js","content":"..."}',
					},
				},
				{
					id: "c2",
					function: {
						name: "edit_file",
						arguments: '{"path":"src/util.js","old_text":"a","new_text":"b"}',
					},
				},
				{
					id: "c3",
					function: {
						name: "run_command",
						arguments: '{"command":"vcs commit -m add"}',
					},
				},
				{
					id: "c4",
					function: { name: "read_file", arguments: '{"path":"src/app.js"}' },
				},
			],
		},
		{ type: "tool", toolCallId: "c1", payload: "File created" },
		{ type: "tool", toolCallId: "c2", payload: "ERROR: old_text not found" },
		{ type: "tool", toolCallId: "c3", payload: "committed" },
		{ type: "tool", toolCallId: "c4", payload: "file body" },
		{
			type: "usage",
			payload: { prompt: 1200, completion: 300, total: 1500 },
		},
	];

	it("derives files with actions and outcomes", () => {
		const data = collectArtifacts(transcript);
		expect(data.files).toHaveLength(2);
		expect(data.files[0]).toEqual({
			path: "src/util.js",
			action: "created",
			ok: true,
		});
		expect(data.files[1]).toEqual({
			path: "src/util.js",
			action: "edited",
			ok: false,
		});
	});

	it("derives commands and tool counts", () => {
		const data = collectArtifacts(transcript);
		expect(data.commands).toHaveLength(1);
		expect(data.commands[0].command).toBe("vcs commit -m add");
		expect(data.commands[0].ok).toBe(true);
		expect(data.tools.read_file).toBe(1);
		expect(data.tools.create_file).toBe(1);
	});

	it("collects usage", () => {
		const data = collectArtifacts(transcript);
		expect(data.tokens).toEqual({ prompt: 1200, completion: 300, total: 1500 });
	});

	it("returns empty structure for empty transcript", () => {
		const data = collectArtifacts([]);
		expect(data.files).toEqual([]);
		expect(data.commands).toEqual([]);
		expect(data.tools).toEqual({});
		expect(data.tokens.total).toBe(0);
	});
});

describe("formatTokenCount", () => {
	it("formats thousands compactly", () => {
		expect(formatTokenCount(950)).toBe("950");
		expect(formatTokenCount(1234)).toBe("1.2k");
		expect(formatTokenCount(15300)).toBe("15k");
	});
});

describe("buildUserContent", () => {
	it("returns plain text without attachments", () => {
		expect(buildUserContent("hello", [])).toBe("hello");
		expect(buildUserContent("hello")).toBe("hello");
	});

	it("lists file paths without inlining content", () => {
		const content = buildUserContent("review this", [
			{ type: "file", path: "src/a.js" },
		]);
		expect(Array.isArray(content)).toBe(true);
		expect(content[0].text).toContain("src/a.js");
		expect(content[0].text).toContain("read_file");
		expect(JSON.stringify(content)).not.toContain("file content:");
	});

	it("appends image parts for vision models", () => {
		const content = buildUserContent("look", [
			{ type: "image", name: "shot.png", dataUrl: "data:image/png;base64,AAA" },
		]);
		expect(content).toHaveLength(2);
		expect(content[1].image_url.url).toBe("data:image/png;base64,AAA");
	});
});
