import "./style.scss";
import fsOperation from "fileSystem";
import Contextmenu from "components/contextmenu";
import Page from "components/page";
import DOMPurify from "dompurify";
import Ref from "html-tag-js/ref";
import actionStack from "lib/actionStack";
import config from "lib/config";
import markdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";
import helpers from "utils/helpers";

export default async function Changelog() {
	const GITHUB_API_URL = `${config.GITHUB_URL.replace(
		"https://github.com",
		"https://api.github.com",
	)}/releases`;
	const CHANGELOG_FILE_URL = `${config.GITHUB_URL}/raw/main/CHANGELOG.md`;
	const currentVersion = BuildInfo.version;
	const localChangelogMd = (await import("../../../CHANGELOG.md")).default;

	let selectedVersion = currentVersion;
	let selectedStatus = "current";
	const versionIndicatorRef = Ref();
	const versionTextRef = Ref();
	const body = Ref();

	const versionSelector = (
		<div className="changelog-version-selector" data-action="select-version">
			<span
				className={"status-indicator status-" + selectedStatus}
				ref={versionIndicatorRef}
			></span>
			<span ref={versionTextRef}>{selectedVersion}</span>
		</div>
	);

	const $page = Page(strings["changelog"], {
		tail: versionSelector,
	});

	const versionSelectorMenu = Contextmenu({
		top: "36px",
		right: "5px",
		toggler: versionSelector,
		transformOrigin: "top right",
		onclick: menuClickHandler,
		innerHTML: () => {
			return `
        <li action="current">
          <span class="text">${strings["changelog current version"] || "Current Version"} (${currentVersion})</span>
        </li>
        <li action="latest">
          <span class="text">${strings["changelog latest release"] || "Latest Release"}</span>
        </li>
        <li action="beta">
          <span class="text">${strings["changelog beta version"] || "Beta Version"}</span>
        </li>
        <li action="full">
          <span class="text">${strings["changelog full"] || "Full Changelog"}</span>
        </li>
      `;
		},
	});

	// Render the bundled changelog immediately — remote sources are
	// enhancements, never a requirement.
	body.onref = () => renderChangelog(localChangelogMd);
	$page.body = <div className="md" id="changelog" ref={body} />;
	app.append($page);
	helpers.showAd();

	$page.onhide = function () {
		actionStack.remove("changelog");
	};

	actionStack.push({
		id: "changelog",
		action: $page.hide,
	});

	loadVersionChangelog();

	async function loadLatestRelease() {
		try {
			const releases = await fsOperation(`${GITHUB_API_URL}/latest`).readFile(
				"json",
			);
			selectedVersion = releases.tag_name.replace("v", "");
			selectedStatus = "latest";
			updateVersionSelector();
			return renderChangelog(releases.body || localChangelogMd);
		} catch (error) {
			window.log("error", "Failed to load latest release notes:", error);
			updateVersionSelector();
			return renderChangelog(localChangelogMd);
		}
	}

	async function loadBetaRelease() {
		try {
			const releases = await fsOperation(GITHUB_API_URL).readFile("json");
			const betaRelease = releases.find((r) => r.prerelease);
			if (!betaRelease) {
				body.content = (
					<div className="error">
						{strings["changelog no beta"] || "No beta release found"}
					</div>
				);
				return;
			}
			selectedVersion = betaRelease.tag_name.replace("v", "");
			selectedStatus = "prerelease";
			updateVersionSelector();
			return renderChangelog(betaRelease.body || localChangelogMd);
		} catch (error) {
			window.log("error", "Failed to load beta release notes:", error);
			updateVersionSelector();
			return renderChangelog(localChangelogMd);
		}
	}

	async function loadFullChangelog() {
		try {
			const changeLogText =
				await fsOperation(CHANGELOG_FILE_URL).readFile("utf8");
			const cleanedText = changeLogText.replace(/^#\s*Change\s*Log\s*\n*/i, "");
			selectedVersion = "CHANGELOG.md";
			selectedStatus = "current";
			updateVersionSelector();
			return renderChangelog(cleanedText || localChangelogMd);
		} catch (error) {
			window.log("error", "Failed to load full changelog:", error);
			updateVersionSelector();
			return renderChangelog(localChangelogMd);
		}
	}

	async function loadVersionChangelog() {
		try {
			const releases = await fsOperation(GITHUB_API_URL).readFile("json");
			const currentRelease = releases.find(
				(r) => r.tag_name.replace("v", "") === currentVersion,
			);
			selectedVersion = currentVersion;
			selectedStatus = "current";
			updateVersionSelector();
			if (currentRelease?.body) {
				return renderChangelog(currentRelease.body);
			}
			return loadLatestRelease();
		} catch (error) {
			// Offline, rate limited or slow network: keep showing the
			// bundled changelog silently instead of an error toast.
			window.log("warn", "Failed to load version changelog:", error);
			updateVersionSelector();
			return renderChangelog(localChangelogMd);
		}
	}

	function renderChangelog(text) {
		const md = markdownIt({ html: true, linkify: true });
		const REPO_URL = config.GITHUB_URL;
		const ownerRepo = REPO_URL.replace("https://github.com/", "");
		let processedText = text
			// Convert full PR URLs (any repo spelling) to short linked #numbers
			.replace(
				new RegExp(
					`https:\\/\\/github\\.com\\/(?:${ownerRepo.replace("/", "\\/")}|XCoder-Foundation\\/XCoder)\\/pull\\/(\\d+)`,
					"g",
				),
				`[#$1](${REPO_URL}/pull/$1)`,
			)
			// Convert existing #number references to links if they aren't already
			.replace(/#(?<!\[#)(\d+)(?!\])/g, `[#$1](${REPO_URL}/pull/$1)`)
			// Convert @username mentions to GitHub profile links
			.replace(/@(\w+)/g, "[@$1](https://github.com/$1)");

		md.use(markdownItTaskLists);
		md.use(markdownItFootnote);
		const renderedHtml = md.render(processedText);
		body.innerHTML = DOMPurify.sanitize(renderedHtml);
	}

	function updateVersionSelector() {
		versionTextRef.textContent = selectedVersion;
		versionIndicatorRef.className = "status-indicator status-" + selectedStatus;
	}

	async function menuClickHandler(e) {
		const action = e.target.closest("li")?.getAttribute("action");
		if (!action) return;
		versionSelectorMenu.hide();

		switch (action) {
			case "current":
				await loadVersionChangelog();
				break;
			case "latest":
				await loadLatestRelease();
				break;
			case "beta":
				await loadBetaRelease();
				break;
			case "full":
				await loadFullChangelog();
				break;
		}
	}
}
