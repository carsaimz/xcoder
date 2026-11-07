import "./style.scss";
import sidebarApps from "sidebarApps";
import toast from "components/toast";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import vshell from "lib/ai/vshell";
import { pickAndApplyGhRepo } from "lib/ghRepos";
import { refreshGhProfile, signInGitHubFlow } from "lib/ghSignIn";
import * as git from "lib/git";
import { echoGitCommand } from "lib/git/terminalEcho";
import {
	readVcsDb,
	commit as snapshotCommit,
	restore as snapshotRestore,
	getStatus as snapshotStatus,
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

const LETTER_CLASS = {
	added: "git-added",
	"staged-modified": "git-modified",
	"staged-deleted": "git-deleted",
	modified: "git-modified",
	deleted: "git-deleted",
	untracked: "git-added",
};
const LETTER_TEXT = {
	added: "A",
	"staged-modified": "M",
	"staged-deleted": "D",
	modified: "M",
	deleted: "D",
	untracked: "U",
};

/** @type {HTMLElement} */
let container = null;
/** @type {HTMLElement} */
let $scmBody = null;
/** @type {HTMLElement} */
let $historyBody = null;
/** @type {HTMLInputElement} */
let $message = null;
let refreshTimer = 0;
let removeGitListener = null;
/** @type {{ahead: number, behind: number, at: number}} */
let syncState = { ahead: 0, behind: 0, at: 0 };

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
	{ titleKey: "git panel", group: "primary", floating: true },
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

	// refresh the account card as soon as the session changes —
	// sign-in can happen from the settings page while this app is open
	settings.on("update:ghUserLogin", onAccountChanged);
	settings.on("update:ghToken", onAccountChanged);
	// the repository card mirrors the active repo (set here or in chat)
	settings.on("update:ghRepo", onAccountChanged);

	// VS Code behaviour: git mutations from ANY surface (terminal `git`,
	// AI agent, sidebar buttons) refresh this view
	removeGitListener = git.onGitChange(() => {
		if (container?._$accountBody?.isConnected) refresh();
	});

	return () => {
		container = null;
		clearInterval(refreshTimer);
		removeGitListener?.();
		removeGitListener = null;
		settings.off("update:ghUserLogin", onAccountChanged);
		settings.off("update:ghToken", onAccountChanged);
		settings.off("update:ghRepo", onAccountChanged);
	};
}

/** Re-renders the account + GitHub cards when the session changes. */
function onAccountChanged() {
	if (!container?._$accountBody?.isConnected) return;
	renderAccount();
}

function buildUi() {
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

	const $repo = (
		<div className="git-card git-repo">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["git repo card"] || "Repositório GitHub"}
				</span>
				<span
					className="icon refresh"
					title={strings["github repos"] || "My repositories"}
					onclick={chooseRepo}
				></span>
			</div>
			<div className="git-repo-body" ref={setRepoBody}></div>
		</div>
	);

	$message = (
		<input
			type="text"
			className="git-message"
			placeholder={strings["git msg hint"] || "feat: describe your change"}
		/>
	);

	const $scm = (
		<div className="git-card git-scm">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["git scm"] || "Source Control"}
				</span>
				<span
					className="icon refresh"
					title={strings.refresh || "Refresh"}
					onclick={refresh}
				></span>
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
			<div className="git-scm-body" ref={setScmBody}></div>
		</div>
	);

	const $history = (
		<div className="git-card">
			<div className="git-card-header">
				<span className="git-card-title">
					{strings["git commits"] || "History"}
				</span>
			</div>
			<div className="git-commits" ref={setHistoryBody}></div>
		</div>
	);

	return (
		<div className="git-panel">
			{$account}
			{$repo}
			{$scm}
			{$history}
		</div>
	);
}

function setScmBody(el) {
	$scmBody = el;
}

function setHistoryBody(el) {
	$historyBody = el;
}

function setAccountBody(el) {
	container._$accountBody = el;
	renderAccount();
}

function setRepoBody(el) {
	container._$repoBody = el;
	renderRepo();
}

/** Re-renders the repository card (active repo or empty hint). */
function renderRepo() {
	const $body = container?._$repoBody;
	if (!$body?.isConnected) return;
	const values = settings.value;

	if (values.ghRepo) {
		$body.content = (
			<div className="git-repo-row">
				<span className="icon folder git-repo-icon"></span>
				<div className="git-repo-info">
					<span className="git-repo-name">{values.ghRepo}</span>
					<span className="git-repo-meta">
						{values.ghBranch || "main"}
						{values.gitRemoteUrl ? ` · ${values.gitRemoteUrl}` : ""}
					</span>
				</div>
				<button
					className="git-ghost-btn"
					onclick={chooseRepo}
					title={strings["github repos"] || "My repositories"}
				>
					{strings["git repo change"] || "Trocar"}
				</button>
			</div>
		);
		return;
	}

	$body.content = (
		<div className="git-repo-row">
			<span className="git-account-hint">
				{values.ghToken
					? strings["git repo hint"] ||
						"Nenhum repositório selecionado — toque para listar."
					: strings["github token needed"] ||
						"Entre com a conta ou defina um token para listar repositórios"}
			</span>
			<button
				className="git-commit-btn"
				onclick={chooseRepo}
				disabled={!values.ghToken}
			>
				{strings["github repos"] || "Meus repositórios"}
			</button>
		</div>
	);
}

/** Opens the shared repository picker and persists the choice. */
async function chooseRepo() {
	const changed = await pickAndApplyGhRepo();
	if (changed) {
		renderRepo();
	}
}

async function refresh() {
	if (!container || !$scmBody?.isConnected) return;

	// Account card and repository card must render regardless of the
	// local repo state — a broken/absent git workspace used to
	// early-return and leave the connected account invisible.
	renderAccount();
	renderRepo();

	const hasRealRepo = await git.hasRepo().catch(() => false);
	if (hasRealRepo) {
		await renderScm();
		await renderGitHistory();
	} else {
		renderSnapshotScm();
		await renderSnapshotHistory();
	}
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
			<div className="git-account-actions">
				{values.ghToken ? (
					<button
						className="git-ghost-btn"
						onclick={retryProfile}
						title={strings["github refresh profile"] || "Refresh profile"}
					>
						{strings["github refresh profile"] || "Atualizar perfil"}
					</button>
				) : null}
				<button className="git-commit-btn" onclick={signInGitHub}>
					{strings["sign in with github"] || "Sign in with GitHub"}
				</button>
			</div>
		</div>
	);
}

/** Re-fetches the profile for the stored token (token set, no login). */
async function retryProfile() {
	await refreshGhProfile();
	renderAccount();
}

/**
 * GitHub sign-in: delegates to the shared flow — site web flow, device
 * flow or PAT fallback (see lib/ghSignIn.js policy).
 */
async function signInGitHub() {
	await signInGitHubFlow();
	renderAccount();
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
}

// ---------------------------------------------------------------------------
// Source Control (real git)
// ---------------------------------------------------------------------------

/** Renders the Source Control body from real git status. */
async function renderScm() {
	const $body = $scmBody;
	let status;
	try {
		status = await git.status();
	} catch (error) {
		sidebarApps.setBadge?.("git", null);
		$body.content = (
			<div className="git-empty">{`git: ${error.message || error}`}</div>
		);
		return;
	}

	const badge = status.total || null;
	sidebarApps.setBadge?.("git", badge);

	// header: branch chip + sync actions
	const remote = await git.remoteUrl().catch(() => "");
	const { ahead, behind } = await syncCounts(remote);

	$body.content = (
		<div className="git-scm-view">
			{renderBranchBar(status.branch, remote, ahead, behind)}
			{status.staged.length ? renderStagedSection(status) : null}
			{status.changed.length ? renderChangesSection(status) : null}
			{status.untracked.length ? renderUntrackedSection(status) : null}
			{!status.total ? (
				<div className="git-empty">
					{strings["git no changes"] ||
						"No changes — everything matches the last commit."}
				</div>
			) : null}
		</div>
	);
}

/**
 * Cached ahead/behind (60s TTL — a fetch per refresh would be too much).
 * @param {string} remote
 */
async function syncCounts(remote) {
	if (!remote) return { ahead: 0, behind: 0 };
	const now = Date.now();
	if (now - syncState.at < 60000) return syncState;
	try {
		await git.fetch();
		syncState = { ...(await git.aheadBehind()), at: now };
	} catch {
		syncState = { ahead: 0, behind: 0, at: now };
	}
	return syncState;
}

/**
 * Branch chip + pull/push row (VS Code title bar actions).
 * @param {string} branch
 * @param {string} remote
 * @param {number} ahead
 * @param {number} behind
 */
function renderBranchBar(branch, remote, ahead, behind) {
	const syncLabel = [ahead ? `↑${ahead}` : "", behind ? `↓${behind}` : ""]
		.filter(Boolean)
		.join(" ");

	return (
		<div className="git-branch-bar">
			<span className="git-branch-chip" onclick={chooseBranch}>
				<span className="icon git-branch-ic"></span>
				{branch || strings["git detached"] || "detached"}
			</span>
			<span className="git-branch-sync">
				{syncLabel ? (
					<span className="git-sync-counts">{syncLabel}</span>
				) : null}
				<span
					className={`icon ${remote ? "download" : "public"}`}
					title={strings["git pull"] || "Pull"}
					onclick={onPull}
				></span>
				<span
					className="icon upload"
					title={strings["git push"] || "Push"}
					onclick={onPush}
				></span>
			</span>
		</div>
	);
}

/** Branch picker dialog: switch, create, delete. */
async function chooseBranch() {
	try {
		const list = await git.branches();
		const options = list.all.map((branch) => [
			branch.name,
			`${branch.current ? "✓ " : ""}${branch.name}`,
			"svg:git-branch",
		]);
		options.push([
			"__create__",
			`➕ ${strings["git branch create"] || "Create branch…"}`,
			"add",
		]);
		if (list.all.length > 1) {
			options.push([
				"__delete__",
				`🗑 ${strings["git branch delete"] || "Delete branch…"}`,
				"delete",
			]);
		}
		const choice = await select(strings["git branches"] || "Branches", options);
		if (!choice || choice === list.current) return;
		if (choice === "__create__") {
			const name = await prompt(
				strings["git branch create"] || "Create branch",
				"",
				"text",
			);
			if (!name) return;
			await runGit(`git checkout -b ${name}`, () =>
				git.createBranch(null, name.trim()),
			);
			return;
		}
		if (choice === "__delete__") {
			const name = await select(
				strings["git branch delete"] || "Delete branch",
				list.all
					.filter((branch) => !branch.current)
					.map((branch) => [branch.name, branch.name, "svg:git-branch"]),
			);
			if (!name) return;
			const { default: confirm } = await import("dialogs/confirm");
			const ok = await confirm(
				strings["git branch delete"] || "Delete branch",
				`${name}?`,
			);
			if (!ok) return;
			await runGit(`git branch -D ${name}`, () => git.deleteBranch(null, name));
			return;
		}
		await runGit(`git checkout ${choice}`, () => git.checkout(null, choice));
	} catch (error) {
		toast(`branch: ${error.message || error}`);
	}
}

/**
 * Shared action runner: loader + terminal echo + refresh + error toast.
 * @param {string} command display command for the terminal echo
 * @param {() => Promise<any>} fn engine call
 */
async function runGit(command, fn) {
	const hide = await loader.show();
	try {
		const result = await fn();
		echoGitCommand(command);
		return result;
	} catch (error) {
		toast(`git: ${error.message || error}`, 4500);
		return null;
	} finally {
		hide();
		syncState = { ahead: 0, behind: 0, at: 0 };
		refresh();
	}
}

/** Stage-all action. */
async function onStageAll() {
	await runGit("git add -A", () => git.stage(null, "*"));
}

/** Unstage-all action. */
async function onUnstageAll() {
	await runGit("git restore --staged .", () => git.unstage(null, "*"));
}

/**
 * Stages one file.
 * @param {string} path
 */
async function onStage(path) {
	await runGit(`git add ${path}`, () => git.stage(null, [path]));
}

/**
 * Unstages one file.
 * @param {string} path
 */
async function onUnstage(path) {
	await runGit(`git restore --staged ${path}`, () => git.unstage(null, [path]));
}

/**
 * Discards one file (confirm first — destructive).
 * @param {string} path
 */
async function onDiscard(path) {
	const { default: confirm } = await import("dialogs/confirm");
	const ok = await confirm(
		strings["git discard"] || "Discard changes",
		`${strings["git discard confirm"] || "Discard all changes in"} ${path}?`,
	);
	if (!ok) return;
	await runGit(`git checkout -- ${path}`, () => git.discard(null, [path]));
}

/**
 * Commit: message box → staged commit (offers stage-all when nothing is
 * staged yet, like VS Code's auto-stage hint).
 */
async function onCommit() {
	const message = ($message?.value || "").trim();
	if (!message) {
		toast(strings["git commit msg"] || "Commit message");
		return;
	}
	const hasRepo = await git.hasRepo().catch(() => false);
	if (!hasRepo) {
		await snapshotCommitFlow(message);
		return;
	}
	const hide = await loader.show();
	try {
		let status = await git.status();
		if (!status.staged.length && status.total) {
			// nothing staged — stage everything first (VS Code behaviour)
			await git.stage(null, "*");
			status = await git.status();
		}
		if (!status.staged.length) {
			toast(strings["git no changes"] || "No changes to commit");
			return;
		}
		const oid = await git.commit(null, message);
		echoGitCommand(`git commit -m "${message.replace(/"/g, "'")}"`);
		toast(
			`${strings["git committed"] || "Committed"} ${oid.slice(0, 7)}`,
			3000,
		);
		$message.value = "";
	} catch (error) {
		toast(`commit: ${error.message || error}`, 4500);
	} finally {
		hide();
		syncState = { ahead: 0, behind: 0, at: 0 };
		refresh();
	}
}

/**
 * Push: configures the remote from the selected GitHub repo when
 * needed, then pushes with the session credentials.
 */
async function onPush() {
	const hasRepo = await git.hasRepo().catch(() => false);
	if (!hasRepo) {
		toast(strings["git no repo"] || "Initialize a repository first");
		return;
	}
	let hide = await loader.show();
	try {
		let remote = await git.remoteUrl();
		if (!remote) {
			const values = settings.value;
			if (!values.ghRepo) {
				hide();
				const picked = await pickAndApplyGhRepo();
				if (!picked) return;
				hide = await loader.show();
			}
			const url =
				settings.value.gitRemoteUrl ||
				`https://github.com/${settings.value.ghRepo}.git`;
			await git.addRemote(null, "origin", url);
			remote = url;
			echoGitCommand(`git remote add origin ${url}`);
		}
		const branch = await git.currentBranch();
		await git.push(null, {});
		echoGitCommand(`git push -u origin ${branch || "main"}`);
		toast(`${strings["git pushed"] || "Pushed"} → ${remote}`, 4000);
	} catch (error) {
		toast(`push: ${error.message || error}`, 5000);
	} finally {
		hide();
		syncState = { ahead: 0, behind: 0, at: 0 };
		refresh();
	}
}

/** Pull with fast-forward/merge handled by the engine. */
async function onPull() {
	const hasRepo = await git.hasRepo().catch(() => false);
	if (!hasRepo) {
		toast(strings["git no repo"] || "Initialize a repository first");
		return;
	}
	await runGit("git pull", () => git.pull(null, {}));
	toast(strings["git pulled"] || "Pull ok", 3000);
}

/** Initializes a repository in the opened project. */
async function onInit() {
	await runGit("git init", () => git.init(null));
	toast(strings["git inited"] || "Repository initialized", 3000);
}

/**
 * Clone from URL into a subfolder of the current workspace.
 */
async function onClone() {
	const url = await prompt(
		strings["git clone url"] || "Repository URL (https://github.com/user/repo)",
		settings.value.gitRemoteUrl || "",
		"text",
	);
	if (!url) return;
	const hide = await loader.create(strings["git clone"] || "Clone", url, {
		timeout: 0,
	});
	try {
		const dir = await git.clone({ url: url.trim() });
		echoGitCommand(`git clone ${url.trim()}`);
		toast(`${strings["git cloned"] || "Cloned"} → ${Url.basename(dir)}`, 4000);
	} catch (error) {
		toast(`clone: ${error.message || error}`, 5000);
	} finally {
		hide.destroy();
		refresh();
	}
}

/**
 * Commit history from real git (with checkout + copy actions).
 */
async function renderGitHistory() {
	if (!$historyBody?.isConnected) return;
	let history;
	try {
		history = await git.log(null, { depth: 30 });
	} catch {
		history = [];
	}
	if (!history.length) {
		$historyBody.content = (
			<div className="git-empty">
				{strings["git no commits"] || "No commits yet."}
			</div>
		);
		return;
	}
	$historyBody.content = (
		<div className="git-commit-list">
			{history.map((item) => (
				<div className="git-commit" onclick={() => commitActions(item)}>
					<span className="git-commit-id">{item.short}</span>
					<span className="git-commit-msg">{item.message}</span>
					<span className="git-commit-time">
						{item.author ? `${item.author} · ` : ""}
						{relativeTime(item.timestamp)}
					</span>
				</div>
			))}
		</div>
	);
}

/**
 * Actions for a history entry.
 * @param {{oid: string, short: string, message: string}} item
 */
async function commitActions(item) {
	const choice = await select(item.message, [
		{
			value: "copy",
			text: strings.copy || "Copy hash",
			icon: "copy",
		},
		{
			value: "checkout",
			text: strings["git checkout"] || "Checkout",
			icon: "historyrestore",
		},
	]);
	if (choice === "copy") {
		await copy(item.oid);
		toast(strings["git copied"] || "Copied");
	} else if (choice === "checkout") {
		const { default: confirm } = await import("dialogs/confirm");
		const ok = await confirm(
			strings["git checkout"] || "Checkout",
			`${item.short} — ${item.message}`,
		);
		if (!ok) return;
		await runGit(`git checkout ${item.short}`, () =>
			git.checkout(null, item.oid),
		);
	}
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * @param {object} status engine status
 */
function renderStagedSection(status) {
	return (
		<div className="git-section">
			<div className="git-section-header">
				<span className="git-section-title">
					{strings["git staged"] || "Staged Changes"}
				</span>
				<span
					className="icon remove"
					title={strings["git unstage all"] || "Unstage all"}
					onclick={onUnstageAll}
				></span>
			</div>
			<div className="git-file-list">
				{status.staged.map((row) => (
					<div className="git-file" data-path={row.path}>
						<span className={`git-letter ${LETTER_CLASS[row.status] || ""}`}>
							{LETTER_TEXT[row.status] || "M"}
						</span>
						<span
							className="git-file-name"
							onclick={() =>
								row.status !== "staged-deleted" && openChangedFile(row.path)
							}
						>
							{row.path}
						</span>
						<span
							className="icon remove git-file-act"
							title={strings["git unstage"] || "Unstage"}
							onclick={() => onUnstage(row.path)}
						></span>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * @param {object} status engine status
 */
function renderChangesSection(status) {
	return (
		<div className="git-section">
			<div className="git-section-header">
				<span className="git-section-title">
					{strings["git changes"] || "Changes"}
				</span>
				<span
					className="icon add"
					title={strings["git stage all"] || "Stage all"}
					onclick={onStageAll}
				></span>
			</div>
			<div className="git-file-list">
				{status.changed.map((row) => (
					<div className="git-file" data-path={row.path}>
						<span className={`git-letter ${LETTER_CLASS[row.status] || ""}`}>
							{LETTER_TEXT[row.status] || "M"}
						</span>
						<span
							className="git-file-name"
							onclick={() =>
								row.status !== "deleted" && openChangedFile(row.path)
							}
						>
							{row.path}
						</span>
						<span
							className="icon undo git-file-act"
							title={strings["git discard"] || "Discard"}
							onclick={() => onDiscard(row.path)}
						></span>
						<span
							className="icon add git-file-act"
							title={strings["git stage"] || "Stage"}
							onclick={() => onStage(row.path)}
						></span>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * @param {object} status engine status
 */
function renderUntrackedSection(status) {
	return (
		<div className="git-section">
			<div className="git-section-header">
				<span className="git-section-title">
					{strings["git untracked"] || "Untracked"}
				</span>
				<span
					className="icon add"
					title={strings["git stage all"] || "Stage all"}
					onclick={onStageAll}
				></span>
			</div>
			<div className="git-file-list">
				{status.untracked.map((row) => (
					<div className="git-file" data-path={row.path}>
						<span className="git-letter git-added">U</span>
						<span
							className="git-file-name"
							onclick={() => openChangedFile(row.path)}
						>
							{row.path}
						</span>
						<span
							className="icon add git-file-act"
							title={strings["git stage"] || "Stage"}
							onclick={() => onStage(row.path)}
						></span>
					</div>
				))}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Snapshot fallback (no real git repo yet)
// ---------------------------------------------------------------------------

/**
 * Snapshot mode body: initialize real git OR keep using local snapshots.
 */
function renderSnapshotScm() {
	sidebarApps.setBadge?.("git", null);
	$scmBody.content = (
		<div className="git-scm-view">
			<button className="git-commit-btn git-init-btn" onclick={onInit}>
				{strings["git init repo"] || "Initialize repository"}
			</button>
			<button className="git-ghost-btn git-clone-btn" onclick={onClone}>
				{strings["git clone"] || "Clone repository…"}
			</button>
			<span className="git-account-hint">
				{strings["git snapshots hint"] ||
					"Sem repositório git — os snapshots locais continuam disponíveis abaixo."}
			</span>
			<div className="git-snapshot-status" ref={setSnapBody}></div>
		</div>
	);
	updateSnapshotStatus();
}

function setSnapBody(el) {
	container._$snapBody = el;
}

/** Fills the snapshot status rows (old VCS kept for non-git projects). */
async function updateSnapshotStatus() {
	const $body = container?._$snapBody;
	if (!$body?.isConnected) return;
	let status;
	try {
		status = await snapshotStatus();
	} catch (error) {
		$body.content = (
			<div className="git-empty">{`git: ${error.message || error}`}</div>
		);
		return;
	}
	const { changes } = status;
	const count = countChanges(changes);

	if (!count) {
		$body.content = (
			<div className="git-empty">
				{strings["git no changes"] ||
					"No changes — everything matches the last snapshot."}
			</div>
		);
		return;
	}

	const rows = [
		...changes.modified.map((path) => (
			<div className="git-file">
				<span className="git-letter git-modified">M</span>
				<span className="git-file-name" onclick={() => openChangedFile(path)}>
					{path}
				</span>
			</div>
		)),
		...changes.added.map((path) => (
			<div className="git-file">
				<span className="git-letter git-added">A</span>
				<span className="git-file-name" onclick={() => openChangedFile(path)}>
					{path}
				</span>
			</div>
		)),
		...changes.deleted.map((path) => (
			<div className="git-file">
				<span className="git-letter git-deleted">D</span>
				<span className="git-file-name">{path}</span>
			</div>
		)),
	];
	$body.content = <div className="git-file-list">{rows}</div>;
}

/** @param {{modified: string[], added: string[], deleted: string[]}} changes */
function countChanges(changes) {
	return (
		changes.modified.length + changes.added.length + changes.deleted.length
	);
}

/** Snapshot history list. */
async function renderSnapshotHistory() {
	if (!$historyBody?.isConnected) return;
	const { commits } = await readVcsDb();
	if (!commits.length) {
		$historyBody.content = (
			<div className="git-empty">
				{strings["git no commits"] || "No snapshots yet."}
			</div>
		);
		return;
	}
	$historyBody.content = (
		<div className="git-commit-list">
			{commits
				.slice()
				.reverse()
				.map((item) => (
					<div className="git-commit" onclick={() => snapshotActions(item)}>
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
async function snapshotActions(item) {
	const choice = await select(item.message, [
		{
			value: "restore",
			text: strings["git restore"] || "Restore files",
			icon: "historyrestore",
		},
		{ value: "copy", text: strings.copy || "Copy id", icon: "copy" },
	]);
	if (choice === "restore") {
		const { default: confirm } = await import("dialogs/confirm");
		const ok = await confirm(
			strings["git restore"] || "Restore files",
			(
				strings["git confirm restore"] ||
				"Restore all files from snapshot {id}? Current files with the same name will be overwritten."
			).replace("{id}", item.id),
		);
		if (!ok) return;
		try {
			const result = await snapshotRestore(item.id);
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

/** Snapshot commit (used when no git repo exists yet). */
async function snapshotCommitFlow(message) {
	try {
		const result = await snapshotCommit(message);
		if (result?.error) {
			toast(result.output);
			return;
		}
		if ($message) $message.value = "";
		toast(result?.output || strings["git committed"] || "Snapshot created");
		refresh();
	} catch (error) {
		toast(`commit: ${error.message || error}`);
	}
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
