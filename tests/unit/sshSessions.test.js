// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let sshSessions;

beforeEach(async () => {
        vi.resetModules();
        localStorage.clear();
        sshSessions = await import("lib/sshSessions");
});

afterEach(() => {
        vi.restoreAllMocks();
});

describe("ssh host visuals", () => {
        it("derives stable hue and initials for the same host", () => {
                const a = sshSessions.sshHostAvatar("my-vps.example.com");
                const b = sshSessions.sshHostAvatar("my-vps.example.com");
                expect(a).toEqual(b);
                expect(a.initials).toMatch(/^[A-Z0-9S]{1,2}$/);
                expect(a.hue).toBeGreaterThanOrEqual(0);
                expect(a.hue).toBeLessThan(360);
                expect(a.bg).toContain("hsl(");
        });

        it("different hosts usually get different colors", () => {
                const hues = new Set(
                        ["alpha", "beta", "gamma", "delta", "omega"].map((name) =>
                                sshSessions.sshHostHue(name),
                        ),
                );
                expect(hues.size).toBeGreaterThan(2);
        });

        it("builds user@host:port labels from sftp profile URLs", () => {
                expect(
                        sshSessions.sshHostLabel("sftp://profile-abc@10.0.0.5:2222/"),
                ).toBe("profile-abc@10.0.0.5:2222");
                expect(sshSessions.sshHostLabel("not a url")).toBe("");
        });
});

describe("per-host home directory", () => {
        it("stores and clears a home dir per profile", () => {
                sshSessions.setHostHomeDir("profile-a", "/home/user");
                expect(sshSessions.getHostHomeDir("profile-a")).toBe("/home/user");

                sshSessions.setHostHomeDir("profile-a", "");
                expect(sshSessions.getHostHomeDir("profile-a")).toBe("");
        });

        it("keeps hosts independent", () => {
                sshSessions.setHostHomeDir("profile-a", "/srv");
                sshSessions.setHostHomeDir("profile-b", "/var");
                expect(sshSessions.getHostHomeDir("profile-a")).toBe("/srv");
                expect(sshSessions.getHostHomeDir("profile-b")).toBe("/var");
        });
});

describe("per-host command history", () => {
        it("records finished commands and dedupes consecutive repeats", () => {
                sshSessions.recordCommand("profile-a", "ls -la");
                sshSessions.recordCommand("profile-a", "ls -la");
                sshSessions.recordCommand("profile-a", "cd /var/log");
                expect(sshSessions.getHistory("profile-a")).toEqual([
                        "ls -la",
                        "cd /var/log",
                ]);
        });

        it("sanitizes control characters and rejects junk", () => {
                expect(sshSessions.sanitizeCommand("  ls \r")).toBe("ls");
                expect(sshSessions.sanitizeCommand("a\u0007b")).toBe("ab");
                expect(sshSessions.sanitizeCommand("   ")).toBe("");
                expect(
                        sshSessions.sanitizeCommand("x".repeat(sshSessions.SSH_MAX_COMMAND_LENGTH + 1)),
                ).toBe("");
        });

        it("caps history at SSH_HISTORY_CAP entries", () => {
                for (let i = 0; i < sshSessions.SSH_HISTORY_CAP + 20; i++) {
                        sshSessions.recordCommand("profile-a", `cmd-${i}`);
                }
                const history = sshSessions.getHistory("profile-a");
                expect(history).toHaveLength(sshSessions.SSH_HISTORY_CAP);
                expect(history[history.length - 1]).toBe(
                        `cmd-${sshSessions.SSH_HISTORY_CAP + 19}`,
                );
        });

        it("clears history per host", () => {
                sshSessions.recordCommand("profile-a", "ls");
                sshSessions.recordCommand("profile-b", "pwd");
                sshSessions.clearHistory("profile-a");
                expect(sshSessions.getHistory("profile-a")).toEqual([]);
                expect(sshSessions.getHistory("profile-b")).toEqual(["pwd"]);
        });

        it("forgetHost removes both settings and history", () => {
                sshSessions.setHostHomeDir("profile-a", "/root");
                sshSessions.recordCommand("profile-a", "ls");
                sshSessions.forgetHost("profile-a");
                expect(sshSessions.getHostHomeDir("profile-a")).toBe("");
                expect(sshSessions.getHistory("profile-a")).toEqual([]);
        });
});

describe("hidden input guard", () => {
        it("flags password-like prompts", () => {
                for (const line of [
                        "[sudo] password for user:",
                        "Enter passphrase for key:",
                        "Password:",
                        "Verification code:",
                ]) {
                        expect(sshSessions.looksLikeHiddenInput(line)).toBe(true);
                }
        });

        it("allows regular prompt lines", () => {
                expect(sshSessions.looksLikeHiddenInput("user@host:~$ ")).toBe(false);
                expect(sshSessions.looksLikeHiddenInput("")).toBe(false);
        });
});

describe("initial directory resolution", () => {
        it("explicit option wins over everything", () => {
                expect(
                        sshSessions.resolveInitialDirectory({
                                initialDirectory: "/opt",
                                homeDir: "/home/x",
                                urlPath: "/srv",
                        }),
                ).toBe("/opt");
        });

        it("stored home dir beats the URL path", () => {
                expect(
                        sshSessions.resolveInitialDirectory({ homeDir: "/home/x", urlPath: "/" }),
                ).toBe("/home/x");
        });

        it("falls back to /", () => {
                expect(sshSessions.resolveInitialDirectory({})).toBe("/");
        });
});

describe("terminal recording guard (source-level)", () => {
        it("trackRemoteInput is wired into the SSH shell onData handler", async () => {
                const src = await import("node:fs").then((fs) =>
                        fs.promises.readFile("src/components/terminal/terminal.js", "utf8"),
                );
                expect(src).toContain("this.trackRemoteInput(data)");
                expect(src).toContain("looksLikeHiddenInput(this.getRemoteCursorLineText())");
                expect(src).toContain("recordCommand(profile.profileId, line)");
        });
});
