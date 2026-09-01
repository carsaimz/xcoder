import { getResolvedKeyBindings } from "cm/commandRegistry";
import logoSrc from "components/logo/logo.png?inline";
import config from "lib/config";
import EditorFile from "lib/editorFile";
import recents from "lib/recents";
import Url from "utils/Url";

/**
 * Opens the Welcome tab as an EditorFile page
 */
export default function openWelcomeTab() {
	// Check if welcome tab is already open
	const existingFile = editorManager.files.find((f) => f.id === "welcome-tab");
	if (existingFile) {
		existingFile.makeActive();
		return;
	}

	const welcomeContent = createWelcomeContent();

	const welcomeFile = new EditorFile("Welcome", {
		id: "welcome-tab",
		render: true,
		type: "page",
		content: welcomeContent,
		tabIcon: "icon house",
		hideQuickTools: true,
	});

	// Set custom subtitle for the header
	welcomeFile.setCustomTitle(() => strings["welcome start"] || "Get Started");
}

/**
 * Creates the welcome tab content
 * @returns {HTMLElement}
 */
function createWelcomeContent() {
	const bindings = getResolvedKeyBindings();
	const kb = (name) => {
		const binding = bindings[name];
		return binding?.key ? binding.key.split("|")[0].replace(/-/g, "+") : "";
	};

	const recentFolders = recents.folders.slice(0, 3);
	const recentFiles = recents.files.slice(0, 5);
	const section = (key, fallback) => (strings[key] || fallback).toUpperCase();

	return (
		<div id="welcome-tab" className="welcome-page scroll">
			{/* Hero Section */}
			<header className="welcome-header">
				<img className="logo" src={logoSrc} width="48" height="48" alt="" />
				<div className="welcome-header-text">
					<h1>{strings["welcome title"] || "Welcome to XCoder"}</h1>
					<p className="tagline">
						{strings["welcome tagline"] || "Powerful code editor for Android"}
					</p>
					<span className="version-chip">v{BuildInfo.version}</span>
				</div>
			</header>

			{/* What's New Section */}
			<section className="welcome-section">
				<div className="feature-card whats-new" onclick={openChangelogPage}>
					<span className="icon new_releases accent"></span>
					<div className="feature-text">
						<span className="feature-title">
							{strings["welcome whats new"] || "What's New"}
						</span>
						<span className="feature-desc">
							{strings["welcome whats new desc"] ||
								"See the latest features and improvements."}
						</span>
					</div>
					<span className="icon arrow_forward arrow"></span>
				</div>
			</section>

			{/* Recent Section */}
			<section className="welcome-section">
				<h2 className="section-label">{strings.recent || "RECENT"}</h2>
				<div className="action-list">
					{recentFolders.map((folder) => (
						<RecentRow
							icon="folder_open"
							name={Url.basename(folder.url) || folder.url}
							path={Url.dirname(folder.url)}
							onClick={() => openRecentFolder(folder)}
						/>
					))}
					{recentFiles.map((file) => (
						<RecentRow
							icon="document-text-outline"
							name={Url.basename(file) || file}
							path={Url.dirname(file)}
							onClick={() => openRecentFile(file)}
						/>
					))}
					{!recentFiles.length && !recentFolders.length && (
						<p className="empty-recents">
							{strings["welcome no recents"] ||
								"Files and folders you open will appear here."}
						</p>
					)}
				</div>
			</section>

			{/* Tools Section: AI + Git */}
			<section className="welcome-section">
				<h2 className="section-label">{section("welcome tools", "Tools")}</h2>
				<div className="feature-card" onclick={() => openAppTab("ai")}>
					<span className="icon brain accent"></span>
					<div className="feature-text">
						<span className="feature-title">
							{strings["welcome ask ai"] || "Ask AI"}
						</span>
						<span className="feature-desc">
							{strings["welcome ask ai desc"] ||
								"Chat or agent mode with editor tools and code runs."}
						</span>
					</div>
					<span className="icon arrow_forward arrow"></span>
				</div>
				<div className="feature-card" onclick={() => openAppTab("git")}>
					<span className="icon git accent"></span>
					<div className="feature-text">
						<span className="feature-title">
							{strings["welcome git card"] || "Git & GitHub"}
						</span>
						<span className="feature-desc">
							{strings["welcome git desc"] ||
								"Snapshot status, commits and prepared push commands."}
						</span>
					</div>
					<span className="icon arrow_forward arrow"></span>
				</div>
			</section>

			{/* Get Started Section */}
			<section className="welcome-section">
				<h2 className="section-label">
					{section("welcome start", "Get Started")}
				</h2>
				<div className="action-list">
					<ActionRow
						icon="add"
						label={strings["new file"]}
						shortcut={kb("newFile")}
						onClick={() => xcoder.exec("new-file")}
					/>
					<ActionRow
						icon="document-text-outline"
						label={strings["open file"]}
						shortcut={kb("openFile")}
						onClick={() => xcoder.exec("open-file")}
					/>
					<ActionRow
						icon="folder_open"
						label={strings["open folder"]}
						shortcut={kb("openFolder")}
						onClick={() => xcoder.exec("open-folder")}
					/>
					<ActionRow
						icon="terminal"
						label={strings.terminal}
						shortcut={kb("openTerminal")}
						onClick={() => xcoder.exec("new-terminal")}
					/>
					<ActionRow
						icon="historyrestore"
						label={strings.recent}
						onClick={() => xcoder.exec("recent")}
					/>
					<ActionRow
						icon="tune"
						label={strings["command palette"]}
						shortcut={kb("openCommandPalette")}
						onClick={() => xcoder.exec("command-palette")}
					/>
				</div>
			</section>

			{/* Configure Section */}
			<section className="welcome-section">
				<h2 className="section-label">
					{section("welcome configure", "Configure")}
				</h2>
				<div className="action-list">
					<ActionRow
						icon="settings"
						label={strings.settings}
						onClick={() => xcoder.exec("open", "settings")}
					/>
					<ActionRow
						icon="color_lenspalette"
						label={strings["change theme"]}
						onClick={() => xcoder.exec("change-app-theme")}
					/>
					<ActionRow
						icon="extension"
						label={strings.explore + " " + strings.plugins}
						onClick={() => xcoder.exec("open", "plugins")}
					/>
				</div>
			</section>

			{/* Learn Section */}
			<section className="welcome-section">
				<h2 className="section-label">{section("welcome learn", "Learn")}</h2>
				<div className="action-list">
					<ActionRow
						icon="help"
						label={strings.help}
						onClick={() => xcoder.exec("open", "help")}
					/>
					<ActionRow
						icon="info_outline"
						label={strings.about}
						onClick={() => xcoder.exec("open", "about")}
					/>
				</div>
			</section>

			{/* Links Section */}
			<section className="welcome-section welcome-links">
				<h2 className="section-label">
					{section("welcome connect", "Connect")}
				</h2>
				<div className="link-row">
					<LinkItem icon="logo" label="Website" url={config.BASE_URL} />
					<LinkItem icon="github" label="GitHub" url={config.GITHUB_URL} />
					<LinkItem
						icon="error_outline"
						label="Issues"
						url={`${config.GITHUB_URL}/issues`}
					/>
				</div>
			</section>
		</div>
	);
}

/**
 * Opens a recently opened file
 * @param {string} url
 */
async function openRecentFile(url) {
	try {
		const { default: openFile } = await import("lib/openFile");
		openFile(url);
	} catch (error) {
		window.log("error", error);
		toast(strings["error"] || "Error");
	}
}

/**
 * Opens a recently opened folder
 * @param {{url: string, opts: object}} folder
 */
async function openRecentFolder(folder) {
	try {
		const { default: openFolder } = await import("lib/openFolder");
		openFolder(folder.url, folder.opts);
	} catch (error) {
		window.log("error", error);
		toast(strings["error"] || "Error");
	}
}

/**
 * Opens the AI chat or Git panel as an editor tab (like the terminal).
 * @param {"ai"|"git"} id
 */
async function openAppTab(id) {
	try {
		if (id === "ai") {
			const { openAiChat } = await import("sidebarApps/ai");
			await openAiChat();
			return;
		}
		if (id === "git") {
			const { openGitPanel } = await import("sidebarApps/git");
			await openGitPanel();
		}
	} catch (error) {
		window.log("error", error);
	}
}

/**
 * Opens the changelog page
 */
async function openChangelogPage() {
	try {
		const { default: Changelog } = await import(
			/* webpackChunkName: "changelog" */ "pages/changelog/changelog"
		);
		Changelog();
	} catch (error) {
		window.log("error", error);
		toast(strings["error"] || "Error");
	}
}

/**
 * Action row component
 */
function ActionRow({ icon, label, shortcut, onClick }) {
	return (
		<div className="action-row" onclick={onClick}>
			<span className={`icon ${icon}`}></span>
			<span className="action-label">{label}</span>
			{shortcut && <span className="action-shortcut">{shortcut}</span>}
		</div>
	);
}

/**
 * Recent file/folder row: two lines (name + dimmed location)
 */
function RecentRow({ icon, name, path, onClick }) {
	return (
		<div className="recent-row" onclick={onClick}>
			<span className={`icon ${icon}`}></span>
			<div className="recent-text">
				<span className="recent-name">{name}</span>
				<span className="recent-path">{path}</span>
			</div>
		</div>
	);
}

/**
 * Link item component - opens URL in external browser
 */
function LinkItem({ icon, label, url }) {
	const handleClick = (e) => {
		e.preventDefault();
		system.openInBrowser(url);
	};

	return (
		<a href={url} className="link-item" onclick={handleClick}>
			{icon === "logo" ? (
				<img
					className="link-logo"
					src={logoSrc}
					width="16"
					height="16"
					alt=""
				/>
			) : (
				<span className={`icon ${icon}`}></span>
			)}
			<span>{label}</span>
		</a>
	);
}
