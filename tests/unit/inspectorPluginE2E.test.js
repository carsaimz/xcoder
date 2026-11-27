// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";

/**
 * End-to-end reproduction of the Inspector plugin user flow:
 *   open page -> session -> pageFinished -> Elements tree / Console / Storage
 * with the REAL capture script, the REAL engine (lib/webInspector) and the
 * REAL plugin main.js, over a faithful mock of the native XCoderWebView
 * bridge (BRIDGE_JS + document-start/end injection + evaluate dispatch).
 *
 * The "page" lives in an isolated happy-dom Window (the WebView); the plugin
 * UI runs in the test window — like the real app where the plugin page and
 * the inspected page are different documents.
 */

// Prefer the live sibling checkout of carsaimz/xcoder-plugins (fresh source
// during local development); CI only has this repo, so it falls back to the
// committed fixture snapshot.
const SIBLING_PLUGIN = resolve(process.cwd(), "../xcoder-plugins/plugins/inspector/main.js");
const FIXTURE_PLUGIN = resolve(process.cwd(), "tests/fixtures/inspector-plugin-main.js");
const PLUGIN_SRC = (existsSync(SIBLING_PLUGIN) ? SIBLING_PLUGIN : FIXTURE_PLUGIN);
const PLUGIN_CODE = readFileSync(PLUGIN_SRC, "utf8");

// ── the native JS bridge the Android side injects into every page ──
const BRIDGE_JS = `(function(){
if(window.webview&&window.webview.__xcoderBridge){return;}
var callbacks=[];
window.webview={
__xcoderBridge:true,
onMessage:function(cb){if(typeof cb==='function'){callbacks.push(cb);}},
offMessage:function(cb){callbacks=callbacks.filter(function(c){return c!==cb;});},
postMessage:function(msg){
var data=(typeof msg==='string')?msg:JSON.stringify(msg);
window.XCoderWebViewNative.postMessage(String(data));
},
_dispatch:function(msg){
callbacks.slice().forEach(function(cb){try{cb(msg);}catch(e){console.error(e);}});
}
};
})();`;

const { nativeRef } = vi.hoisted(() => ({ nativeRef: { current: null } }));

vi.mock("lib/webview", () => ({
        default: new Proxy(
                {},
                {
                        get(_t, prop) {
                                const api = nativeRef.current?.api;
                                if (!api) throw new Error("native shim not ready");
                                return api[prop];
                        },
                },
        ),
}));

function makeNativeShim() {
        const instances = new Map();
        let appMessageSink = null; // page → app delivery
        const native = { instances };
        native.XCoderWebViewNative = {
                postMessage(message) {
                        if (appMessageSink) appMessageSink(message);
                },
        };

        function injectBridge(win, userScript) {
                win.eval(BRIDGE_JS);
                if (userScript) win.eval(userScript);
        }

        native.create = function (options) {
                const id = "wv_test_" + instances.size;
                const win = new Window({ url: options?.title || "https://about.blank" });
                win.XCoderWebViewNative = native.XCoderWebViewNative;
                win.document.write("<html><head></head><body></body></html>");
                const inst = {
                        id,
                        win,
                        url: "",
                        userScript: null,
                        _messageCallbacks: [],
                        _eventCallbacks: [],
                        setInjectScript(script) {
                                inst.userScript = script;
                                injectBridge(inst.win, script); // "apply immediately", like the native side
                                return Promise.resolve();
                        },
                        evaluate(js) {
                                let value;
                                try {
                                        value = inst.win.eval(js);
                                } catch (e) {
                                        return Promise.reject(e);
                                }
                                return Promise.resolve(value === undefined ? null : value);
                        },
                        postMessage(message) {
                                // native wraps the payload in a safe string literal, then the
                                // page parses it and hands it to the bridge dispatcher
                                const raw = typeof message === "string" ? message : JSON.stringify(message);
                                const js =
                                        "(function(){var raw=" +
                                        JSON.stringify(raw) +
                                        ";var msg;try{msg=JSON.parse(raw);}catch(e){msg=raw;}" +
                                        "if(window.webview&&window.webview._dispatch){window.webview._dispatch(msg);}})()";
                                try {
                                        inst.win.eval(js);
                                } catch (e) {
                                        return Promise.reject(e);
                                }
                                return Promise.resolve();
                        },
                        loadURL(url) {
                                inst.url = url;
                                // Android: every navigation creates a FRESH JS context — simulate
                                // it with a brand-new Window so guards behave like the device.
                                const win = new Window({ url });
                                win.XCoderWebViewNative = native.XCoderWebViewNative;
                                inst.win = win;
                                // simulate a navigation: fresh document, then the native
                                // onPageStarted → onPageFinished injection sequence
                                win.document.write(
                                        `<html><head><title>t</title></head><body><div id="app" class="root"><p>hello</p><a href="#">link</a></div></body></html>`,
                                );
                                injectBridge(win, inst.userScript); // onPageStarted (best effort)
                                injectBridge(win, inst.userScript); // onPageFinished (guaranteed)
                                for (const cb of inst._eventCallbacks.slice()) {
                                        if (cb.event === "pageFinished")
                                                setTimeout(() => cb.callback("pageFinished", { url, title: "t" }), 0);
                                }
                                return Promise.resolve();
                        },
                        reload() {
                                return inst.loadURL(inst.url || "https://reload");
                        },
                        onMessage(cb) {
                                inst._messageCallbacks.push(cb);
                        },
                        on(event, cb) {
                                inst._eventCallbacks.push({ event, callback: cb });
                        },
                        destroy() {
                                instances.delete(id);
                                return Promise.resolve();
                        },
                };
                instances.set(id, inst);
                return Promise.resolve(id);
        };

        // app-level native bridge (www/webview.js equivalent)
        function wrap(inst) {
                return {
                        id: inst.id,
                        loadURL: (u) => inst.loadURL(u),
                        evaluate: (js) => inst.evaluate(js),
                        postMessage: (m) => inst.postMessage(m),
                        setInjectScript: (s) => inst.setInjectScript(s),
                        reload: () => inst.reload(),
                        onMessage: (cb) => inst.onMessage(cb),
                        on: (ev, cb) => inst.on(ev, cb),
                        off: () => {},
                        show: () => Promise.resolve(),
                        hide: () => Promise.resolve(),
                        destroy: () => inst.destroy(),
                };
        }
        native.api = {
                setMessageCallback(cb) {
                        // mirror src/lib/webview.js routing: look the instance up by
                        // id, JSON-parse the payload, deliver to onMessage callbacks
                        appMessageSink = (message) => {
                                let last = null;
                                for (const id of instances.keys()) last = id;
                                const inst = instances.get(last);
                                if (!inst) return;
                                let parsed = message;
                                try {
                                        parsed = JSON.parse(message);
                                } catch (_) {}
                                for (const mcb of inst._messageCallbacks.slice()) mcb(parsed);
                        };
                },
                create(options) {
                        // the real lib/webview.js create() runs ensureInit() first,
                        // which registers the routing callback — mirror that here
                        if (!appMessageSink) {
                                appMessageSink = (message) => {
                                        let last = null;
                                        for (const id of instances.keys()) last = id;
                                        const inst = instances.get(last);
                                        if (!inst) return;
                                        let parsed = message;
                                        try {
                                                parsed = JSON.parse(message);
                                        } catch (_) {}
                                        for (const mcb of inst._messageCallbacks.slice()) mcb(parsed);
                                };
                        }
                        return native.create(options).then((id) => wrap(instances.get(id)));
                },
                loadURL: (id, url) => instances.get(id).loadURL(url),
                evaluate: (id, js) => instances.get(id).evaluate(js),
                postMessage: (id, message) => instances.get(id).postMessage(message),
                setInjectScript: (id, script) => instances.get(id).setInjectScript(script),
                reload: (id) => instances.get(id).reload(),
                destroy: (id) => instances.get(id).destroy(),
        };
        return native;
}

describe("Inspector plugin end-to-end", () => {
        let native;

        beforeEach(() => {
                native = makeNativeShim();
                nativeRef.current = native;
        });

        afterEach(() => {
                nativeRef.current = null;
                vi.resetModules();
        });

        async function boot() {
                const engine = await import("../../src/lib/webInspector");
                const commands = new Map();
                window.xcoder = {
                        setPluginInit(id, fn) {
                                window.__pluginInit = fn;
                        },
                        setPluginUnmount() {},
                        addCommand(def) {
                                commands.set(def.name, def);
                        },
                        removeCommand(name) {
                                commands.delete(name);
                        },
                        require(name) {
                                if (name === "webInspector") return engine;
                                if (name === "page")
                                        return (title, opts) => {
                                                const page = document.createElement("div");
                                                page.className = "plugin-page";
                                                page.hide = () => {};
                                                window.__pageEl = page;
                                                return page;
                                        };
                                if (name === "sidebarApps")
                                        return {
                                                add() {},
                                                remove() {},
                                        };
                                if (name === "toast") return () => {};
                                throw new Error("no module " + name);
                        },
                };
                window.strings = { inspector: "Inspector" };
                window.actionStack = { push() {}, remove() {} };
                window.app = {
                        append(el) {
                                document.body.appendChild(el);
                        },
                };
                new Function(PLUGIN_CODE)();
                window.__pluginInit("xcoder.inspector");
                // open the plugin page like the user does (sidebar/command)
                const openCmd = commands.get("inspector:open");
                expect(openCmd).toBeTruthy();
                openCmd.exec();
                expect(window.__pageEl).toBeTruthy();
                return { engine, commands };
        }

        function tabs() {
                return [...window.__pageEl.querySelectorAll(".xin-tab")];
        }

        async function openSite(url) {
                const input = window.__pageEl.querySelector("input[type=url]");
                input.value = url;
                const go = [...window.__pageEl.querySelectorAll("[role=button]")].pop();
                go.click();
                await new Promise((r) => setTimeout(r, 30));
        }

        it("renders the Elements tree after pageFinished", async () => {
                const { engine } = await boot();
                await openSite("https://exemplo.com");
                await new Promise((r) => setTimeout(r, 30));

                expect(engine.activeInspectorSession()).toBeTruthy();
                const tree = window.__pageEl.querySelector(".xin-tree");
                const rows = [...tree.querySelectorAll(".xin-node")].map((n) => n.textContent);
                expect(rows.length).toBeGreaterThan(0);
                expect(rows.join(" ")).toMatch(/html/);
        });

        it("shows captured console entries when the tab is opened", async () => {
                await boot();
                await openSite("https://exemplo.com");
                await new Promise((r) => setTimeout(r, 30));

                // the page logs BEFORE the user switches tabs
                const page = native.instances.values().next().value.win;
                page.console.log("hello from page");
                await new Promise((r) => setTimeout(r, 10));

                tabs()[1].click(); // Consola
                await new Promise((r) => setTimeout(r, 10));
                const out = window.__pageEl.querySelector(".xin-console-out");
                expect(out.textContent).toContain("hello from page");
        });

        it("console tab renders live messages while open", async () => {
                await boot();
                await openSite("https://exemplo.com");
                await new Promise((r) => setTimeout(r, 30));
                tabs()[1].click();
                const page = native.instances.values().next().value.win;
                page.console.warn("warning!");
                await new Promise((r) => setTimeout(r, 10));
                const out = window.__pageEl.querySelector(".xin-console-out");
                expect(out.textContent).toContain("warning!");
        });

        it("runs JS in the page from the console input", async () => {
                await boot();
                await openSite("https://exemplo.com");
                await new Promise((r) => setTimeout(r, 30));
                tabs()[1].click();
                const input = window.__pageEl.querySelector(".xin-console-inputrow input");
                input.value = "2+3";
                input.dispatchEvent(
                        new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
                );
                await new Promise((r) => setTimeout(r, 30));
                const out = window.__pageEl.querySelector(".xin-console-out");
                expect(out.textContent).toContain("5");
        });

        it("reads storage from the page", async () => {
                await boot();
                await openSite("https://exemplo.com");
                await new Promise((r) => setTimeout(r, 30));
                const page = native.instances.values().next().value.win;
                page.localStorage.setItem("token", "abc123");
                tabs()[4].click(); // Armazenamento
                await new Promise((r) => setTimeout(r, 30));
                const out = window.__pageEl.querySelector(".xin-storage-out");
                expect(out.textContent).toContain("token");
                expect(out.textContent).toContain("abc123");
        });

        it("still serves the tree via the evaluate fallback when the bridge dies", async () => {
                const { engine } = await boot();
                await openSite("https://exemplo.com");
                await new Promise((r) => setTimeout(r, 120));
                const inst = native.instances.values().next().value;
                // simulate the device failure mode: the postMessage bridge
                // answers nothing (rebuilt window.webview, empty callbacks)
                const original = inst.postMessage;
                inst.postMessage = () => Promise.reject(new Error("bridge dead"));
                try {
                        const tree = await engine.sendInspectorCommand("getTree", { path: "" });
                        expect(tree.self.tag).toBe("html");
                        expect(tree.total).toBeGreaterThan(0);
                } finally {
                        inst.postMessage = original;
                }
        });

        it("search finds nodes by CSS selector", async () => {
                await boot();
                await openSite("https://exemplo.com");
                await new Promise((r) => setTimeout(r, 30));
                tabs()[3].click(); // Procurar
                const input = window.__pageEl.querySelector(".xin-searchrow input");
                input.value = "a";
                input.dispatchEvent(
                        new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
                );
                await new Promise((r) => setTimeout(r, 30));
                const out = window.__pageEl.querySelector(".xin-search-out");
                expect(out.textContent).toMatch(/match/i);
        });
});
