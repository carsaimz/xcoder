// @vitest-environment happy-dom
/**
 * "sidebar is not defined" regression guard.
 *
 * The in-app console (page context via window.eval), plugins and any user
 * script evaluate against window globals. The sidebar element used to be a
 * closure-local const inside main.js, so ANY user code referencing
 * `sidebar` (or the Acode-style `$sidebar`) threw
 * "ReferenceError: sidebar is not defined".
 *
 * main.js now exposes:
 *   - window.sidebar     → static Sidebar API (show/hide/toggle/on/off/el)
 *   - window.$sidebar    → the live sidebar element
 *   - window.sidebarApps → the sidebar app registry
 *
 * These tests pin the API surface that the global promises.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "vitest";
import tag from "html-tag-js";

// --- app bootstrap globals the component expects --------------------------
window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
// main.js sets window.root and window.editorManager during boot; the
// component's setWidth()/onshow() touch them through bare identifiers.
window.root = document.createElement("div");
window.editorManager = null;

const Sidebar = (await import("components/sidebar")).default;

describe("sidebar global API (window.sidebar)", () => {
        test("static API exposes show/hide/toggle/on/off + el getter", () => {
                for (const method of ["show", "hide", "toggle", "on", "off"]) {
                        assert.equal(typeof Sidebar[method], "function", `Sidebar.${method}`);
                }
                assert.ok("el" in Sidebar, "Sidebar.el getter must exist");
        });

        test("creating the sidebar yields a singleton with element helpers", () => {
                const el = Sidebar({ container: window.app });
                assert.equal(Sidebar.el, el, "Sidebar.el must return the live instance");
                for (const method of ["show", "hide", "toggle", "getWidth"]) {
                        assert.equal(typeof el[method], "function", `el.${method}`);
                }
                // singleton — second creation returns the same element
                assert.equal(Sidebar({ container: window.app }), el);
        });

        test("show/hide/toggle cycle works without throwing (tab mode)", () => {
                const el = Sidebar.el;
                el.show();
                assert.ok(el.activated, "el.activated after show()");
                el.hide(true);
                assert.ok(!el.activated, "!el.activated after hide(true)");
                Sidebar.toggle();
                assert.ok(el.activated, "Sidebar.toggle() shows");
                Sidebar.toggle();
                assert.ok(!el.activated, "Sidebar.toggle() hides");
        });

        test("Sidebar.on('show') listeners fire exactly once per show", () => {
                let called = 0;
                const cb = () => called++;
                Sidebar.on("show", cb);
                Sidebar.show();
                Sidebar.off("show", cb);
                Sidebar.show();
                assert.equal(called, 1, "listener fired once, then was removed");
        });

        test("main.js exposes window.sidebar / window.$sidebar / window.sidebarApps", () => {
                const source = fs.readFileSync(
                        path.resolve(process.cwd(), "src/main.js"),
                        "utf8",
                );
                assert.match(source, /window\.sidebar\s*=\s*Sidebar\b/);
                assert.match(source, /window\.\$sidebar\s*=\s*\$sidebar\b/);
                assert.match(source, /window\.sidebarApps\s*=\s*sidebarApps\b/);
        });
});
