/**
 * XCoder AI ⇄ terminal bridge.
 *
 * Gives the agent a tool that opens/closes the REAL terminal (the Alpine
 * proot environment behind the app's Terminal tab) and runs any command
 * inside it, waits for it to finish and returns the captured output so the
 * agent can decide what to do next — like a coding agent with a real shell.
 *
 * How completion detection works: after the agent's command we append a
 * `printf` line that echoes a unique end marker plus `$?`. The PTY also
 * ECHOES the typed marker (with a literal `_$?`), so the regex only matches
 * the executed marker when it carries real digits — giving us the exit code
 * without touching the interactive shell state.
 */

const AI_TERMINAL_NAME = "AI Terminal";

/** Default per-command wait (ms) — agent can raise it via timeout_ms. */
const DEFAULT_TIMEOUT_MS = 90_000;
/** Hard cap so one bad command can't hang the agent loop forever. */
const MAX_TIMEOUT_MS = 300_000;
/** Max characters of captured output returned to the model. */
const MAX_OUTPUT_CHARS = 8000;
/** How long we poll the capture buffer between checks (ms). */
const POLL_MS = 150;
/** Extra grace period after a fresh terminal is created (Alpine boot). */
const BOOT_GRACE_MS = 1500;

/** @type {Promise<unknown>} serializes terminal runs (one command at a time) */
let runQueue = Promise.resolve();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Finds an existing local (non-SSH) terminal, preferring the AI-owned one.
 * @param {object} manager TerminalManager singleton
 * @returns {object|undefined} terminal instance ({id, name, component, file})
 */
function findLocalTerminal(manager) {
	let fallback;
	for (const candidate of manager.terminals.values()) {
		const component = candidate?.component;
		if (!component || component.remoteSsh) continue;
		if (candidate.name === AI_TERMINAL_NAME) return candidate;
		if (!fallback && component.serverMode) fallback = candidate;
	}
	return fallback;
}

/**
 * Opens (or reuses) a terminal session and shows its tab.
 * @param {object} [opts]
 * @param {boolean} [opts.show] make the terminal tab active (default true)
 * @returns {Promise<{entry: object, fresh: boolean}>}
 */
async function ensureTerminal({ show = true } = {}) {
	const { TerminalManager } = await import("components/terminal");
	let entry = findLocalTerminal(TerminalManager);
	const fresh = !entry;

	if (!entry) {
		entry = await TerminalManager.createTerminal({ name: AI_TERMINAL_NAME });
		// give the Alpine/proot shell a moment to print its first prompt;
		// the command itself is buffered by the PTY either way
		await sleep(BOOT_GRACE_MS);
	}
	if (show) entry.file?.makeActive?.();
	return { entry, fresh };
}

/**
 * Collects PTY output frames for one command run. Mirrors the decoding
 * AttachAddon does (text frames as-is, binary frames via UTF-8 decoder
 * with stream mode so multi-byte characters split across frames survive).
 */
function startCapture(component) {
	const state = { text: "" };
	const decoder = new TextDecoder("utf-8");
	const onMessage = (event) => {
		const data = event?.data;
		try {
			if (typeof data === "string") {
				state.text += data;
			} else if (data instanceof ArrayBuffer) {
				state.text += decoder.decode(data, { stream: true });
			} else if (data instanceof Uint8Array) {
				state.text += decoder.decode(data, { stream: true });
			}
		} catch {
			// decoding noise must never kill a run
		}
		if (state.text.length > 400_000) {
			// ring guard: keep the tail so long builds don't eat memory
			state.text = state.text.slice(-200_000);
			state.trimmed = true;
		}
	};
	const ws = component?.websocket;
	if (ws && typeof ws.addEventListener === "function") {
		ws.addEventListener("message", onMessage);
	}
	return {
		state,
		stop() {
			try {
				ws?.removeEventListener?.("message", onMessage);
			} catch {
				/* noop */
			}
		},
	};
}

/** Strips ANSI escapes/CR noise so the model sees plain text. */
function cleanOutput(text) {
	return (
		String(text || "")
			// eslint-disable-next-line no-control-regex
			.replace(
				/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\))/g,
				"",
			)
			.replace(/\r\n?/g, "\n")
			.replace(/\u0007|\u0008/g, "")
	);
}

/**
 * Keeps head and tail of long output (errors usually live at the end,
 * banners/context at the beginning).
 */
function clampOutput(text, max = MAX_OUTPUT_CHARS) {
	const output = cleanOutput(text);
	if (output.length <= max) return output;
	const head = output.slice(0, Math.floor(max * 0.6));
	const tail = output.slice(-Math.floor(max * 0.35));
	return `${head}\n... (${output.length - head.length - tail.length} chars omitted) ...\n${tail}`;
}

/**
 * Runs a command in the given terminal session and waits for completion.
 * @param {object} entry terminal instance from TerminalManager
 * @param {string} command raw command line (sh syntax)
 * @param {number} timeoutMs
 * @returns {Promise<string>} model-facing result text
 */
async function runInTerminal(entry, command, timeoutMs) {
	const component = entry?.component;
	if (!component) return "ERROR: terminal session is unavailable.";
	if (component.remoteSsh) {
		return "ERROR: refusing to drive an SSH session — open a local terminal instead.";
	}
	if (!component.isConnected || !component.websocket) {
		return "ERROR: terminal session is not connected. Open the terminal first (action 'open').";
	}

	const capture = startCapture(component);
	const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	const END = `XC_END_${nonce}`;
	const endRe = new RegExp(`${END}_(\\d+)`);
	const startPos = capture.state.text.length;

	try {
		component.write(`${command}\n`);
		component.write(`printf '%s\\n' "${END}_$?"\n`);

		const deadline = Date.now() + timeoutMs;
		let exitCode = null;
		let shellExited = false;

		while (Date.now() < deadline) {
			await sleep(POLL_MS);
			const match = endRe.exec(capture.state.text.slice(startPos));
			if (match) {
				exitCode = Number(match[1]);
				break;
			}
			if (component.processExited || !component.isConnected) {
				shellExited = true;
				break;
			}
		}

		let body = capture.state.text.slice(startPos);
		// drop the PTY echo of our marker printf line (contains the literal
		// unexpanded `_$?`), keep everything the command itself printed
		body = body.replace(new RegExp(`printf[^\n]*${END}[^\n]*\n?`, "g"), "");

		const echoIndex = body.indexOf(command);
		if (echoIndex >= 0) body = body.slice(echoIndex + command.length);
		const match = endRe.exec(body);
		if (match) body = body.slice(0, match.index);

		const output = clampOutput(body);

		if (exitCode != null) {
			const prefix = exitCode === 0 ? "" : `exit code ${exitCode}\n`;
			return `${prefix}${output.trim() || "(no output)"}`;
		}
		if (shellExited) {
			return `${output}\n(terminal session ended while running the command)`.trim();
		}
		return `${output || "(no output yet)"}\n(timed out after ${Math.round(
			timeoutMs / 1000,
		)}s — the command is STILL RUNNING. Use action "signal" to send Ctrl+C, or run a shorter command.)`.trim();
	} finally {
		capture.stop();
	}
}

/**
 * Tool implementation — `terminal` for the agent.
 * @param {object} args
 * @returns {Promise<string>}
 */
async function terminalTool(args) {
	const action = String(args?.action || "run").toLowerCase();
	const command = String(args?.command || "").trim();

	try {
		switch (action) {
			case "open": {
				const { entry } = await ensureTerminal({ show: true });
				return `Terminal "${entry?.name || AI_TERMINAL_NAME}" is open (Alpine Linux). Use action "run" to execute commands.`;
			}
			case "close": {
				const { TerminalManager } = await import("components/terminal");
				const entry = findLocalTerminal(TerminalManager);
				if (!entry) return "No open terminal to close.";
				await TerminalManager.closeTerminal(entry.id, true);
				return `Terminal "${entry.name}" closed.`;
			}
			case "list": {
				const { TerminalManager } = await import("components/terminal");
				const entries = [...TerminalManager.terminals.values()];
				if (!entries.length) return "(no open terminals)";
				return entries
					.map(
						(candidate) =>
							`${candidate.name}${candidate.component?.remoteSsh ? " [ssh]" : " [alpine]"}`,
					)
					.join("\n");
			}
			case "signal": {
				const { TerminalManager } = await import("components/terminal");
				const entry = findLocalTerminal(TerminalManager);
				if (!entry) return "No open terminal.";
				entry.component?.write?.("\x03");
				return "Sent Ctrl+C to the terminal.";
			}
			default: {
				// "run" (and any unknown action) lands here
				if (!command) {
					return 'ERROR: "command" is required (e.g. {"action":"run","command":"apk --version"}).';
				}
				if (/^\s*exit\s*$/.test(command)) {
					return 'ERROR: do not run `exit` — use action "close" to close the terminal.';
				}
				const requested = Number(args?.timeout_ms);
				const timeoutMs = Math.min(
					Math.max(
						Number.isFinite(requested) ? requested : DEFAULT_TIMEOUT_MS,
						3_000,
					),
					MAX_TIMEOUT_MS,
				);

				// one command at a time keeps marker matching predictable
				const result = await (runQueue = runQueue
					.catch(() => {})
					.then(async () => {
						const { entry } = await ensureTerminal({ show: false });
						return runInTerminal(entry, command, timeoutMs);
					}));
				return result;
			}
		}
	} catch (error) {
		return `ERROR: ${error?.message || error}`;
	}
}

export default terminalTool;
export { AI_TERMINAL_NAME, clampOutput, cleanOutput };
