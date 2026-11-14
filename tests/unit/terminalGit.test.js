import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fileSystem", () => ({
        default: () => ({
                exists: async () => false,
        }),
}));
vi.mock("../../src/lib/git/credentials", () => ({
        resolveCredentials: async () => ({
                username: "x-access-token",
                password: "ghp_secrettoken",
                token: "ghp_secrettoken",
        }),
}));

import {
        authedUrl,
        ensureAlpineGit,
        execAlpine,
        maskSecrets,
        terminalClone,
} from "../../src/lib/git/terminalGit";

/** Installs a controllable fake window.Executor. */
function fakeExecutor(handler) {
        const calls = [];
        const executor = {
                start: vi.fn((command, onData, alpine) => {
                        calls.push({ command, alpine });
                        return Promise.resolve(`uuid-${calls.length}`).then((id) => {
                                handler?.({ command, onData, alpine, id });
                                return id;
                        });
                }),
                stop: vi.fn(() => Promise.resolve("stopped")),
        };
        globalThis.Executor = executor;
        return executor;
}

describe("git terminal bridge", () => {
        beforeEach(() => {
                delete globalThis.Executor;
        });

        it("masks embedded credentials in logs", () => {
                expect(
                        maskSecrets("cloning https://user:ghp_secret@github.com/a/b.git"),
                ).toBe("cloning https://***@github.com/a/b.git");
                expect(maskSecrets("no secrets here")).toBe("no secrets here");
        });

        it("embeds the session token in terminal git urls", () => {
                expect(
                        authedUrl("https://github.com/carsaimz/xcoder.git", {
                                username: "x-access-token",
                                password: "ghp_secrettoken",
                        }),
                ).toBe("https://x-access-token:ghp_secrettoken@github.com/carsaimz/xcoder.git");
                // no credentials → url untouched
                expect(
                        authedUrl("https://github.com/a/b.git", { username: "x" }),
                ).toBe("https://github.com/a/b.git");
        });

        it("runs one-shot commands in the Alpine sandbox and reads the exit code", async () => {
                fakeExecutor(({ onData }) => {
                        setTimeout(() => {
                                onData("stdout", "hello from alpine");
                                onData("exit", "0");
                        }, 10);
                });
                const result = await execAlpine("echo hello from alpine", {
                        timeoutMs: 5000,
                });
                expect(result.code).toBe(0);
                expect(result.output).toContain("hello from alpine");
        });

        it("auto-installs git in Alpine when missing", async () => {
                const executor = fakeExecutor(({ command, onData }) => {
                        setTimeout(() => {
                                if (command.includes("command -v git")) {
                                        onData("stdout", "__NOGIT__");
                                        onData("exit", "1");
                                } else if (command.startsWith("apk add")) {
                                        onData("stdout", "Installing git…");
                                        onData("exit", "0");
                                } else {
                                        onData("exit", "0");
                                }
                        }, 5);
                });
                const status = await ensureAlpineGit();
                expect(status).toBe("installed");
                expect(
                        executor.start.mock.calls.some((call) =>
                                String(call[0]).startsWith("apk add"),
                        ),
                ).toBe(true);
        });

        it("skips the install when git is already present", async () => {
                const executor = fakeExecutor(({ command, onData }) => {
                        setTimeout(() => {
                                if (command.includes("command -v git")) {
                                        onData("stdout", "__GIT_OK__");
                                        onData("exit", "0");
                                } else {
                                        onData("exit", "0");
                                }
                        }, 5);
                });
                expect(await ensureAlpineGit()).toBe("present");
                expect(
                        executor.start.mock.calls.some((call) =>
                                String(call[0]).startsWith("apk add"),
                        ),
                ).toBe(false);
        });

        const SANDBOX_ROOT = "file:///data/user/0/com.carsaimz.xcoder/files/workspace";

        it("clones through the terminal into the sandbox-mapped folder", async () => {
                const logs = [];
                let cloneCommand = "";
                fakeExecutor(({ command, onData }) => {
                        setTimeout(() => {
                                if (command.includes("command -v git")) {
                                        onData("stdout", "__GIT_OK__");
                                        onData("exit", "0");
                                } else if (command.includes("git clone")) {
                                        cloneCommand = command;
                                        onData("stdout", "Cloning into 'xcoder'…");
                                        onData("exit", "0");
                                } else {
                                        onData("exit", "0");
                                }
                        }, 5);
                });
                const { dirUrl } = await terminalClone(
                        {
                                url: "https://github.com/carsaimz/xcoder.git",
                                root: SANDBOX_ROOT,
                                dir: "xcoder",
                        },
                        { onLog: (line) => logs.push(line) },
                );
                expect(dirUrl).toBe(`${SANDBOX_ROOT}/xcoder`);
                expect(cloneCommand).toContain("git clone");
                expect(cloneCommand).toContain(
                        "/data/user/0/com.carsaimz.xcoder/files/workspace/xcoder",
                );
        });

        it("surfaces clone failures without leaking the token", async () => {
                fakeExecutor(({ command, onData }) => {
                        setTimeout(() => {
                                if (command.includes("command -v git")) {
                                        onData("stdout", "__GIT_OK__");
                                        onData("exit", "0");
                                } else if (command.includes("git clone")) {
                                        onData(
                                                "stderr",
                                                "fatal: authentication failed for https://x-access-token:ghp_secrettoken@github.com/",
                                        );
                                        onData("exit", "128");
                                } else {
                                        onData("exit", "0");
                                }
                        }, 5);
                });
                await expect(
                        terminalClone({
                                url: "https://github.com/carsaimz/xcoder.git",
                                root: SANDBOX_ROOT,
                                dir: "xcoder",
                        }),
                ).rejects.toThrow(/git clone falhou/);
        });
});
