import toast from "components/toast";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import settings from "lib/settings";
import { chatCompletion, resolveBaseURL } from "./client";
import { PROVIDER_MAP } from "./providers";
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
                this.toolAllowlist =
                        this.mode === "chat" ? [] : opts.tools || null;
                this.aborted = false;
                /** @type {Array<object>} OpenAI-format messages */
                this.messages = [
                        {
                                role: "system",
                                content: this.systemPrompt(),
                        },
                ];
        }

        systemPrompt() {
                if (this.isSubagent) {
                        return [
                                "You are a XCoder subagent: a focused research assistant.",
                                "Analyze the workspace with the allowed read-only tools and answer the task precisely.",
                                "Be concise: return a compact report with findings and, when relevant, exact file paths and line numbers.",
                                "Do not attempt to modify files (write tools are unavailable).",
                        ].join("\n");
                }
                const root = vshell.getRoot();
                return [
                        "You are the XCoder coding agent, embedded in the XCoder mobile code editor (Android).",
                        `Current workspace root: ${root || "(no folder open)"}.`,
                        "",
                        "Capabilities:",
                        "- You can list/read/create/edit/delete files, run a virtual shell, execute JavaScript in a sandbox and spawn subagents.",
                        "- Editor tools let you see and edit the file the user has open right now: editor_context, read_active_file (live buffer incl. unsaved edits), list_open_files and apply_to_editor (insert / replace_selection / replace_all, stays unsaved for review).",
                        "- Paths are relative to the workspace root ('.').",
                        "- Before editing, always read the target region with read_file and use edit_file with an exact unique old_text.",
                        "- Use vcs (run_command with 'vcs commit ...') before large changes so the user can restore.",
                        "- Keep answers short and structured; mention exact paths of files you changed.",
                        "- If a task is ambiguous, ask the user.",
                ].join("\n");
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
                                        ...(event.toolCalls
                                                ? { tool_calls: event.toolCalls }
                                                : {}),
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
         */
        async run(userText) {
                this.aborted = false;
                this.messages.push({ role: "user", content: userText });
                this.onEvent({ type: "user", payload: userText });

                const config = this.aiConfig();
                if (!config.apiKey && !/localhost|127\.0\.0\.1/.test(config.baseURL)) {
                        const message =
                                "No API key configured. Open Settings > AI assistant to add one.";
                        this.onEvent({ type: "error", payload: message });
                        return message;
                }

                let step = 0;
                while (!this.aborted && step < MAX_STEPS) {
                        step++;
                        let response;
                        try {
                                this.onEvent({ type: "status", payload: "thinking" });
                                response = await chatCompletion({
                                        ...config,
                                        messages: this.messages,
                                        tools: toolSchemas(this.toolAllowlist),
                                        temperature: settings.value.aiTemperature,
                                        maxTokens: settings.value.aiMaxTokens,
                                });
                        } catch (error) {
                                const message = `AI request failed: ${error.message || error}`;
                                this.onEvent({ type: "error", payload: message });
                                return message;
                        }

                        const { content, toolCalls } = response;

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
         * Executes a tool call honoring permissions.
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

                try {
                        return await executeTool(name, args, this);
                } catch (error) {
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
                const autonomy = settings.value.aiAutonomy || "safe";

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
         * Resolves provider settings.
         */
        aiConfig() {
                const providerId = settings.value.aiProvider || "groq";
                const provider = PROVIDER_MAP[providerId];
                const baseURL = resolveBaseURL(
                        provider,
                        settings.value.aiBaseUrl,
                );
                return {
                        baseURL,
                        apiKey: settings.value.aiApiKey || "",
                        model: settings.value.aiModel || provider?.models?.[0] || "",
                };
        }
}

/**
 * Runs a restricted subagent.
 * @param {{task: string, context?: string}} args
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
                ],
        });

        const promptText = args?.context
                ? `${task}\n\nContext from the main agent:\n${args.context}`
                : task;

        parent?.onEvent({ type: "status", payload: "subagent started" });
        const report = await subagent.run(promptText);
        parent?.onEvent({ type: "status", payload: "subagent finished" });
        return truncate(report || "(subagent returned nothing)", 6000);
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

export default Agent;
