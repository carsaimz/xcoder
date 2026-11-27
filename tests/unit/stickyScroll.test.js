import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxTree } from "@codemirror/language";
import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { collectStickyHeaders, MAX_STICKY_ROWS } from "../../src/cm/stickyScroll";

/** Parses code with the JS parser and computes sticky headers at a pos. */
function headersFor(code, pos) {
        const state = EditorState.create({
                doc: Text.of(code.split("\n")),
                extensions: [javascript()],
        });
        return collectStickyHeaders(syntaxTree(state), state.doc, pos);
}

const CODE = [
        "class Widget {", // 1
        "  setup() {", // 2
        "    const render = () => {", // 3
        "      if (dirty) {", // 4
        "        flush();", // 5
        "      }", // 6
        "    };", // 7
        "  }", // 8
        "}", // 9
].join("\n");

describe("sticky scroll — collectStickyHeaders", () => {
        it("returns an empty chain at the very top of the document", () => {
                expect(headersFor(CODE, 0)).toEqual([]);
        });

        it("pins the enclosing scopes when the viewport top is deep", () => {
                // pos inside flush() (line 5): class → method → arrow function →
                // if statement are all open above; the chain is capped at 3 rows
                // keeping the INNERMOST scopes (VS Code drops the outermost first)
                const lines = CODE.split("\n");
                let pos = 0;
                for (let i = 0; i < 4; i++) pos += lines[i].length + 1; // start of line 5
                const headers = headersFor(CODE, pos);
                expect(headers.length).toBe(MAX_STICKY_ROWS);
                expect(headers).toEqual([2, 3, 4]);
        });

        it("returns the chain ordered outermost → innermost", () => {
                const lines = CODE.split("\n");
                let pos = 0;
                for (let i = 0; i < 2; i++) pos += lines[i].length + 1; // start of line 3
                const headers = headersFor(CODE, pos);
                expect(headers).toEqual([1, 2]);
        });

        it("never includes a header on or below the top visible line", () => {
                const lines = CODE.split("\n");
                let pos = 0;
                for (let i = 0; i < 1; i++) pos += lines[i].length + 1; // top = line 2
                const headers = headersFor(CODE, pos);
                for (const line of headers) expect(line).toBeLessThan(2);
        });

        it("rejects non-Text docs and non-positive positions", () => {
                const state = EditorState.create({
                        doc: Text.of(["x"]),
                        extensions: [javascript()],
                });
                expect(collectStickyHeaders(null, state.doc, 0)).toEqual([]);
                expect(collectStickyHeaders(syntaxTree(state), state.doc, -1)).toEqual(
                        [],
                );
                expect(collectStickyHeaders(syntaxTree(state), state.doc, 0)).toEqual(
                        [],
                );
        });
});
