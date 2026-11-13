// @vitest-environment happy-dom
/**
 * Git panel "blank view" regression guard.
 *
 * Root cause (v1.8.26): the panel bound its body elements with FUNCTION
 * refs (`ref={setAccountBody}`), but the html-tag-js JSX runtime only
 * binds `ref` attributes holding a Ref instance (`instanceOfRef` →
 * `ref.el = element`). Function refs are silently dropped, so
 * $accountBody/$mainBody stayed null forever, renderAccount() and
 * refresh() both early-returned and the Git sidebar rendered NOTHING.
 *
 * These tests run the REAL panel module (JSX + refs) under happy-dom and
 * pin that initApp() actually fills the account row and the main view.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test, vi } from "vitest";
import tag from "html-tag-js";

// html-tag-js polyfill replica (the UMD does not import cleanly under
// vitest) — the panel relies on the `content` setter patched by the app
if (!("content" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "content", {
                set(value) {
                        this.innerHTML = "";
                        const items = Array.isArray(value) ? value.flat() : [value];
                        for (const item of items) {
                                if (item == null) continue;
                                this.append(
                                        item instanceof Node
                                                ? item
                                                : document.createTextNode(String(item)),
                                );
                        }
                },
                get() {
                        return this.children.length === 0
                                ? null
                                : this.children.length === 1
                                        ? this.children[0]
                                        : [...this.children];
                },
                configurable: true,
        });
}

window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
window.root = document.createElement("div");
window.DATA_STORAGE = "file:///data/user/0/com.carsaimz.xcoder/files/";
window.strings = new Proxy(
        {},
        { get: (_t, key) => (typeof key === "string" ? "" : undefined) },
);

const settingsListeners = new Map();
const settingsValue = { ghToken: "", ghUserLogin: "", ghRepo: "" };

vi.mock("lib/settings", () => ({
        default: {
                get value() {
                        return settingsValue;
                },
                on: (key, fn) => {
                        const list = settingsListeners.get(key) || [];
                        list.push(fn);
                        settingsListeners.set(key, list);
                },
                off: (key, fn) => {
                        settingsListeners.set(
                                key,
                                (settingsListeners.get(key) || []).filter((f) => f !== fn),
                        );
                },
                update: async () => {},
        },
}));

vi.mock("sidebarApps", () => ({
        default: { setBadge: () => {}, pulseApp: () => {} },
}));

vi.mock("lib/git", () => ({
        hasRepo: async () => false,
        onGitChange: () => () => {},
}));

vi.mock("lib/gitPanel", () => ({
        readVcsDb: async () => null,
        restore: async () => {},
        getStatus: async () => ({ changes: { modified: [], added: [], deleted: [] } }),
}));

vi.mock("lib/ghSignIn", () => ({
        refreshGhProfile: async () => {},
        signInGitHubFlow: async () => {},
        signInWithPat: async () => {},
}));

vi.mock("lib/ghRepos", () => ({ pickAndApplyGhRepo: async () => {} }));

vi.mock("lib/ai/vshell", () => ({ default: { getRoot: () => "/root" } }));

vi.mock("lib/git/terminalEcho", () => ({ echoGitCommand: () => {} }));

vi.mock("lib/lang", () => ({
        default: { getIntlLocale: () => "en-US" },
        getIntlLocale: () => "en-US",
}));

vi.mock("components/toast", () => ({ default: () => {} }));

vi.mock("dialogs/loader", () => ({
        default: { showTitleLoader: () => {}, removeTitleLoader: () => {} },
}));

vi.mock("dialogs/prompt", () => ({ default: async () => "" }));

vi.mock("dialogs/select", () => ({ default: async () => "" }));

describe("git sidebar panel renders (function-ref regression)", () => {
        let panel;
        let dispose;

        beforeEach(async () => {
                panel = await import("sidebarApps/git");
        });

        afterEach(() => {
                dispose?.();
                dispose = null;
        });

        test("descriptor is well-formed", () => {
                const [icon, id, title, init] = panel.default;
                assert.equal(id, "git");
                assert.equal(typeof title, "string");
                assert.equal(typeof init, "function");
                assert.equal(typeof icon, "string");
        });

        test("initApp fills the account row and the main view", async () => {
                const [, , , init] = panel.default;
                const container = document.createElement("div");
                document.body.append(container);
                dispose = init(container);

                // settle the async refresh() (hasRepo → renderShell)
                await new Promise((resolve) => setTimeout(resolve, 20));

                const $account = container.querySelector(".git-account");
                assert.ok($account, ".git-account exists");
                assert.ok(
                        $account.children.length > 0,
                        "account row is rendered (sign-in hint when signed out)",
                );
                assert.ok(
                        container.querySelector(".git-account-hint, .git-account-row"),
                        "account content rendered",
                );

                const $main = container.querySelector(".git-main");
                assert.ok($main, ".git-main exists");
                assert.ok(
                        $main.children.length > 0,
                        "main view is rendered (welcome shell without a repo)",
                );
                assert.ok(
                        container.querySelector(".git-welcome"),
                        "welcome view (Initialize/Clone) rendered",
                );
        });

        test("re-init repopulates the bodies (no stale refs)", async () => {
                const [, , , init] = panel.default;
                const first = document.createElement("div");
                document.body.append(first);
                const disposeFirst = init(first);
                disposeFirst();
                first.remove();

                const second = document.createElement("div");
                document.body.append(second);
                dispose = init(second);
                await new Promise((resolve) => setTimeout(resolve, 20));
                assert.ok(
                        second.querySelector(".git-account")?.children.length > 0,
                        "second mount still renders the account row",
                );
        });
});
