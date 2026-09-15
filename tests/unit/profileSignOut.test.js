// @vitest-environment happy-dom
/**
 * Reproduction for "na página de perfil não aceita terminar sessão".
 *
 * Unlike accountAndGhSession.test.js (which MOCKS dialogs/confirm), this
 * file exercises the REAL confirm dialog + REAL actionStack — exactly the
 * code path a device runs when "Terminar sessão" is tapped.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

import tag from "html-tag-js";

window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
document.body.classList.add("no-animation");

window.strings = {
        profile: "Perfil",
        guest: "Convidado",
        "not signed in": "Sessão não iniciada",
        "free badge": "Grátis",
        email: "E-mail",
        password: "Palavra-passe",
        "sign in": "Entrar",
        "sign up": "Criar conta",
        or: "ou",
        ok: "OK",
        cancel: "Cancelar",
        warning: "Aviso",
        "close app": "Sair do app",
        "sign out": "Terminar sessão",
        "sign out confirm": "Terminar a sessão nesta conta?",
        "signed out": "Sessão terminada",
        logout: "Terminar sessão",
        "support the project": "Apoie o XCoder",
        "profile account hint": "Use a mesma conta do site",
        "oauth paste": "Colar link",
        "oauth none active": "sem oauth",
        "fill email password": "Preencha",
        "signing in": "A entrar…",
        "signed in": "Sessão iniciada ✓",
};

if (!String.prototype.capitalize) {
        Object.defineProperty(String.prototype, "capitalize", {
                value() {
                        return this.length
                                ? this[0].toUpperCase() + this.slice(1)
                                : this;
                },
                writable: true,
                configurable: true,
        });
}
if (!("get" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "get", {
                value(selector) {
                        return this.querySelector(selector);
                },
                configurable: true,
                writable: true,
        });
}
if (!("getAll" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "getAll", {
                value(selector) {
                        return [...this.querySelectorAll(selector)];
                },
                configurable: true,
                writable: true,
        });
}
if (!("content" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "content", {
                set($el) {
                        this.textContent = "";
                        const appendAll = (nodes) => {
                                for (const node of [].concat(nodes)) {
                                        if (Array.isArray(node)) appendAll(node);
                                        else if (node instanceof Node)
                                                this.appendChild(node);
                                }
                        };
                        appendAll($el);
                },
                get() {
                        const children = [...this.children];
                        return children.length === 0
                                ? null
                                : children.length === 1
                                        ? children[0]
                                        : children;
                },
                configurable: true,
        });
}

await import("components/WebComponents");

const state = vi.hoisted(() => ({
        fetchCalls: [],
        toasts: [],
}));

vi.mock("components/toast", () => ({
        default: (msg) => {
                state.toasts.push(String(msg));
        },
}));

vi.mock("dialogs/loader", () => ({
        default: {
                show: async () => async () => {},
                hide: async () => {},
        },
}));

// real confirm + real actionStack stay live; only their cosmetic deps are
// stubbed (theme darkening needs the cordova system plugin)
vi.mock("components/checkbox", () => ({ default: () => null }));
vi.mock("dompurify", () => ({
        default: { sanitize: (value) => value },
}));
vi.mock("lib/restoreTheme", () => ({ default: () => {} }));

vi.mock("lib/settings", () => ({
        default: {
                value: {},
                uiSettings: {},
                async update() {},
                get(key) {
                        return this.value[key];
                },
                on() {},
                off() {},
                async reset() {},
        },
}));

vi.mock("lib/backend", () => ({
        DEFAULT_BACKEND_URL: "https://backend.test",
        backendUrl: () => "https://backend.test",
        backendConfig: () => ({
                supabase: { url: "https://supa.test", anonKey: "anon-key" },
        }),
        ensureBackendConfig: async () => null,
        sendFeedback: async () => true,
        deviceId: () => "test-device",
}));

vi.mock("lib/premium", () => ({
        isPremium: () => false,
        getPremiumStatus: () => ({ active: false }),
        syncCloudPremium: async () => false,
        redeemCode: async () => {},
        supportInfo: () => ({ methods: [], links: [] }),
}));

vi.mock("lib/premiumUI", () => ({
        openSupportPage: async () => {},
        showSupportDialog: async () => {},
}));

function jsonResponse(data) {
        return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify(data),
                json: async () => data,
        };
}

beforeEach(() => {
        state.fetchCalls = [];
        state.toasts = [];
        window.fetch = async (url, opts) => {
                const urlText = String(url);
                state.fetchCalls.push({ url: urlText, opts: opts || {} });
                if (urlText.includes("/auth/v1/token")) {
                        return jsonResponse({
                                access_token: "at-123",
                                refresh_token: "rt-123",
                                expires_in: 3600,
                                user: { id: "u-1", email: "teste@exemplo.com" },
                        });
                }
                if (urlText.includes("/auth/v1/user")) {
                        return jsonResponse({
                                id: "u-1",
                                email: "teste@exemplo.com",
                        });
                }
                if (urlText.includes("/auth/v1/settings")) {
                        return jsonResponse({ external: {} });
                }
                return jsonResponse({});
        };
        localStorage.clear();
        document.querySelectorAll("wc-page").forEach(($p) => $p.remove());
        // clean the real actionStack between tests
        while (actionStack.length) actionStack.pop();
});

const { default: renderProfile } = await import("pages/profile/profile");
const { default: actionStack } = await import("lib/actionStack");

describe("profile — real confirm dialog + real actionStack", () => {
        test(
                "Terminar sessão (real confirm) clears the session",
                { timeout: 20000 },
                async () => {
                        // sign in first
                        renderProfile();
                        let $body = document.querySelector(".profile-page");
                        $body.querySelector('input[type="email"]').value =
                                "teste@exemplo.com";
                        $body.querySelector('input[type="password"]').value = "senha";
                        [...$body.querySelectorAll("button")].find(($b) =>
                                ($b.textContent || "").includes("Entrar"),
                        ).click();
                        await vi.waitFor(
                                () => {
                                        assert.equal(
                                                JSON.parse(
                                                        localStorage.getItem(
                                                                "xcoder.supabase.session",
                                                        ) || "null",
                                                )?.access_token,
                                                "at-123",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        await vi.waitFor(
                                () =>
                                        assert.match(
                                                document.body.textContent || "",
                                                /teste@exemplo\.com/,
                                        ),
                                { timeout: 5000 },
                        );

                        // tap Terminar sessão — REAL confirm dialog opens
                        $body = document.querySelector(".profile-page");
                        const $out = [...$body.querySelectorAll("button")].find(($b) =>
                                ($b.textContent || "").includes("Terminar sessão"),
                        );
                        assert.ok($out, "sign-out button rendered");
                        $out.click();

                        // the real dialog is in the DOM — find its OK button
                        await vi.waitFor(
                                () => {
                                        const $ok = [
                                                ...window.app.querySelectorAll(
                                                        ".prompt.confirm button",
                                                ),
                                        ].find(($b) => ($b.textContent || "") === "OK");
                                        assert.ok(
                                                $ok,
                                                "real confirm dialog rendered with OK button",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        const $ok = [
                                ...window.app.querySelectorAll(".prompt.confirm button"),
                        ].find(($b) => ($b.textContent || "") === "OK");
                        $ok.click();

                        await vi.waitFor(
                                () => {
                                        assert.ok(
                                                state.fetchCalls.some((c) =>
                                                        c.url.includes("/auth/v1/logout"),
                                                ),
                                                "logout request sent",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        await vi.waitFor(
                                () => {
                                        assert.equal(
                                                localStorage.getItem(
                                                        "xcoder.supabase.session",
                                                ),
                                                null,
                                                "session cleared",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        await vi.waitFor(
                                () => {
                                        assert.match(
                                                document.body.textContent || "",
                                                /Convidado/,
                                        );
                                },
                                { timeout: 5000 },
                        );
                        assert.ok(
                                state.toasts.some((t) => /Sessão terminada/i.test(t)),
                                "signed-out toast shown",
                        );
                },
        );

        test(
                "hardware back on the profile page must close the page (actionStack entry must use `action`)",
                { timeout: 20000 },
                async () => {
                        renderProfile();
                        await vi.waitFor(
                                () =>
                                        assert.ok(
                                                document.querySelector(".profile-page"),
                                        ),
                                { timeout: 5000 },
                        );
                        assert.ok(
                                actionStack.get("profile"),
                                "profile entry pushed",
                        );
                        // pop() must invoke the profile close action WITHOUT throwing
                        await assert.doesNotReject(() => actionStack.pop());
                        assert.equal(
                                actionStack.get("profile"),
                                undefined,
                                "profile entry removed after pop",
                        );
                        document.querySelectorAll("wc-page").forEach(($p) => $p.remove());
                },
        );

        test(
                "a token refresh in flight when signOut runs must NOT resurrect the session",
                { timeout: 20000 },
                async () => {
                        const supabase = await import("lib/supabase");
                        // sign in with a SHORT expiry so a refresh is triggered
                        window.fetch = async (url, opts) => {
                                const urlText = String(url);
                                state.fetchCalls.push({ url: urlText, opts: opts || {} });
                                if (urlText.includes("/auth/v1/token")) {
                                        return jsonResponse({
                                                access_token: "at-refreshed",
                                                refresh_token: "rt-2",
                                                expires_in: 30,
                                                user: { id: "u-1", email: "teste@exemplo.com" },
                                        });
                                }
                                if (urlText.includes("/auth/v1/logout")) {
                                        return jsonResponse({});
                                }
                                return jsonResponse({});
                        };
                        await supabase.signInWithPassword("teste@exemplo.com", "senha");
                        assert.ok(supabase.getUser(), "signed in");

                        // start a lazy refresh (token expires in 30s) and sign out
                        // BEFORE the refresh response is processed
                        const refreshing = supabase.ensureFreshSession();
                        await supabase.signOut();
                        const refreshed = await refreshing;

                        assert.equal(refreshed, false, "refresh discarded after signOut");
                        assert.equal(supabase.getUser(), null, "user stays signed out");
                        assert.equal(
                                localStorage.getItem("xcoder.supabase.session"),
                                null,
                                "localStorage stays clear of the resurrected session",
                        );
                },
        );
});
