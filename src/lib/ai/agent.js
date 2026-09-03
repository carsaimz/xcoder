import fsOperation from "fileSystem";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import {
	canUseAgentTurn,
	FREE_AGENT_DAILY_LIMIT,
	trackAgentTurn,
} from "lib/premium";
import { showSupportDialog } from "lib/premiumUI";
import settings from "lib/settings";
import Url from "utils/Url";
import { buildUserContent } from "./artifacts";
import { chatCompletion, resolveBaseURL, streamChatCompletion } from "./client";
import {
	DEFAULT_PROVIDER_ID,
	keyShapeWarning,
	normalizeModel,
	PROVIDER_MAP,
	resolveApiKey,
	resolveAutonomy,
	resolveBaseUrl,
	resolveMaxTokens,
	resolveModel,
} from "./providers";
import { executeTool, toolSchemas } from "./tools";
import vshell from "./vshell";

/**
 * XCoder AI agent — an OpenAI tool-calling loop with a permission system.
 *
 * Autonomy modes (settings.aiAutonomy):
 *  - "ask":  confirm every tool call
 *  - "safe": auto-approve read/exec tools, ask for writes/destructive
 *  - "auto": auto-approve everything except destructive tools
 */

const MAX_STEPS = 25;

/**
 * @typedef {object} ChatEvent
 * @property {"user"|"assistant"|"tool"|"error"|"status"} type
 * @property {any} [payload]
 */

export class Agent {
	/**
	 * @param {object} [opts]
	 * @param {ChatEvent[]} [opts.history] existing messages (OpenAI format + meta)
	 * @param {(event: ChatEvent) => void} [opts.onEvent]
	 * @param {boolean} [opts.isSubagent]
	 * @param {string[]} [opts.tools] tool allowlist
	 * @param {"chat"|"agent"} [opts.mode] chat = pure conversation (no tools),
	 *        agent = full tool-calling loop (default from settings.aiMode)
	 */
	constructor(opts = {}) {
		this.onEvent = opts.onEvent || (() => {});
		this.isSubagent = Boolean(opts.isSubagent);
		this.mode = opts.mode || settings.value.aiMode || "agent";
		this.toolAllowlist = this.mode === "chat" ? [] : opts.tools || null;
		this.aborted = false;
		/** cumulative token usage for the chat UI (usage chip) */
		this.usage = { prompt: 0, completion: 0, total: 0 };
		/** @type {Array<object>} OpenAI-format messages */
		this.messages = [
			{
				role: "system",
				// placeholder — replaced by the full, awaited prompt in run()
				content: "You are the XCoder coding agent.",
			},
		];
	}

	async systemPrompt() {
		if (this.isSubagent) {
			return [
				"You are a XCoder subagent: a focused research assistant.",
				"Analyze the workspace with the allowed read-only tools and answer the task precisely.",
				"Be concise: return a compact report with findings and, when relevant, exact file paths and line numbers.",
				"Do not attempt to modify files (write tools are unavailable).",
			].join("\n");
		}
		const root = vshell.getRoot();
		const context = await workspaceContext();
		const parts = [
			"You are the XCoder coding agent, embedded in the XCoder mobile code editor (Android).",
			`Current workspace root: ${root || "(no folder open)"}.`,
			"",
			context,
			"",
			"Capabilities:",
			"- You can list/read/create/edit/delete files, run a virtual shell, execute JavaScript in a sandbox, search the web (web_search) and read pages (read_url).",
			"- TERMINAL: run_command executes shell commands and waits for the result. If a tool/dependency is missing, INSTALL it (pip install / npm install / apt-get via run_command), then retry. Always wait for the command output before continuing.",
			"- SUBAGENTS: use spawn_subagent for one research task; use spawn_subagents to run 2-5 INDEPENDENT subtasks in PARALLEL, optionally on different providers/models (pass provider/model per subtask) — merge their reports in your answer.",
			"- Editor tools let you see and edit the file the user has open right now: editor_context, read_active_file (live buffer incl. unsaved edits), list_open_files and apply_to_editor (insert / replace_selection / replace_all, stays unsaved for review).",
			'- When the user asks about "the file", "this code", explain or fix without naming a path, READ the active file first with read_active_file (or read_file with the path) — do not assume you already have its content.',
			"- Paths are relative to the workspace root ('.').",
			"- Before editing, always read the target region with read_file and use edit_file with an exact unique old_text.",
			"- Use vcs (run_command with 'vcs commit ...') before large changes so the user can restore.",
			"- Keep answers short and structured; mention exact paths of files you changed.",
			"- BACKGROUND WORK: write code through the file tools (create_file, edit_file, apply_to_editor) — the chat renders every file write as an artifact automatically. NEVER paste whole file contents or large code blocks into your reply; a short summary of what changed (file, lines, reason) is enough.",
			"- IMAGES (OCR): when the user attaches images, read text in them (vision models do OCR automatically). For image files in the workspace, mention they need attaching — or read bytes yourself only when needed.",
			"- PDFs: read_file returns binary garbage for .pdf. Extract text via run_command when a tool exists (e.g. 'pdftotext file.pdf -' or python with pypdf — install it if missing), then read the extracted text.",
			"- If a task is ambiguous, ask the user.",
		];
		if (settings.value.aiSystemPrompt) {
			parts.push(
				"",
				`Extra instructions from the user:\n${settings.value.aiSystemPrompt}`,
			);
		}
		return parts.join("\n");
	}

	abort() {
		this.aborted = true;
	}

	/** @returns {ChatEvent[]} serializable chat transcript */
	get transcript() {
		// messages[0] is the system prompt — skip it
		return this.messages.slice(1);
	}

	/**
	 * Loads a persisted transcript.
	 * @param {ChatEvent[]} events
	 */
	restore(events = []) {
		for (const event of events) {
			if (event.type === "user") {
				this.messages.push({ role: "user", content: event.payload });
			} else if (event.type === "assistant") {
				this.messages.push({
					role: "assistant",
					content: event.payload,
					...(event.toolCalls ? { tool_calls: event.toolCalls } : {}),
				});
			} else if (event.type === "tool") {
				this.messages.push({
					role: "tool",
					tool_call_id: event.toolCallId,
					content: String(event.payload ?? ""),
				});
			}
		}
	}

	/**
	 * @param {string} userText
	 * @param {object} [opts]
	 * @param {Array<import("./artifacts").Attachment>} [opts.attachments]
	 *        files/images attached by the user (files stay referenced,
	 *        images become vision parts when supported)
	 */
	async run(userText, opts = {}) {
		this.aborted = false;
		const attachments = Array.isArray(opts.attachments) ? opts.attachments : [];
		const userContent = buildUserContent(userText, attachments);
		this.messages.push({ role: "user", content: userContent });
		this.onEvent({ type: "user", payload: userText, attachments });

		// keep the system prompt fresh: it embeds the open files and the
		// workspace tree, which change between messages
		this.messages[0] = {
			role: "system",
			content: await this.systemPrompt(),
		};

		const config = this.aiConfig();
		// Keyless providers (e.g. Pollinations) and localhost/LAN
		// endpoints (Ollama, LM Studio) work with no API key.
		if (
			!config.apiKey &&
			!config.noKeyRequired &&
			!/localhost|127\.0\.0\.1/.test(config.baseURL)
		) {
			const message =
				'No API key configured. Open Settings > AI assistant to add one — or pick the keyless "Pollinations" provider.';
			this.onEvent({ type: "error", payload: message });
			return message;
		}

		// free tier: limited agent runs/day — premium is unlimited
		if (!canUseAgentTurn()) {
			const message = `Limite diário do agente atingido (${FREE_AGENT_DAILY_LIMIT} execuções). Apoie o projeto para desbloquear o agente ilimitado.`;
			this.onEvent({ type: "error", payload: message });
			showSupportDialog().catch(() => {});
			return message;
		}
		trackAgentTurn();

		let step = 0;
		while (!this.aborted && step < MAX_STEPS) {
			step++;
			let response;
			try {
				this.onEvent({ type: "status", payload: { action: "thinking" } });
				response = await this.requestWithRecovery({
					config,
					messages: this.messages,
				});
			} catch (error) {
				const message = `AI request failed: ${friendlyError(error, config)}`;
				this.onEvent({ type: "error", payload: message });
				return message;
			}

			const { content, toolCalls } = response;
			this.trackUsage(response.raw);
			this.onEvent({ type: "usage", payload: { ...this.usage } });

			if (toolCalls.length) {
				this.messages.push({
					role: "assistant",
					content: content || "",
					tool_calls: toolCalls,
				});
				if (content) {
					this.onEvent({
						type: "assistant",
						payload: content,
						toolCalls,
					});
				}

				for (const call of toolCalls) {
					if (this.aborted) break;
					const result = await this.invokeTool(call);
					this.messages.push({
						role: "tool",
						tool_call_id: call.id,
						content: result,
					});
					this.onEvent({
						type: "tool",
						payload: result,
						toolCallId: call.id,
						name: call.function?.name,
					});
				}
				continue;
			}

			this.messages.push({ role: "assistant", content: content || "" });
			if (response.reasoning) {
				this.onEvent({
					type: "reasoning",
					payload: response.reasoning,
				});
			}
			this.onEvent({ type: "assistant", payload: content || "" });
			return content || "";
		}

		if (!this.aborted) {
			const message =
				"Reached the maximum number of steps for this task. Ask me to continue if needed.";
			this.onEvent({ type: "error", payload: message });
			return message;
		}
		return "";
	}

	/**
	 * Runs one chat completion with self-recovery on 400-class errors:
	 *  - model rejected / not found  -> retry with the provider default
	 *  - tool use rejected           -> retry without tools (rest of loop)
	 * Anything else bubbles up to a friendly error.
	 *
	 * Streams when possible: deltas flow to the UI as "delta" events
	 * (a "delta-reset" event opens each attempt so partial text from a
	 * failed attempt is never shown twice). If streaming itself is
	 * unavailable (CORS-blocked host, old webview) it silently falls
	 * back to the non-streaming request.
	 *
	 * @param {object} opts
	 * @param {object} opts.config aiConfig() result
	 * @param {Array<object>} opts.messages OpenAI messages
	 * @returns {Promise<{content: string, toolCalls: Array<object>, raw: object, reasoning?: string}>}
	 */
	async requestWithRecovery({ config, messages }) {
		const provider = PROVIDER_MAP[config.providerId];
		const fallbackModel = provider?.models?.[0] || "";
		/** current tools payload; emptied if the endpoint rejects tools */
		let tools = toolSchemas(this.toolAllowlist);
		let model = config.model;

		for (let attempt = 0; attempt < 3; attempt++) {
			// every attempt re-opens the live bubble
			this.onEvent({ type: "delta-reset" });
			try {
				return await this.streamOrRequest({
					config,
					messages,
					tools,
					model,
				});
			} catch (error) {
				const text = String(error?.message || error);
				const status = httpStatus(text);
				const lower = text.toLowerCase();

				if (status === 400 && attempt < 2) {
					// 1) tools not supported by this model/endpoint?
					if (tools.length && /tool|function/.test(lower)) {
						tools = [];
						this.onEvent({
							type: "error",
							payload: friendlyError(error, config),
						});
						continue;
					}
					// 2) model unknown / decommissioned?
					if (
						model !== fallbackModel &&
						/model|endpoint|decommission/.test(lower)
					) {
						model = fallbackModel;
						this.onEvent({
							type: "error",
							payload: friendlyError(error, {
								...config,
								model,
								fallbackModel,
							}),
						});
						continue;
					}
					// 3) last resort: try without tools once
					if (tools.length) {
						tools = [];
						continue;
					}
				}
				throw error;
			}
		}
		this.onEvent({ type: "delta-reset" });
		return this.streamOrRequest({
			config,
			messages,
			tools: [],
			model,
		});
	}

	/**
	 * Tries the streaming path first (live typing), falling back to the
	 * plain request when the environment cannot stream (no ReadableStream,
	 * CORS-blocked host, etc.).
	 * @param {object} opts
	 * @param {object} opts.config
	 * @param {Array<object>} opts.messages
	 * @param {Array<object>} opts.tools
	 * @param {string} opts.model
	 */
	async streamOrRequest({ config, messages, tools, model }) {
		const common = {
			baseURL: config.baseURL,
			apiKey: config.apiKey,
			providerId: config.providerId,
			model,
			messages,
			tools,
			temperature: settings.value.aiTemperature,
			maxTokens: resolveMaxTokens(config.providerId),
		};

		try {
			return await streamChatCompletion({
				...common,
				onDelta: (delta) => {
					this.onEvent({ type: "delta", payload: delta });
				},
			});
		} catch (error) {
			const status = httpStatus(String(error?.message || error));
			// HTTP errors are real provider answers — rethrow so the
			// recovery logic sees them; anything else (TypeError from
			// CORS, missing stream support, abort) retries plain.
			if (status !== null) throw error;
			if (error?.name === "AbortError") throw error;
			window.log?.("warn", "AI streaming unavailable, falling back:", error);
			const result = await chatCompletion(common);
			// reasoning models also report thoughts in the plain body
			const message = result.raw?.choices?.[0]?.message;
			const thought = message?.reasoning_content ?? message?.reasoning ?? null;
			if (typeof thought === "string" && thought) {
				result.reasoning = thought;
				this.onEvent({ type: "reasoning", payload: thought });
			}
			return result;
		}
	}

	/**
	 * Accumulates token usage from a raw provider response.
	 * OpenAI-compatible bodies carry `usage: {prompt_tokens,
	 * completion_tokens, total_tokens}`; missing fields are ignored so
	 * providers without usage reporting keep the counters at 0.
	 * @param {object} [raw]
	 */
	trackUsage(raw) {
		const usage = raw?.usage;
		if (!usage || typeof usage !== "object") return;
		this.usage.prompt += Number(usage.prompt_tokens) || 0;
		this.usage.completion += Number(usage.completion_tokens) || 0;
		this.usage.total +=
			Number(usage.total_tokens) || this.usage.prompt + this.usage.completion;
	}

	/**
	 * Executes a tool call honoring permissions, announcing what is
	 * happening in real time ("reading file…", "running command…").
	 * @param {object} call OpenAI tool call
	 * @returns {Promise<string>}
	 */
	async invokeTool(call) {
		const name = call.function?.name;
		let args = {};
		try {
			args = JSON.parse(call.function?.arguments || "{}");
		} catch (error) {
			return `ERROR: invalid tool arguments (${error.message})`;
		}

		if (!(await this.requestPermission(name, args))) {
			return "DENIED by user.";
		}

		this.onEvent({
			type: "status",
			payload: toolStatus(name, args),
		});
		try {
			const result = await executeTool(name, args, this);
			this.onEvent({ type: "status", payload: { action: "done" } });
			return result;
		} catch (error) {
			this.onEvent({ type: "status", payload: { action: "done" } });
			return `ERROR: ${error.message || error}`;
		}
	}

	/**
	 * @param {string} name
	 * @param {object} args
	 * @returns {Promise<boolean>}
	 */
	async requestPermission(name, args) {
		const { TOOL_MAP } = await import("./tools");
		const tool = TOOL_MAP[name];
		const danger = tool?.danger || "write";
		const autonomy =
			resolveAutonomy(settings.value.aiProvider || DEFAULT_PROVIDER_ID) ||
			"safe";

		if (autonomy === "auto" && danger !== "destructive") return true;
		if (autonomy === "safe" && (danger === "read" || danger === "exec")) {
			return true;
		}
		if (this.isSubagent) return danger === "read";

		const summary = JSON.stringify(args);
		return confirm(
			`AI: ${name}`,
			`The AI agent wants to run <b>${name}</b><br /><br /><code style="font-size: 10px">${escapeHtml(truncate(summary, 600))}</code>`,
			true,
		);
	}

	/**
	 * Resolves provider settings (per-provider overrides first).
	 * The model is normalized so stale ids from a provider's old
	 * catalog (e.g. Pollinations models that no longer exist) map to
	 * a working default instead of failing with 404/"inválido".
	 */
	aiConfig() {
		const providerId =
			this.providerOverride || settings.value.aiProvider || DEFAULT_PROVIDER_ID;
		const provider = PROVIDER_MAP[providerId];
		const baseURL = resolveBaseURL(provider, resolveBaseUrl(providerId));
		const model = normalizeModel(
			providerId,
			this.modelOverride || resolveModel(providerId),
		);
		if (model !== (this.modelOverride || resolveModel(providerId))) {
			// one-time notice per session — the saved model was
			// retired by the provider
			this.onEvent({
				type: "status",
				payload: {
					action: "notice",
					detail:
						window.strings?.["ai model remapped"] ||
						`Model "${resolveModel(providerId)}" is no longer available — using "${model}"`,
				},
			});
		}
		return {
			providerId,
			baseURL,
			apiKey: resolveApiKey(providerId),
			model,
			noKeyRequired: Boolean(provider?.noKeyRequired),
		};
	}
}

/**
 * Runs a restricted subagent.
 * @param {{task: string, context?: string, provider?: string, model?: string}} args
 * @param {import("./agent").Agent} [parent]
 * @returns {Promise<string>}
 */
export async function runSubagent(args, parent) {
	const task = String(args?.task || "").trim();
	if (!task) return "ERROR: subagent requires a task";

	const subagent = new Agent({
		isSubagent: true,
		tools: [
			"list_dir",
			"read_file",
			"search_files",
			"run_js",
			"run_command",
			"editor_context",
			"read_active_file",
			"list_open_files",
			"web_search",
			"read_url",
		],
	});

	// optional model override — parallel subagents may each use a
	// different provider/model chosen for the subtask
	if (PROVIDER_MAP[args?.provider]) {
		subagent.providerOverride = args.provider;
	}
	if (args?.model) {
		subagent.modelOverride = String(args.model);
	}

	const promptText = args?.context
		? `${task}\n\nContext from the main agent:\n${args.context}`
		: task;

	parent?.onEvent({
		type: "status",
		payload: { action: "subagent", detail: task.slice(0, 80) },
	});
	const report = await subagent.run(promptText);
	parent?.onEvent({ type: "status", payload: { action: "done" } });
	return truncate(report || "(subagent returned nothing)", 6000);
}

/**
 * Runs multiple subagents in PARALLEL (Promise.allSettled), optionally on
 * different providers/models — the model-selection side of agent mode.
 * @param {{subtasks?: Array<{task?: string, context?: string, provider?: string, model?: string}>}} args
 * @param {import("./agent").Agent} [parent]
 * @returns {Promise<string>} merged report
 */
export async function runSubagentsParallel(args, parent) {
	const subtasks = Array.isArray(args?.subtasks)
		? args.subtasks.slice(0, 5)
		: [];
	if (subtasks.length < 2) {
		// single subtask — degrade gracefully to the simple path
		if (subtasks.length === 1) return runSubagent(subtasks[0], parent);
		return "ERROR: spawn_subagents requires a 'subtasks' array (2-5 entries)";
	}

	parent?.onEvent({
		type: "status",
		payload: {
			action: "subagents",
			detail: `${subtasks.length} subagents em paralelo`,
		},
	});

	const settled = await Promise.allSettled(
		subtasks.map((subtask) => runSubagent(subtask, parent)),
	);

	parent?.onEvent({ type: "status", payload: { action: "done" } });

	const parts = settled.map((result, index) => {
		const label = subtasks[index]?.task?.slice(0, 60) || `subtask ${index + 1}`;
		const body =
			result.status === "fulfilled"
				? result.value
				: `ERROR: ${result.reason?.message || result.reason}`;
		return `### Subtask ${index + 1}: ${label}\n${body}`;
	});
	return parts.join("\n\n---\n\n");
}

/**
 * Runs a one-off prompt without tools (quick actions like "explain code").
 * @param {string} system
 * @param {string} user
 * @returns {Promise<string>}
 */
export async function quickAsk(system, user) {
	const agent = new Agent({ tools: [] });
	const config = agent.aiConfig();
	const response = await chatCompletion({
		...config,
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: user },
		],
		temperature: settings.value.aiTemperature ?? 0.3,
	});
	return response.content;
}

/**
 * Asks the user for input via a dialog (used by the chat UI).
 * @param {string} title
 * @param {string} value
 */
export async function askInput(title, value = "") {
	return prompt(title, value, "text");
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * @param {string} text
 * @param {number} max
 */
function truncate(text, max) {
	if (!text) return "";
	if (text.length <= max) return text;
	return `${text.slice(0, max)}...`;
}

/**
 * Builds a compact snapshot of the environment for the system prompt:
 * the files open in editor tabs and the top level of the workspace, so
 * the model "sees" the project without the user pasting anything.
 * @returns {Promise<string>}
 */
async function workspaceContext() {
	const parts = ["Project context (auto-collected):"];

	try {
		const manager = window.editorManager;
		const files = Array.isArray(manager?.files) ? manager.files : [];
		const open = files.filter((file) => file?.type === "editor" || file?.uri);
		if (open.length) {
			const active = manager?.activeFile;
			const lines = open.slice(0, 20).map((file) => {
				const flags = [];
				if (active && file === active) flags.push("active");
				if (file.isUnsaved) flags.push("unsaved");
				const suffix = flags.length ? ` (${flags.join(", ")})` : "";
				return `- ${file.filename || file.uri || "(untitled)"}${suffix}`;
			});
			parts.push(
				`Open files:\n${lines.join("\n")}${open.length > 20 ? "\n- ..." : ""}`,
			);
		}
	} catch {
		/* editor not ready — skip */
	}

	try {
		const root = vshell.getRoot();
		if (root) {
			const list = await fsOperation(root).lsDir();
			if (Array.isArray(list) && list.length) {
				const entries = list
					.slice(0, 40)
					.map(
						(item) =>
							`${item.isDirectory ? "[dir] " : ""}${Url.basename(item.url)}`,
					);
				parts.push(
					`Workspace root entries:\n${entries.join("\n")}${
						list.length > 40 ? "\n..." : ""
					}`,
				);
			}
		}
	} catch {
		/* fs not ready — skip */
	}
	return parts.join("\n\n");
}

/**
 * Maps a tool call to a live-activity payload for the status chip.
 * @param {string} name tool name
 * @param {object} args parsed tool arguments
 * @returns {{action: string, detail?: string}}
 */
function toolStatus(name, args) {
	const detail = String(
		args?.path || args?.command || args?.pattern || args?.task || "",
	).slice(0, 60);
	switch (name) {
		case "list_dir":
			return { action: "list_dir", detail };
		case "read_file":
		case "read_active_file":
		case "editor_context":
		case "list_open_files":
			return { action: "reading", detail };
		case "search_files":
			return { action: "searching", detail };
		case "create_file":
		case "delete_file":
		case "move_path":
			return { action: "writing", detail };
		case "edit_file":
		case "apply_to_editor":
			return { action: "editing", detail };
		case "run_command":
			return { action: "command", detail: String(args?.command || "") };
		case "run_js":
			return { action: "js", detail };
		case "spawn_subagent":
		case "spawn_subagents":
			return { action: "subagent", detail };
		case "web_search":
			return { action: "web", detail: String(args?.query || "") };
		case "read_url":
			return { action: "fetch", detail: String(args?.url || "") };
		default:
			return { action: "tool", detail: name };
	}
}

/**
 * Extracts the HTTP status code from a client error message
 * ("400: {...}" from the native plugin, "HTTP 401" from fetch).
 * @param {string} message
 * @returns {number | null}
 */
function httpStatus(message) {
	const match =
		String(message).match(/^(\d{3}):/) || String(message).match(/HTTP (\d{3})/);
	if (match) return Number(match[1]);
	return null;
}

/**
 * Maps a raw provider error to a short, actionable message (PT/EN via
 * window.strings when available).
 * @param {Error | string} error
 * @param {object} config aiConfig() result
 * @returns {string}
 */
function friendlyError(error, config) {
	const raw = String(error?.message || error);
	const status = httpStatus(raw);
	const provider = PROVIDER_MAP[config.providerId];
	const name = provider?.name || config.providerId || "provider";
	const key = String(config.apiKey || "");
	const keyHint = key
		? `${key.slice(0, 6)}… (${key.length} chars)`
		: "(no key)";
	const shape = keyShapeWarning(config.providerId, key);

	if (status === 401 || status === 403) {
		return (
			(window.strings?.["ai err auth"] ||
				`Authentication failed on ${name}. Check its API key on Settings > AI > Providers.`) +
			(shape
				? ` ${shape}.`
				: ` ${window.strings?.["ai err key in use"] || "Key in use:"} ${keyHint}.`) +
			` (${raw.slice(0, 160)})`
		);
	}
	if (
		status === 400 &&
		/invalid api key|invalid_api_key|incorrect api key/i.test(raw)
	) {
		return (
			(window.strings?.["ai err key invalid"] ||
				`${name} rejected the API key as invalid. Re-copy the key (no spaces/quotes) on Settings > AI > Providers.`) +
			` (${raw.slice(0, 160)})`
		);
	}
	if (status === 404) {
		if (/model not found|model_not_found|no such model/i.test(raw)) {
			return (
				(window.strings?.["ai err model missing"] ||
					`Model "${config.model}" does not exist on ${name}. Open the model picker (⟳ Fetch available models) and pick a current one.`) +
				` (${raw.slice(0, 160)})`
			);
		}
		return (
			(window.strings?.["ai err endpoint"] ||
				`Endpoint not found on ${name} — verify the Base URL.`) +
			` (${raw.slice(0, 160)})`
		);
	}
	if (status === 429) {
		return (
			(window.strings?.["ai err rate"] ||
				`Rate limit / quota reached on ${name}. Wait a bit or check your plan.`) +
			` (${raw.slice(0, 160)})`
		);
	}
	if (status === 400 && /model|endpoint|decommission/i.test(raw)) {
		return (
			(window.strings?.["ai err model"] ||
				`Model "${config.model}" was rejected by ${name}. Pick another model — the provider default will be tried automatically.`) +
			` (${raw.slice(0, 160)})`
		);
	}
	if (status === 400 && /tool|function/i.test(raw)) {
		return (
			(window.strings?.["ai err tools"] ||
				`${name} rejected tool use for "${config.model}" — continuing without tools.`) +
			` (${raw.slice(0, 160)})`
		);
	}
	return raw;
}

export default Agent;
