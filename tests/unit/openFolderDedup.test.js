// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
        const withHelpers = (el) => {
                el.get = (selector) => el.querySelector(selector);
                el.getAll = (selector) => Array.from(el.querySelectorAll(selector));
                return el;
        };
        const $rootFactory = () => {
                const $title = withHelpers(document.createElement("div"));
                $title.append(document.createElement("span"));
                const $text = document.createElement("span");
                $text.className = "text";
                $title.append($text);
                const $ul = withHelpers(document.createElement("ul"));
                const $root = withHelpers(document.createElement("div"));
                $root.classList.add("list", "collapsible");
                $root.append($title, $ul);
                $root.$title = $title;
                $root.$ul = $ul;
                return $root;
        };
        return {
                appendMock: vi.fn(),
                collapsableList: vi.fn($rootFactory),
                recentsAddFolder: vi.fn(),
        };
});

vi.mock("fileSystem", () => ({ default: vi.fn() }));
vi.mock("sidebarApps", () => ({
        default: { get: vi.fn(() => ({ append: mocks.appendMock })) },
}));
vi.mock("components/collapsableList", () => ({
        default: mocks.collapsableList,
}));
vi.mock("components/fileTree", () => ({ default: vi.fn() }));
vi.mock("components/sidebar", () => ({ default: {} }));
vi.mock("components/tile", () => ({
        default: vi.fn(() => document.createElement("div")),
}));
vi.mock("components/toast", () => ({ default: vi.fn() }));
vi.mock("dialogs/alert", () => ({ default: vi.fn() }));
vi.mock("dialogs/confirm", () => ({ default: vi.fn() }));
vi.mock("dialogs/prompt", () => ({ default: vi.fn() }));
vi.mock("dialogs/select", () => ({ default: vi.fn() }));
vi.mock("lib/fileIcons", () => ({
        default: { onChange: vi.fn(), getIconClass: vi.fn() },
}));
vi.mock("utils/copyEntry", () => ({ default: vi.fn() }));
vi.mock("utils/helpers", () => ({
        default: {
                getIconForFolder: vi.fn(() => "icon folder"),
                getIconForFile: vi.fn(() => "icon file"),
                isFile: vi.fn(() => false),
                isDir: vi.fn(() => true),
                error: vi.fn(),
        },
}));
vi.mock("lib/config", () => ({ default: { FILE_NAME_REGEX: /.+/ } }));
vi.mock("lib/fileList", () => ({
        addRoot: vi.fn(() => Promise.resolve()),
        append: vi.fn(() => Promise.resolve()),
        remove: vi.fn(),
}));
vi.mock("lib/lazyImports", () => ({ loadFileBrowser: vi.fn() }));
vi.mock("lib/openFile", () => ({ default: vi.fn() }));
vi.mock("lib/recents", () => ({
        default: { addFolder: mocks.recentsAddFolder, removeFolder: vi.fn() },
}));
vi.mock("lib/settings", () => ({
        default: {
                value: { fileBrowser: { listFiles: true } },
                OPEN_FILE_LIST_POS_SIDEBAR: "sidebar",
        },
}));

import openFolder, { addedFolder } from "lib/openFolder";

beforeEach(() => {
        // html-tag-js extends String with hashCode(); provide a stub
        if (!String.prototype.hashCode) {
                Object.defineProperty(String.prototype, "hashCode", {
                        value() {
                                let hash = 0;
                                for (let i = 0; i < this.length; i++) {
                                        hash = (hash << 5) - hash + this.charCodeAt(i);
                                        hash |= 0;
                                }
                                return hash;
                        },
                        configurable: true,
                });
        }
        // openFolder talks to the free `editorManager` global
        vi.stubGlobal("editorManager", {
                files: [],
                on: vi.fn(),
                emit: vi.fn(),
                onupdate: vi.fn(),
                getFile: vi.fn(() => null),
        });
        mocks.collapsableList.mockClear();
        mocks.appendMock.mockClear();
        mocks.recentsAddFolder.mockClear();
        addedFolder.length = 0;
});

describe("openFolder duplicate guard", () => {
        it("opens a folder once and appends a single tile", () => {
                openFolder("file:///storage/emulated/0/Project", { name: "Project" });

                expect(addedFolder).toHaveLength(1);
                expect(mocks.collapsableList).toHaveBeenCalledTimes(1);
                expect(mocks.appendMock).toHaveBeenCalledTimes(1);
        });

        it("ignores a second open of the same folder", () => {
                openFolder("file:///storage/emulated/0/Project", { name: "Project" });
                openFolder("file:///storage/emulated/0/Project", { name: "Project" });

                expect(addedFolder).toHaveLength(1);
                expect(mocks.collapsableList).toHaveBeenCalledTimes(1);
        });

        it("treats a trailing-slash variant as the same project", () => {
                // recents may store the SAF url with a trailing slash while the
                // picker returns it without — both are one project
                openFolder("file:///storage/emulated/0/Project", { name: "Project" });
                openFolder("file:///storage/emulated/0/Project/", { name: "Project" });

                expect(addedFolder).toHaveLength(1);
                expect(mocks.collapsableList).toHaveBeenCalledTimes(1);
        });

        it("still opens different folders", () => {
                openFolder("file:///storage/emulated/0/Alpha", { name: "Alpha" });
                openFolder("file:///storage/emulated/0/Beta", { name: "Beta" });

                expect(addedFolder).toHaveLength(2);
                expect(mocks.collapsableList).toHaveBeenCalledTimes(2);
        });
});
