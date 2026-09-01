import "./about.scss";
import Logo from "components/logo";
import Page from "components/page";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import Reactive from "html-tag-js/reactive";
import actionStack from "lib/actionStack";
import config from "lib/config";
import helpers from "utils/helpers";

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

export default function AboutInclude() {
	const $page = Page(strings.about.capitalize());
	const webviewVersionName = Reactive("N/A");
	const webviewPackageName = Reactive("N/A");

	$page.classList.add("about-us");
	$page.body = (
		<main id="about-page" className="main scroll">
			<Logo />

			<div className="version-info">
				<h1 className="version-title">XCoder</h1>
				<div className="version-number">
					Version {BuildInfo.version} ({BuildInfo.versionCode})
				</div>
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
						<span className="icon offline"></span>
					</div>
					<div className="info-item-text">
						Offline-first
						<div className="info-item-subtext">
							No account, no ads, no tracking
						</div>
					</div>
				</div>
				<a href={config.GITHUB_URL} className="info-item">
					<div className="info-item-icon">
						<span className="icon xcoder"></span>
					</div>
					<div className="info-item-text">
						Project homepage
						<div className="info-item-subtext">{config.GITHUB_URL}</div>
					</div>
				</a>
				<a href={`${config.GITHUB_URL}/issues`} className="info-item">
					<div className="info-item-icon">
						<span className="icon bug_report"></span>
					</div>
					<div className="info-item-text">
						Report an issue
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
						License
						<div className="info-item-subtext">MIT</div>
					</div>
				</a>
			</div>

			<div className="social-links">
				<a href={config.GITHUB_URL} className="social-link">
					<div className="social-icon">
						<span className="icon xcoder"></span>
					</div>
					GitHub
				</a>
				<a href={`${config.GITHUB_URL}/wiki`} className="social-link">
					<div className="social-icon">
						<span className="icon find"></span>
					</div>
					Docs
				</a>
			</div>
		</main>
	);

	$page.body
		.querySelector("#check-updates-item")
		?.addEventListener("click", checkForUpdates);

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
