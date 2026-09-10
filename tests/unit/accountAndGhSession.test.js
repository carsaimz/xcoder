// @vitest-environment happy-dom
/**
 * Regression tests for the two "dead account" reports:
 *
 *  1. Profile (account) page: "Entrar"/"Criar conta" did nothing and the
 *     page stayed on "Convidado" forever. Root cause: WCPage's `body`
 *     setter REPLACES the internal `.main` container with the assigned
 *     element, and the getter (`get(".main") || get("main")`) then returns
 *     NULL because the profile body div doesn't carry the `main` class
 *     (the About page does: `<main class="main scroll">`). Every
 *     `$page.body.querySelector(...)` inside onSignIn/onSignUp threw a
 *     silent TypeError — an async click handler rejects invisibly.
 *
 *  2. GitHub settings: a PAT typed into the "Personal access token" row
 *     (and the Remote URL / Branch rows) was never persisted —
 *     handleCallback assumed the settings kit saves prompt values, but the
 *     kit only updates its own DOM item (every other settings page calls
 *     appSettings.update({ [key]: value }) in its callback). With
 *     settings.value.ghToken still empty the Git sidebar shows no account
 *     and "Meus repositórios" bails out before any request.
 *
 * The tests render the REAL JSX modules under happy-dom; only network,
 * dialogs and the settings store are stubbed.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

// --- app bootstrap globals the JSX modules expect -------------------------
import tag from "html-tag-js";

window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
// makes WCPage.hide() synchronous (skips the never-settling motion animation)
document.body.classList.add("no-animation");

window.strings = {
        profile: "Perfil",
        guest: "Convidado",
        "not signed in": "Sessão não iniciada",
        "free badge": "Grátis",
        "premium active": "Premium ativo",
        email: "E-mail",
        password: "Palavra-passe",
        "sign in": "Entrar",
        "sign up": "Criar conta",
        or: "ou",
        "profile account hint": "Use a mesma conta do site",
        "oauth paste": "Já entrei — colar link de retorno",
        "oauth none active": "Entrada com Google/GitHub não está ativa — use e-mail e palavra-passe",
        "fill email password": "Preencha e-mail e palavra-passe",
        "signing in": "A entrar…",
        "signed in": "Sessão iniciada ✓",
        "signed out": "Sessão terminada",
        "creating account": "A criar conta…",
        "account created": "Conta criada ✓",
        "support the project": "Apoie o XCoder",
        logout: "Terminar sessão",
        "sign out": "Terminar sessão",
        "sign out confirm": "Terminar a sessão nesta conta?",
        "github settings": "GitHub",
        "github account": "Conta GitHub",
        "sign in with github": "Entrar com GitHub",
        "github token": "Token de acesso pessoal",
        "github repos": "Meus repositórios",
        "git remote url": "URL remota",
        "git branch": "Branch",
        "github token only": "Token definido — sem perfil",
        "github chip connected": "Conectado",
        "github chip offline": "Offline",
        "signed in as": "Sessão iniciada como",
        "github profile failed": "Não foi possível carregar o perfil",
        "github refresh profile": "Atualizar perfil",
        "github token needed": "Entre com a conta ou defina um token para listar repositórios",
        "github no repos": "Nenhum repositório encontrado",
        "github repo saved": "Repositório",
};

if (!String.prototype.capitalize) {
        Object.defineProperty(String.prototype, "capitalize", {
                value() {
                        return this.length ? this[0].toUpperCase() + this.slice(1) : this;
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
// html-tag-js polyfill piece used by the settings kit ($list.content = ...)
// and by the profile page (slot.content = ...). The upstream UMD does not
// import cleanly under vitest, so — like get/getAll above — the part the
// tested pages rely on is replicated here.
if (!("content" in HTMLElement.prototype)) {
        Object.defineProperty(HTMLElement.prototype, "content", {
                set($el) {
                        this.textContent = "";
                        const appendAll = (nodes) => {
                                for (const node of [].concat(nodes)) {
                                        if (Array.isArray(node)) appendAll(node);
                                        else if (node instanceof Node) this.appendChild(node);
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

// register <wc-page> and friends exactly like the app boot does
await import("components/WebComponents");

// --- shared state + module mocks (no network, no cordova) ------------------

const state = vi.hoisted(() => ({
        fetchCalls: [],
        toasts: [],
        prompts: [],
        selects: [],
        selectResult: null,
        promptResult: null,
        settingsValue: {},
        settingsUpdates: [],
        repos: [],
        ghUser: {},
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

vi.mock("dialogs/select", () => ({
        default: async (title, items) => {
                state.selects.push({ title, items });
                return state.selectResult;
        },
}));

vi.mock("dialogs/prompt", () => ({
        default: async (...args) => {
                state.prompts.push(args);
                return state.promptResult;
        },
}));

vi.mock("dialogs/confirm", () => ({
        default: async () => true,
}));

vi.mock("lib/settings", () => ({
        default: {
                get value() {
                        return state.settingsValue;
                },
                set value(v) {
                        state.settingsValue = v;
                },
                uiSettings: {},
                async update(patch) {
                        state.settingsUpdates.push(patch ? { ...patch } : null);
                        if (patch && typeof patch === "object") {
                                Object.assign(state.settingsValue, patch);
                        }
                },
                get(key) {
                        return state.settingsValue[key];
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

const supabase = await import("lib/supabase");

beforeEach(async () => {
        state.fetchCalls = [];
        state.toasts = [];
        state.prompts = [];
        state.selects = [];
        state.selectResult = null;
        state.promptResult = null;
        state.settingsValue = {};
        state.settingsUpdates = [];
        state.repos = [
                {
                        full_name: "octocat/hello-world",
                        private: false,
                        clone_url: "https://github.com/octocat/hello-world.git",
                        default_branch: "main",
                },
                {
                        full_name: "octocat/secret",
                        private: true,
                        clone_url: "https://github.com/octocat/secret.git",
                        default_branch: "dev",
                },
        ];
        state.ghUser = {
                login: "octocat",
                name: "The Octocat",
                avatar_url: "https://github.com/octocat.png",
        };

        window.fetch = async (url, opts) => {
                const urlText = String(url);
                state.fetchCalls.push({ url: urlText, opts: opts || {} });
                if (urlText.includes("/auth/v1/token")) {
                        return jsonResponse({
                                access_token: "at-123",
                                refresh_token: "rt-123",
                                expires_in: 3600,
                                token_type: "bearer",
                                user: {
                                        id: "u-1",
                                        email: "teste@exemplo.com",
                                        user_metadata: {},
                                },
                        });
                }
                if (urlText.includes("/auth/v1/user")) {
                        return jsonResponse({
                                id: "u-1",
                                email: "teste@exemplo.com",
                                user_metadata: {},
                        });
                }
                if (urlText.includes("/auth/v1/settings")) {
                        return jsonResponse({
                                external: { email: true, google: false, github: false },
                        });
                }
                if (urlText.includes("api.github.com/user/repos")) {
                        return jsonResponse(state.repos);
                }
                if (urlText.includes("api.github.com/user")) {
                        return jsonResponse(state.ghUser);
                }
                return jsonResponse({});
        };

        localStorage.clear();
        await supabase.signOut();
        document.querySelectorAll("wc-page").forEach(($p) => $p.remove());
});

function cleanupPages() {
        document.querySelectorAll("wc-page").forEach(($p) => $p.remove());
}

// module-level imports keep the per-test budget small (same trick as
// supportAndProfile.test.js — vi.mock registrations are hoisted anyway)
const { default: renderProfile } = await import("pages/profile/profile");
const { default: ghSettings } = await import("settings/ghSettings");

describe("account page (profile) — sign-in must actually work", () => {
        test(
                "wc-page.body stays queryable after the body assignment",
                { timeout: 20000 },
                () => {
                        renderProfile();
                        const $page = document.querySelector("wc-page");
                        assert.ok($page, "profile page attached to the app root");
                        // the old bug: this was null → onSignIn crashed on first keystroke read
                        const $body = $page.body;
                        assert.ok($body, "wc-page.body is NOT null after assignment");
                        assert.ok(
                                $body.classList?.contains("profile-page"),
                                "body getter resolves to the profile content element",
                        );
                        cleanupPages();
                },
        );

        test(
                "shows the honest OAuth hint when no federated provider is active",
                { timeout: 20000 },
                async () => {
                        renderProfile();
                        await vi.waitFor(
                                () => {
                                        const text =
                                                document.querySelector(".profile-page")
                                                        ?.textContent || "";
                                        assert.match(text, /Google\/GitHub/);
                                },
                                { timeout: 5000 },
                        );
                        cleanupPages();
                },
        );

        test(
                "Entrar sends the password grant, stores the session and re-renders",
                { timeout: 20000 },
                async () => {
                        renderProfile();
                        const $body = document.querySelector(".profile-page");
                        $body.querySelector('input[type="email"]').value =
                                "teste@exemplo.com";
                        $body.querySelector('input[type="password"]').value =
                                "senha-123";
                        const $btn = [...$body.querySelectorAll("button")].find(($b) =>
                                ($b.textContent || "").includes("Entrar"),
                        );
                        assert.ok($btn, "Entrar button exists");
                        $btn.click();

                        await vi.waitFor(
                                () => {
                                        assert.ok(
                                                state.fetchCalls.some((c) =>
                                                        c.url.includes("/auth/v1/token"),
                                                ),
                                                "password grant request sent",
                                        );
                                },
                                { timeout: 5000 },
                        );

                        const grant = state.fetchCalls.find((c) =>
                                c.url.includes("/auth/v1/token"),
                        );
                        const payload = JSON.parse(grant.opts.body);
                        assert.equal(payload.email, "teste@exemplo.com");
                        assert.equal(payload.password, "senha-123");

                        const stored = JSON.parse(
                                localStorage.getItem("xcoder.supabase.session") || "null",
                        );
                        assert.equal(
                                stored?.access_token,
                                "at-123",
                                "session persisted to localStorage",
                        );
                        assert.equal(stored?.user?.email, "teste@exemplo.com");

                        await vi.waitFor(
                                () => {
                                        const text = document.body.textContent || "";
                                        assert.match(
                                                text,
                                                /teste@exemplo\.com/,
                                                "account visible after re-render",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        assert.doesNotMatch(
                                document.body.textContent || "",
                                /Convidado/,
                                "guest label gone after sign-in",
                        );
                        cleanupPages();
                },
        );
});

describe("GitHub settings — prompt rows must persist", () => {
        test(
                "PAT typed in the token row is saved and the profile is fetched",
                { timeout: 20000 },
                async () => {
                        state.promptResult = "  ghp_token_abc  ";
                        const page = ghSettings();
                        const $list = page.getListElement();
                        $list.get('[data-key="ghToken"]').click();

                        await vi.waitFor(
                                () => {
                                        assert.equal(
                                                state.settingsValue.ghToken,
                                                "ghp_token_abc",
                                                "token persisted (trimmed)",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        await vi.waitFor(
                                () => {
                                        assert.equal(
                                                state.settingsValue.ghUserLogin,
                                                "octocat",
                                                "profile fetched and stored",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        const userCall = state.fetchCalls.find((c) =>
                                c.url.includes("api.github.com/user"),
                        );
                        assert.ok(userCall, "profile request sent");
                        assert.equal(
                                userCall.opts.headers?.Authorization,
                                "Bearer ghp_token_abc",
                        );
                        cleanupPages();
                },
        );

        test(
                "Meus repositórios lists repos and saves the chosen one",
                { timeout: 20000 },
                async () => {
                        state.settingsValue = { ghToken: "ghp_token_abc" };
                        state.selectResult = "octocat/hello-world";
                        const page = ghSettings();
                        const $list = page.getListElement();
                        $list.get('[data-key="gh-repos"]').click();

                        await vi.waitFor(
                                () => {
                                        assert.equal(
                                                state.settingsValue.ghRepo,
                                                "octocat/hello-world",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        const reposCall = state.fetchCalls.find((c) =>
                                c.url.includes("api.github.com/user/repos"),
                        );
                        assert.ok(reposCall, "repos request sent");
                        assert.match(reposCall.url, /affiliation=owner/);
                        assert.equal(
                                reposCall.opts.headers?.Authorization,
                                "Bearer ghp_token_abc",
                        );
                        assert.equal(state.selects[0]?.title, "Meus repositórios");
                        assert.equal(
                                state.settingsValue.gitRemoteUrl,
                                "https://github.com/octocat/hello-world.git",
                        );
                        assert.equal(state.settingsValue.ghBranch, "main");
                        cleanupPages();
                },
        );

        test(
                "Remote URL row persists its value",
                { timeout: 20000 },
                async () => {
                        state.promptResult = "https://github.com/octocat/other.git";
                        const page = ghSettings();
                        const $list = page.getListElement();
                        $list.get('[data-key="gitRemoteUrl"]').click();
                        await vi.waitFor(
                                () => {
                                        assert.equal(
                                                state.settingsValue.gitRemoteUrl,
                                                "https://github.com/octocat/other.git",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        cleanupPages();
                },
        );

        test(
                "Meus repositórios without a token shows guidance instead of failing",
                { timeout: 20000 },
                async () => {
                        const page = ghSettings();
                        page.getListElement().get('[data-key="gh-repos"]').click();
                        await vi.waitFor(
                                () => {
                                        assert.ok(
                                                state.toasts.some((t) => /token/i.test(t)),
                                                "guidance toast shown",
                                        );
                                },
                                { timeout: 5000 },
                        );
                        assert.equal(
                                state.fetchCalls.filter((c) =>
                                        c.url.includes("user/repos"),
                                ).length,
                                0,
                                "no repos request without a token",
                        );
                        cleanupPages();
                },
        );
});
