// @vitest-environment happy-dom
/**
 * v1.8.42 — chat reads open-file errors + Acode AI Agent (Pi) port:
 *  - active_file_errors tool (LSP + linter diagnostics of the open file)
 *  - AGENTS.md / .agents.md / CLAUDE.md project instructions in the prompt
 *  - ask_user_question (options widget) and todo_write (checklist) tools
 *  - the literal «expand_more» text is gone (codicon chevron)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

import {
	formatFileErrors,
	readActiveFileErrors,
} from "../../src/lib/ai/editorBridge";
import {
	formatProjectInstructions,
	pickInstructionFile,
	readProjectInstructions,
} from "../../src/lib/ai/projectInstructions";
import { executeTool } from "../../src/lib/ai/tools";

const read = (p) => readFileSync(p, "utf8");

describe("active file errors (chat lê os erros do arquivo aberto)", () => {
	const makeManager = (diagnostics) => ({
		activeFile: { type: "editor", uri: "file:///p/app.js", filename: "app.js" },
		editor: {
			state: {
				doc: {
					length: 2000,
					lineAt(pos) {
						return { number: Math.floor(pos / 80) + 1, from: 0 };
					},
				},
			},
			dispatch() {},
		},
	});

	test("formatFileErrors summarizes diagnostics for the model", () => {
		const report = formatFileErrors("app.js", [
			{ row: 11, column: 4, severity: "error", message: "Unexpected token", source: "linter" },
			{ row: 39, column: 0, severity: "warning", message: "unused var", source: "" },
		]);
		assert.match(report, /app\.js/);
		assert.match(report, /2 error\(s\)|error\(s\)/);
		assert.match(report, /linha 12:5 \[error\] Unexpected token \(linter\)/);
		assert.match(report, /linha 40:1 \[warning\] unused var/);
	});

	test("formatFileErrors with an empty list reports no diagnostics", () => {
		assert.match(formatFileErrors("a.js", []), /No diagnostics/);
	});

	test("readActiveFileErrors merges lsp + linter and dedupes", async () => {
		const manager = makeManager();
		const lspDiag = {
			from: 160, // linha 3
			message: "type error",
			severity: "error",
			source: "tsserver",
		};
		const lintDiag = {
			from: 10, // linha 1
			message: "syntax error",
			severity: "error",
			source: "lezer",
		};
		const report = await readActiveFileErrors(manager, {
			lsp: () => [lspDiag],
			lint: () => [lintDiag, { from: 10, message: "syntax error", severity: "error" }],
		});
		assert.match(report, /Diagnostics for the active file \(app\.js\): 2 error\(s\)/);
		assert.match(report, /linha 1:11 \[error\] syntax error \(lezer\)/);
		assert.match(report, /linha 3:161 \[error\] type error \(tsserver\)/);
	});

	test("no open file yields a clear message", async () => {
		const report = await readActiveFileErrors(
			{ activeFile: null, editor: null },
			{ lsp: () => [], lint: () => [] },
		);
		assert.match(report, /No editor file is open/);
	});

	test("tool is registered as read-only", async () => {
		const { TOOL_MAP } = await import("../../src/lib/ai/tools");
		assert.ok(TOOL_MAP.active_file_errors, "tool missing");
		assert.equal(TOOL_MAP.active_file_errors.danger, "read");
	});
});

describe("project instructions (AGENTS.md / CLAUDE.md)", () => {
	test("AGENTS.md wins over .agents.md and CLAUDE.md", () => {
		assert.equal(
			pickInstructionFile({ "AGENTS.md": true, "CLAUDE.md": true }),
			"AGENTS.md",
		);
		assert.equal(pickInstructionFile({ "CLAUDE.md": true }), "CLAUDE.md");
		assert.equal(pickInstructionFile({}), null);
	});

	test("reads the first existing file via the injected fs", async () => {
		const calls = [];
		const fakeFs = (path) => ({
			exists: async () => {
				calls.push(String(path));
				return String(path).endsWith("CLAUDE.md");
			},
			readFile: async () => "use tabs everywhere",
		});
		const result = await readProjectInstructions("file:///root/", fakeFs);
		assert.ok(result, "instructions missing");
		assert.equal(result.file, "CLAUDE.md");
		assert.equal(result.text, "use tabs everywhere");
		assert.ok(calls.some((path) => path.includes("AGENTS.md")), "AGENTS.md probed first");
	});

	test("formats a prompt section and long texts are truncated", async () => {
		const section = formatProjectInstructions({
			file: "AGENTS.md",
			text: "run the tests",
		});
		assert.match(section, /PROJECT INSTRUCTIONS \(AGENTS\.md\)/);
		assert.match(section, /run the tests/);
		assert.equal(formatProjectInstructions(null), "");

		// truncation happens at read time (MAX_INSTRUCTION_CHARS)
		const fakeFs = () => ({
			exists: async () => true,
			readFile: async () => "x".repeat(30000),
		});
		const long = await readProjectInstructions("file:///root/", fakeFs);
		assert.ok(long.text.length < 26000, "not truncated");
		assert.match(long.text, /truncated/);
	});

	test("agent system prompt mentions the instructions hook", () => {
		const agent = read("src/lib/ai/agent.js");
		expect(agent).toContain("readProjectInstructions");
		expect(agent).toContain("instructionsSection");
	});
});

describe("ask_user_question + todo_write (Acode AI Agent port)", () => {
	const makeAgent = (ui) => ({
		isSubagent: false,
		todos: [],
		uiHandler: ui,
		onEvent: (event) => events.push(event),
	});
	const events = [];

	test("tools are registered with the right danger level", async () => {
		const { TOOL_MAP } = await import("../../src/lib/ai/tools");
		assert.ok(TOOL_MAP.ask_user_question);
		assert.ok(TOOL_MAP.todo_write);
		assert.equal(TOOL_MAP.ask_user_question.danger, "read");
		assert.equal(TOOL_MAP.todo_write.danger, "read");
	});

	test("todo_write stores the list on the agent and emits an event", async () => {
		events.length = 0;
		const agent = makeAgent();
		const result = await executeTool(
			"todo_write",
			{
				todos: [
					{ content: "read file", status: "completed" },
					{ content: "fix bug", status: "in_progress" },
					{ content: "run tests", status: "pending" },
					{ content: "", status: "pending" }, // filtered out
				],
			},
			agent,
		);
		assert.match(result, /3 item\(s\)/);
		assert.equal(agent.todos.length, 3);
		assert.equal(events[0].type, "todo");
		assert.equal(events[0].payload[1].status, "in_progress");
	});

	test("todo_write rejects an empty list", async () => {
		const result = await executeTool("todo_write", { todos: [] }, makeAgent());
		assert.match(result, /^ERROR:/);
	});

	test("ask_user_question resolves through the UI handler", async () => {
		const picked = [];
		const agent = makeAgent({
			askUserQuestion: async (request) => {
				picked.push(request);
				return request.options[1];
			},
		});
		const result = await executeTool(
			"ask_user_question",
			{ question: "Which fix?", options: ["A", "B", "C"] },
			agent,
		);
		assert.match(result, /User selected: B/);
		assert.equal(picked[0].options.length, 3);
	});

	test("ask_user_question falls back to plain text without a UI", async () => {
		const result = await executeTool(
			"ask_user_question",
			{ question: "Which fix?", options: ["A", "B"] },
			makeAgent(undefined),
		);
		assert.match(result, /Which fix\?/);
		assert.match(result, /1\. A/);
		assert.match(result, /2\. B/);
	});

	test("ask_user_question needs 2+ options", async () => {
		const result = await executeTool(
			"ask_user_question",
			{ question: "Which fix?", options: ["A"] },
			makeAgent(undefined),
		);
		assert.match(result, /^ERROR:/);
	});

	test("agent accepts the uiHandler option (chat wires it)", () => {
		const agent = read("src/lib/ai/agent.js");
		expect(agent).toContain("this.uiHandler = opts.uiHandler");
		const chat = read("src/sidebarApps/ai/index.js");
		expect(chat).toContain("consentHandler: opts.consentHandler || requestConsent");
		expect(chat).toContain("uiHandler: opts.uiHandler || chatUi");
		expect(chat).toContain("function renderTodoCard(");
		expect(chat).toContain("askUserQuestion({ question, options })");
	});
});

describe("literal expand_more text is gone", () => {
	test("reasoning summary uses the codicon chevron", () => {
		const style = read("src/sidebarApps/ai/style.scss");
		expect(style).not.toContain('content: "expand_more"');
		expect(style).toContain('content: "\\eab4"');
		expect(style).toContain('font-family: "xcodicon"');
	});

	test("artifacts arrow uses the codicon class", () => {
		const chat = read("src/sidebarApps/ai/index.js");
		expect(chat).not.toContain('className="icon expand_more');
		expect(chat).toContain('className="icon codicon-chevron-down ai-artifacts-arrow"');
	});
});
