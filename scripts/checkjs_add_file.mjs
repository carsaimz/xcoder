#!/usr/bin/env node
/**
 * Progressive checkJs ratchet helper.
 *
 * XCoder type-checks plain JS one file at a time (tsconfig.checkjs.json).
 * Because checkJs pulls the whole import closure of each included file into
 * the program, a file that imports half the app (e.g. src/lib/ai/markdown.js)
 * brings ~11k errors from the rest of src/ along. Measure a candidate BEFORE
 * adding it to the ratchet:
 *
 *   node scripts/checkjs_add_file.mjs src/lib/ai/agent.js
 *
 * Prints the actual error count for the file (including its closure) so the
 * JSDoc can be fixed — or the file left out — before wiring it into
 * tsconfig.checkjs.json (npm run typecheck:checkjs must stay green).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const fileArg = process.argv[2];
if (!fileArg) {
	console.error(
		"usage: node scripts/checkjs_add_file.mjs <repo-relative .js file>",
	);
	process.exit(2);
}

const file = path.normalize(fileArg);
if (!fs.existsSync(file)) {
	console.error(`not found: ${file}`);
	process.exit(2);
}

const include = [file.replaceAll("\\", "/")];
const probe = {
	extends: "./tsconfig.json",
	compilerOptions: {
		noEmit: true,
		checkJs: true,
		useUnknownInCatchVariables: false,
	},
	include,
	exclude: ["node_modules"],
};
const probePath = "tsconfig.checkjs-probe.json";
fs.writeFileSync(probePath, JSON.stringify(probe, null, 2));

let out;
try {
	out = execFileSync(
		process.execPath,
		[path.join("node_modules", "typescript", "bin", "tsc"), "-p", probePath],
		{ encoding: "utf8" },
	);
} finally {
	fs.rmSync(probePath, { force: true });
}

const errors = out
	.split(/\r?\n/)
	.filter((line) => line.includes("error TS"));
console.log(`${file}: ${errors.length} error(s)`);
console.log(errors.slice(0, 20).join("\n"));
if (errors.length > 20) console.log(`... ${errors.length - 20} more`);
process.exit(errors.length ? 1 : 0);
