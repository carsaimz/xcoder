import "./style.scss";
import sidebarApps from "sidebarApps";
import toast from "components/toast";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import Ref from "html-tag-js/ref";
import vshell from "lib/ai/vshell";
import { pickAndApplyGhRepo } from "lib/ghRepos";
import {
	refreshGhProfile,
	signInGitHubFlow,
	signInWithPat,
} from "lib/ghSignIn";
import * as git from "lib/git";
import { echoGitCommand } from "lib/git/terminalEcho";
import {
	readVcsDb,
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

/** Collapsed sections (session scoped — VS Code remembers per view). */
const collapsed = new Set();

/** @type {HTMLElement} */
let container = null;
/** @type {HTMLElement} */
let $accountBody = null;
/** @type {HTMLElement} */
let $mainBody = null;
/*
 * Body refs — the html-tag-js JSX runtime only binds `ref` attributes
 * holding a Ref instance (it checks `instanceOfRef` and assigns `.el`).
 * Function refs are SILENTLY DROPPED, which left this panel blank in
 * v1.8.26 (every body stayed null, so refresh() early-returned).
 */
const accountBodyRef = Ref();
const mainBodyRef = Ref();
/** @type {HTMLInputElement} */
let $message = null;
/** @type {HTMLElement} */
let $commitBtn = null;
let refreshTimer = 0;
let removeGitListener = null;
/** @type {{ahead: number, behind: number, at: number}} */
let syncState = { ahead: 0, behind: 0, at: 0 };
/** Self-heal guard: profile auto-fetch ran once per panel life. */
let profileHealTried = false;
/** Last rendered mode ("welcome" | "scm") — avoids pointless repaints. */
let lastMode = "";

/**
 * Git sidebar app — VS Code style Source Control.
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
	el.classList.add("git-app");
	el.content = buildUi();
	// Ref instances got their element during tag creation (see note above)
	$accountBody = accountBodyRef.el;
	$mainBody = mainBodyRef.el;
	renderAccount();
	refresh();

	// refresh when files change (debounced)
	clearInterval(refreshTimer);
	refreshTimer = setInterval(() => {
		if (el.isConnected) refresh();
	}, 4000);

	// re-render as soon as the session changes — sign-in can happen from
	// the settings page or the AI chat while this app is open
	settings.on("update:ghUserLogin", onAccountChanged);
	settings.on("update:ghToken", onAccountChanged);
	settings.on("update:ghRepo", onAccountChanged);

	// VS Code behaviour: git mutations from ANY surface (terminal `git`,
	// AI agent, sidebar buttons) refresh this view
	removeGitListener = git.onGitChange(() => {
		if (container?.isConnected) refresh();
	});

	return () => {
		container = null;
		$accountBody = null;
		$mainBody = null;
		$message = null;
		$commitBtn = null;
		clearInterval(refreshTimer);
		removeGitListener?.();
		removeGitListener = null;
		settings.off("update:ghUserLogin", onAccountChanged);
		settings.off("update:ghToken", onAccountChanged);
		settings.off("update:ghRepo", onAccountChanged);
	};
}

/** Re-renders everything when the session changes. */
function onAccountChanged() {
	if (!container?.isConnected) return;
	renderAccount();
	refresh();
}

function buildUi() {
	const $account = <div className="git-account" ref={accountBodyRef}></div>;
	const $main = <div className="git-main" ref={mainBodyRef}></div>;

	return (
		<div className="git-panel">
			{$account}
			{$main}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Account row (VS Code Accounts surface)
// ---------------------------------------------------------------------------

/**
 * Renders the slim account row: profile when signed in, sign-in actions
 * otherwise. A stored token without a profile self-heals once by
 * fetching the GitHub profile for the stored token.
 */
function renderAccount() {
	if (!$accountBody?.isConnected) return;
	const values = settings.value;

	if (values.ghUserLogin) {
		$accountBody.content = (
			<div className="git-account-row">
				{values.ghUserAvatar ? (
					<img className="git-avatar" src={values.ghUserAvatar} alt="" />
				) : (
					<span className="icon account_circle git-avatar-fallback"></span>
				)}
				<div className="git-account-info">
					<span className="git-account-login">{values.ghUserLogin}</span>
					<span className="git-account-state">
						{strings["github connected"] || "Conectado ao GitHub"}
					</span>
				</div>
				<span
					className="icon more_vert git-account-menu"
					title={strings["github account"] || "Conta GitHub"}
					onclick={accountActions}
				></span>
			</div>
		);
		return;
	}

	if (values.ghToken) {
		// token set, profile missing — self-heal once, then show the retry row
		if (!profileHealTried) {
			profileHealTried = true;
			refreshGhProfile().then(() => renderAccount());
		}
		$accountBody.content = (
			<div className="git-account-row">
				<span className="icon key git-avatar-fallback"></span>
				<div className="git-account-info">
					<span className="git-account-login">
						{strings["github token active"] || "Token configurado"}
					</span>
					<span className="git-account-state">
						{strings["github pat active"] ||
							"Usando um token de acesso pessoal."}
					</span>
				</div>
				<span
					className="icon refresh git-account-menu"
					title={strings["github refresh profile"] || "Atualizar perfil"}
					onclick={retryProfile}
				></span>
			</div>
		);
		return;
	}

	$accountBody.content = (
		<div className="git-account-row git-account-out">
			<span className="icon github git-avatar-fallback"></span>
			<span className="git-account-hint">
				{strings["git sign in hint"] ||
					"Conecte sua conta para clonar, sincronizar e publicar repositórios."}
			</span>
			<button className="git-btn primary" onclick={signInGitHub}>
				{strings["sign in with github"] || "Entrar com GitHub"}
			</button>
		</div>
	);
}

/** Account menu: refresh profile / PAT / sign out. */
async function accountActions() {
	const choice = await select(strings["github account"] || "Conta GitHub", [
		{
			value: "refresh",
			text: strings["github refresh profile"] || "Atualizar perfil",
			icon: "refresh",
		},
		{
			value: "pat",
			text: strings["github token"] || "Token de acesso pessoal",
			icon: "key",
		},
		{ value: "signout", text: strings.logout || "Sair", icon: "logout" },
	]);
	if (choice === "refresh") {
		await retryProfile();
	} else if (choice === "pat") {
		await signInWithPat();
		renderAccount();
	} else if (choice === "signout") {
		await signOutGitHub();
	}
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
	refresh();
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
	refresh();
}

// ---------------------------------------------------------------------------
// Main body — welcome (no repo) vs Source Control (repo)
// ---------------------------------------------------------------------------

async function refresh() {
	if (!container || !$mainBody?.isConnected) return;

	renderAccount();

	const hasRealRepo = await git.hasRepo().catch(() => false);
	const mode = hasRealRepo ? "scm" : "welcome";
	if (mode !== lastMode) {
		lastMode = mode;
		renderShell(mode);
	}

	if (hasRealRepo) {
		await renderScm();
		await renderGitHistory();
	} else {
		sidebarApps.setBadge?.("git", null);
		renderSnapshotStatus();
	}
}

/**
 * Builds the static shell for the current mode. Dynamic lists are
 * re-filled in place afterwards.
 */
function renderShell(mode) {
	const scmBodyRef = Ref();
	const historyBodyRef = Ref();
	const snapBodyRef = Ref();

	if (mode === "scm") {
		$message = (
			<input
				type="text"
				className="git-message"
				placeholder={strings["git msg hint"] || "Mensagem de commit"}
			/>
		);
		$message.onkeydown = (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				onCommit();
			}
		};
		$commitBtn = (
			<button
				className="git-btn primary git-commit-btn"
				onclick={onCommit}
				title={strings["git commit"] || "Commit"}
			>
				<span className="icon check"></span>
			</button>
		);

		$mainBody.content = (
			<div className="git-view">
				<div className="git-toolbar">
					<span className="git-branch-chip" onclick={chooseBranch}>
						<span className="icon git-branch-ic"></span>
						<span className="git-branch-name">
							{strings["git loading"] || "…"}
						</span>
					</span>
					<span className="git-branch-sync"></span>
					<span className="git-toolbar-actions">
						<span
							className="icon refresh"
							title={strings.refresh || "Atualizar"}
							onclick={refresh}
						></span>
						<span
							className="icon download"
							title={strings["git pull"] || "Pull"}
							onclick={onPull}
						></span>
						<span
							className="icon upload"
							title={strings["git push"] || "Push"}
							onclick={onPush}
						></span>
						<span
							className="icon more_vert"
							title={strings.more || "Mais ações"}
							onclick={scmActions}
						></span>
					</span>
				</div>

				<div className="git-commitbox">
					<div className="git-commitbox-row">
						{$message}
						{$commitBtn}
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

				<div className="git-scm" ref={scmBodyRef}></div>

				<div className="git-section git-history" data-section="history">
					<div
						className="git-section-header"
						onclick={() => toggleSection("history")}
					>
						<span className="icon chevron"></span>
						<span className="git-section-title">
							{strings["git history title"] || "Histórico"}
						</span>
					</div>
					<div className="git-section-body" ref={historyBodyRef}></div>
				</div>
			</div>
		);
	} else {
		// VS Code welcome view: Initialize Repository / Clone Repository
		$mainBody.content = (
			<div className="git-view">
				<div className="git-welcome">
					<span className="icon git-branch git-welcome-icon"></span>
					<span className="git-welcome-title">
						{strings["git welcome title"] || "Controle de versão"}
					</span>
					<span className="git-welcome-hint">
						{strings["git welcome hint"] ||
							"Rastreie mudanças, faça commits e sincronize com o GitHub."}
					</span>
					<button className="git-btn primary" onclick={onInit}>
						<span className="icon add"></span>
						{strings["git init repo"] || "Inicializar repositório"}
					</button>
					<button className="git-btn ghost" onclick={onClone}>
						<span className="icon copy"></span>
						{strings["git clone"] || "Clonar repositório…"}
					</button>
				</div>

				<div className="git-section">
					<div
						className="git-section-header"
						onclick={() => toggleSection("snapshots")}
					>
						<span className="icon chevron"></span>
						<span className="git-section-title">
							{strings["git commits"] || "Snapshots locais"}
						</span>
					</div>
					<div className="git-section-body" ref={snapBodyRef}></div>
				</div>
			</div>
		);
	}
	// Ref instances are bound synchronously during tag creation —
	// publish them for renderScm / renderGitHistory / renderSnapshotStatus
	container._$scmBody = scmBodyRef.el;
	container._$historyBody = historyBodyRef.el;
	container._$snapBody = snapBodyRef.el;
}

/** Collapses/expands a section and re-renders its chevron. */
function toggleSection(id) {
	if (collapsed.has(id)) collapsed.delete(id);
	else collapsed.add(id);
	const $section = $mainBody?.querySelector(`[data-section="${id}"]`);
	if ($section) {
		$section.classList.toggle("collapsed", collapsed.has(id));
	}
}

// ---------------------------------------------------------------------------
// Source Control (real git)
// ---------------------------------------------------------------------------

/** Refills the SCM lists from real git status. */
async function renderScm() {
	const $body = container?._$scmBody;
	if (!$body?.isConnected) return;
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

	sidebarApps.setBadge?.("git", status.total || null);

	// toolbar branch name + push/pull availability
	const remote = await git.remoteUrl().catch(() => "");
	const { ahead, behind } = await syncCounts(remote);
	const $branchName = $mainBody?.querySelector(".git-branch-name");
	if ($branchName) {
		$branchName.textContent =
			status.branch || strings["git detached"] || "detached";
	}
	const $pull = $mainBody?.querySelector(".git-toolbar .icon.download");
	const $push = $mainBody?.querySelector(".git-toolbar .icon.upload");
	if ($pull) $pull.style.display = remote ? "" : "none";
	if ($push) $push.style.display = remote ? "" : "none";
	const $sync = $mainBody?.querySelector(".git-branch-sync");
	if ($sync) {
		const label = [ahead ? `↑${ahead}` : "", behind ? `↓${behind}` : ""]
			.filter(Boolean)
			.join(" ");
		$sync.textContent = label;
		$sync.style.display = label ? "" : "none";
	}

	// publish setup card when the repo has no remote yet
	$mainBody?.querySelector(".git-remote-setup")?.remove();
	if (!remote) {
		const setup = (
			<div className="git-remote-setup">
				<span className="git-account-hint">
					{strings["git publish hint"] ||
						"Configure um repositório remoto para sincronizar (push/pull)."}
				</span>
				<div className="git-remote-setup-actions">
					<button className="git-btn primary" onclick={onPublish}>
						<span className="icon upload"></span>
						{strings["git publish"] || "Publicar no GitHub"}
					</button>
					<button className="git-btn ghost" onclick={onAddRemote}>
						{strings["git remote url"] || "URL remota…"}
					</button>
				</div>
			</div>
		);
		$body.before(setup);
	}

	const sections = [];
	if (status.staged.length) {
		sections.push(
			renderFileSection(
				"staged",
				strings["git staged"] || "Preparadas",
				status.staged,
				[
					{
						icon: "remove",
						title: strings["git unstage all"] || "Despreparar tudo",
						action: onUnstageAll,
					},
				],
			),
		);
	}
	if (status.changed.length) {
		sections.push(
			renderFileSection(
				"changed",
				strings["git changes"] || "Mudanças",
				status.changed,
				[
					{
						icon: "add",
						title: strings["git stage all"] || "Preparar tudo",
						action: onStageAll,
					},
				],
			),
		);
	}
	if (status.untracked.length) {
		sections.push(
			renderFileSection(
				"untracked",
				strings["git untracked"] || "Sem rastreamento",
				status.untracked,
				[
					{
						icon: "add",
						title: strings["git stage all"] || "Preparar tudo",
						action: onStageAll,
					},
				],
			),
		);
	}

	$body.content = (
		<div className="git-scm-view">
			{sections}
			{!status.total ? (
				<div className="git-empty">
					{strings["git no changes real"] ||
						"Sem mudanças — tudo corresponde ao último commit."}
				</div>
			) : null}
		</div>
	);
}

/**
 * One collapsible changes section with header actions.
 * @param {string} id section id
 * @param {string} title section label
 * @param {Array<{path: string, status: string}>} rows status rows
 * @param {Array<{icon: string, title: string, action: Function}>} actions
 */
function renderFileSection(id, title, rows, actions) {
	return (
		<div className="git-section" data-section={id}>
			<div className="git-section-header" onclick={() => toggleSection(id)}>
				<span className="icon chevron"></span>
				<span className="git-section-title">
					{title} ({rows.length})
				</span>
				<span className="git-section-actions">
					{actions.map((item) => (
						<span
							className="icon"
							data-icon={item.icon}
							title={item.title}
							onclick={(event) => {
								event.stopPropagation();
								item.action();
							}}
						></span>
					))}
				</span>
			</div>
			<div className="git-section-body">
				<div className="git-file-list">
					{rows.map((row) => renderFileRow(row))}
				</div>
			</div>
		</div>
	);
}

/**
 * One file row: letter badge + name (basename bold, dir dimmed) + actions.
 * @param {{path: string, status: string}} row
 */
function renderFileRow(row) {
	const staged = ["added", "staged-modified", "staged-deleted"].includes(
		row.status,
	);
	const deleted = ["deleted", "staged-deleted"].includes(row.status);
	const dir = Url.dirname(row.path);
	const basename = Url.basename(row.path);

	return (
		<div className="git-file" data-path={row.path}>
			<span className={`git-letter ${LETTER_CLASS[row.status] || ""}`}>
				{LETTER_TEXT[row.status] || "M"}
			</span>
			<span
				className="git-file-name"
				title={row.path}
				onclick={() => !deleted && openChangedFile(row.path)}
			>
				{dir && dir !== "." ? (
					<span className="git-file-dir">{dir}/</span>
				) : null}
				<span className="git-file-base">{basename}</span>
			</span>
			<span className="git-file-actions">
				{staged ? (
					<span
						className="icon remove git-file-act"
						title={strings["git unstage"] || "Despreparar"}
						onclick={() => onUnstage(row.path)}
					></span>
				) : (
					<span
						className="icon add git-file-act"
						title={strings["git stage"] || "Preparar"}
						onclick={() => onStage(row.path)}
					></span>
				)}
				{!staged ? (
					<span
						className="icon undo git-file-act"
						title={strings["git discard"] || "Descartar"}
						onclick={() => onDiscard(row.path)}
					></span>
				) : null}
			</span>
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

/** ⋯ menu: every git command (VS Code SCM title bar "more"). */
async function scmActions() {
	const remote = await git.remoteUrl().catch(() => "");
	const options = [
		{
			value: "publish",
			text: remote
				? strings["git remote edit"] || "Alterar remote…"
				: strings["git publish"] || "Publicar no GitHub",
			icon: "public",
		},
		{
			value: "branches",
			text: strings["git branches"] || "Branches",
			icon: "svg:git-branch",
		},
		{
			value: "pull",
			text: strings["git pull"] || "Puxar (pull)",
			icon: "download",
			disabled: !remote,
		},
		{
			value: "push",
			text: strings["git push"] || "Enviar (push)",
			icon: "upload",
			disabled: !remote,
		},
		{
			value: "fetch",
			text: strings["git fetch"] || "Fetch",
			icon: "refresh",
			disabled: !remote,
		},
		{
			value: "clone",
			text: strings["git clone"] || "Clonar repositório…",
			icon: "copy",
		},
		{
			value: "removeRemote",
			text: strings["git remote remove"] || "Remover remote",
			icon: "delete",
			disabled: !remote,
		},
	];
	const choice = await select(
		strings["git actions"] || "Ações do Git",
		options.filter((option) => !option.disabled),
	);
	switch (choice) {
		case "publish":
			await onPublish();
			break;
		case "branches":
			await chooseBranch();
			break;
		case "pull":
			await onPull();
			break;
		case "push":
			await onPush();
			break;
		case "fetch":
			await onFetch();
			break;
		case "clone":
			await onClone();
			break;
		case "removeRemote":
			await onRemoveRemote();
			break;
		default:
			break;
	}
}

/** Branch picker dialog: switch, create, delete. */
async function chooseBranch() {
	try {
		const list = await git.branches();
		const options = list.all.map((branch) => ({
			value: branch.name,
			text: `${branch.current ? "✓ " : ""}${branch.name}`,
			icon: "svg:git-branch",
		}));
		options.push({
			value: "__create__",
			text: strings["git branch create"] || "Criar branch…",
			icon: "add",
		});
		if (list.all.length > 1) {
			options.push({
				value: "__delete__",
				text: strings["git branch delete"] || "Eliminar branch…",
				icon: "delete",
			});
		}
		const choice = await select(strings["git branches"] || "Branches", options);
		if (!choice || choice === list.current) return;
		if (choice === "__create__") {
			const name = await prompt(
				strings["git branch create"] || "Criar branch",
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
				strings["git branch delete"] || "Eliminar branch",
				list.all
					.filter((branch) => !branch.current)
					.map((branch) => ({
						value: branch.name,
						text: branch.name,
						icon: "svg:git-branch",
					})),
			);
			if (!name) return;
			const { default: confirm } = await import("dialogs/confirm");
			const ok = await confirm(
				strings["git branch delete"] || "Eliminar branch",
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
		strings["git discard"] || "Descartar mudanças",
		`${strings["git discard confirm"] || "Descartar todas as mudanças em"} ${path}?`,
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
		toast(strings["git commit msg"] || "Digite uma mensagem de commit");
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
			toast(strings["git no changes real"] || "Sem mudanças para commit");
			return;
		}
		const oid = await git.commit(null, message);
		echoGitCommand(`git commit -m "${message.replace(/"/g, "'")}"`);
		toast(
			`${strings["git committed real"] || "Commit criado"} ${oid.slice(0, 7)}`,
			3000,
		);
		if ($message) $message.value = "";
	} catch (error) {
		toast(`commit: ${error.message || error}`, 4500);
	} finally {
		hide();
		syncState = { ahead: 0, behind: 0, at: 0 };
		refresh();
	}
}

/**
 * Publish flow (VS Code "Publish Branch"): needs a GitHub session, then
 * picks (or asks) the repository and wires it as origin + pushes.
 */
async function onPublish() {
	const values = settings.value;
	if (!values.ghToken && !values.ghUserLogin) {
		// account first — publish without credentials dead-ends on 401
		const signed = await signInGitHubFlow();
		if (!signed) return;
	}
	const picked = await pickAndApplyGhRepo();
	if (!picked) return;
	const url =
		settings.value.gitRemoteUrl ||
		`https://github.com/${settings.value.ghRepo}.git`;
	await runGit(`git remote add origin ${url}`, async () => {
		await git.addRemote(null, "origin", url);
	});
	const branch = await git.currentBranch();
	if (!branch) {
		toast(
			strings["git commit first push"] ||
				"Faça um commit antes de publicar a branch.",
			4000,
		);
		return;
	}
	await onPush();
}

/** Manual remote URL entry (advanced/self-hosted setups). */
async function onAddRemote() {
	const url = await prompt(
		strings["git remote url"] || "URL remota",
		settings.value.gitRemoteUrl || "",
		"text",
	);
	if (!url) return;
	const clean = url.trim();
	await runGit(`git remote add origin ${clean}`, async () => {
		await git.addRemote(null, "origin", clean);
	});
	settings.value.gitRemoteUrl = clean;
	await settings.update();
}

/** Removes the origin remote (VS Code "Remove Remote"). */
async function onRemoveRemote() {
	const { default: confirm } = await import("dialogs/confirm");
	const ok = await confirm(
		strings["git remote remove"] || "Remover remote",
		strings["git remote remove confirm"] ||
			"Remover o remote 'origin' deste repositório?",
	);
	if (!ok) return;
	await runGit("git remote remove origin", () =>
		git.removeRemote(null, "origin"),
	);
	settings.value.gitRemoteUrl = "";
	await settings.update();
}

/** Fetch with loader + echo. */
async function onFetch() {
	await runGit("git fetch", () => git.fetch(null, {}));
	toast(strings["git fetched"] || "Fetch ok", 2500);
}

/**
 * Push with the session credentials; configures the remote from the
 * selected GitHub repo when needed.
 */
async function onPush() {
	const branch = await git.currentBranch();
	if (!branch) {
		toast(
			strings["git commit first push"] ||
				"Faça um commit antes de publicar a branch.",
			4000,
		);
		return;
	}
	await runGit(`git push -u origin ${branch}`, () => git.push(null, {}));
	toast(`${strings["git pushed"] || "Enviado"} → origin/${branch}`, 4000);
}

/** Pull with fast-forward/merge handled by the engine. */
async function onPull() {
	await runGit("git pull", () => git.pull(null, {}));
	toast(strings["git pulled"] || "Pull ok — branch atualizada", 3000);
}

/** Initializes a repository in the opened project. */
async function onInit() {
	await runGit("git init", () => git.init(null));
	toast(strings["git inited"] || "Repositório inicializado", 3000);
}

/**
 * Clone from URL into a subfolder of the current workspace.
 */
async function onClone() {
	const url = await prompt(
		strings["git clone url"] ||
			"URL do repositório (https://github.com/user/repo)",
		settings.value.gitRemoteUrl || "",
		"text",
	);
	if (!url) return;
	const hide = await loader.create(
		strings["git clone"] || "Clonar repositório",
		url,
		{ timeout: 0 },
	);
	try {
		const dir = await git.clone({ url: url.trim() });
		echoGitCommand(`git clone ${url.trim()}`);
		toast(`${strings["git cloned"] || "Clonado"} → ${Url.basename(dir)}`, 4000);
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
	const $body = container?._$historyBody;
	if (!$body?.isConnected) return;
	let history;
	try {
		history = await git.log(null, { depth: 30 });
	} catch {
		history = [];
	}
	if (!history.length) {
		$body.content = (
			<div className="git-empty">
				{strings["git no commits real"] || "Ainda não há commits."}
			</div>
		);
		return;
	}
	$body.content = (
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
			text: strings.copy || "Copiar hash",
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
		toast(strings["git copied"] || "Copiado");
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
// Snapshot fallback (no real git repo yet)
// ---------------------------------------------------------------------------

/** Refills the local-snapshot status rows (kept for non-git projects). */
async function renderSnapshotStatus() {
	const $body = container?._$snapBody;
	if (!$body?.isConnected) return;
	let status;
	try {
		status = await snapshotStatus();
	} catch (error) {
		$body.content = (
			<div className="git-empty">{`snapshot: ${error.message || error}`}</div>
		);
		return;
	}
	const { changes } = status;
	const count = countChanges(changes);

	if (!count) {
		$body.content = (
			<div className="git-empty">
				{strings["git no changes"] ||
					"Sem mudanças — tudo corresponde ao último snapshot."}
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
	if (minutes < 1) return strings["git time now"] || "agora";
	if (minutes < 60) return `${minutes} ${strings["git time min"] || "min"}`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ${strings["git time hour"] || "h"}`;
	const days = Math.floor(hours / 24);
	return `${days} ${strings["git time day"] || "d"}`;
}
