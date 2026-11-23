/**
 * VS Code Icons — bundled file icon theme.
 *
 * Full official vscode-icons set (843 icons, MIT), generated into
 * `fileIconsVscodeData.ts` by `scripts/gen_vscode_icons.py`. Registered by
 * the core (no plugin needed) and selected as the default icon pack so the
 * file browser, editor tabs, quick open and dialogs all look like VS Code.
 */
import type { FileIconTheme } from "./fileIcons";
import { VSCODE_ICONS, VSCODE_ICONS_VERSION } from "./fileIconsVscodeData";

export const VSCODE_ICONS_THEME_ID = "vscode-icons";

/** Core-owned theme id used for themes registered outside the plugin loader. */
const CORE_OWNER = "xcoder-core";

export function createVscodeIconsTheme(): FileIconTheme {
	const icons: Record<string, { src: string }> = {};
	for (const [id, uri] of Object.entries(VSCODE_ICONS.icons)) {
		icons[id] = { src: uri };
	}

	return {
		id: VSCODE_ICONS_THEME_ID,
		name: `VS Code Icons (${VSCODE_ICONS_VERSION})`,
		schemaVersion: 1,
		pluginId: CORE_OWNER,
		icons,
		fileNames: { ...VSCODE_ICONS.fileNames },
		fileExtensions: { ...VSCODE_ICONS.fileExtensions },
		languageIds: { ...VSCODE_ICONS.languageIds },
		folderNames: { ...VSCODE_ICONS.folderNames },
		folderNamesExpanded: { ...VSCODE_ICONS.folderNamesExpanded },
		file: VSCODE_ICONS.defaults.file,
		folder: VSCODE_ICONS.defaults.folder,
		folderExpanded: VSCODE_ICONS.defaults.folderExpanded,
		rootFolder: VSCODE_ICONS.defaults.rootFolder,
		rootFolderExpanded: VSCODE_ICONS.defaults.rootFolderExpanded,
	};
}

export default createVscodeIconsTheme;
