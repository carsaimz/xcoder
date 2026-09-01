import settingsPage from "components/settingsPage";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import { pullAll as fbPull, pushAll as fbPush } from "lib/fbBackend";
import { isReady as fbReady, logEvent } from "lib/firebaseLite";
import {
	backupAll as ghBackup,
	isConfigured as ghReady,
	restoreAll as ghRestore,
} from "lib/ghBackend";
import settings from "lib/settings";
import helpers from "utils/helpers";

/**
 * Cloud settings page — GitHub-as-backend and Firebase (optional).
 */
export default function cloudSettings() {
	const title = strings["cloud settings"] || "Cloud";
	const values = settings.value;

	/** @type {Array<object>} */
	const items = [
		{
			key: "ghRepo",
			text: strings["gh repo"] || "GitHub backend repo",
			value: values.ghRepo || "",
			prompt:
				strings["gh repo prompt"] || "owner/repo (e.g. you/xcoder-backend)",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-gh-repo"] ||
				"Your own repository used as a backend for settings/chat backups and files. Accepts owner/repo or a github.com URL.",
		},
		{
			key: "ghToken",
			text: strings["gh token"] || "GitHub token (PAT)",
			value: values.ghToken ? "••••••••" : "",
			prompt: strings["gh token"] || "GitHub token (PAT)",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-gh-token"] ||
				"Fine-grained PAT with Contents read/write on the backend repo only. Stored on this device.",
		},
		{
			key: "ghOAuthClientId",
			text: strings["github client id"] || "GitHub OAuth client id",
			value: values.ghOAuthClientId || "",
			prompt: strings["github client id"] || "GitHub OAuth client id",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-gh-oauth-client-id"] ||
				"Client id of your own GitHub OAuth App with Device Flow enabled — used by 'Sign in with GitHub' in the Git panel.",
		},
		{
			key: "ghBranch",
			text: strings["gh branch"] || "Backend branch",
			value: values.ghBranch || "main",
			prompt: strings["gh branch"] || "Backend branch",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-gh-branch"] ||
				"Branch used to store the JSON documents.",
		},
		{
			key: "gh-backup",
			text: strings["gh backup"] || "Backup now",
			value: "",
			info:
				strings["settings-info-gh-backup"] ||
				"Commits your settings and AI chats as JSON to db/xcoder/backup.json in the backend repo.",
		},
		{
			key: "gh-restore",
			text: strings["gh restore"] || "Restore backup",
			value: "",
			info:
				strings["settings-info-gh-restore"] ||
				"Restores settings (token excluded) and AI chats from the last backup.",
		},
		{
			key: "firebaseEnabled",
			text: strings["firebase enabled"] || "Firebase events",
			value: Boolean(values.firebaseEnabled),
			checkbox: true,
			info:
				strings["settings-info-firebase-enabled"] ||
				"Optional anonymous usage events via the Firestore REST API (no SDK). No events are sent when disabled.",
		},
		{
			key: "firebaseProjectId",
			text: strings["firebase project"] || "Firebase project id",
			value: values.firebaseProjectId || "",
			prompt: strings["firebase project"] || "Firebase project id",
			promptType: "text",
			promptOptions: { required: false },
			info: strings["settings-info-firebase-project"] || "e.g. my-xcoder-app",
		},
		{
			key: "firebaseApiKey",
			text: strings["firebase key"] || "Firebase web API key",
			value: values.firebaseApiKey ? "••••••••" : "",
			prompt: strings["firebase key"] || "Firebase web API key",
			promptType: "text",
			promptOptions: { required: false },
			info:
				strings["settings-info-firebase-key"] ||
				"The Web API key from your Firebase project settings (public by design).",
		},
		{
			key: "fb-backup",
			text: strings["fb backup"] || "Firebase backup",
			value: "",
			info:
				strings["settings-info-fb-backup"] ||
				"Signs in anonymously and saves your settings and AI chats to Firestore (xcoder_users/<uid>/sync/backup). Requires Anonymous sign-in enabled in your Firebase project.",
		},
		{
			key: "fb-restore",
			text: strings["fb restore"] || "Firebase restore",
			value: "",
			info:
				strings["settings-info-fb-restore"] ||
				"Restores settings (token excluded) and AI chats from the last Firebase backup made on this device.",
		},
	];

	const page = settingsPage(
		title,
		items,
		async (key, value) => {
			try {
				if (key === "gh-backup") {
					await runBackup();
					return;
				}
				if (key === "gh-restore") {
					await runRestore();
					return;
				}
				if (key === "fb-backup") {
					await runFbBackup();
					return;
				}
				if (key === "fb-restore") {
					await runFbRestore();
					return;
				}
				if (key === "ghRepo") value = normalizeRepo(value);
				await settings.update({ [key]: value ?? "" });
				if (key === "firebaseEnabled" && value && fbReady()) {
					void logEvent("firebase_enabled");
				}
			} catch (error) {
				helpers.error(error);
			}
		},
		undefined,
		{
			preserveOrder: true,
			pageClassName: "detail-settings-page",
			listClassName: "detail-settings-list",
			valueInTail: true,
		},
	);

	async function runBackup() {
		if (!ghReady()) {
			toast(
				strings["gh not configured"] || "Configure the repo and token first",
			);
			return;
		}
		const hide = await loader.show();
		try {
			const summary = await ghBackup();
			toast(summary, 4000);
		} catch (error) {
			toast(`backup: ${error.message || error}`);
		} finally {
			hide();
		}
	}

	async function runRestore() {
		if (!ghReady()) {
			toast(
				strings["gh not configured"] || "Configure the repo and token first",
			);
			return;
		}
		const ok = await confirm(
			strings["gh restore"] || "Restore backup",
			strings["gh restore confirm"] ||
				"Current settings will be overwritten by the backup (token excluded). Continue?",
		);
		if (!ok) return;

		const hide = await loader.show();
		try {
			const { restored } = await ghRestore();
			toast(
				`${strings["gh restored"] || "Restored"}: ${restored.join(", ")}`,
				4000,
			);
		} catch (error) {
			toast(`restore: ${error.message || error}`);
		} finally {
			hide();
		}
	}

	async function runFbBackup() {
		if (!fbReady()) {
			toast(
				strings["fb not configured"] ||
					"Configure the Firebase project id and API key first",
			);
			return;
		}
		const hide = await loader.show();
		try {
			const summary = await fbPush();
			toast(summary, 4000);
		} catch (error) {
			toast(`firebase backup: ${error.message || error}`);
		} finally {
			hide();
		}
	}

	async function runFbRestore() {
		if (!fbReady()) {
			toast(
				strings["fb not configured"] ||
					"Configure the Firebase project id and API key first",
			);
			return;
		}
		const ok = await confirm(
			strings["fb restore"] || "Firebase restore",
			strings["fb restore confirm"] ||
				"Current settings will be overwritten by the Firebase backup (token excluded). Continue?",
		);
		if (!ok) return;

		const hide = await loader.show();
		try {
			const { restored } = await fbPull();
			toast(
				`${strings["fb restored"] || "Restored"}: ${restored.join(", ")}`,
				4000,
			);
		} catch (error) {
			toast(`firebase restore: ${error.message || error}`);
		} finally {
			hide();
		}
	}

	page.show();
	return page;
}

/**
 * @param {string} input
 */
function normalizeRepo(input) {
	return String(input || "")
		.trim()
		.replace(/^https?:\/\/(www\.)?github\.com\//i, "")
		.replace(/\.git$/i, "");
}
