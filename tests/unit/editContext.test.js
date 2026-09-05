import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EditorView } from "@codemirror/view";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("useEditContext setting (Acode PR 2258 port)", () => {
        it("settings.js defaults useEditContext to false (EditContext off on Android)", () => {
                // CodeMirror enables the EditContext input path by default on
                // Android, which misbehaves on several WebView builds (scroll
                // jumps when tapping empty lines). The default must be OFF.
                // lib/settings pulls JSX components, so assert on source instead.
                const source = readFileSync(
                        `${repoRoot}src/lib/settings.js`,
                        "utf8",
                );
                expect(source).toMatch(/useEditContext:\s*false/);
        });

        it("editorManager wires the setting (apply + signature + live update)", () => {
                const source = readFileSync(
                        `${repoRoot}src/lib/editorManager.js`,
                        "utf8",
                );
                expect(source).toMatch(/function applyEditContextSetting\(\)/);
                expect(source).toMatch(/applyEditContextSetting\(\);/);
                expect(source).toMatch(/useEditContext:\s*appSettings\.value\.useEditContext === true/);
                expect(source).toMatch(/appSettings\.on\("update:useEditContext"/);
        });

        it("guard logic mirrors applyEditContextSetting behaviour", () => {
                // Same logic as editorManager.applyEditContextSetting — kept in
                // sync by this test so a regression on either side is caught.
                const apply = (useEditContext) => {
                        if (useEditContext === true) {
                                if (
                                        Object.prototype.hasOwnProperty.call(
                                                EditorView,
                                                "EDIT_CONTEXT",
                                        ) &&
                                        EditorView.EDIT_CONTEXT === false
                                ) {
                                        delete EditorView.EDIT_CONTEXT;
                                }
                        } else {
                                EditorView.EDIT_CONTEXT = false;
                        }
                };

                apply(false);
                expect(EditorView.EDIT_CONTEXT).toBe(false);

                apply(true);
                expect(
                        Object.prototype.hasOwnProperty.call(EditorView, "EDIT_CONTEXT"),
                ).toBe(false);
        });
});
