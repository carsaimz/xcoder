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

import { existsSync } from "node:fs";

/** git-bash ships with Git for Windows; msys64 is the other usual home. */
function findBash() {
	if (process.platform !== "win32") return "bash";
	return (
		[
			process.env.XCODER_TEST_BASH,
			"C:\\Program Files\\Git\\bin\\bash.exe",
			"C:\\Program Files\\Git\\usr\\bin\\bash.exe",
			"C:\\msys64\\usr\\bin\\bash.exe",
		].filter(Boolean).find(existsSync) ?? null
	);
}

const BASH = findBash();
const itCli = BASH === null ? it.skip : it;
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
        return spawnSync(BASH, [join(binDir, script), ...args], {
                cwd: workdir,
                encoding: "utf8",
                input: "",
                ...fileArgs,
        });
}

/**
 * msys bash reports POSIX views of the tempdir on Windows ("/tmp/...")
 * while the test variables hold Windows paths. The CLI is the source of
 * truth for what it emits (realpath of the arg), so resolve expectations
 * through the same bash that runs the script.
 */
function bashAbsPath(arg) {
	const res = spawnSync(BASH, ["-c", `realpath -m ${JSON.stringify(arg)}`], {
		cwd: workdir,
		encoding: "utf8",
		input: "",
	});
	return (res.stdout || "").trim();
}
describe("terminal CLI scripts (init-alpine.sh heredocs)", () => {
        itCli("ships an update-propagation version marker", () => {
                // Older installs already extracted CLI v1 — the guard must
                // rewrite the scripts whenever the marker version differs.
                expect(initSource).toMatch(/\.xcoder-cli-version/);
                expect(initSource).toMatch(/\$CLI_VERSION/);
                expect(initSource).toMatch(/CLI_VERSION="2"/);
        });

        itCli("acode open <file> emits the OSC 7777 open sequence", () => {
                const file = join(workdir, "main.c");
                writeFileSync(file, "int main() {}\n");
                const res = run("acode", ["open", "main.c"]);
                expect(res.status).toBe(0);
                // OSC: ESC ] 7777 ; open ; file ; <abs path> BEL
                expect(res.stdout).toContain(
                        `\x1b]7777;open;file;${bashAbsPath("main.c")}\x07`,
                );
        });

        itCli("xcoder open <folder> reports type=folder", () => {
                const dir = join(workdir, "src");
                mkdirSync(dir);
                const res = run("xcoder", ["open", "src"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;folder;${bashAbsPath("src")}\x07`);
        });

        itCli("acode <file> keeps the positional form working", () => {
                const file = join(workdir, "notes.txt");
                writeFileSync(file, "hello");
                const res = run("acode", ["notes.txt"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;file;${bashAbsPath("notes.txt")}\x07`);
        });

        itCli("multiple paths open in one invocation", () => {
                const a = join(workdir, "a.js");
                const b = join(workdir, "b.js");
                writeFileSync(a, "");
                writeFileSync(b, "");
                const res = run("acode", ["open", "a.js", "b.js"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;file;${bashAbsPath("a.js")}\x07`);
                expect(res.stdout).toContain(`\x1b]7777;open;file;${bashAbsPath("b.js")}\x07`);
        });

        itCli("open without a path fails with usage", () => {
                const res = run("acode", ["open"]);
                expect(res.status).toBe(1);
                expect(res.stderr).toMatch(/requires a file or folder/);
        });

        itCli("missing paths fail with a clear error", () => {
                const res = run("acode", ["open", "definitely-missing-xyz.js"]);
                expect(res.status).toBe(1);
                expect(res.stderr).toMatch(/does not exist/);
        });

        itCli("--version prints the CLI version", () => {
                const res = run("acode", ["--version"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toMatch(/xcoder CLI 2/);
        });

        itCli("--help documents the acode-compatible form", () => {
                const res = run("acode", ["--help"]);
                expect(res.status).toBe(0);
                expect(res.stdout).toMatch(/acode open/);
        });

        itCli("no arguments opens the current folder", () => {
                const res = run("acode", []);
                expect(res.status).toBe(0);
                expect(res.stdout).toContain(`\x1b]7777;open;folder;${bashAbsPath(".")}\x07`);
        });
});
