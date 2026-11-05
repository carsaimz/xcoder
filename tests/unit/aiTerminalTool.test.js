import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { terminalManagerMock } = vi.hoisted(() => ({
        terminalManagerMock: {
                terminals: new Map(),
                createTerminal: vi.fn(),
                closeTerminal: vi.fn(),
        },
}));

vi.mock("components/terminal", () => ({
        TerminalManager: terminalManagerMock,
}));

import terminalTool, {
        AI_TERMINAL_NAME,
        clampOutput,
        cleanOutput,
} from "lib/ai/terminalTool";

/** Fake websocket that records listeners and emits PTY frames. */
function makeWebSocket() {
        const listeners = new Map();
        return {
                listeners,
                addEventListener(type, fn) {
                        listeners.set(type, fn);
                },
                removeEventListener(type) {
                        listeners.delete(type);
                },
                emit(data) {
                        listeners.get("message")?.({ data });
                },
        };
}

/** Builds a connected terminal entry wired to emit scripted shell output. */
function makeTerminal({ name = "Terminal 1" } = {}) {
        const ws = makeWebSocket();
        const writes = [];
        const component = {
                serverMode: true,
                remoteSsh: false,
                isConnected: true,
                processExited: false,
                websocket: ws,
                write(data) {
                        writes.push(data);
                        // simulate the shell executing the marker printf line
                        const marker = /"(XC_END_[a-z0-9]+)_\$\?"/.exec(data);
                        if (marker) ws.emit(`${marker[1]}_0\n`);
                },
        };
        const entry = { id: "t1", name, component, file: { makeActive: vi.fn() } };
        return { entry, ws, component, writes };
}

beforeEach(() => {
        terminalManagerMock.terminals.clear();
        terminalManagerMock.createTerminal.mockReset();
        terminalManagerMock.closeTerminal.mockReset();
});

afterEach(() => {
        vi.restoreAllMocks();
});

describe("terminal tool — session actions", () => {
        it("open creates and shows a terminal when none exists", async () => {
                const created = makeTerminal({ name: AI_TERMINAL_NAME });
                terminalManagerMock.createTerminal.mockResolvedValue(created.entry);

                const result = await terminalTool({ action: "open" });

                expect(terminalManagerMock.createTerminal).toHaveBeenCalledWith({
                        name: AI_TERMINAL_NAME,
                });
                expect(created.entry.file.makeActive).toHaveBeenCalled();
                expect(result).toContain(AI_TERMINAL_NAME);
        });

        it("open reuses an existing local terminal", async () => {
                const existing = makeTerminal();
                terminalManagerMock.terminals.set(existing.entry.id, existing.entry);

                const result = await terminalTool({ action: "open" });

                expect(terminalManagerMock.createTerminal).not.toHaveBeenCalled();
                expect(result).toContain("Terminal 1");
        });

        it("close removes the tab through the manager", async () => {
                const existing = makeTerminal({ name: AI_TERMINAL_NAME });
                terminalManagerMock.terminals.set(existing.entry.id, existing.entry);

                const result = await terminalTool({ action: "close" });

                expect(terminalManagerMock.closeTerminal).toHaveBeenCalledWith("t1", true);
                expect(result).toContain("closed");
        });

        it("list reports open terminals", async () => {
                const entry = makeTerminal().entry;
                terminalManagerMock.terminals.set(entry.id, entry);

                const result = await terminalTool({ action: "list" });

                expect(result).toContain("Terminal 1");
                expect(result).toContain("[alpine]");
        });

        it("signal sends Ctrl+C to the terminal", async () => {
                const terminal = makeTerminal();
                terminalManagerMock.terminals.set(terminal.entry.id, terminal.entry);

                await terminalTool({ action: "signal" });

                expect(terminal.writes.at(-1)).toBe("\x03");
        });
});

describe("terminal tool — run", () => {
        it("runs a command, waits for the marker and returns output", async () => {
                const terminal = makeTerminal();
                terminalManagerMock.terminals.set(terminal.entry.id, terminal.entry);
                terminal.component.write = (data) => {
                        terminal.writes.push(data);
                        const echo = data.endsWith("\n") ? data.slice(0, -1) : data;
                        terminal.ws.emit(`$ ${echo}\r\n`);
                        const marker = /"(XC_END_[a-z0-9]+)_\$\?"/.exec(data);
                        if (marker) {
                                terminal.ws.emit("hello from alpine\r\n");
                                terminal.ws.emit(`${marker[1]}_0\r\n`);
                        }
                };

                const result = await terminalTool({
                        action: "run",
                        command: "echo hello",
                });

                expect(result).toContain("hello from alpine");
                expect(result).not.toContain("XC_END_");
                expect(result).not.toContain("timed out");
        });

        it("reports a non-zero exit code", async () => {
                const terminal = makeTerminal();
                terminalManagerMock.terminals.set(terminal.entry.id, terminal.entry);
                terminal.component.write = (data) => {
                        terminal.writes.push(data);
                        const marker = /"(XC_END_[a-z0-9]+)_\$\?"/.exec(data);
                        if (marker) terminal.ws.emit(`${marker[1]}_2\r\n`);
                };

                const result = await terminalTool({
                        action: "run",
                        command: "apk add missing-pkg",
                });

                expect(result).toContain("exit code 2");
        });

        it("refuses to run exit", async () => {
                const result = await terminalTool({ action: "run", command: "exit" });
                expect(result).toContain("ERROR");
                expect(result).toContain("close");
        });

        it("requires a command for the run action", async () => {
                const result = await terminalTool({ action: "run" });
                expect(result).toContain("ERROR");
        });

        it("times out when the command never finishes", async () => {
                const terminal = makeTerminal();
                terminalManagerMock.terminals.set(terminal.entry.id, terminal.entry);
                terminal.component.write = (data) => {
                        terminal.writes.push(data);
                        // shell echoes the typed line but never prints the marker
                        terminal.ws.emit(`$ ${data}`);
                };

                const result = await terminalTool({
                        action: "run",
                        command: "sleep infinity",
                        timeout_ms: 3000,
                });

                expect(result).toContain("timed out");
                expect(result).toContain("signal");
        }, 10_000);

        it("serializes concurrent runs", async () => {
                const terminal = makeTerminal();
                terminalManagerMock.terminals.set(terminal.entry.id, terminal.entry);
                terminal.component.write = (data) => {
                        terminal.writes.push(data);
                        const marker = /"(XC_END_[a-z0-9]+)_\$\?"/.exec(data);
                        if (marker) terminal.ws.emit(`${marker[1]}_0\r\n`);
                };

                const [first, second] = await Promise.all([
                        terminalTool({ action: "run", command: "echo one" }),
                        terminalTool({ action: "run", command: "echo two" }),
                ]);

                expect(first).not.toContain("ERROR");
                expect(second).not.toContain("ERROR");
                // commands reached the PTY one after another
                const firstCmd = terminal.writes.indexOf("echo one\n");
                const secondCmd = terminal.writes.indexOf("echo two\n");
                expect(firstCmd).toBeGreaterThanOrEqual(0);
                expect(secondCmd).toBeGreaterThan(firstCmd);
        }, 15_000);
});

describe("output helpers", () => {
        it("cleanOutput strips ANSI escapes and carriage returns", () => {
                const cleaned = cleanOutput("\x1b[32mgreen\x1b[0m text\r\nsecond\r");
                expect(cleaned).toBe("green text\nsecond\n");
        });

        it("clampOutput keeps head and tail of long output", () => {
                const long = `${"a".repeat(9000)}MIDDLE${"z".repeat(9000)}`;
                const clamped = clampOutput(long, 1000);
                expect(clamped.length).toBeLessThan(1200);
                expect(clamped).toContain("chars omitted");
                expect(clamped.startsWith("a")).toBe(true);
                expect(clamped.endsWith("z")).toBe(true);
        });

        it("clampOutput returns short text untouched", () => {
                expect(clampOutput("short", 1000)).toBe("short");
        });
});
