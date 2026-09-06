// @vitest-environment happy-dom
/**
 * Roadmap v1.5.x item 3 — persistent tab history.
 *
 * Back/forward navigation (v1.4.22) used to die with the app process.
 * The stack now round-trips through localStorage as plain file ids:
 *   - saveState writes `localStorage.tabHistory` via serializeEditorHistory;
 *   - main.js rehydrates it through editorManager.restoreEditorHistory
 *     BEFORE the first save-state (which would otherwise wipe it).
 *
 * The pure helpers are tested directly, saveState is tested through a
 * fake editorManager global, and the wiring is guarded by source checks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("cm/editorUtils", () => ({
        getAllFolds: vi.fn(() => []),
        getScrollPosition: vi.fn(() => ({ scrollTop: 0, scrollLeft: 0 })),
        getSelection: vi.fn(() => ({
                ranges: [{ from: 0, to: 0 }],
                mainIndex: 0,
        })),
}));
vi.mock("lib/config", () => ({
        default: { DEFAULT_FILE_SESSION: "default-session" },
}));
vi.mock("lib/openFolder", () => ({
        default: vi.fn(),
        addedFolder: [],
}));
vi.mock("lib/settings", () => ({
        default: {
                value: {
                        rememberFiles: true,
                        rememberFolders: false,
                },
        },
}));

import saveState from "lib/saveState";
import {
        deserializeEditorHistory,
        MAX_EDITOR_HISTORY,
        serializeEditorHistory,
} from "lib/editorHistoryState";

beforeEach(() => {
        localStorage.clear();
});

describe("serializeEditorHistory", () => {
        test("returns an empty snapshot for empty/invalid input", () => {
                assert.deepEqual(serializeEditorHistory(undefined, -1), { ids: [], index: -1 });
                assert.deepEqual(serializeEditorHistory([], 0), { ids: [], index: -1 });
                assert.deepEqual(serializeEditorHistory([{}, {}], 0), { ids: [], index: -1 });
        });

        test("maps live files to ids keeping the cursor position", () => {
                const stack = [{ id: "a" }, { id: "b" }, { id: "c" }];
                assert.deepEqual(serializeEditorHistory(stack, 1), {
                        ids: ["a", "b", "c"],
                        index: 1,
                });
        });

        test("drops id-less entries and follows the cursor through compaction", () => {
                const stack = [{ id: "a" }, {}, { id: "c" }];
                assert.deepEqual(serializeEditorHistory(stack, 2), { ids: ["a", "c"], index: 1 });
                // cursor sitting on an id-less entry falls back to the newest id
                assert.deepEqual(serializeEditorHistory(stack, 1), { ids: ["a", "c"], index: 1 });
        });
});

describe("deserializeEditorHistory", () => {
        test("returns an empty stack when nothing resolves", () => {
                assert.deepEqual(deserializeEditorHistory(null, () => null), {
                        stack: [],
                        index: -1,
                });
                assert.deepEqual(
                        deserializeEditorHistory({ ids: ["gone"], index: 0 }, () => null),
                        { stack: [], index: -1 },
                );
        });

        test("resolves ids to live files and keeps the recorded cursor", () => {
                const fileA = { id: "a" };
                const fileB = { id: "b" };
                const resolve = (id) => (id === "a" ? fileA : id === "b" ? fileB : null);
                const state = deserializeEditorHistory(
                        { ids: ["a", "b"], index: 1 },
                        resolve,
                );
                assert.deepEqual(state, { stack: [fileA, fileB], index: 1 });
        });

        test("skips ids whose files are gone and re-pins the cursor to the same file", () => {
                const fileC = { id: "c" };
                const resolve = (id) => (id === "c" ? fileC : null);
                // "c" was active (index 2), but "a"/"b" no longer exist
                const state = deserializeEditorHistory(
                        { ids: ["a", "b", "c"], index: 2 },
                        resolve,
                );
                assert.deepEqual(state, { stack: [fileC], index: 0 });
        });

        test("falls back to the newest entry when the recorded active file is gone", () => {
                const fileA = { id: "a" };
                const fileB = { id: "b" };
                const resolve = (id) => (id === "a" ? fileA : id === "b" ? fileB : null);
                const state = deserializeEditorHistory(
                        { ids: ["a", "gone", "b"], index: 2 },
                        resolve,
                );
                // recorded active id "b" still resolves → cursor pinned to it
                assert.deepEqual(state, { stack: [fileA, fileB], index: 1 });
        });

        test("dedupes repeated ids and caps entries at MAX_EDITOR_HISTORY", () => {
                const resolve = (id) => ({ id });
                const deduped = deserializeEditorHistory(
                        { ids: ["a", "b", "a"], index: 2 },
                        resolve,
                );
                assert.equal(deduped.stack.length, 2);
                assert.equal(deduped.index, 0); // second "a" resolved to the first entry

                const ids = Array.from({ length: MAX_EDITOR_HISTORY + 10 }, (_, i) => `f${i}`);
                const capped = deserializeEditorHistory({ ids, index: ids.length - 1 }, resolve);
                assert.equal(capped.stack.length, MAX_EDITOR_HISTORY);
        });
});

describe("saveState persists tabHistory", () => {
        test("writes the history snapshot alongside files/folders", () => {
                window.editorManager = {
                        editor: {},
                        files: [],
                        activeFile: null,
                        editorHistory: [{ id: "a" }, { id: "b" }, { id: "c" }],
                        editorHistoryIndex: 2,
                };

                saveState();

                assert.deepEqual(JSON.parse(localStorage.getItem("tabHistory")), {
                        ids: ["a", "b", "c"],
                        index: 2,
                });
        });

        test("writes an empty snapshot when the manager has no history", () => {
                window.editorManager = {
                        editor: {},
                        files: [],
                        activeFile: null,
                        editorHistory: [],
                        editorHistoryIndex: -1,
                };

                saveState();

                assert.deepEqual(JSON.parse(localStorage.getItem("tabHistory")), {
                        ids: [],
                        index: -1,
                });
        });
});

describe("wiring", () => {
        test("editorManager defines restoreEditorHistory and exposes it", () => {
                const managerSource = fs.readFileSync(
                        path.resolve(process.cwd(), "src/lib/editorManager.js"),
                        "utf8",
                );
                assert.match(managerSource, /function restoreEditorHistory\(state\)/);
                assert.match(managerSource, /restoreEditorHistory,/);
                assert.match(managerSource, /deserializeEditorHistory\(/);
        });

        test("main.js rehydrates the history before the first save-state", () => {
                const mainSource = fs.readFileSync(
                        path.resolve(process.cwd(), "src/main.js"),
                        "utf8",
                );
                const filesRestoredAt = mainSource.indexOf(
                        'sessionStorage.setItem("isfilesRestored", true)',
                );
                const restoreAt = mainSource.indexOf("editorManager.restoreEditorHistory");
                // the boot's first save-state AFTER rehydration (an earlier
                // `onCloseApp` handler reference exists outside the boot path)
                const saveAt = mainSource.indexOf('xcoder.exec("save-state")', restoreAt);
                assert.ok(filesRestoredAt > -1, "boot must mark isfilesRestored");
                assert.ok(restoreAt > -1, "main.js must call editorManager.restoreEditorHistory");
                assert.ok(saveAt > -1, "boot must call save-state after restore");
                assert.ok(
                        filesRestoredAt < restoreAt,
                        "history rehydration must run AFTER the files are restored",
                );
                assert.ok(
                        restoreAt < saveAt,
                        "history rehydration must run BEFORE the first save-state",
                );
        });
});

// sanity: vitest expect is available for future authors; keep the import used
void expect;
