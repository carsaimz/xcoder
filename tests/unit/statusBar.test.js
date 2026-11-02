// @vitest-environment happy-dom
/**
 * VS Code-style status bar — shows real editor facts (Ln/Col, indent,
 * encoding, language mode) only while an editor file is open, and hides
 * itself for welcome/terminal/preview tabs.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EditorState } from "@codemirror/state";

vi.mock("lib/settings", () => ({
        default: {
                value: { softTab: true, tabSize: 4 },
                on: () => {},
                get: () => ({}),
        },
}));
vi.mock("lib/logger", () => ({
        default: { log: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}));

import tag from "html-tag-js";

if (!("get" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "get", {
                value(selector) {
                        return this.querySelector(selector);
                },
                configurable: true,
                writable: true,
        });
}

window.tag = tag;
window.app = document.createElement("div");
document.body.append(window.app);
window.strings = {
        "status bar line": "Ln",
        "status bar column": "Col",
        "status bar spaces": "Spaces",
        "status bar tab size": "Tab Size",
};
globalThis.strings = window.strings;
globalThis.xcoder = { exec: vi.fn() };

import getStatusBar from "../../src/components/statusBar/index.js";

/** Debounce used by the bar for manager/selection updates. */
const DEBOUNCE_MS = 200;

/** Builds a manager-like object with a real CodeMirror state. */
function fakeManager({ doc = "const a = 1;\nlet b = 2;\n", fileType = "editor" } = {}) {
        const state = EditorState.create({ doc });
        return {
                activeFile:
                        fileType === "editor"
                                ? {
                                                type: "editor",
                                                uri: "file:///project/index.js",
                                                filename: "index.js",
                                                encoding: "utf-8",
                                        }
                                : { type: fileType },
                editor: {
                        state,
                        dispatch: () => {},
                },
                handlers: {},
                on(types, callback) {
                        for (const type of [].concat(types)) {
                                this.handlers[type] = this.handlers[type] || [];
                                this.handlers[type].push(callback);
                        }
                },
                emit(type) {
                        (this.handlers[type] || []).forEach((callback) => callback());
                },
        };
}

async function settle() {
        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
}

describe("status bar", () => {
        const $bar = getStatusBar();
        // main.js appends the bar to the root — mirror that here
        document.body.append($bar);

        beforeEach(() => {
                window.editorManager = null;
        });

        it("starts hidden with no editor ready", async () => {
                await settle();
                expect($bar.isConnected).toBe(true);
                expect($bar.classList.contains("show")).toBe(false);
        });

        it("shows cursor, indent, encoding and mode for an open file", async () => {
                window.editorManager = fakeManager();
                document.dispatchEvent(new Event("selectionchange"));
                await settle();

                expect($bar.classList.contains("show")).toBe(true);
                expect($bar.textContent).toContain("Ln 1, Col 1");
                expect($bar.textContent).toContain("Spaces: 4");
                expect($bar.textContent).toContain("UTF-8");
                expect(
                        $bar.textContent.trim().length,
                        "mode name missing",
                ).toBeGreaterThan(0);
        });

        it("keeps diagnostics hidden when there is nothing to report", async () => {
                window.editorManager = fakeManager();
                document.dispatchEvent(new Event("selectionchange"));
                await settle();

                const $diagnostics = $bar.get(".statusbar-diagnostics");
                expect($diagnostics.classList.contains("show")).toBe(false);
        });

        it("hides again when the active tab is not an editor", async () => {
                const manager = fakeManager({ fileType: "terminal" });
                window.editorManager = manager;
                document.dispatchEvent(new Event("selectionchange"));
                await settle();

                expect($bar.classList.contains("show")).toBe(false);
        });

        it("re-renders on switch-file with the new file facts", async () => {
                const manager = fakeManager();
                window.editorManager = manager;
                document.dispatchEvent(new Event("selectionchange"));
                await settle();

                manager.activeFile = {
                        type: "editor",
                        uri: "file:///project/style.css",
                        filename: "style.css",
                        encoding: "iso-8859-1",
                };
                document.dispatchEvent(new Event("selectionchange"));
                await settle();

                expect($bar.classList.contains("show")).toBe(true);
                expect($bar.textContent).toContain("ISO-8859-1");
        });
});
