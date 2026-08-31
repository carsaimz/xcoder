import "./style.scss";
import settings from "lib/settings";
import { Agent } from "lib/ai/agent";
import vshell from "lib/ai/vshell";
import { PROVIDER_MAP } from "lib/ai/providers";
import { GROUPS } from "lib/ai/providers";
import select from "dialogs/select";
import prompt from "dialogs/prompt";
import toast from "components/toast";
import fsOperation from "fileSystem";
import Url from "utils/Url";

const CHAT_STORAGE_KEY = "xcoder.ai.chat";
/** @type {Array<{type: string, payload?: any, name?: string, toolCallId?: string, toolCalls?: any[]}>} */
let events = [];
/** @type {Agent | null} */
let agent = null;
let running = false;
/** @type {HTMLElement} */
let container = null;
/** @type {HTMLElement} */
let $messages = null;
/** @type {HTMLTextAreaElement} */
let $input = null;
/** @type {HTMLElement} */
let $send = null;
/** @type {HTMLElement} */
let $status = null;
/** @type {Function} */
let cleanupOnHide = null;

/**
 * AI chat sidebar app.
 * @returns {Array} sidebar app descriptor
 */
export default [
        "psychology",
        "ai",
        strings["ai assistant"] || "AI",
        initApp,
        false,
        onSelected,
];

/**
 * Opens the AI chat sidebar (activates the "ai" section) without sending
 * anything.
 * @returns {Promise<void>}
 */
export async function openAiChat() {
        try {
                const [{ default: sidebarApps }, { default: Sidebar }] =
                        await Promise.all([
                                import("sidebarApps"),
                                import("components/sidebar"),
                        ]);
                sidebarApps.setActiveApp?.("ai");
                Sidebar.show();
        } catch (error) {
                window.log?.("error", "openAiChat failed:", error);
        }
}

/**
 * Sends a message to the AI chat (used by the selection actions).
 * Shows the sidebar and runs the full agent, streaming events into the UI.
 * @param {string} text prompt text
 * @returns {Promise<boolean>} false if the chat was busy
 */
export async function askAI(text) {
        const message = String(text || "").trim();
        if (!message) return false;

        await openAiChat();

        if (running) {
                toast(strings["ai busy"] || "AI is still working — wait or stop it first");
                return false;
        }

        if (!agent) {
                agent = new Agent({ onEvent: handleEvent });
                agent.restore(events);
        }

        try {
                setRunning(true);
                await agent.run(message);
        } catch (error) {
                handleEvent({ type: "error", payload: error.message || String(error) });
        } finally {
                setRunning(false);
                persist();
        }
        return true;
}

function onSelected(el) {
        // focus input when the tab is selected
        setTimeout(() => {
                el?.querySelector("textarea.ai-input")?.focus();
        }, 100);
}

/**
 * @param {HTMLElement} el container provided by the sidebar
 */
function initApp(el) {
        container = el;
        el.classList.add("ai-chat-app");
        el.content = buildUi();

        restore();
        renderMessages();

        return () => {
                container = null;
                if (cleanupOnHide) cleanupOnHide();
        };
}

function buildUi() {
        const providerId = settings.value.aiProvider || "groq";
        const provider = PROVIDER_MAP[providerId];
        const model = settings.value.aiModel || provider?.models?.[0] || "—";

        const $header = (
                <div className="ai-header">
                        <div className="ai-title">
                                <span className="icon psychology"></span>
                                <span className="ai-model" title={model}>{model}</span>
                        </div>
                        <div className="ai-actions">
                                <span
                                        className="icon history"
                                        title={strings["ai clear chat"] || "Clear chat"}
                                        onclick={clearChat}
                                ></span>
                                <span
                                        className="icon settings"
                                        title={strings["ai settings"] || "AI settings"}
                                        onclick={openSettings}
                                ></span>
                        </div>
                </div>
        );

        $messages = (
                <div
                        className="ai-messages"
                        ontouchstart={handleTouch}
                ></div>
        );

        $status = <div className="ai-status"></div>;

        $input = (
                <textarea
                        className="ai-input"
                        rows={1}
                        placeholder={
                                strings["ai input placeholder"] || "Ask about your project..."
                        }
                        onkeydown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                }
                        }}
                        oninput={autosize}
                ></textarea>
        );

        $send = (
                <button className="ai-send" onclick={onSendClick}>
                        <span className="icon send"></span>
                </button>
        );

        const $composer = (
                <div className="ai-composer">
                        {$input}
                        {$send}
                </div>
        );

        return (
                <div className="ai-chat">
                        {$header}
                        {$messages}
                        {$status}
                        {$composer}
                </div>
        );
}

function onSendClick() {
        if (running) {
                agent?.abort();
                setRunning(false);
        } else {
                send();
        }
}

async function send() {
        const text = ($input.value || "").trim();
        if (!text || running) return;

        $input.value = "";
        autosize();

        if (!agent) {
                agent = new Agent({ onEvent: handleEvent });
                agent.restore(events);
        }

        try {
                setRunning(true);
                await agent.run(text);
        } catch (error) {
                handleEvent({ type: "error", payload: error.message || String(error) });
        } finally {
                setRunning(false);
                persist();
        }
}

/**
 * @param {{type: string, payload?: any, name?: string, toolCallId?: string, toolCalls?: any[]}} event
 */
function handleEvent(event) {
        if (event.type === "tool") {
                updateToolRow(event);
                return;
        }
        if (event.type === "status") {
                $status.textContent =
                        event.payload === "subagent started"
                                ? strings["ai subagent running"] || "Subagent working..."
                                : strings.thinking || "Thinking...";
                return;
        }

        $status.textContent = "";

        if (event.type === "user") {
                events.push({ type: "user", payload: event.payload });
        } else if (event.type === "assistant") {
                events.push({
                        type: "assistant",
                        payload: event.payload,
                        toolCalls: event.toolCalls,
                });
        } else if (event.type === "error") {
                events.push({ type: "error", payload: event.payload });
        }

        appendEvent(event);
        scrollToEnd();
        persist();
}

/**
 * Updates the tool row state when the tool result arrives.
 * @param {{toolCallId?: string, payload?: any, name?: string}} event
 */
function updateToolRow(event) {
        const $wrap = $messages?.querySelector(
                `.ai-toolwrap[data-toolcall="${event.toolCallId}"]`,
        );
        if (!$wrap) return;
        const $row = $wrap.querySelector(".ai-tool");
        const $state = $row?.querySelector(".ai-tool-state");
        const $result = $wrap.querySelector(".ai-tool-result");
        const text = String(event.payload ?? "");
        const failed = text.startsWith("ERROR") || text.startsWith("DENIED");
        if ($row) $row.classList.add(failed ? "failed" : "done");
        if ($state) $state.textContent = failed ? "✗" : "✓";
        if ($result) $result.textContent = text;
}

function appendEvent(event) {
        if (event.type === "user") {
                $messages.append(
                        <div className="ai-msg user">
                                <div className="ai-bubble">{event.payload}</div>
                        </div>,
                );
                return;
        }

        if (event.type === "assistant") {
                const $bubble = (
                        <div className="ai-bubble assistant">
                                {renderRichText(event.payload || "")}
                        </div>
                );
                const $wrap = <div className="ai-msg assistant">{$bubble}</div>;

                for (const call of event.toolCalls || []) {
                        $wrap.append(toolCallView(call));
                }

                $messages.append($wrap);
                return;
        }

        if (event.type === "error") {
                $messages.append(
                        <div className="ai-msg error">
                                <div className="ai-bubble">{event.payload}</div>
                        </div>
                );
        }
}

/**
 * Renders a tool call row; results update when the matching tool event
 * arrives (keyed by toolCallId).
 * @param {object} call
 */
function toolCallView(call) {
        const name = call.function?.name || "tool";
        let argsPreview = "";
        try {
                argsPreview = JSON.stringify(JSON.parse(call.function?.arguments || "{}"));
        } catch {
                argsPreview = call.function?.arguments || "";
        }

        const $result = (
                <div className="ai-tool-result" style="display:none"></div>
        );
        const $row = (
                <div
                        className="ai-tool pending"
                        onclick={() => {
                                const hidden = $result.style.display === "none";
                                $result.style.display = hidden ? "block" : "none";
                        }}
                >
                        <span className="icon build"></span>
                        <span className="ai-tool-name">{name}</span>
                        <span className="ai-tool-state">…</span>
                </div>
        );
        const $wrap = (
                <div className="ai-toolwrap" data-toolcall={call.id}>
                        {$row}
                        {$result}
                        {argsPreview ? (
                                <div className="ai-tool-args">{argsPreview}</div>
                        ) : null}
                </div>
        );
        return $wrap;
}

function renderMessages() {
        $messages.content = "";
        if (!events.length) {
                $messages.append(
                        <div className="ai-msg empty">
                                <div className="ai-bubble">
                                        {strings["ai welcome"] ||
                                                "Hi! I can read and edit your project, run code and use the shell. Open a folder first for the best results."}
                                </div>
                        </div>,
                );
                return;
        }
        for (const event of events) {
                appendEvent(event);
        }
        scrollToEnd();
}

function clearChat() {
        events = [];
        agent = null;
        localStorage.removeItem(CHAT_STORAGE_KEY);
        renderMessages();
}

function openSettings() {
        import("settings/aiSettings").then(({ default: aiSettings }) => {
                aiSettings();
        });
}

/**
 * @param {boolean} value
 */
function setRunning(value) {
        running = value;
        $send.classList.toggle("running", value);
        $send.get("span").className = value ? "icon close" : "icon send";
        if (!value) $status.textContent = "";
}

function scrollToEnd() {
        requestAnimationFrame(() => {
                if ($messages) {
                        $messages.scrollTop = $messages.scrollHeight;
                }
        });
}

function autosize() {
        $input.style.height = "auto";
        $input.style.height = `${Math.min($input.scrollHeight, 140)}px`;
}

function persist() {
        try {
                localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(events.slice(-80)));
        } catch {
                /* storage full — ignore */
        }
}

function restore() {
        try {
                const raw = localStorage.getItem(CHAT_STORAGE_KEY);
                if (raw) events = JSON.parse(raw) || [];
        } catch {
                events = [];
        }
}

/**
 * Minimal rich text: fenced code blocks -> <pre>, otherwise plain text.
 * @param {string} text
 */
function renderRichText(text) {
        const parts = String(text).split(/```/);
        const nodes = [];
        parts.forEach((part, index) => {
                if (index % 2 === 1) {
                        const [maybeLang, ...rest] = part.split("\n");
                        const code = rest.length ? rest.join("\n") : maybeLang;
                        const clean = code.replace(/\n$/, "");
                        nodes.push(
                                <pre
                                        className="ai-code tappable"
                                        onclick={() => codeBlockActions(clean)}
                                        title={strings["ai code actions"] || "Tap for code actions"}
                                >
                                        {clean}
                                </pre>,
                        );
                } else if (part.trim()) {
                        part.split("\n").forEach((line) => {
                                nodes.push(<div className="ai-line">{line}</div>);
                        });
                }
        });
        return nodes;
}

function handleTouch() {
        /* reserved: long-press actions */
}

/**
 * Actions available on an AI code block (copy / insert / replace / save).
 * @param {string} code
 */
async function codeBlockActions(code) {
        const choice = await select(
                strings["ai code actions"] || "Code actions",
                [
                        {
                                text: strings["insert at cursor"] || "Insert at cursor",
                                value: "insert",
                        },
                        {
                                text: strings["replace selection"] || "Replace selection",
                                value: "replace",
                        },
                        { text: strings.copy || "Copy", value: "copy" },
                        {
                                text:
                                        strings["save code to file"] || "Save code to file",
                                value: "save",
                        },
                ],
        );

        switch (choice) {
                case "copy":
                        await copyToClipboard(code);
                        toast(strings["code copied"] || "Code copied");
                        break;
                case "insert":
                case "replace":
                        insertCode(code, choice === "replace");
                        break;
                case "save":
                        await saveCodeFile(code);
                        break;
        }
}

/**
 * @param {string} text
 */
async function copyToClipboard(text) {
        try {
                if (cordova?.plugins?.clipboard) {
                        cordova.plugins.clipboard.copy(text);
                        return;
                }
                await navigator.clipboard.writeText(text);
        } catch (error) {
                toast(`clipboard: ${error.message || error}`);
        }
}

/**
 * Inserts (or replaces the selection with) the given code in the active
 * editor file.
 * @param {string} code
 * @param {boolean} replaceSelection
 */
function insertCode(code, replaceSelection) {
        const editorManager = window.editorManager;
        const file = editorManager?.activeFile;
        const editor = editorManager?.editor;

        if (!file || file.type !== "editor" || !editor) {
                toast(strings["ai no file open"] || "Open a file first");
                return;
        }

        const state = editor.state;
        const selection = state.selection.main;
        const useSelection = replaceSelection && !selection.empty;
        editor.dispatch({
                changes: {
                        from: useSelection ? selection.from : selection.to,
                        to: useSelection ? selection.to : selection.to,
                        insert: code,
                },
                selection: { anchor: (useSelection ? selection.from : selection.to) + code.length },
        });
        editor.focus();
        toast(
                useSelection
                        ? strings["code replaced"] || "Selection replaced"
                        : strings["code inserted"] || "Code inserted",
        );
}

/**
 * Saves code to a file inside the workspace (path asked via prompt).
 * @param {string} code
 */
async function saveCodeFile(code) {
        const path = await prompt(
                strings["save code to file"] || "Save code to file",
                "",
                "text",
        );
        if (!path) return;

        try {
                const url = vshell.resolvePath(path.trim());
                const fs = fsOperation(url);
                if (await fs.exists()) {
                        await fs.writeFile(code);
                } else {
                        const dir = Url.dirname(url);
                        await fsOperation(dir).createFile(Url.basename(url), code);
                }
                toast(`${strings["file saved"] || "Saved"}: ${path.trim()}`);
        } catch (error) {
                toast(`save: ${error.message || error}`);
        }
}
