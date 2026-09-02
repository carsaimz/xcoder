import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import { Agent } from "lib/ai/agent";
import { listModels, resolveBaseURL } from "lib/ai/client";
import { getEditorContext as readEditorContext } from "lib/ai/editorBridge";
import {
	badgeLabel,
	PROVIDER_MAP,
	resolveApiKey,
	resolveBaseUrl,
} from "lib/ai/providers";
import {
	deriveTitle,
	formatSessionTime,
	loadActiveId,
	loadSessions,
	newSession,
	saveActiveId,
	saveSessions,
	touchSession,
} from "lib/ai/sessions";
import {
	expandSlashCommand,
	matchSlashCommands,
	SLASH_COMMANDS,
} from "lib/ai/slashCommands";
import vshell from "lib/ai/vshell";
import settings from "lib/settings";
import Url from "utils/Url";

const LEGACY_CHAT_KEY = "xcoder.ai.chat";

/** @type {Array<{type: string, payload?: any, name?: string, toolCallId?: string, toolCalls?: any[]}>} */
let events = [];
/** @type {Array<object>} sessions from lib/ai/sessions */
let sessions = [];
/** @type {string | null} */
let activeId = null;
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
/** @type {HTMLElement} */
let $slashMenu = null;
/** @type {HTMLElement} */
let $sessionTitle = null;
/** @type {HTMLElement} */
let $modelBtn = null;
/** @type {HTMLElement} */
let $modeTrack = null;
/** @type {HTMLElement} */
let $modeFooter = null;
/** @type {Function} */
let cleanupOnHide = null;

/**
 * AI chat sidebar app.
 * @returns {Array} sidebar app descriptor
 */
export default [
	"svg:brain",
	"ai",
	strings["ai assistant"] || "AI",
	initApp,
	false,
	onSelected,
	{ titleKey: "ai assistant" },
];

/**
 * Opens the AI chat in the sidebar (activates the app and shows the
 * sidebar if it was closed) without sending anything.
 * @returns {Promise<void>}
 */
export async function openAiChat() {
	try {
		const { default: sidebarApps } = await import("sidebarApps");
		sidebarApps.pulseApp?.("ai");
		const { default: Sidebar } = await import("components/sidebar");
		Sidebar?.show?.();
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

	ensureTitle(message);

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
	// live in the sidebar panel again; resync controls, scroll to the
	// latest message and focus the input
	updateModeSwitch();
	updateModelButton();
	scrollToEnd();
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

	restoreSessions();
	renderMessages();
	updateModeSwitch();
	updateModelButton();

	return () => {
		container = null;
		if (cleanupOnHide) cleanupOnHide();
	};
}

function buildUi() {
	$sessionTitle = <span className="ai-session-title" title=""></span>;

	// Header — quick action icons only (compact 24dp glyphs, 40dp targets)
	$modelBtn = (
		<span
			className="icon tune ai-act"
			title={strings["ai model"] || "Model"}
			onclick={openModelPicker}
		></span>
	);

	const $header = (
		<div className="ai-header">
			{$modelBtn}
			<span
				className="icon add ai-act"
				title={strings["ai new chat"] || "New chat"}
				onclick={startNewChat}
			></span>
			<span
				className="icon historyrestore ai-act"
				title={strings["ai sessions"] || "Chat sessions"}
				onclick={openSessions}
			></span>
			<span
				className="icon settings ai-act"
				title={strings["ai settings"] || "AI settings"}
				onclick={openSettings}
			></span>
		</div>
	);

	// Slim session title strip (kept out of the header on purpose)
	const $sessionBar = <div className="ai-session-bar">{$sessionTitle}</div>;

	$messages = (
		<div className="ai-messages scroll" ontouchstart={handleTouch}></div>
	);

	$status = <div className="ai-status"></div>;

	// Footer — centered Agent/Chat switch (iOS/VS Code style)
	$modeTrack = <div className="ai-mode-track" onclick={toggleMode}></div>;
	$modeFooter = (
		<div className="ai-modebar">
			<span
				className="ai-mode-label"
				data-side="chat"
				onclick={() => setMode("chat")}
			>
				{strings["ai mode chat"] || "Chat"}
			</span>
			{$modeTrack}
			<span
				className="ai-mode-label"
				data-side="agent"
				onclick={() => setMode("agent")}
			>
				{strings["ai mode agent"] || "Agent"}
			</span>
		</div>
	);

	$slashMenu = (
		<div className="ai-slash-menu scroll" style="display:none"></div>
	);

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
			oninput={onInput}
		></textarea>
	);

	$send = (
		<button className="ai-send" onclick={onSendClick}>
			<span className="icon send"></span>
		</button>
	);

	const $composer = (
		<div className="ai-composer">
			{$slashMenu}
			<div className="ai-composer-row">
				{$input}
				{$send}
			</div>
		</div>
	);

	return (
		<div className="ai-chat">
			{$header}
			{$sessionBar}
			{$messages}
			{$status}
			{$modeFooter}
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

/**
 * Shows/hides the slash command popup as the user types.
 * @param {InputEvent} e
 */
function onInput(e) {
	autosize();
	updateSlashMenu(e.target?.value ?? "");
}

/**
 * Renders the filtered slash command list.
 * @param {string} value
 */
function updateSlashMenu(value) {
	if (!$slashMenu) return;
	const matches = matchSlashCommands(value);
	if (!matches.length || /\s/.test(value.slice(1))) {
		$slashMenu.style.display = "none";
		$slashMenu.content = "";
		return;
	}
	$slashMenu.content = matches.map((command) => (
		<div
			className="ai-slash-item"
			onclick={() => {
				$input.value = `/${command.id} `;
				updateSlashMenu($input.value);
				$input.focus();
			}}
		>
			<span className="ai-slash-cmd">/{command.id}</span>
			<span className="ai-slash-desc">
				{strings[command.descriptionKey] || command.fallbackDescription}
			</span>
		</div>
	));
	$slashMenu.style.display = "block";
}

async function send() {
	const raw = ($input.value || "").trim();
	if (!raw || running) return;

	$input.value = "";
	autosize();
	$slashMenu.style.display = "none";
	$slashMenu.content = "";

	// slash command expansion uses the live editor context (selection/file)
	const expanded = expandSlashCommand(raw, getEditorContext());
	const text = expanded || raw;

	ensureTitle(raw);

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
 * Live editor context for slash expansion: selection text + file name.
 * @returns {{hasFile: boolean, fileName?: string, selection?: string}}
 */
function getEditorContext() {
	try {
		const manager = window.editorManager;
		const context = readEditorContext(manager);
		if (!context.hasFile) return { hasFile: false };

		let selection = "";
		if (context.hasSelection && manager?.editor?.state) {
			const { from, to } = manager.editor.state.selection.main;
			selection = String(manager.editor.state.doc.toString())
				.slice(from, to)
				.slice(0, 8000);
		}
		return {
			hasFile: true,
			fileName: context.name,
			selection,
		};
	} catch {
		return { hasFile: false };
	}
}

/**
 * Sets the session title from the first user message when it is still
 * the default.
 * @param {string} rawText
 */
function ensureTitle(rawText) {
	const session = activeSession();
	if (!session) return;
	if (session.title && session.title !== "New chat") return;
	const title = deriveTitle(rawText);
	if (!title) return;
	session.title = title;
	renderSessionTitle();
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
			</div>,
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

	const $result = <div className="ai-tool-result" style="display:none"></div>;
	const $row = (
		<div
			className="ai-tool pending"
			onclick={() => {
				const hidden = $result.style.display === "none";
				$result.style.display = hidden ? "block" : "none";
			}}
		>
			<span className="icon wand"></span>
			<span className="ai-tool-name">{name}</span>
			<span className="ai-tool-state">…</span>
		</div>
	);
	const $wrap = (
		<div className="ai-toolwrap" data-toolcall={call.id}>
			{$row}
			{$result}
			{argsPreview ? <div className="ai-tool-args">{argsPreview}</div> : null}
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

function renderSessionTitle() {
	const session = activeSession();
	if ($sessionTitle) {
		$sessionTitle.textContent = session?.title || "New chat";
		$sessionTitle.title = session?.title || "";
	}
}

/**
 * Renders the Agent/Chat footer switch from settings.aiMode.
 */
function updateModeSwitch() {
	if (!$modeTrack || !$modeFooter) return;
	const mode = settings.value.aiMode === "chat" ? "chat" : "agent";
	$modeTrack.dataset.mode = mode;
	$modeTrack.content = (
		<span className="ai-mode-thumb">
			<span
				className={`icon ${mode === "chat" ? "chat_bubble" : "wand"}`}
			></span>
		</span>
	);
	$modeFooter.dataset.mode = mode;
	$modeTrack.title =
		mode === "chat"
			? strings["ai mode switch agent"] || "Switch to Agent (tools)"
			: strings["ai mode switch chat"] || "Switch to Chat (no tools)";
}

/** Flips the current mode. */
function toggleMode() {
	setMode(settings.value.aiMode === "chat" ? "agent" : "chat");
}

/**
 * Sets the AI mode (chat = conversation only, agent = full tools).
 * @param {string} mode
 */
function setMode(mode) {
	if (mode !== "chat" && mode !== "agent") return;
	if ((settings.value.aiMode === "chat" ? "chat" : "agent") === mode) return;

	settings.value.aiMode = mode;
	settings.update();
	agent = null; // rebuilt on next message with the new mode
	updateModeSwitch();
	hapticTick();
	toast(
		mode === "chat"
			? strings["ai mode chat"] || "Chat"
			: strings["ai mode agent"] || "Agent",
		1200,
	);
}

/** Light haptic feedback for confirmations. */
function hapticTick() {
	try {
		navigator.vibrate?.(10);
	} catch {
		/* unsupported — ignore */
	}
}

/** Keeps the model button tooltip in sync with the active model. */
function updateModelButton() {
	if (!$modelBtn) return;
	const providerId = settings.value.aiProvider || "groq";
	const provider = PROVIDER_MAP[providerId];
	const model = settings.value.aiModel || provider?.models?.[0] || "—";
	const badge = provider ? badgeLabel(provider.group) : null;
	$modelBtn.title = `${strings["ai model"] || "Model"}: ${model}${badge ? ` (${badge})` : ""}`;
}

/**
 * Quick model picker: instant dialog with the provider's known models,
 * plus live fetch from the API and manual entry.
 */
async function openModelPicker() {
	const providerId = settings.value.aiProvider || "groq";
	const provider = PROVIDER_MAP[providerId];

	/** @type {Array<string>} deduplicated model ids */
	const models = [];
	for (const model of provider?.models || []) {
		if (!models.includes(model)) models.push(model);
	}

	const current = settings.value.aiModel || models[0] || "";
	const fetchLabel = strings["ai fetch models"] || "Fetch available models";
	const manualLabel = strings["ai model manual"] || "Type model id manually";

	const choice = await select(strings["ai model"] || "Model", [
		...models.map((model) => [model, model === current ? `✓ ${model}` : model]),
		["__fetch__", `⟳ ${fetchLabel}`],
		["__manual__", manualLabel],
	]);
	if (!choice) return;

	if (choice === "__fetch__") {
		await pickModelLive();
		return;
	}

	if (choice === "__manual__") {
		const manual = await prompt(
			strings["ai model"] || "Model",
			current,
			"text",
			{ required: false },
		);
		const value = String(manual || "").trim();
		if (!value) return;
		await settings.update({ aiModel: value });
		agent = null;
		updateModelButton();
		toast(value, 2000);
		return;
	}

	if (choice !== current) {
		await settings.update({ aiModel: choice });
		agent = null;
		updateModelButton();
		toast(choice, 2000);
	}
}

/**
 * Queries /models at the current endpoint and lets the user pick one.
 */
async function pickModelLive() {
	const providerId = settings.value.aiProvider || "groq";
	const provider = PROVIDER_MAP[providerId];
	toast(strings["loading..."] || "Loading...", 3000);
	try {
		const models = await listModels({
			baseURL: resolveBaseURL(provider, resolveBaseUrl(providerId)),
			apiKey: resolveApiKey(providerId),
		});
		if (!models.length) {
			toast(
				strings["ai no models"] || "No models found — set the model manually.",
				4000,
			);
			return;
		}
		const selected = await select(
			strings["ai model"] || "Model",
			models.slice(0, 200).map((model) => [model, model]),
		);
		if (selected) {
			await settings.update({ aiModel: selected });
			agent = null;
			updateModelButton();
			toast(selected, 2000);
		}
	} catch (error) {
		toast(`models: ${error.message || error}`);
	}
}

/** @returns {object | undefined} the currently active session */
function activeSession() {
	return sessions.find((session) => session.id === activeId);
}

/** Persists the current events into the active session (if any). */
function persist() {
	const session = activeSession();
	if (!session) return;
	session.events = events.slice();
	touchSession(session);
	saveSessions(sessions);
	saveActiveId(activeId);
}

/**
 * Loads sessions (with legacy single-chat migration) and restores the
 * active one.
 */
function restoreSessions() {
	sessions = loadSessions();
	activeId = loadActiveId();

	if (!sessions.length) {
		// migrate the pre-multi-session chat if present
		let legacy = [];
		try {
			legacy = JSON.parse(localStorage.getItem(LEGACY_CHAT_KEY) || "[]");
		} catch {
			legacy = [];
		}
		const session = newSession(
			legacy.length
				? strings["ai imported"] || "Previous chat"
				: strings["ai new chat"] || "New chat",
		);
		session.events = Array.isArray(legacy) ? legacy.slice(-200) : [];
		if (session.events.length) {
			const firstUser = session.events.find((event) => event.type === "user");
			if (firstUser) session.title = deriveTitle(firstUser.payload);
		}
		sessions = [session];
		activeId = session.id;
		saveSessions(sessions);
		saveActiveId(activeId);
		localStorage.removeItem(LEGACY_CHAT_KEY);
	}

	if (!activeSession()) {
		activeId = sessions[sessions.length - 1]?.id || null;
		if (!activeId) {
			const session = newSession();
			sessions = [session];
			activeId = session.id;
			saveSessions(sessions);
		}
		saveActiveId(activeId);
	}

	events = [...(activeSession()?.events || [])];
	renderSessionTitle();
}

/**
 * Session manager: list chats, create, open, rename or delete.
 */
async function openSessions() {
	const items = [
		{
			value: "__new__",
			text: strings["ai new chat"] || "New chat",
			icon: "add",
		},
		...sessions.map((session) => ({
			value: session.id,
			text:
				(session.id === activeId ? `● ${session.title}` : session.title) +
				`  ·  ${formatSessionTime(session.updatedAt)}`,
		})),
	];

	const choice = await select(strings["ai sessions"] || "Chat sessions", items);
	if (!choice) return;

	if (choice === "__new__") {
		startNewChat();
		return;
	}

	const action = await select(
		sessions.find((s) => s.id === choice)?.title || "",
		[
			{
				value: "open",
				text: strings["ai open session"] || "Open",
				icon: "remove_red_eyevisibility",
			},
			{
				value: "rename",
				text: strings["ai rename session"] || "Rename",
				icon: "edit",
			},
			{
				value: "delete",
				text: strings["ai delete session"] || "Delete",
				icon: "delete",
			},
		],
	);

	if (action === "open") {
		switchSession(choice);
	} else if (action === "rename") {
		await renameSession(choice);
	} else if (action === "delete") {
		await deleteSession(choice);
	}
}

/** Starts a fresh chat session. */
function startNewChat() {
	if (activeSession() && !events.length) {
		// already on an empty chat — just focus
		renderMessages();
		return;
	}
	persist();
	const session = newSession();
	sessions.push(session);
	activeId = session.id;
	events = [];
	agent = null;
	saveSessions(sessions);
	saveActiveId(activeId);
	renderSessionTitle();
	renderMessages();
}

/**
 * @param {string} id
 */
function switchSession(id) {
	if (id === activeId) return;
	persist();
	const session = sessions.find((item) => item.id === id);
	if (!session) return;
	activeId = id;
	events = [...(session.events || [])];
	agent = null;
	saveActiveId(activeId);
	renderSessionTitle();
	renderMessages();
}

/**
 * @param {string} id
 */
async function renameSession(id) {
	const session = sessions.find((item) => item.id === id);
	if (!session) return;
	const title = await prompt(
		strings["ai rename session"] || "Rename",
		session.title,
		"text",
	);
	if (!title || !title.trim()) return;
	session.title = title.trim().slice(0, 80);
	if (id === activeId) renderSessionTitle();
	persist();
	toast(strings["ai session renamed"] || "Chat renamed");
}

/**
 * @param {string} id
 */
async function deleteSession(id) {
	const session = sessions.find((item) => item.id === id);
	if (!session) return;

	const ok = await confirm(
		strings["ai delete session"] || "Delete chat",
		(strings["ai delete session confirm"] || "Delete chat '{title}'?").replace(
			"{title}",
			session.title,
		),
	);
	if (!ok) return;

	sessions = sessions.filter((item) => item.id !== id);
	if (id === activeId) {
		const remaining = [...sessions].sort(
			(a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
		);
		if (remaining.length) {
			activeId = remaining[0].id;
			events = [...(activeSession()?.events || [])];
		} else {
			const fresh = newSession();
			sessions = [fresh];
			activeId = fresh.id;
			events = [];
		}
		agent = null;
		renderSessionTitle();
		renderMessages();
	}
	saveSessions(sessions);
	saveActiveId(activeId);
	toast(strings["ai session deleted"] || "Chat deleted");
}

/**
 * Clears the events of the current chat (the session itself is kept).
 */
async function clearChat() {
	const ok = await confirm(
		strings["ai clear chat"] || "Clear chat",
		strings["ai confirm clear"] || "Clear this chat?",
	);
	if (!ok) return;

	events = [];
	agent = null;
	const session = activeSession();
	if (session) session.events = [];
	persist();
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
	$send.get("span").className = value ? "icon clearclose" : "icon send";
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
					data-hint={strings["ai tap hint"] || "tap for actions"}
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
	const choice = await select(strings["ai code actions"] || "Code actions", [
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
			text: strings["save code to file"] || "Save code to file",
			value: "save",
		},
	]);

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
		selection: {
			anchor: (useSelection ? selection.from : selection.to) + code.length,
		},
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
