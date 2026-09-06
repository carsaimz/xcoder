/**
 * checkSidebarImports.mjs — static guard: every src file that USES the free
 * identifier `Sidebar` (Acode-style static API) must have a top-level
 * `import Sidebar from "components/sidebar"` (any form: default, mixed or
 * named), OR a same-file local `const { default: Sidebar } =
 * await import("components/sidebar")` that precedes the usage, OR be the
 * defining module itself.
 *
 * Missing imports only explode at RUNTIME (ReferenceError inside the sidebar
 * app chunk — see "Sidebar is not defined" boot crash fixed in v1.5.1) and
 * tsc has checkJs:false, so this source-level check is the net.
 *
 * Usage: node scripts/checkSidebarImports.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = "/home/z/my-project/xcoder";

let files;
try {
        files = execSync(
                `rg -l -P '(?<![.\\w/"\\x27-])Sidebar(?![\\w"\\x27-])' src/ --glob '*.js' --glob '*.ts'`,
                { cwd: ROOT, encoding: "utf8" },
        )
                .trim()
                .split("\n")
                .filter(Boolean);
} catch (error) {
        // rg exits 1 when there are no matches
        files = [];
}

const stripComments = (src) =>
        src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const stripStrings = (src) =>
        // remove double/single-quoted and template literals (keeps code structure)
        src.replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
                .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
                .replace(/`(?:[^`\\]|\\.)*`/g, "``");

// length-preserving variant: string CONTENTS become filler so indexes stay
// aligned with the original source (needed when comparing match positions
// across the stripped and unstripped views)
const stripStringsKeepLength = (src) =>
        src
                .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => '"' + "x".repeat(m.length - 2) + '"')
                .replace(/'(?:[^'\\\n]|\\.)*'/g, (m) => "'" + "x".repeat(m.length - 2) + "'")
                .replace(/`(?:[^`\\]|\\.)*`/g, (m) => "`" + "x".repeat(m.length - 2) + "`");

const failures = { count: 0 };
for (const rel of files) {
        const file = path.join(ROOT, rel);
        const raw = fs.readFileSync(file, "utf8");
        const noComments = stripComments(raw);
        // strings become length-preserving filler so indexes align with the
        // original source (identifiers inside strings can't false-positive)
        const code = stripStringsKeepLength(noComments);

        // the defining module itself
        if (rel === "src/components/sidebar/index.js") {
                console.log(`OK (define Sidebar): ${rel}`);
                continue;
        }

        const uses = /(?<![.\w/"\x27-])Sidebar(?![\w"\x27-])/.test(code);
        if (!uses) {
                console.log(`OK (só comentários/strings): ${rel}`);
                continue;
        }

        // top-level import, any form: default / mixed / named
        const hasTopImport =
                /^import\s+Sidebar\s+from\s+["']components\/sidebar["']/m.test(raw) ||
                /^import\s+Sidebar\s*,\s*\{[^}]*\}\s*from\s+["']components\/sidebar["']/m.test(
                        raw,
                ) ||
                /^import\s+\{[^}]*\bSidebar\b[^}]*\}\s*from\s+["']components\/sidebar["']/m.test(
                        raw,
                );

        // local dynamic destructure (same-function usage pattern) — matched on
        // the comment-stripped source so the module URL is still intact
        const firstUse = code.search(/(?<![.\w/"\x27-])Sidebar(?![\w"\x27-])/);
        const localImport =
                /const\s*\{\s*default\s*:\s*Sidebar\s*\}\s*=\s*await\s+import\(\s*["']components\/sidebar["']\s*\)/.exec(
                        noComments,
                );
        const hasLocalBeforeUse = Boolean(
                localImport && firstUse >= 0 && localImport.index < firstUse,
        );

        if (hasTopImport) {
                console.log(`OK (import top-level ✓): ${rel}`);
        } else if (hasLocalBeforeUse) {
                console.log(`OK (import local antes do uso ✓): ${rel}`);
        } else {
                failures.count += 1;
                console.log(`*** FALTANDO IMPORT DE Sidebar ***: ${rel}`);
        }
}

console.log(
        failures.count === 0
                ? "\nTodos os usos de Sidebar têm import válido ✓"
                : `\n${failures.count} arquivo(s) com Sidebar NÃO importado ✗`,
);
process.exit(failures.count === 0 ? 0 : 1);
