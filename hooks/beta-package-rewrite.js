/* eslint-disable no-console */
/**
 * after_prepare hook — keeps Java sources compiling when the application
 * id is not the stable one.
 *
 * Beta builds run with the side-by-side package id
 * `com.carsaimz.xcoder.beta` (utils/scripts/apply-beta-package.mjs). The
 * Android R class is generated under the CURRENT application id, so any
 * plugin Java source that hard-codes `import com.carsaimz.xcoder.R;`
 * stops compiling («package R does not exist») as soon as the id changes.
 *
 * This hook rewrites that import to the id actually configured in
 * config.xml, so stable and beta builds both work from the same sources.
 */
const fs = require("fs");
const path = require("path");

main();

function main() {
	try {
		const root = path.resolve(__dirname, "..");
		const configXml = fs.readFileSync(path.join(root, "config.xml"), "utf8");
		const idMatch = configXml.match(/<widget[^>]*\sid="([^"]+)"/);
		if (!idMatch) {
			console.warn("[beta-package-rewrite] widget id not found — skipping");
			return;
		}
		const appId = idMatch[1];
		const stableR = "com.carsaimz.xcoder.R";

		if (appId === "com.carsaimz.xcoder") {
			// stable build — sources already import the right R
			return;
		}

		const srcDir = path.join(root, "platforms/android/app/src");
		if (!fs.existsSync(srcDir)) {
			console.warn("[beta-package-rewrite] platform sources missing — skipping");
			return;
		}

		let changed = 0;
		rewriteImports(srcDir, (content) => {
			const next = content.split(`import ${stableR};`).join(`import ${appId}.R;`);
			if (next !== content) changed++;
			return next;
		});
		console.log(
			`[beta-package-rewrite] appId=${appId} — rewrote R import in ${changed} file(s)`,
		);

		// Firebase's google-services plugin validates package_name against
		// the applicationId — point the copied file at the beta id too
		const gsPath = path.join(
			root,
			"platforms/android/app/google-services.json",
		);
		if (fs.existsSync(gsPath)) {
			const gs = fs.readFileSync(gsPath, "utf8");
			const next = gs.split(`"package_name": "${stableR.replace(/\.R$/, "")}"`).join(`"package_name": "${appId}"`);
			if (next !== gs) {
				fs.writeFileSync(gsPath, next);
				console.log("[beta-package-rewrite] google-services.json updated");
			}
		}
	} catch (error) {
		console.warn("[beta-package-rewrite] failed:", error?.message || error);
	}
}

function rewriteImports(dir, transform) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			rewriteImports(full, transform);
		} else if (entry.name.endsWith(".java")) {
			const content = fs.readFileSync(full, "utf8");
			if (content.includes("import com.carsaimz.xcoder.R;")) {
				fs.writeFileSync(full, transform(content));
			}
		}
	}
}
