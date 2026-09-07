// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { filterModelItems, providerLogoEl } from "components/modelPicker/utils";

/**
 * Roadmap v1.6.x item 5 — model picker with brand logos:
 *  - the AI chat uses the new searchable picker (components/modelPicker)
 *    instead of the text-only native select;
 *  - rows show real brand logos, free/paid badges and the current model;
 *  - search filters rows and hides empty provider groups;
 *  - the dialog follows the select pattern (actionStack + mask) so the
 *    back button closes it like every other dialog.
 *
 * The pure helpers come from components/modelPicker/utils (import-free,
 * so no boot side effects in the test environment); the dialog wiring is
 * guarded at source level.
 */

const read = (p) => readFileSync(join(process.cwd(), p), "utf8");

const FIXTURE = [
        { header: true, providerId: "google", text: "Google" },
        { value: "gemini-2.5-flash", text: "gemini-2.5-flash" },
        { value: "gemini-2.5-pro", text: "gemini-2.5-pro" },
        { header: true, providerId: "groq", text: "Groq" },
        { value: "llama-3.3-70b", text: "llama-3.3-70b" },
];

describe("modelPicker: filterModelItems", () => {
        it("shows everything on an empty query", () => {
                const visible = filterModelItems(FIXTURE, "");
                expect([...visible].sort()).toEqual([0, 1, 2, 3, 4]);
        });

        it("matches rows case-insensitively and keeps their group header", () => {
                const visible = filterModelItems(FIXTURE, "GEMINI");
                expect([...visible].sort()).toEqual([0, 1, 2]);
        });

        it("trims the query", () => {
                const visible = filterModelItems(FIXTURE, "  flash  ");
                expect([...visible].sort()).toEqual([0, 1]);
        });

        it("hides group headers with no matching rows", () => {
                const visible = filterModelItems(FIXTURE, "llama");
                expect([...visible].sort()).toEqual([3, 4]);
                expect(visible.has(0)).toBe(false);
        });

        it("never matches a header itself", () => {
                const visible = filterModelItems(FIXTURE, "groq");
                expect([...visible]).toEqual([]);
        });
});

describe("modelPicker: providerLogoEl", () => {
        it("renders the real brand SVG when available", () => {
                const $logo = providerLogoEl({
                        glyph: "✨",
                        color: "#4285f4",
                        isLetter: false,
                        svg: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M0 0"/></svg>',
                });
                expect($logo.classList.contains("mp-logo")).toBe(true);
                expect($logo.classList.contains("svg")).toBe(true);
                expect($logo.innerHTML).toContain("<svg");
                expect($logo.style.color).toBe("#4285f4");
        });

        it("renders a colored letter badge for letter glyphs", () => {
                const $logo = providerLogoEl({
                        glyph: "T",
                        color: "#0f6fff",
                        isLetter: true,
                });
                expect($logo.classList.contains("letter")).toBe(true);
                expect($logo.textContent).toBe("T");
                expect($logo.style.background).toBe("#0f6fff");
        });

        it("renders the emoji glyph for providers without brand art", () => {
                const $logo = providerLogoEl({ glyph: "🤖", color: "", isLetter: false });
                expect($logo.classList.contains("letter")).toBe(false);
                expect($logo.textContent).toBe("🤖");
        });
});

describe("modelPicker: chat wiring", () => {
        const ai = read("src/sidebarApps/ai/index.js");

        it("openModelPicker uses the new picker, not the native select", () => {
                const body = ai.slice(
                        ai.indexOf("async function openModelPicker"),
                        ai.indexOf("async function pickModelLive"),
                );
                expect(body).toContain("await modelPicker(");
                expect(body).not.toContain("await select(");
        });

        it("pickModelLive uses the new picker too", () => {
                const start = ai.indexOf("async function pickModelLive");
                // body only — the file keeps using `select` for other dialogs
                const nextFn = ai.indexOf("async function", start + 10);
                const body = ai.slice(start, nextFn);
                expect(body).toContain("await modelPicker(");
                expect(body).not.toContain("await select(");
        });

        it("keeps the fetch-live and manual-id entry points as footer actions", () => {
                const body = ai.slice(
                        ai.indexOf("async function openModelPicker"),
                        ai.indexOf("async function pickModelLive"),
                );
                expect(body).toContain('"__fetch__"');
                expect(body).toContain('"__manual__"');
        });

        it("rows carry providerId/type/selected for logos and badges", () => {
                const body = ai.slice(
                        ai.indexOf("async function openModelPicker"),
                        ai.indexOf("async function pickModelLive"),
                );
                expect(body).toContain("providerId: provider.id");
                expect(body).toContain("type: modelType(provider, model)");
                expect(body).toContain("selected: model === current");
        });

        it("imports the picker component", () => {
                expect(ai).toContain('import modelPicker from "components/modelPicker";');
        });
});

describe("modelPicker: dialog pattern", () => {
        it("uses actionStack so the back button closes it", () => {
                const src = read("src/components/modelPicker/index.js");
                expect(src).toContain('id: "model-picker"');
                expect(src).toContain('actionStack.remove("model-picker")');
                expect(src).toContain('className="mask"');
                expect(src).toContain("oninput={applyFilter}");
        });

        it("renders logos via the pure utils renderer", () => {
                const src = read("src/components/modelPicker/index.js");
                expect(src).toContain('from "./utils"');
                expect(src).toContain("logoFor(item.providerId)");
        });
});

describe("modelPicker: translations", () => {
        it("has the search placeholder in en-us and pt-br", () => {
                expect(JSON.parse(read("src/lang/en-us.json"))["ai model search"]).toBeTruthy();
                expect(JSON.parse(read("src/lang/pt-br.json"))["ai model search"]).toBeTruthy();
        });
});
