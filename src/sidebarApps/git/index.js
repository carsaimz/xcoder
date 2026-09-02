import "./style.scss";
import toast from "components/toast";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import vshell from "lib/ai/vshell";
import { fetchGhUser, pollForToken, requestDeviceCode } from "lib/ghAuth";
import {
	commit,
	getStatus,
	preparedCommands,
	readVcsDb,
	restore,
} from "lib/gitPanel";
import lang, { getIntlLocale } from "lib/lang";
import settings from "lib/settings";
import Url from "utils/Url";

const COMMIT_PREFIXES = [
	"feat",
	"fix",
	"chore",
	"docs",
	"refactor",
	"test",
	"ci",
];

/** @type {HTMLElement} */
let container = null;
/** @type {HTMLElement} */
let $statusBody = null;
/** @type {HTMLElement} */
let $commitsBody = null;
/** @type {HTMLInputElement} */
let $message = null;
let refreshTimer = 0;

/**
 * Git sidebar app.
 * @returns {Array} sidebar app descriptor
 */
export default [
	"svg:git-branch",
	"git",
	strings["git panel"] || "Git",
	initApp,
	false,
	onSelected,
	{ titleKey: "git panel" },
];

/**
 * Opens the Git panel in the sidebar (activates the app and shows the
 * sidebar if it was closed).
 * @returns {Promise<void>}
 */
export async function openGitPanel() {
	try {
		const { default: sidebarApps } = await import("sidebarApps");
		sidebarApps.pulseApp?.("git");
		const { default: Sidebar } = await import("components/sidebar");
		Sidebar?.show?.();
	} catch (error) {
		window.log?.("error", "openGitPanel failed:", error);
	}
}

function onSelected(el) {
	// live in the sidebar panel again; refresh on every open
	refresh();
	el?.querySelector("input.git-message")?.focus?.();
}

/**
 * @param {HTMLElement} el
 */
function initApp(el) {
	container = el;
	el.classList.add("git-app", "scroll");
	el.content = buildUi();
	refresh();

	// refresh when files change (debounced)
	clearInterval(refreshTimer);
	refreshTimer = setInterval(() => {
		if (el.isConnected) refresh();
	}, 4000);

	return () => {
		container = null;
		clearInterval(refreshTimer);
	};
}

function buildUi() {
	const $refresh = (
		<span
			className="icon refresh"
			title={strings.refresh || "Refresh"}
			onclick={refresh}
		></span>
	);

	const $account = (
		<div className="git-card git-account">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["github account"] || "GitHub account"}
				</span>
				<span className="icon github"></span>
			</div>
			<div className="git-account-body" ref={setAccountBody}></div>
		</div>
	);

	const $remoteEdit = (
		<span
			className="icon public"
			title={strings["git remote url"] || "Remote URL"}
			onclick={editRemote}
		></span>
	);

	const $status = (
		<div className="git-card">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["git status"] || "Status"}
				</span>
				{$refresh}
			</div>
			<div className="git-status" ref={setStatusBody}></div>
		</div>
	);

	$message = (
		<input
			type="text"
			className="git-message"
			placeholder={strings["git msg hint"] || "feat: describe your change"}
		/>
	);

	const $composer = (
		<div className="git-card">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["git commit"] || "Commit"}
				</span>
			</div>
			<div className="git-composer">
				{$message}
				<button className="git-commit-btn" onclick={onCommit}>
					{strings["git commit"] || "Commit"}
				</button>
			</div>
			<div className="git-prefixes">
				{COMMIT_PREFIXES.map((prefix) => (
					<span
						className="git-prefix"
						onclick={() => {
							$message.value = `${prefix}: ${$message.value.replace(/^\w+:\s*/, "")}`;
							$message.focus();
						}}
					>
						{prefix}
					</span>
				))}
			</div>
		</div>
	);

	const $commits = (
		<div className="git-card">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["git commits"] || "Snapshots"}
				</span>
			</div>
			<div className="git-commits" ref={setCommitsBody}></div>
		</div>
	);

	const $gh = (
		<div className="git-card">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["git github"] || "GitHub — prepared commands"}
				</span>
				{$remoteEdit}
			</div>
			<div className="git-gh" ref={setGhBody}></div>
		</div>
	);

	return (
		<div className="git-panel">
			{$account}
			{$status}
			{$composer}
			{$commits}
			{$gh}
		</div>
	);
}

function setStatusBody(el) {
	$statusBody = el;
}

function setCommitsBody(el) {
	$commitsBody = el;
}

function setGhBody(el) {
	container._$ghBody = el;
	renderGh();
}

function setAccountBody(el) {
	container._$accountBody = el;
	renderAccount();
}

async function refresh() {
	if (!container || !$statusBody?.isConnected) return;

	let status;
	try {
		status = await getStatus();
	} catch (error) {
		renderError($statusBody, error);
		return;
	}

	renderStatus(status);
	renderCommits();
	renderGh();
	renderAccount();
}

/**
 * Renders the GitHub account card: signed-in profile or sign-in button.
 */
function renderAccount() {
	const $body = container?._$accountBody;
	if (!$body?.isConnected) return;
	const values = settings.value;

	if (values.ghUserLogin) {
		$body.content = (
			<div className="git-account-row">
				{values.ghUserAvatar ? (
					<img className="git-avatar" src={values.ghUserAvatar} alt="" />
				) : (
					<span className="icon account_circle git-avatar-fallback"></span>
				)}
				<div className="git-account-info">
					<span className="git-account-login">{values.ghUserLogin}</span>
					{values.ghUserName ? (
						<span className="git-account-name">{values.ghUserName}</span>
					) : null}
				</div>
				<button className="git-ghost-btn" onclick={signOutGitHub}>
					{strings.logout || "Logout"}
				</button>
			</div>
		);
		return;
	}

	$body.content = (
		<div className="git-account-row">
			<span className="git-account-hint">
				{values.ghToken
					? strings["github pat active"] ||
						"Using a personal access token (PAT)."
					: strings["github sign in desc"] ||
						"Sign in to access your GitHub repositories."}
			</span>
			<button className="git-commit-btn" onclick={signInGitHub}>
				{strings["sign in with github"] || "Sign in with GitHub"}
			</button>
		</div>
	);
}

/**
 * GitHub OAuth Device Flow sign-in (see lib/ghAuth.js).
 */
async function signInGitHub() {
	try {
		let clientId = String(settings.value.ghOAuthClientId || "").trim();

		if (!clientId) {
			const ok = await confirmDialog(
				strings["sign in with github"] || "Sign in with GitHub",
				strings["github sign in steps"] ||
					"Create an OAuth App at github.com/settings/developers, enable 'Device Flow', then paste its client id here. No client secret or backend is needed.",
			);
			if (!ok) return;

			const input = await prompt(
				strings["github client id"] || "OAuth App client id",
				"",
				"text",
			);
			if (!input || !input.trim()) return;

			clientId = input.trim();
			settings.value.ghOAuthClientId = clientId;
			await settings.update();
		}

		const code = await requestDeviceCode(clientId);
		const proceed = await confirm(
			strings["sign in with github"] || "Sign in with GitHub",
			`${strings["device code"] || "Code"}: ${code.userCode}\n\n${
				strings["github device steps"] ||
				"Open the verification page in your browser and enter the code above."
			}`,
		);
		if (!proceed) return;

		system.openInBrowser(code.verificationUri);

		const hide = await loader.show();
		try {
			const { token, user } = await pollForToken(
				clientId,
				code.deviceCode,
				code.interval,
				{ maxMs: code.expiresIn * 1000 },
			);

			settings.value.ghToken = token;
			settings.value.ghUserLogin = user?.login || "";
			settings.value.ghUserName = user?.name || "";
			settings.value.ghUserAvatar = user?.avatarUrl || "";
			await settings.update();

			toast(
				`${strings["signed in as"] || "Signed in as"} ${user?.login || "?"}`,
			);
		} finally {
			hide();
		}

		renderAccount();
		renderGh();
	} catch (error) {
		toast(
			`${strings["sign in failed"] || "Sign in failed"}: ${
				error.message || error
			}`,
		);
	}
}

/**
 * Removes the stored token and profile.
 */
async function signOutGitHub() {
	settings.value.ghToken = "";
	settings.value.ghUserLogin = "";
	settings.value.ghUserName = "";
	settings.value.ghUserAvatar = "";
	await settings.update();
	toast(strings.logout || "Logout");
	renderAccount();
	renderGh();
}

/**
 * @param {HTMLElement} el
 * @param {Error} error
 */
function renderError(el, error) {
	el.content = (
		<div className="git-empty">{`git: ${error.message || error}`}</div>
	);
}

function renderStatus(status) {
	const { changes } = status;

	if (!status.hasRepo && !countChanges(status.changes)) {
		$statusBody.content = (
			<div className="git-empty">
				{strings["git no repo"] ||
					"No snapshots yet — create your first commit to start tracking changes."}
			</div>
		);
		return;
	}

	if (!countChanges(changes)) {
		$statusBody.content = (
			<div className="git-empty">
				{strings["git no changes"] ||
					"No changes — everything matches the last snapshot."}
			</div>
		);
		return;
	}

	const rows = [
		...changes.modified.map(rowFactory("M", "git-modified")),
		...changes.added.map(rowFactory("A", "git-added")),
		...changes.deleted.map(rowFactory("D", "git-deleted")),
	];

	$statusBody.content = <div className="git-file-list">{rows}</div>;

	function rowFactory(letter, cls) {
		/**
		 * @param {string} path
		 */
		return (path) => (
			<div className="git-file" data-path={path}>
				<span className={`git-letter ${cls}`}>{letter}</span>
				<span className="git-file-name" onclick={() => openChangedFile(path)}>
					{path}
				</span>
				<span
					className="icon copy git-file-copy"
					title={strings.copy || "Copy path"}
					onclick={() => copyPath(path)}
				></span>
			</div>
		);
	}
}

/** @param {{modified: string[], added: string[], deleted: string[]}} changes */
function countChanges(changes) {
	return (
		changes.modified.length + changes.added.length + changes.deleted.length
	);
}

/**
 * Opens a workspace file in the editor.
 * @param {string} relativePath
 */
async function openChangedFile(relativePath) {
	try {
		const { default: openFile } = await import("lib/openFile");
		await openFile(Url.join(vshell.getRoot(), relativePath));
	} catch (error) {
		toast(`open: ${error.message || error}`);
	}
}

/**
 * Copies a changed file path to the clipboard.
 * @param {string} relativePath
 */
async function copyPath(relativePath) {
	await copy(relativePath);
	toast(strings["git copied"] || "Copied");
}

async function onCommit() {
	const message = ($message?.value || "").trim();
	if (!message) {
		toast(strings["git commit msg"] || "Commit message");
		return;
	}
	try {
		const result = await commit(message);
		if (result?.error) {
			toast(result.output);
			return;
		}
		$message.value = "";
		toast(result?.output || strings["git committed"] || "Snapshot created");
		refresh();
	} catch (error) {
		toast(`commit: ${error.message || error}`);
	}
}

async function renderCommits() {
	if (!$commitsBody?.isConnected) return;
	const { commits } = await readVcsDb();

	if (!commits.length) {
		$commitsBody.content = (
			<div className="git-empty">
				{strings["git no commits"] || "No snapshots yet."}
			</div>
		);
		return;
	}

	$commitsBody.content = (
		<div className="git-commit-list">
			{commits
				.slice()
				.reverse()
				.map((item) => (
					<div className="git-commit" onclick={() => commitActions(item)}>
						<span className="git-commit-id">{item.id}</span>
						<span className="git-commit-msg">{item.message}</span>
						<span className="git-commit-time">
							{shortDate(item.at)} · {relativeTime(item.at)}
						</span>
					</div>
				))}
		</div>
	);
}

/**
 * @param {{id: string, message: string, at: number}} item
 */
async function commitActions(item) {
	const choice = await select(item.message, [
		{
			value: "restore",
			text: strings["git restore"] || "Restore files",
			icon: "historyrestore",
		},
		{ value: "copy", text: strings.copy || "Copy id", icon: "copy" },
	]);
	if (choice === "restore") {
		const ok = await confirmDialog(
			strings["git restore"] || "Restore files",
			(
				strings["git confirm restore"] ||
				"Restore all files from snapshot {id}? Current files with the same name will be overwritten."
			).replace("{id}", item.id),
		);
		if (!ok) return;
		try {
			const result = await restore(item.id);
			toast(result?.output || strings["git restored"] || "Files restored");
			refresh();
		} catch (error) {
			toast(`restore: ${error.message || error}`);
		}
	} else if (choice === "copy") {
		await copy(item.id);
		toast(strings["git copied"] || "Copied");
	}
}

function renderGh() {
	const $body = container?._$ghBody;
	if (!$body?.isConnected) return;
	const remote = settings.value.gitRemoteUrl || "";
	const commands = preparedCommands(remote, "update");

	$body.content = (
		<div className="git-gh-list">
			{commands.map((entry) => (
				<div className="git-gh-cmd" onclick={() => copyCommand(entry.command)}>
					<span className="git-gh-label">{entry.label}</span>
					<code className="git-gh-text">{entry.command}</code>
				</div>
			))}
		</div>
	);
}

async function editRemote() {
	const value = await prompt(
		strings["git remote url"] || "Remote URL",
		settings.value.gitRemoteUrl || "",
		"text",
	);
	if (value === null) return;
	settings.value.gitRemoteUrl = String(value || "").trim();
	settings.update();
	renderGh();
}

/**
 * @param {string} command
 */
async function copyCommand(command) {
	await copy(command);
	toast(strings["git copied"] || "Command copied");
}

/**
 * @param {string} text
 */
async function copy(text) {
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
 * Small confirm wrapper (kept local to avoid importing dialogs twice).
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
async function confirmDialog(title, message) {
	const { default: confirm } = await import("dialogs/confirm");
	return confirm(title, message);
}

/**
 * Locale-aware relative time ("agora", "5 min", "3 h", "2 d"...).
 * @param {number} timestamp
 */
function relativeTime(timestamp) {
	if (!timestamp) return "";
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return strings["git time now"] || "now";
	if (minutes < 60) return `${minutes} ${strings["git time min"] || "min"}`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ${strings["git time hour"] || "h"}`;
	const days = Math.floor(hours / 24);
	return `${days} ${strings["git time day"] || "d"}`;
}

/**
 * Locale-aware short date for commit rows.
 * @param {number} timestamp
 */
function shortDate(timestamp) {
	if (!timestamp) return "";
	try {
		return new Intl.DateTimeFormat(getIntlLocale(lang?.code), {
			day: "2-digit",
			month: "short",
		}).format(new Date(timestamp));
	} catch {
		return "";
	}
}
