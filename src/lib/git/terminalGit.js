/**
 * Git ⇄ Alpine terminal bridge.
 *
 * When the in-app git engine cannot reach the network (WebView CORS,
 * captive portals, big repos), the Git panel falls back to the REAL git
 * inside the Alpine proot sandbox: it installs git automatically
 * (`apk add git`) when missing and runs headless one-shot commands
 * through the terminal plugin's Executor (no PTY tab required, output
 * captured, exit code checked).
 *
 * Paths: the sandbox binds /sdcard, /storage and /data verbatim
 * (plugins/proot/scripts/init-sandbox.sh), so any app-visible file://
 * root under those prefixes maps 1:1 (lib/terminalCwd.sandboxPathOf).
 */
import fsOperation from "fileSystem";
import { sandboxPathOf, shellQuote } from "lib/terminalCwd";
import Url from "utils/Url";
import { resolveCredentials } from "./credentials";

/** How long a single headless command may run (clone of big repos). */
const EXEC_TIMEOUT_MS = 600_000;
/** Short probes (which git, mkdir). */
const PROBE_TIMEOUT_MS = 30_000;

/**
 * Whether the headless Alpine executor is available in this build.
 * @returns {boolean}
 */
export function executorAvailable() {
	const executor = globalThis.Executor;
	return Boolean(executor?.start && executor?.stop);
}

/**
 * Runs one command inside the Alpine sandbox (headless, no terminal tab)
 * and resolves with {code, output}. Timeout kills the process.
 * @param {string} command sh command line
 * @param {{timeoutMs?: number, onLog?: (line: string) => void}} [opts]
 * @returns {Promise<{code: number|null, output: string}>}
 */
export async function execAlpine(command, opts = {}) {
	const executor = globalThis.Executor;
	if (!executor?.start) {
		throw new Error("terminal unavailable");
	}
	const timeoutMs = opts.timeoutMs ?? EXEC_TIMEOUT_MS;
	const lines = [];

	return new Promise((resolve, reject) => {
		let uuid = "";
		let settled = false;
		const done = (fn, arg) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			fn(arg);
		};
		const timer = setTimeout(() => {
			if (uuid) executor.stop(uuid).catch(() => {});
			done(
				reject,
				new Error(
					`timeout: o comando excedeu ${Math.round(timeoutMs / 1000)}s no terminal`,
				),
			);
		}, timeoutMs);

		executor
			.start(
				command,
				(type, data) => {
					if (type === "stdout" || type === "stderr") {
						lines.push(String(data || ""));
						opts.onLog?.(String(data || ""));
					} else if (type === "exit") {
						const code = Number(data);
						done(resolve, {
							code: Number.isFinite(code) ? code : null,
							output: lines.join("\n"),
						});
					}
				},
				true,
			)
			.then((id) => {
				uuid = id;
			})
			.catch((error) => done(reject, error));
	});
}

/**
 * Masks embedded credentials so tokens never reach toasts/logs.
 * @param {string} text
 */
export function maskSecrets(text) {
	return String(text || "").replace(/\/\/[^@/\s]+@/g, "//***@");
}

/**
 * https remote with the session token embedded (headless terminal git
 * has no credential helper of its own).
 * @param {string} url remote url
 * @param {{username?: string, password?: string}|undefined} creds
 */
export function authedUrl(url, creds) {
	if (!creds?.password) return url;
	const safe = String(url).replace(/^[a-z]+:\/\//i, (scheme) => scheme);
	const user = encodeURIComponent(creds.username || "x-access-token");
	const pass = encodeURIComponent(creds.password);
	return safe.replace(/^(https?):\/\//i, `$1://${user}:${pass}@`);
}

/**
 * Whether git exists in the Alpine sandbox; installs it when missing.
 * @param {{onLog?: (line: string) => void}} [opts]
 * @returns {Promise<"present"|"installed">}
 */
export async function ensureAlpineGit(opts = {}) {
	const probe = await execAlpine(
		"command -v git >/dev/null 2>&1 && echo __GIT_OK__ || echo __NOGIT__",
		{ timeoutMs: PROBE_TIMEOUT_MS },
	);
	if (probe.output.includes("__GIT_OK__")) return "present";
	opts.onLog?.("git não encontrado no Alpine — instalando (apk add git)…");
	const install = await execAlpine("apk add --no-cache git", {
		timeoutMs: EXEC_TIMEOUT_MS,
		onLog: opts.onLog,
	});
	if (install.code !== 0) {
		throw new Error(
			`apk add git falhou (exit ${install.code}): ${maskSecrets(install.output.slice(-400))}`,
		);
	}
	return "installed";
}

/**
 * Sandbox path for an app root; throws a friendly error when the folder
 * is not visible inside the sandbox (e.g. third-party SAF trees).
 * @param {string} root app file:// root url
 */
export function sandboxRootFor(root) {
	const path = sandboxPathOf(root);
	if (!path) {
		throw new Error(
			"esta pasta não é visível no terminal Alpine — abra um projeto local (armazenamento do app ou /sdcard)",
		);
	}
	return path.replace(/\/+$/, "");
}

/**
 * Clones a repository through the Alpine git (headless). Auto-installs
 * git when missing. Returns the app-side url of the cloned folder.
 * @param {{url: string, root: string, dir: string}} args
 * @param {{onLog?: (line: string) => void}} [opts]
 * @returns {Promise<{dirUrl: string, installed: boolean}>}
 */
export async function terminalClone(args, opts = {}) {
	const { url, root, dir } = args;
	const sandboxRoot = sandboxRootFor(root);
	const creds = await resolveCredentials(url);
	const cleanName = String(dir || "").replace(/^\/+|\/+$/g, "");
	if (!cleanName) throw new Error("clone: pasta de destino inválida");

	const dirUrl = Url.join(root, cleanName);
	if (await fsOperation(dirUrl).exists()) {
		throw new Error(`a pasta ${cleanName} já existe`);
	}

	const installed = await ensureAlpineGit(opts);
	opts.onLog?.(`git clone → ${cleanName}…`);

	const dest = `${sandboxRoot}/${cleanName}`;
	const command =
		"GIT_TERMINAL_PROMPT=0 git clone " +
		`${shellQuote(authedUrl(url, creds))} ${shellQuote(dest)}`;
	const result = await execAlpine(command, {
		timeoutMs: EXEC_TIMEOUT_MS,
		onLog: opts.onLog,
	});
	if (result.code !== 0) {
		throw new Error(
			`git clone falhou: ${maskSecrets(result.output.slice(-400)) || `exit ${result.code}`}`,
		);
	}
	return { dirUrl, installed };
}
