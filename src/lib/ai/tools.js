import fsOperation from "fileSystem";
import Url from "utils/Url";
import vshell, { exec as shellExec } from "./vshell";

/**
 * XCoder agent toolset.
 *
 * Each tool: { name, description, parameters (JSON schema), danger,
 *              run(args) => Promise<string> }
 * `danger` classifies the tool for the permission system:
 *  - "read":  always allowed
 *  - "exec":  allowed in safe mode (sandboxed)
 *  - "write": requires permission (unless auto mode)
 *  - "destructive": always asks
 */

/** Max characters of file content returned to the model. */
const MAX_READ_CHARS = 12000;

/** @type {Array<{name: string, description: string, parameters: object, danger: string, run: (args: object) => Promise<string>}>} */
export const TOOLS = [
	{
		name: "list_dir",
		description:
			"List files and folders of a directory inside the workspace. Use path '.' for the workspace root.",
		danger: "read",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "directory path ('.' for cwd)" },
			},
			required: ["path"],
		},
		async run({ path }) {
			const url = vshell.resolvePath(path || ".");
			const list = await fsOperation(url).lsDir();
			if (!Array.isArray(list) || !list.length) return "(empty)";
			return list
				.map(
					(item) =>
						`${item.isDirectory ? "dir " : "file"} ${Url.basename(item.url)}`,
				)
				.join("\n");
		},
	},
	{
		name: "read_file",
		description:
			"Read a text file from the workspace and return its content with line numbers.",
		danger: "read",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string" },
				start_line: { type: "number", description: "1-based, optional" },
				line_count: { type: "number", description: "optional, default 400" },
			},
			required: ["path"],
		},
		async run({ path, start_line, line_count }) {
			const url = vshell.resolvePath(path);
			const content = await fsOperation(url).readFile("utf8");
			const lines = String(content).split("\n");
			const start = Math.max(1, Number(start_line) || 1);
			const count = Math.min(800, Number(line_count) || 400);
			const slice = lines.slice(start - 1, start - 1 + count);
			const numbered = slice
				.map((line, index) => `${start + index}: ${line}`)
				.join("\n");
			return truncate(numbered, MAX_READ_CHARS);
		},
	},
	{
		name: "create_file",
		description:
			"Create a new file (or overwrite an existing one) with the given full content. Parent folders are created automatically.",
		danger: "write",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string" },
				content: { type: "string" },
			},
			required: ["path", "content"],
		},
		async run({ path, content }) {
			const url = vshell.resolvePath(path);
			const dir = Url.dirname(url);
			if (!(await dirExists(dir))) {
				await mkdirs(dir);
			}
			await fsOperation(dir).createFile(
				Url.basename(url),
				String(content ?? ""),
			);
			return `created ${path} (${(content || "").length} chars)`;
		},
	},
	{
		name: "edit_file",
		description:
			"Replace an exact old text block with a new text block inside an existing file. Use read_file first to get the exact text.",
		danger: "write",
		parameters: {
			type: "object",
			properties: {
				path: { type: "string" },
				old_text: { type: "string", description: "exact text to find" },
				new_text: { type: "string", description: "replacement text" },
			},
			required: ["path", "old_text", "new_text"],
		},
		async run({ path, old_text, new_text }) {
			const url = vshell.resolvePath(path);
			const content = await fsOperation(url).readFile("utf8");
			const text = String(content);
			if (!old_text || !text.includes(old_text)) {
				return `ERROR: old_text not found in ${path}. Read the file and try again with the exact text.`;
			}
			const occurrences = text.split(old_text).length - 1;
			if (occurrences > 1) {
				return `ERROR: old_text appears ${occurrences} times in ${path}. Include more surrounding context to make it unique.`;
			}
			const updated = text.replace(old_text, new_text);
			await fsOperation(url).writeFile(updated);
			return `edited ${path}`;
		},
	},
	{
		name: "delete_path",
		description: "Delete a file or folder from the workspace.",
		danger: "destructive",
		parameters: {
			type: "object",
			properties: { path: { type: "string" } },
			required: ["path"],
		},
		async run({ path }) {
			const url = vshell.resolvePath(path);
			await fsOperation(url).delete();
			return `deleted ${path}`;
		},
	},
	{
		name: "move_path",
		description: "Move or rename a file/folder.",
		danger: "write",
		parameters: {
			type: "object",
			properties: {
				from: { type: "string" },
				to: { type: "string" },
			},
			required: ["from", "to"],
		},
		async run({ from, to }) {
			const src = vshell.resolvePath(from);
			const dest = vshell.resolvePath(to);
			const content = await fsOperation(src).readFile();
			const destIsDir = await isDir(dest);
			const target = destIsDir ? Url.join(dest, Url.basename(src)) : dest;
			const dir = Url.dirname(target);
			if (!(await dirExists(dir))) await mkdirs(dir);
			await fsOperation(dir).createFile(Url.basename(target), content);
			await fsOperation(src).delete();
			return `moved ${from} -> ${to}`;
		},
	},
	{
		name: "search_files",
		description:
			"Search files by name (find) or content (grep). mode='find' matches file names, mode='grep' matches content.",
		danger: "read",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string" },
				mode: { type: "string", enum: ["find", "grep"] },
				path: {
					type: "string",
					description: "optional base path ('.' default)",
				},
			},
			required: ["query", "mode"],
		},
		async run({ query, mode, path }) {
			const result =
				mode === "find"
					? await shellExec(
							`find ${path || "."} -name ${JSON.stringify(query)}`,
						)
					: await shellExec(`grep ${JSON.stringify(query)} ${path || "."}`);
			return result.output || "(no matches)";
		},
	},
	{
		name: "run_command",
		description:
			"Run a virtual shell command (ls, cd, cat, mkdir, rm, cp, mv, find, grep, wc, vcs, pkg...). 'pkg install <name>' adds commands from the local catalog (jq, http, nano, gh, python3); 'vcs commit <msg>' snapshots the workspace; 'vcs restore <id>' restores a snapshot.",
		danger: "exec",
		parameters: {
			type: "object",
			properties: { command: { type: "string" } },
			required: ["command"],
		},
		async run({ command }) {
			const result = await shellExec(command);
			return result.output || "(ok)";
		},
	},
	{
		name: "run_js",
		description:
			"Execute JavaScript in an isolated Web Worker sandbox (no DOM). console.log output and the last expression value are returned.",
		danger: "exec",
		parameters: {
			type: "object",
			properties: { code: { type: "string" } },
			required: ["code"],
		},
		async run({ code }) {
			const { default: ConsoleExecutor } = await import("lib/consoleRuntime");
			const executor = new ConsoleExecutor({ timeout: 15000 });
			try {
				const result = await executor.execute(String(code));
				const prefix = result.type === "error" ? "ERROR: " : "";
				return prefix + truncate(String(result.value ?? ""), 4000);
			} finally {
				executor.destroy();
			}
		},
	},
	{
		name: "editor_context",
		description:
			"Get metadata about the file currently open in the editor (path, lines, cursor, selection size). Use this first to understand what the user is looking at.",
		danger: "read",
		parameters: { type: "object", properties: {} },
		async run() {
			const { getEditorContext, formatEditorContext } = await import(
				"./editorBridge"
			);
			return formatEditorContext(getEditorContext(window.editorManager));
		},
	},
	{
		name: "read_active_file",
		description:
			"Read the live buffer of the file open in the editor (includes unsaved changes), with line numbers.",
		danger: "read",
		parameters: {
			type: "object",
			properties: {
				start_line: { type: "number", description: "1-based, optional" },
				line_count: { type: "number", description: "optional, default 400" },
			},
		},
		async run(args) {
			const { readActiveBuffer } = await import("./editorBridge");
			return readActiveBuffer(window.editorManager, args || {});
		},
	},
	{
		name: "list_open_files",
		description:
			"List all files currently open in editor tabs, with the active file and unsaved-changes markers.",
		danger: "read",
		parameters: { type: "object", properties: {} },
		async run() {
			const { listOpenFiles } = await import("./editorBridge");
			return listOpenFiles(window.editorManager);
		},
	},
	{
		name: "apply_to_editor",
		description:
			"Apply text directly to the buffer of the file open in the editor: insert at cursor, replace the current selection or replace the whole buffer. The change stays unsaved so the user can review it.",
		danger: "write",
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["insert", "replace_selection", "replace_all"],
					description: "how to apply the text",
				},
				text: { type: "string" },
			},
			required: ["action", "text"],
		},
		async run(args) {
			const { applyToEditor } = await import("./editorBridge");
			const result = applyToEditor(window.editorManager, args || {});
			return result.ok ? result.message : `ERROR: ${result.message}`;
		},
	},
	{
		name: "spawn_subagent",
		description:
			"Launch a subagent to research a focused task. The subagent can read the workspace and run read-only analysis, then returns a summary report.",
		danger: "exec",
		parameters: {
			type: "object",
			properties: {
				task: { type: "string", description: "the subagent objective" },
				context: { type: "string", description: "optional extra context" },
			},
			required: ["task"],
		},
		async run(args, agent) {
			const { runSubagent } = await import("./agent");
			return runSubagent(args, agent);
		},
	},
	{
		name: "spawn_subagents",
		description:
			"Run MULTIPLE subagents IN PARALLEL for independent subtasks. Each subagent may use a different provider/model — pick capable models for the job. Returns one merged report per subtask. Use this to split research/analysis work (e.g. review several files at once) across models.",
		danger: "exec",
		parameters: {
			type: "object",
			properties: {
				subtasks: {
					type: "array",
					description: "2-5 independent subtasks to run in parallel",
					items: {
						type: "object",
						properties: {
							task: {
								type: "string",
								description: "the subagent objective",
							},
							context: { type: "string" },
							provider: {
								type: "string",
								description:
									"optional provider id (e.g. pollinations, groq, google)",
							},
							model: {
								type: "string",
								description: "optional model id for this subagent",
							},
						},
						required: ["task"],
					},
				},
			},
			required: ["subtasks"],
		},
		async run(args, agent) {
			const { runSubagentsParallel } = await import("./agent");
			return runSubagentsParallel(args, agent);
		},
	},
	{
		name: "web_search",
		description:
			"Search the public web (no API key needed). Returns result titles, URLs and snippets. Use for documentation, error messages, library usage — anything outside the workspace.",
		danger: "read",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "search keywords" },
			},
			required: ["query"],
		},
		async run(args) {
			const { webSearch } = await import("./webTools");
			return webSearch(String(args?.query || ""));
		},
	},
	{
		name: "read_url",
		description:
			"Fetch a web page and return its readable text (tags stripped, scripts removed). Use after web_search to read docs or articles.",
		danger: "read",
		parameters: {
			type: "object",
			properties: {
				url: { type: "string", description: "absolute http(s) URL" },
			},
			required: ["url"],
		},
		async run(args) {
			const { readUrl } = await import("./webTools");
			return readUrl(String(args?.url || ""));
		},
	},
	{
		name: "load_skill",
		description:
			"Load a skill: a short markdown playbook with step-by-step guidance (debug-build, code-review, write-tests, git-hygiene, refactor-safe, plus workspace .xcoder/skills). Load it when its description matches the task, follow it, then continue the task.",
		danger: "read",
		parameters: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "skill name as listed in the system prompt",
				},
			},
			required: ["name"],
		},
		async run(args) {
			const { findSkill, listSkills, enabledSkills } = await import("./skills");
			const skills = await listSkills();
			const usable = enabledSkills(skills);
			const skill = findSkill(usable, String(args?.name || ""));
			if (!skill) {
				const known = usable.map((entry) => entry.name).join(", ");
				return `ERROR: skill "${args?.name}" not found or disabled. Available: ${known || "none"}.`;
			}
			return skill.body;
		},
	},
];

export const TOOL_MAP = Object.fromEntries(
	TOOLS.map((tool) => [tool.name, tool]),
);

/**
 * OpenAI tool schemas for the chat completions API.
 * @param {string[]} [allowlist] restrict to given tool names
 * @returns {Array<object>}
 */
export function toolSchemas(allowlist) {
	return TOOLS.filter(
		(tool) => !allowlist || allowlist.includes(tool.name),
	).map((tool) => ({
		type: "function",
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	}));
}

/**
 * Executes a tool by name.
 * @param {string} name
 * @param {object} args
 * @param {import("./agent").Agent} agent
 * @returns {Promise<string>}
 */
export async function executeTool(name, args, agent) {
	const tool = TOOL_MAP[name];
	if (!tool) return `ERROR: unknown tool ${name}`;
	return tool.run(args || {}, agent);
}

/** @param {string} url */
async function isDir(url) {
	try {
		const list = await fsOperation(url).lsDir();
		return Array.isArray(list);
	} catch {
		return false;
	}
}

/** @param {string} url */
async function dirExists(url) {
	try {
		return await fsOperation(url).exists();
	} catch {
		return false;
	}
}

/** Creates all missing parent folders of a file url. @param {string} fileUrl */
async function mkdirs(fileUrl) {
	const parts = fileUrl.split("/").filter(Boolean);
	let current = parts.slice(0, 2).join("/");
	// walk protocol: file:///storage/emulated/0/a/b -> create one by one
	const segments = [];
	for (let i = 2; i < parts.length; i++) {
		segments.push(parts[i]);
	}
	for (const segment of segments) {
		current = `${current}/${segment}`;
		if (!(await dirExists(current))) {
			try {
				await fsOperation(Url.dirname(current)).createDirectory(segment);
			} catch {
				// may already exist or be handled by parent create
			}
		}
	}
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
	if (!text) return "";
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n... (truncated)`;
}
