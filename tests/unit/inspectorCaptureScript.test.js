import { describe, expect, it } from "vitest";
import { BODY_CAPTURE_LIMIT, CAPTURE_SCRIPT } from "../../src/lib/webInspector";

describe("inspector CAPTURE_SCRIPT", () => {
        it("is syntactically valid JavaScript", () => {
                expect(() => {
                        // parses (does NOT execute) the injected script — a broken template
                        // literal or stray backtick would otherwise only explode on device
                        new Function(CAPTURE_SCRIPT);
                }).not.toThrow();
        });

        it("carries the body capture limit and every command", () => {
                expect(CAPTURE_SCRIPT).toContain(String(BODY_CAPTURE_LIMIT));
                for (const cmd of [
                        "getTree",
                        "inspect",
                        "highlight",
                        "searchDom",
                        "searchText",
                        "setPickMode",
                        "setAttr",
                        "deleteNode",
                        "setOuterHTML",
                        "picked",
                ]) {
                        expect(CAPTURE_SCRIPT).toContain(`"${cmd}"`);
                }
        });

        it("does not terminate the template early (no raw backticks inside)", () => {
                const script = CAPTURE_SCRIPT.trim();
                expect(script.startsWith("(function()")).toBe(true);
                expect(script.endsWith("})();")).toBe(true);
                expect(CAPTURE_SCRIPT).not.toContain("window.__xcoderInspector2");
        });
});
