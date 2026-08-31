import settingsPage from "components/settingsPage";
import config from "lib/config";

export default function help() {
	const title = strings.help;
	const items = [
		{
			key: "docs",
			text: strings.documentation,
			link: config.DOCS_URL,
			chevron: true,
		},
		{
			key: "changelog",
			text: strings.changelog,
			link: `${config.GITHUB_URL}/blob/main/CHANGELOG.md`,
			chevron: true,
		},
		{
			key: "bug_report",
			text: strings.bug_report,
			link: `${config.GITHUB_URL}/issues`,
			chevron: true,
		},
	];

	const page = settingsPage(title, items, () => {}, "separate", {
		preserveOrder: true,
		pageClassName: "detail-settings-page",
		listClassName: "detail-settings-list",
		groupByDefault: true,
	});
	page.show();
}
