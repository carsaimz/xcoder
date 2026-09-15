// @vitest-environment happy-dom
/**
 * "Meus repositórios" MOVED from the GitHub settings page to the Git
 * sidebar app (and, as context, the AI chat):
 *
 *  1. lib/ghRepos.js — the shared picker: lists repos with the stored
 *     token, persists ghRepo/gitRemoteUrl/ghBranch, guides when there is
 *     no session.
 *  2. The GitHub settings page must NO LONGER render the gh-repos row.
 *  3. The Git sidebar must render a repository card wired to the picker.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";
import tag from "html-tag-js";

window.tag = tag;
window.app = document.createElement("div");
window.app.id = "app";
document.body.append(window.app);
document.body.classList.add("no-animation");

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
        selects: [],
        selectResult: null,
        settingsValue: {},
}));

window.strings = {
        "github repos": "Meus repositórios",
        "github token needed":
                "Entre com a conta ou defina um token para listar repositórios",
        "github no repos": "Nenhum repositório encontrado",
        "github repo saved": "Repositório",
        "github settings": "GitHub",
        "github account": "Conta GitHub",
        "not signed in": "Sessão não iniciada",
        logout: "Logout",
        "sign in with github": "Entrar com GitHub",
        "github token": "Token de acesso pessoal",
        "git remote url": "URL remota",
        "git branch": "Branch",
        "github token only": "Token definido — sem perfil",
        "github chip connected": "Conectado",
        "github chip offline": "Offline",
        "signed in as": "Sessão iniciada como",
        "github profile failed": "Não foi possível carregar o perfil",
        "github refresh profile": "Atualizar perfil",
        "settings-info-gh-repos": "info repos",
};

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

function jsonResponse(data) {
        return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify(data),
                json: async () => data,
        };
}

const REPOS = [
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

beforeEach(() => {
        state.fetchCalls = [];
        state.toasts = [];
        state.selects = [];
        state.selectResult = null;
        state.settingsValue = {};
        document.querySelectorAll("wc-page").forEach(($p) => $p.remove());
        window.fetch = async (url, opts) => {
                const urlText = String(url);
                state.fetchCalls.push({ url: urlText, opts: opts || {} });
                if (urlText.includes("api.github.com/user/repos")) {
                        return jsonResponse(REPOS);
                }
                return jsonResponse({});
        };
});

const ghRepos = await import("lib/ghRepos");

describe("ghRepos (moved from the GitHub settings page)", () => {
        test(
                "pickAndApplyGhRepo lists repos and persists the choice",
                { timeout: 20000 },
                async () => {
                        state.settingsValue = { ghToken: "ghp_token_abc" };
                        state.selectResult = "octocat/hello-world";

                        const changed = await ghRepos.pickAndApplyGhRepo();

                        assert.equal(changed, true);
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
                        assert.equal(state.settingsValue.ghRepo, "octocat/hello-world");
                        assert.equal(
                                state.settingsValue.gitRemoteUrl,
                                "https://github.com/octocat/hello-world.git",
                        );
                        assert.equal(state.settingsValue.ghBranch, "main");
                },
        );

        test(
                "without a token it guides instead of failing silently",
                { timeout: 20000 },
                async () => {
                        const changed = await ghRepos.pickAndApplyGhRepo();
                        assert.equal(changed, false);
                        assert.ok(
                                state.toasts.some((t) => /token/i.test(t)),
                                "guidance toast shown",
                        );
                        assert.equal(
                                state.fetchCalls.filter((c) =>
                                        c.url.includes("user/repos"),
                                ).length,
                                0,
                                "no repos request without a token",
                        );
                },
        );

        test(
                "listGhRepos surfaces API errors (bad/expired token)",
                { timeout: 20000 },
                async () => {
                        state.settingsValue = { ghToken: "ghp_expired" };
                        window.fetch = async () => ({
                                ok: false,
                                status: 401,
                                text: async () =>
                                        JSON.stringify({ message: "Bad credentials" }),
                        });
                        await assert.rejects(() => ghRepos.listGhRepos(), /401/);
                },
        );
});

describe("wiring — page removed, sidebar owns the picker", () => {
        test("GitHub settings page no longer renders a gh-repos row", async () => {
                const { default: ghSettings } = await import("settings/ghSettings");
                const page = ghSettings();
                const $list = page.getListElement();
                assert.equal(
                        $list.get('[data-key="gh-repos"]'),
                        null,
                        "gh-repos row removed from the GitHub settings page",
                );
                assert.ok(
                        $list.get('[data-key="ghToken"]'),
                        "token row still present",
                );
        });

        test("Git sidebar renders the repository card wired to the picker", async () => {
                const fs = await import("node:fs");
                const path = await import("node:path");
                const read = (rel) =>
                        fs.readFileSync(path.join(process.cwd(), rel), "utf8");
                const gitApp = read("src/sidebarApps/git/index.js");
                assert.match(gitApp, /pickAndApplyGhRepo/, "uses the shared picker");
                assert.match(gitApp, /git-repo-body/, "has the repository card body");
                assert.match(gitApp, /git-repo-name/, "renders the active repo name");
                const ghSettingsSrc = read("src/settings/ghSettings.js");
                assert.doesNotMatch(
                        ghSettingsSrc,
                        /pickRepo|user\/repos/,
                        "settings page has no repo listing left",
                );
        });
});
