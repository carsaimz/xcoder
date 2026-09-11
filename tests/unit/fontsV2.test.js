// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let fonts;

beforeEach(async () => {
        vi.resetModules();
        localStorage.clear();
        document.head.innerHTML = "";
        // loader dialogs need the app root global in happy-dom
        if (!globalThis.app) {
                globalThis.app = document.createElement("div");
        }
        document.body.append(globalThis.app);
        fonts = (await import("lib/fonts")).default;
});

afterEach(() => {
        vi.restoreAllMocks();
});

describe("editor font weight (Fontes v2)", () => {
        it("injects the weight rule into the editor font style", async () => {
                fonts.add("TestFont", "@font-face { font-family: 'TestFont'; src: local('X'); }");
                await fonts.setEditorFont("TestFont", 700);
                const $style = document.querySelector("style#editor-font-style");
                expect($style).toBeTruthy();
                expect($style.textContent).toContain('font-family: "TestFont"');
                expect($style.textContent).toContain("font-weight: 700 !important;");
        });

        it("omits the weight rule when no weight is given", async () => {
                fonts.add("TestFont2", "@font-face { font-family: 'TestFont2'; src: local('X'); }");
                await fonts.setEditorFont("TestFont2");
                const $style = document.querySelector("style#editor-font-style");
                expect($style.textContent).not.toContain("font-weight:");
        });

        it("rejects out-of-range weights", async () => {
                fonts.add("TestFont3", "@font-face { font-family: 'TestFont3'; src: local('X'); }");
                await fonts.setEditorFont("TestFont3", 12345);
                const $style = document.querySelector("style#editor-font-style");
                expect($style.textContent).not.toContain("font-weight: 12345");
        });
});

describe("font manager preview (source-level guard)", () => {
        it("renders a live preview in each FontItem row", async () => {
                const src = await import("node:fs").then((fs) =>
                        fs.promises.readFile("src/pages/fontManager/fontManager.js", "utf8"),
                );
                expect(src).toContain("font-manager-preview");
                expect(src).toContain("font preview sample");
                // the preview must preload the font so the preview is accurate
                expect(src).toContain("fonts.loadFont(name)");
        });
});

describe("editor manager weight wiring (source-level guard)", () => {
        it("font theme + compartment include editorFontWeight", async () => {
                const src = await import("node:fs").then((fs) =>
                        fs.promises.readFile("src/lib/editorManager.js", "utf8"),
                );
                expect(src).toContain('"fontSize", "editorFont", "editorFontWeight", "lineHeight"');
                expect(src).toContain('fontWeight');
                expect(src).toContain('appSettings.on("update:editorFontWeight"');
        });

        it("settings default ships editorFontWeight 400", async () => {
                const src = await import("node:fs").then((fs) =>
                        fs.promises.readFile("src/lib/settings.js", "utf8"),
                );
                expect(src).toContain("editorFontWeight: 400");
        });
});
