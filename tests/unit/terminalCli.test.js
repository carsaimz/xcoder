/**
 * Functional tests for the terminal CLI tools (xcoder + acode).
 *
 * The scripts are shipped as heredocs inside
 * src/plugins/terminal/scripts/init-alpine.sh and written into the alpine
 * rootfs on terminal install. Instead of source-asserting the shell code,
 * we extract the exact heredoc payload and run it with a real bash:
 * the CLI is a pure bash script (realpath/dirname/basename/pwd only), so
 * the escape-sequence protocol can be verified end to end.
 *
 * Roadmap v1.5.x item 1 — "CLI `acode` no terminal": `acode open <file>`
 * must behave like Acode v1.11.8 and reuse the OSC 7777 bridge already
 * consumed by src/components/terminal/terminalManager.js.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const INIT_SCRIPT = join(
        process.cwd(),
        "src/plugins/terminal/scripts/init-alpine.sh",
);
const initSource = readFileSync(INIT_SCRIPT, "utf8");

/** Extract a heredoc payload (between `cat <<'MARKER'` and the marker line). */
function extractHeredoc(marker) {
        const start = initSource.indexOf(`<<'${marker}'`);
        expect(start, `heredoc ${marker} exists in init-alpine.sh`).toBeGreaterThan(-1);
        const bodyStart = initSource.indexOf("\n", start) + 1;
        const end = initSource.indexOf(`\n${marker}\n`, bodyStart);
        expect(end, `heredoc ${marker} terminator found`).toBeGreaterThan(-1);
        return initSource.slice(bodyStart, end);
}

let workdir;
let binDir;

beforeEach(() => {
        workdir = mkdtempSync(join(tmpdir(), "xcoder-cli-"));
        binDir = join(workdir, "usr", "local", "bin");
        mkdirSync(binDir, { recursive: true });
        const scripts = { xcoder: extractHeredoc("XCODER_CLI"), acode: extractHeredoc("ACODE_CLI") };
        for (const [name, body] of Object.entries(scripts)) {
                const path = join(binDir, name);
                writeFileSync(path, `${body}\n`);
                chmodSync(path, 0o755);
        }
});

afterEach(() => {
        rmSync(workdir, { recursive: true, force: true });
});

function run(script, args, fileArgs = []) {
        return spawnSync("bash", [join(binDir, script), ...args], {
                cwd: workdir,
                encoding: "utf8",
                input: "",
                ...fileArgs,
        });
}

describe("terminal CLI scripts (init-alpine.sh heredocs)", () => {
        it("ships an update-propagation version marker", () => {
                // Older installs already extracted CLI v1 — the guard must
                // rewrite the scripts whenever the marker version differs.
                expect(initSource).toMatch(/\.xcoder-cli-version/);
                expect(initSource).toMatch(/\$CLI_VERSION/);
                expect(initSource).toMatch(/CLI_VERSION="2"/);
        });

        it("acode open <file> emits the OSC 7777 open sequence", () => {
                const file = join(workdir, "main.c");
                writeFileSync(file, "int main() {}\n");
                const res = run("acode", ["open", "main.c"]);
                expect(res.status).toBe(0);
                // OSC: ESC ] 7777 ; open ; file ; <abs path> BEL
                expect(res.stdout).toContain(
                        `\x1b]7777;open;file;${file}\x07`,
                );
        });

        it("xcoder open <folder> reports type=folder", () => {
                const dir = join(workdir, "src");
                mkdirSync(dir);
                const res = run("xcoder", ["open", "src"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;folder;${dir}\x07`);
        });

        it("acode <file> keeps the positional form working", () => {
                const file = join(workdir, "notes.txt");
                writeFileSync(file, "hello");
                const res = run("acode", ["notes.txt"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;file;${file}\x07`);
        });

        it("multiple paths open in one invocation", () => {
                const a = join(workdir, "a.js");
                const b = join(workdir, "b.js");
                writeFileSync(a, "");
                writeFileSync(b, "");
                const res = run("acode", ["open", "a.js", "b.js"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;file;${a}\x07`);
                expect(res.stdout).toContain(`\x1b]7777;open;file;${b}\x07`);
        });

        it("open without a path fails with usage", () => {
                const res = run("acode", ["open"]);
                expect(res.status).toBe(1);
                expect(res.stderr).toMatch(/requires a file or folder/);
        });

        it("missing paths fail with a clear error", () => {
                const res = run("acode", ["open", "definitely-missing-xyz.js"]);
                expect(res.status).toBe(1);
                expect(res.stderr).toMatch(/does not exist/);
        });

        it("--version prints the CLI version", () => {
                const res = run("acode", ["--version"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toMatch(/xcoder CLI 2/);
        });

        it("--help documents the acode-compatible form", () => {
                const res = run("acode", ["--help"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toMatch(/acode open/);
        });

        it("no arguments opens the current folder", () => {
                const res = run("acode", []);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;folder;${workdir}\x07`);
        });
});
