import { describe, expect, it } from "vitest";
// register the CM language modes (side-effect import) so the languageIds
// association path resolves just like in the app
import "cm/supportedModes";
import fileIcons from "lib/fileIcons";
import {
        createVscodeIconsTheme,
        VSCODE_ICONS_THEME_ID,
} from "lib/fileIconsVscode";
import { VSCODE_ICONS } from "lib/fileIconsVscodeData";

describe("vscode-icons — bundled VS Code file icon theme", () => {
        it("registers and activates the full official theme", () => {
                const registered = fileIcons.register(createVscodeIconsTheme());
                expect(typeof registered.dispose).toBe("function");
                const active = fileIcons.use(VSCODE_ICONS_THEME_ID, { persist: false });
                expect(active.id).toBe(VSCODE_ICONS_THEME_ID);
                expect(active.available).toBe(true);
        });

        it("resolves common files to colored vscode-icons", () => {
                fileIcons.use(VSCODE_ICONS_THEME_ID, { persist: false });

                const pkg = fileIcons.resolve({ kind: "file", name: "package.json" });
                expect(pkg.themeId).toBe(VSCODE_ICONS_THEME_ID);
                expect(pkg.iconId).toBe("_f_npm");

                const ts = fileIcons.resolve({ kind: "file", name: "app.ts" });
                expect(ts.iconId).toBe("_f_typescript");

                const rs = fileIcons.resolve({ kind: "file", name: "main.rs" });
                expect(rs.iconId).toBe("_f_rust");

                const md = fileIcons.resolve({ kind: "file", name: "README.md" });
                expect(md.iconId).toBe("_f_markdown");

                const folder = fileIcons.resolve({
                        kind: "folder",
                        name: "minha-pasta",
                        expanded: false,
                });
                expect(folder.iconId).toBe("_folder");

                const folderOpen = fileIcons.resolve({
                        kind: "folder",
                        name: "minha-pasta",
                        expanded: true,
                });
                expect(folderOpen.iconId).toBe("_folder_open");

                // folders with dedicated vscode-icons art (e.g. src) get their icon
                const src = fileIcons.resolve({ kind: "folder", name: "src" });
                expect(src.iconId).toBe("_fd_src");
        });

        it("falls back to the default file icon for unknown names", () => {
                fileIcons.use(VSCODE_ICONS_THEME_ID, { persist: false });
                const unknown = fileIcons.resolve({
                        kind: "file",
                        name: "definitely-not-a-known-ext.xcunknown",
                });
                expect(unknown.iconId).toBe(VSCODE_ICONS.defaults.file);
        });

        it("ships every icon as an offline data URI", () => {
                const entries = Object.entries(VSCODE_ICONS.icons);
                expect(entries.length).toBeGreaterThan(700);
                for (const [id, uri] of entries) {
                        expect(
                                uri.startsWith("data:image/svg+xml,"),
                                `icon ${id} must be a data URI`,
                        ).toBe(true);
                }
        });

        it("keeps associations lowercase and conflict-free", () => {
                for (const field of [
                        "fileNames",
                        "fileExtensions",
                        "languageIds",
                        "folderNames",
                        "folderNamesExpanded",
                ]) {
                        const keys = Object.keys(VSCODE_ICONS[field]);
                        const lowered = new Set(keys.map((k) => k.toLowerCase()));
                        expect(lowered.size, field).toBe(keys.length);
                        for (const key of keys) {
                                const value = VSCODE_ICONS[field][key];
                                expect(VSCODE_ICONS.icons[value], `${field}: ${key}`).toBeTruthy();
                        }
                }
        });
});
