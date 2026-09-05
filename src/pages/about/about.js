import "./about.scss";
import Logo from "components/logo";
import Page from "components/page";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import select from "dialogs/select";
import Reactive from "html-tag-js/reactive";
import actionStack from "lib/actionStack";
import config from "lib/config";
import { isPremium } from "lib/premium";
import helpers from "utils/helpers";
import { enhanceIcons } from "utils/iconEnhancer";

async function checkForUpdates() {
	const hide = await loader.show();
	try {
		const { checkAppUpdate } = await import("lib/checkAppUpdate");
		const update = await checkAppUpdate();
		if (!update) {
			toast(strings["update check failed"]);
			return;
		}
		if (!update.hasUpdate) {
			toast(strings["up to date"]);
			return;
		}
		const open = await confirm(
			strings["update available"],
			strings["update available info"].replace(/\{version\}/, update.tag),
		);
		if (open) system.openInBrowser(update.url);
	} catch (error) {
		window.log("error", "Manual update check failed");
		window.log("error", error);
		toast(strings["update check failed"]);
	} finally {
		hide();
	}
}

const DEV_TAP_COUNT = 7;

/**
 * Hidden developer menu — opens after tapping the version number
 * DEV_TAP_COUNT times. Keeps maintenance/dev-only actions out of the
 * regular settings UI.
 */
async function openDeveloperMenu() {
	const action = await select(
		strings["developer menu"] || "Developer menu",
		[
			["clear-cache", strings["clear cache"] || "Clear cache", "cached"],
			["restart", strings["restart_app"] || "Restart app", "autorenew"],
			["devtools", strings["developer mode"] || "Developer mode", "terminal"],
			["copy-info", strings["copy build info"] || "Copy build info", "copy"],
			["console", strings["console"] || "Console", "notes"],
		],
		{ hideOnSelect: true },
	);

	switch (action) {
		case "clear-cache":
			try {
				await system.clearCache();
				toast(strings["success"] || "Success");
			} catch (error) {
				window.log("error", "Clear cache failed:", error);
				toast(strings["error"] || "Error");
			}
			break;
		case "restart":
			location.reload();
			break;
		case "devtools": {
			const { default: appSettings } = await import("lib/settings");
			const newValue = !appSettings.value.developerMode;
			await appSettings.update({ developerMode: newValue });
			const { default: devTools } = await import("lib/devTools");
			if (newValue) {
				await devTools.init(true);
			} else {
				devTools.destroy();
			}
			toast(
				`${strings["devtools"] || "Developer mode"}: ${newValue ? "ON" : "OFF"}`,
			);
			break;
		}
		case "copy-info": {
			const info = [
				`XCoder ${BuildInfo.version} (${BuildInfo.versionCode})`,
				`Package: ${BuildInfo.packageName || "N/A"}`,
				`Platform: ${device?.platform || "N/A"} ${device?.version || ""}`,
				`WebView: ${navigator.userAgent}`,
			].join("\n");
			if (cordova?.plugins?.clipboard) {
				cordova.plugins.clipboard.copy(info);
				toast(strings["copied to clipboard"] || "Copied to clipboard");
			} else {
				toast(info);
			}
			break;
		}
		case "console": {
			const { default: commands } = await import("lib/commands");
			commands.console();
			break;
		}
	}
}

export default function AboutInclude() {
	const $page = Page(strings.about.capitalize());
	const webviewVersionName = Reactive("N/A");
	const webviewPackageName = Reactive("N/A");
	let devTaps = 0;
	let devTapTimer = null;

	$page.classList.add("about-us");
	$page.body = (
		<main id="about-page" className="main scroll">
			<Logo />

			<div className="version-info">
				<h1 className="version-title">XCoder</h1>
				<div className="version-number" id="version-number">
					{strings.version || "Version"} {BuildInfo.version} (
					{BuildInfo.versionCode})
				</div>
				{isPremium() && (
					<div className="premium-badge">
						♥ {strings["premium supporter"] || "Apoiador Premium"}
					</div>
				)}
				<p className="about-description">
					{strings["about description"] ||
						"A fast, offline-first code editor and web IDE for Android. Forked from Acode, rebuilt with AI assistance, Git integration and a Linux terminal in your pocket."}
				</p>
			</div>

			<div className="info-section">
				<div className="info-item" id="check-updates-item" role="button">
					<div className="info-item-icon">
						<span className="icon update"></span>
					</div>
					<div className="info-item-text">
						{strings["check for updates"]}
						<div className="info-item-subtext">
							{strings["check for updates desc"]}
						</div>
					</div>
				</div>
				<div className="info-item">
					<div className="info-item-icon">
						<span className="icon phone_android"></span>
					</div>
					<div className="info-item-text">
						{strings["about offline"] || "Offline-first"}
						<div className="info-item-subtext">
							{strings["about offline desc"] ||
								"No account, no ads, no tracking"}
						</div>
					</div>
				</div>
				<a href={config.WEBSITE_URL} className="info-item">
					<div className="info-item-icon">
						<span className="icon language"></span>
					</div>
					<div className="info-item-text">
						{strings["about website"] || "Website"}
						<div className="info-item-subtext">{config.WEBSITE_URL}</div>
					</div>
				</a>
				<a href={`${config.WEBSITE_URL}/docs`} className="info-item">
					<div className="info-item-icon">
						<span className="icon menu_book"></span>
					</div>
					<div className="info-item-text">
						{strings["about docs"] || "Documentation"}
						<div className="info-item-subtext">
							{`${config.WEBSITE_URL}/docs`}
						</div>
					</div>
				</a>
				<a href={`${config.WEBSITE_URL}/sponsor`} className="info-item">
					<div className="info-item-icon">
						<span className="icon favorite"></span>
					</div>
					<div className="info-item-text">
						{strings["about sponsor"] || "Sponsor the project"}
						<div className="info-item-subtext">
							{`${config.WEBSITE_URL}/sponsor`}
						</div>
					</div>
				</a>
				<a href={config.GITHUB_URL} className="info-item">
					<div className="info-item-icon">
						<span className="icon github"></span>
					</div>
					<div className="info-item-text">
						{strings["about homepage"] || "Project homepage"}
						<div className="info-item-subtext">{config.GITHUB_URL}</div>
					</div>
				</a>
				<a href={`${config.GITHUB_URL}/issues`} className="info-item">
					<div className="info-item-icon">
						<span className="icon error_outline"></span>
					</div>
					<div className="info-item-text">
						{strings["about report issue"] || "Report an issue"}
						<div className="info-item-subtext">
							{`${config.GITHUB_URL}/issues`}
						</div>
					</div>
				</a>
				<a
					href={`${config.GITHUB_URL}/blob/main/license.txt`}
					className="info-item"
				>
					<div className="info-item-icon">
						<span className="icon historyrestore"></span>
					</div>
					<div className="info-item-text">
						{strings.license || "License"}
						<div className="info-item-subtext">MIT</div>
					</div>
				</a>
			</div>

			<div className="credits-section">
				<h2 className="credits-title">
					{strings["about acknowledgments"] || "Acknowledgments"}
				</h2>
				<div className="info-section">
					<a href="https://github.com/deewarz/acodeapp" className="info-item">
						<div className="info-item-icon">
							<span className="icon xcoder"></span>
						</div>
						<div className="info-item-text">
							{strings["credits acode"] || "Acode app"}
							<div className="info-item-subtext">
								{strings["credits acode desc"] ||
									"XCoder is a fork of the awesome Acode editor"}
							</div>
						</div>
					</a>
					<div className="info-item">
						<div className="info-item-icon">
							<span className="icon javascript"></span>
						</div>
						<div className="info-item-text">
							{strings["credits libraries"] || "Open-source libraries"}
							<div className="info-item-subtext">
								CodeMirror 6 · xterm.js · markdown-it · KaTeX · Mermaid ·
								DOMPurify · Emmet · motion · html-tag-js
							</div>
						</div>
					</div>
					<a
						href={`${config.GITHUB_URL}/graphs/contributors`}
						className="info-item"
					>
						<div className="info-item-icon">
							<span className="icon person"></span>
						</div>
						<div className="info-item-text">
							{strings["credits contributors"] || "Contributors"}
							<div className="info-item-subtext">
								{strings["credits contributors desc"] ||
									"Everyone who improves XCoder on GitHub"}
							</div>
						</div>
					</a>
					<a href={`${config.GITHUB_URL}/issues`} className="info-item">
						<div className="info-item-icon">
							<span className="icon favorite"></span>
						</div>
						<div className="info-item-text">
							{strings["credits community"] || "Community"}
							<div className="info-item-subtext">
								{strings["credits community desc"] ||
									"Testers, translators and bug reporters — thank you!"}
							</div>
						</div>
					</a>
				</div>
			</div>

			<div className="social-links">
				<a href={config.WEBSITE_URL} className="social-link">
					<div className="social-icon">
						<span className="icon language"></span>
					</div>
					{strings["about website short"] || "Site"}
				</a>
				<a href={`${config.WEBSITE_URL}/docs`} className="social-link">
					<div className="social-icon">
						<span className="icon menu_book"></span>
					</div>
					{strings.documentation || "Docs"}
				</a>
				<a href={config.GITHUB_URL} className="social-link">
					<div className="social-icon">
						<span className="icon github"></span>
					</div>
					GitHub
				</a>
			</div>
		</main>
	);

	// Upgrade icon-font glyphs to the SVG pack (Lucide tier)
	enhanceIcons($page.body);

	$page.body
		.querySelector("#check-updates-item")
		?.addEventListener("click", checkForUpdates);

	// Hidden developer menu: tap the version number 7 times (resets after 3s)
	$page.body.querySelector("#version-number")?.addEventListener("click", () => {
		devTaps += 1;
		clearTimeout(devTapTimer);
		devTapTimer = setTimeout(() => {
			devTaps = 0;
		}, 3000);
		if (devTaps >= DEV_TAP_COUNT) {
			devTaps = 0;
			clearTimeout(devTapTimer);
			if (navigator.vibrate) navigator.vibrate(config.VIBRATION_TIME_LONG);
			openDeveloperMenu();
		}
	});

	system.getWebviewInfo((res) => {
		webviewPackageName.value = res?.packageName || "N/A";
		webviewVersionName.value = res?.versionName || "N/A";
	});

	actionStack.push({
		id: "about",
		action: $page.hide,
	});

	$page.onhide = function () {
		actionStack.remove("about");
	};

	app.append($page);
	helpers.showAd();

	return $page;
}
