import "./style.scss";
import select from "dialogs/select";
import prompt from "dialogs/prompt";
import toast from "components/toast";
import settings from "lib/settings";
import Url from "utils/Url";
import vshell from "lib/ai/vshell";
import {
        getStatus,
        commit,
        restore,
        preparedCommands,
        readVcsDb,
} from "lib/gitPanel";

const COMMIT_PREFIXES = ["feat", "fix", "chore", "docs", "refactor", "test", "ci"];

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
        "account_tree",
        "git",
        strings["git panel"] || "Git",
        initApp,
        false,
        onSelected,
];

function onSelected() {
        refresh();
}

/**
 * @param {HTMLElement} el
 */
function initApp(el) {
        container = el;
        el.classList.add("git-app");
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
                <span className="icon sync" title={strings.refresh || "Refresh"} onclick={refresh}></span>
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
                        placeholder={
                                strings["git msg hint"] || "feat: describe your change"
                        }
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
                        <div
                                className="git-file"
                                data-path={path}
                                onclick={() => openChangedFile(path)}
                        >
                                <span className={`git-letter ${cls}`}>{letter}</span>
                                <span className="git-file-name">{path}</span>
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
                        <div className="git-empty">{strings["git no commits"] || "No snapshots yet."}</div>
                );
                return;
        }

        $commitsBody.content = (
                <div className="git-commit-list">
                        {commits
                                .slice()
                                .reverse()
                                .map((item) => (
                                        <div
                                                className="git-commit"
                                                onclick={() => commitActions(item)}
                                        >
                                                <span className="git-commit-id">{item.id}</span>
                                                <span className="git-commit-msg">{item.message}</span>
                                                <span className="git-commit-time">
                                                        {relativeTime(item.at)}
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
                        icon: "settings_backup_restore",
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
                                <div
                                        className="git-gh-cmd"
                                        onclick={() => copyCommand(entry.command)}
                                >
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
 * @param {number} timestamp
 */
function relativeTime(timestamp) {
        if (!timestamp) return "";
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "now";
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
}
