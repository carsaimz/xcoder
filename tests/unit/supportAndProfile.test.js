// @vitest-environment happy-dom
/**
 * Regression tests for the two "dead tap" reports:
 *  1. account (profile) icon in the sidebar opened nothing but the sidebar
 *     closing — root cause: `$page.show()` does not exist on WCPage, so
 *     rendering threw `TypeError: $page.show is not a function` every tap;
 *  2. "Apoie o projeto" entry swallowed every error (`.catch(() => {})`),
 *     so any failure inside showSupportDialog() looked like "nothing
 *     happens". The dialog must ALWAYS mount (or visibly fail) and its
 *     payment methods must render even when the remote config is empty.
 *
 * These tests render the real JSX modules under happy-dom.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

// --- app bootstrap globals the JSX modules expect -------------------------
import tag from "html-tag-js";

window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
window_strings();

// String.prototype.capitalize is installed by the app's polyfill (src/main.js);
// only the pieces the tested pages need are replicated here (happy-dom safe).
if (!String.prototype.capitalize) {
        Object.defineProperty(String.prototype, "capitalize", {
                value() {
                        return this.length ? this[0].toUpperCase() + this.slice(1) : this;
                },
                writable: true,
                configurable: true,
        });
}

// register <wc-page> and friends exactly like the app boot does
await import("components/WebComponents");

// minimal replica of html-tag-js/dist/polyfill (the parts the tested pages
// rely on) — the upstream UMD does not import cleanly under vitest
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

function window_strings() {
        window.strings = {
                profile: "Perfil",
                "support the project": "Apoie o projeto",
                guest: "Convidado",
                "not signed in": "Sessão não iniciada",
                "free badge": "Grátis",
                email: "E-mail",
                password: "Palavra-passe",
                "sign in": "Entrar",
                "sign up": "Criar conta",
                or: "ou",
                "continue google": "Continuar com Google",
                "continue github": "Continuar com GitHub",
                "oauth paste": "Já entrei — colar link de retorno",
                "support pitch": "O XCoder é gratuito",
                "become sponsor": "Quero patrocinar — abrir no site",
                "i donated code": "Já doei — inserir código",
                copied: "Copiado ✓",
                "account hint": "Use a MESMA conta do site oficial",
                "account sync hint": "Depois de confirmarmos a sua doação",
        };
}

// --- module-level mocks (no network, no cordova) ---------------------------

const state = vi.hoisted(() => ({
        user: null,
        premium: false,
        methods: [],
}));

vi.mock("lib/supabase", async (importOriginal) => {
        const actual = await importOriginal();
        const getUser = () => state.user;
        return {
                ...actual,
                getUser,
                supabaseConfigured: () => true,
                default: {
                        ...actual.default,
                        getUser,
                        supabaseConfigured: () => true,
                },
        };
});

vi.mock("lib/backend", () => ({
        backendConfig: () => ({ support: { methods: state.methods } }),
}));

vi.mock("lib/premium", async (importOriginal) => {
        const actual = await importOriginal();
        return {
                ...actual,
                isPremium: () => state.premium,
                getPremiumStatus: () => (state.premium ? { active: true } : { active: false }),
                supportInfo: () => ({
                        methods: state.methods.length
                                ? state.methods
                                : [
                                                {
                                                        method: "paypal",
                                                        label: "PayPal",
                                                        url: "",
                                                        account: "carimosaidempinda@gmail.com",
                                                        accountLabel: "e-mail",
                                                        instructions: "Envie como amigo/família.",
                                                },
                                        ],
                        links: [],
                }),
                syncCloudPremium: async () => false,
                redeemCode: async () => {},
        };
});

vi.mock("components/toast", () => ({
        default: (msg) => {
                window.__lastToast = String(msg);
        },
}));

vi.mock("dialogs/prompt", () => ({
        default: async () => "",
}));

vi.mock("dialogs/loader", () => ({
        default: {
                show: async () => async () => {},
        },
}));

// The profile module pulls in the whole page/sidebar stack — importing it
// inside a test can exceed the 5s default timeout on loaded machines (65
// files running in parallel), which made this regression test flaky. Resolve
// it once at file level: vi.mock registrations above are hoisted before any
// import runs, so the mocks still apply, and the import cost is no longer
// counted against the per-test timeout.
const { default: renderProfile } = await import("pages/profile/profile");

describe("account page (sidebar profile icon)", () => {
        test(
                "renders and attaches to the DOM without throwing (no $page.show)",
                // heavy first-render under parallel workers — never assume <5s
                { timeout: 20000 },
                async () => {
                        // the old bug: TypeError "$page.show is not a function" — would fail here
                        renderProfile();
                        const $page = document
                                .querySelector("wc-page .profile-page")
                                ?.closest("wc-page");
                        assert.ok($page, "profile page is attached to the document");
                        assert.ok(
                                document.querySelector(".profile-page"),
                                "profile body is rendered",
                        );
                        // sign-in section shows because supabaseConfigured() is true and no user
                        assert.ok(
                                document.querySelector('input[type="email"]'),
                                "e-mail field rendered for signed-out user",
                        );
                        // animate() never settles under happy-dom — detach synchronously
                        document
                                .querySelectorAll("wc-page")
                                ?.forEach(($p) => $p.remove());
                },
        );

        test("signed-in view exposes support + sign out", async () => {
                state.user = { email: "test@example.com", id: "u1" };
                const $page = renderProfile();
                const text =
                        document.querySelector(".profile-page")?.textContent || "";
                assert.match(text, /test@example\.com/);
                assert.match(text, /Apoie/i);
                // animate() never settles under happy-dom — detach synchronously
                document
                        .querySelectorAll("wc-page")
                        ?.forEach(($p) => $p.remove());
                state.user = null;
        });
});

describe("support page (Apoie o projeto — página própria, não modal)", () => {
        test("opens as a full page with visible payment methods", async () => {
                const { showSupportDialog } = await import("lib/premiumUI");
                await showSupportDialog();
                const $page = document.querySelector(".support-page");
                assert.ok($page, "support page is rendered (no overlay/dialog)");
                const text = $page.textContent || "";
                assert.match(text, /PayPal/);
                // the payment account must be readable in full — not masked
                assert.match(text, /carimosaidempinda@gmail\.com/);
                assert.ok(
                        document.querySelector("wc-page .support-page"),
                        "support page is hosted in a wc-page (appended to app root)",
                );
                $page.remove();
        });

        test("renders fallback methods when remote list is empty", async () => {
                state.methods = [];
                const { showSupportDialog } = await import("lib/premiumUI");
                await showSupportDialog();
                assert.ok(
                        document.querySelector(".support-page"),
                        "support page exists with fallback methods",
                );
                document.querySelector("wc-page .support-page")?.remove();
        });
});
