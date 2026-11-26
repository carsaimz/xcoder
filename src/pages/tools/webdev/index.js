import { openToolPage } from "../toolPage";
import devtoolsApp from "sidebarApps/devtools";

/**
 * Web Dev tools page — the shadow/gradient/card/JSON/... generators
 * previously living directly in the sidebar now open as an independent
 * full-screen page inside the «Ferramentas» hub (v1.8.45, user request:
 * «mover as ferramentas de desenvolvimento para dentro desta seção»).
 * The generator UI is unchanged and still lives in
 * sidebarApps/devtools (buildToolPicker + panels); this module only
 * hosts it in the reliable page shell. The old sidebar tuple stays
 * exported so the activation tests keep exercising the real UI.
 */

const [, , , buildDevtools] = devtoolsApp;

/**
 * Opens the web dev generators as an independent full-screen page.
 * @returns {HTMLElement} the page element (connected to the document)
 */
export function openWebdevPage() {
	return openToolPage({
		id: "webdev-page",
		titleKey: "dev tools",
		title: "Dev Tools",
		className: "devtools-app",
		build: buildDevtools,
	});
}
