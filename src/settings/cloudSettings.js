import settingsPage from "components/settingsPage";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import {
	backupAll as ghBackup,
	isConfigured as ghReady,
	restoreAll as ghRestore,
} from "lib/ghBackend";
import settings from "lib/settings";
import helpers from "utils/helpers";

/**
 * Cloud settings page — GitHub storage (optional). Firebase is limited
 * to Analytics/Crashlytics/Remote Config/FCM, so no Firestore or Auth here.
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
				if (key === "ghRepo") value = normalizeRepo(value);
				await settings.update({ [key]: value ?? "" });
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
