/**
 * XCoder AI artifacts — derives a structured work report from the chat
 * transcript: files touched, commands executed, tools used and token
 * usage. The chat UI renders this as an "artifacts" bar + panel so the
 * agent can work in the background (files via tools, not pasted code)
 * while the user sees exactly what changed.
 */

/**
 * @typedef {object} ArtifactFile
 * @property {string} path
 * @property {"created"|"edited"|"applied"|"moved"|"deleted"} action
 * @property {boolean} ok
 */

/**
 * @typedef {object} ArtifactCommand
 * @property {string} command
 * @property {"run_command"|"run_js"} tool
 * @property {boolean} ok
 */

/**
 * @typedef {object} Artifacts
 * @property {ArtifactFile[]} files
 * @property {ArtifactCommand[]} commands
 * @property {Record<string, number>} tools tool name -> call count
 * @property {{prompt: number, completion: number, total: number}} tokens
 */

const FILE_TOOLS = {
	create_file: "created",
	edit_file: "edited",
	apply_to_editor: "applied",
	delete_path: "deleted",
	move_path: "moved",
};

const COMMAND_TOOLS = new Set(["run_command", "run_js"]);

/**
 * Parses tool-call arguments defensively.
 * @param {string} argsJson
 * @returns {object}
 */
function parseArgs(argsJson) {
	try {
		const value = JSON.parse(argsJson || "{}");
		return value && typeof value === "object" ? value : {};
	} catch {
		return {};
	}
}

/**
 * Extracts a workspace-relative path from tool args.
 * @param {object} args
 * @returns {string}
 */
function pathOf(args) {
	return String(args.path || args.file || args.target || args.source || "");
}

/**
 * Derives artifacts + usage from a chat transcript.
 *
 * Accepted event shapes (matches lib/ai/agent + sessions persistence):
 *  - {type:"assistant", payload, toolCalls:[{id, function:{name, arguments}}]}
 *  - {type:"tool", toolCallId, payload, name}
 *  - {type:"usage", payload:{prompt, completion, total}}
 *
 * @param {Array<object>} events
 * @returns {Artifacts}
 */
export function collectArtifacts(events = []) {
	/** @type {Artifacts} */
	const out = {
		files: [],
		commands: [],
		tools: {},
		tokens: { prompt: 0, completion: 0, total: 0 },
	};

	/** @type {Map<string, boolean>} toolCallId -> ok */
	const outcomes = new Map();
	for (const event of events) {
		if (event?.type === "tool") {
			const text = String(event.payload ?? "");
			outcomes.set(
				event.toolCallId,
				!text.startsWith("ERROR") && !text.startsWith("DENIED"),
			);
		}
	}

	for (const event of events) {
		if (event?.type === "usage" && event.payload) {
			out.tokens.prompt = Number(event.payload.prompt) || 0;
			out.tokens.completion = Number(event.payload.completion) || 0;
			out.tokens.total = Number(event.payload.total) || 0;
			continue;
		}
		if (event?.type !== "assistant" || !Array.isArray(event.toolCalls))
			continue;

		for (const call of event.toolCalls) {
			const name = String(call?.function?.name || "");
			if (!name) continue;
			out.tools[name] = (out.tools[name] || 0) + 1;

			const args = parseArgs(call?.function?.arguments);
			const ok = outcomes.get(call?.id) !== false;

			if (FILE_TOOLS[name]) {
				const path = pathOf(args);
				if (path) {
					const existing = out.files.find(
						(item) => item.path === path && item.action === FILE_TOOLS[name],
					);
					if (!existing) {
						out.files.push({ path, action: FILE_TOOLS[name], ok });
					}
				}
			} else if (COMMAND_TOOLS.has(name)) {
				const command =
					name === "run_command"
						? String(args.command || "")
						: String(args.code || args.script || "js snippet");
				if (command) {
					out.commands.push({
						command: command.slice(0, 120),
						tool: name,
						ok,
					});
				}
			}
		}
	}

	return out;
}

/**
 * Formats a token count for a compact chip ("1.2k", "45").
 * @param {number} value
 * @returns {string}
 */
export function formatTokenCount(value) {
	const count = Number(value) || 0;
	if (count >= 1000) {
		const k = count / 1000;
		return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
	}
	return String(count);
}

/**
 * @typedef {object} Attachment
 * @property {"file"|"image"} type
 * @property {string} [path] workspace path for type "file"
 * @property {string} [name] display name (images)
 * @property {string} [dataUrl] base64 data URL (images)
 */

/**
 * Builds the OpenAI content array for a user message with attachments.
 * Files are NEVER inlined — the model gets their paths and reads them
 * with read_file itself (the app owns the filesystem). Images are inlined
 * as data URLs when the model has vision.
 * @param {string} text
 * @param {Attachment[]} [attachments]
 * @returns {string | Array<object>} OpenAI message content
 */
export function buildUserContent(text, attachments = []) {
	const images = attachments.filter(
		(item) => item?.type === "image" && item.dataUrl,
	);
	const files = attachments.filter(
		(item) => item?.type === "file" && item.path,
	);

	if (!images.length && !files.length) return text;

	const notes = [];
	if (files.length) {
		notes.push(
			`Files attached by the user (read them with read_file when needed):\n${files
				.map((item) => `- ${item.path}`)
				.join("\n")}`,
		);
	}

	/** @type {Array<object>} */
	const parts = [
		{
			type: "text",
			text: notes.length ? `${text}\n\n${notes.join("\n\n")}` : text,
		},
	];
	for (const image of images) {
		parts.push({ type: "image_url", image_url: { url: image.dataUrl } });
	}
	return parts;
}

export default {
	collectArtifacts,
	formatTokenCount,
	buildUserContent,
};
