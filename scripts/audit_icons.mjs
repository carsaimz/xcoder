#!/usr/bin/env node
/**
 * Audit icon classes used across src/ against the icon font CSS.
 * Usage: node scripts/audit_icons.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const SRC = "src";
const css = readFileSync("src/res/icons/style.css", "utf8");
const defined = new Set();
for (const m of css.matchAll(/\.icon\.([a-z_0-9]+):before/g)) defined.add(m[1]);
// compound classes: remove_red_eyevisibility -> not usable as-is, note them
const compounds = [...defined].filter((c) => !defined.has(c) && c.length > 20);

const used = new Map(); // name -> [file:line]
function walk(dir) {
        for (const name of readdirSync(dir)) {
                const p = join(dir, name);
                const st = statSync(p);
                if (st.isDirectory()) {
                        if (name === "node_modules") continue;
                        walk(p);
                        continue;
                }
                const ext = extname(name);
                if (![".js", ".jsx", ".ts", ".tsx", ".html", ".scss"].includes(ext)) continue;
                const text = readFileSync(p, "utf8");
                const lines = text.split("\n");
                lines.forEach((line, i) => {
                        // match `icon name`, className="icon a b", class="icon x"
                        for (const m of line.matchAll(/icon\s+([a-z_][a-z_0-9 ]*[a-z_0-9])/gi)) {
                                for (const cls of m[1].split(/\s+/)) {
                                        if (!cls || cls === "icon") continue;
                                        // skip obvious non-icon words
                                        if (["xc-svgicon", "floating", "launch"].includes(cls)) {
                                                if (cls !== "launch") continue;
                                        }
                                        const key = cls;
                                        if (!used.has(key)) used.set(key, []);
                                        used.get(key).push(`${p}:${i + 1}`);
                                }
                        }
                        // svg: usage
                });
        }
}
walk(SRC);

const missing = [];
for (const [name, locs] of [...used.entries()].sort()) {
        if (!defined.has(name)) missing.push([name, locs]);
}
console.log("=== MISSING icon classes (used but not in style.css) ===");
for (const [name, locs] of missing) {
        console.log(`${name}  (${locs.length}x)  e.g. ${locs[0]}`);
}
if (!missing.length) console.log("none 🎉");
console.log("\n=== compound class names in css ===");
console.log(compounds.join("\n") || "none");
