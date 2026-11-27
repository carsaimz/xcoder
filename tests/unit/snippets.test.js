// @vitest-environment happy-dom

/**
 * User snippets (VS Code format) — parser + language matching.
 *
 * The completion source and UI entry points are wired through
 * editorManager/commands; these tests cover the pure logic: the VS Code
 * JSON schema (object form, array body, multi-prefix, scoped
 * .code-snippets files) and the language alias matching.
 */
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
        snippetsCompletionSource,
        snippetsCompletions,
} from "cm/snippets";
import { matchLanguage, parseSnippetFile } from "cm/snippetParser";

const basicFile = JSON.stringify({
        "For Loop": {
                prefix: ["for", "forl"],
                body: ["for (let ${1:i} = 0; $1 < ${2:array}.length; $1++) {", "\t$0", "}"],
                description: "For loop",
        },
        Log: {
                prefix: "log",
                body: "console.log('$1');",
        },
        Empty: {
                prefix: "nope",
        },
});

describe("snippets — parseSnippetFile", () => {
        it("parses prefixes (string or array) and joins array bodies", () => {
                const snippets = parseSnippetFile(basicFile, "javascript.json");
                expect(snippets).toHaveLength(2);
                const loop = snippets.find((s) => s.name === "For Loop");
                expect(loop.prefixes).toEqual(["for", "forl"]);
                expect(loop.body).toContain("\t$0");
                expect(loop.description).toBe("For loop");
                const log = snippets.find((s) => s.name === "Log");
                expect(log.prefixes).toEqual(["log"]);
                expect(log.body).toBe("console.log('$1');");
        });

        it("skips entries without usable prefix or body", () => {
                const snippets = parseSnippetFile(basicFile, "javascript.json");
                expect(snippets.find((s) => s.name === "Empty")).toBeUndefined();
        });

        it("returns [] for invalid JSON", () => {
                expect(parseSnippetFile("{oops", "x.json")).toEqual([]);
                expect(parseSnippetFile("null", "x.json")).toEqual([]);
        });

        it("reads scope from .code-snippets files", () => {
                const scoped = JSON.stringify({
                        scope: "javascript,html",
                        Log: { prefix: "log", body: "console.log($1);" },
                });
                const snippets = parseSnippetFile(scoped, "mine.code-snippets");
                expect(snippets).toHaveLength(1);
                expect(snippets[0].languages).toEqual(["javascript", "html"]);
        });

        it("treats scope in a plain .json file as a normal snippet entry", () => {
                const weird = JSON.stringify({
                        scope: { prefix: "scope", body: "x" },
                });
                const snippets = parseSnippetFile(weird, "global.json");
                expect(snippets).toHaveLength(1);
                expect(snippets[0].languages).toBeNull();
        });
});

describe("snippets — matchLanguage", () => {
        it("matches mode to its own id", () => {
                expect(matchLanguage("javascript", "javascript")).toBe(true);
        });

        it("is case-insensitive", () => {
                expect(matchLanguage("JavaScript", "JavaScript")).toBe(true);
        });

        it("matches known aliases in both directions", () => {
                expect(matchLanguage("javascript", "js")).toBe(true);
                expect(matchLanguage("python", "py")).toBe(true);
                expect(matchLanguage("shellscript", "bash")).toBe(true);
                expect(matchLanguage("yaml", "yml")).toBe(true);
        });

        it("rejects unrelated languages", () => {
                expect(matchLanguage("javascript", "python")).toBe(false);
                expect(matchLanguage("html", "js")).toBe(false);
        });

        it("rejects empty ids", () => {
                expect(matchLanguage("javascript", "")).toBe(false);
                expect(matchLanguage("", "javascript")).toBe(false);
        });
});

describe("snippets — completion extension wiring", () => {
        it("snippetsCompletions() is a valid extension, not a raw source", () => {
                const ext = snippetsCompletions();
                // regression: the old API returned the bare completion-source
                // function, which CodeMirror rejects with «Unrecognized
                // extension value in extension set» the moment an editor opens
                expect(typeof ext).not.toBe("function");
                expect(() =>
                        EditorState.create({ extensions: [ext] }),
                ).not.toThrow();
        });

        it("reaches the snippet source through the language-data facet", () => {
                const state = EditorState.create({
                        extensions: [snippetsCompletions()],
                });
                const sources = state.languageDataAt("autocomplete", 0);
                expect(sources).toContain(snippetsCompletionSource);
        });

        it("raw snippet source stays usable inside autocompletion override", async () => {
                // the override path (settings › languageCompletion off) passes
                // bare functions to autocompletion({override}) — a function is
                // exactly what that API expects
                expect(typeof snippetsCompletionSource).toBe("function");
                const result = await snippetsCompletionSource({
                        matchBefore: () => null,
                });
                expect(result).toBe(null);
        });
});
