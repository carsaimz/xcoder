/**
 * XCoder build configuration script.
 *
 * Simplified from the upstream free/paid variant system: XCoder has a single
 * variant with all features unlocked and no AdMob/IAP plugin syncing.
 *
 * Usage: node utils/config.js [p|prod|d|dev]
 */
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");

const LOGO_COLORS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0f172a</color>
    <color name="ic_splash_background">#0f172a</color>
</resources>`;

const mode = process.argv[2] === "p" || process.argv[2] === "prod" ? "p" : "d";

// Sync .babelrc compact flag with build mode
const babelPath = path.join(rootDir, ".babelrc");
try {
	const babelConfig = JSON.parse(fs.readFileSync(babelPath, "utf8"));
	const compact = mode === "p";
	if (babelConfig.compact !== compact) {
		babelConfig.compact = compact;
		fs.writeFileSync(
			babelPath,
			`${JSON.stringify(babelConfig, undefined, 2)}\n`,
			"utf8",
		);
	}
} catch (error) {
	console.warn(`Unable to update .babelrc compact flag: ${error.message}`);
}

// Write launcher/splash background colors
const logoPath = path.join(rootDir, "res/android/values/ic_launcher_background.xml");
fs.writeFileSync(logoPath, LOGO_COLORS, "utf8");

// Keep config.xml version in sync with package.json
const configPath = path.join(rootDir, "config.xml");
const packagePath = path.join(rootDir, "package.json");
try {
	const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
	let config = fs.readFileSync(configPath, "utf8");
	const versionMatch = /<widget[^>]*?\sversion=["']([^"']+)["']/.exec(config);
	if (versionMatch && versionMatch[1] !== packageJson.version) {
		config = config.replace(
			/(\sversion=")([^"']+)(")/,
			`$1${packageJson.version}$3`,
		);
		fs.writeFileSync(configPath, config, "utf8");
	}
} catch (error) {
	console.warn(`Unable to sync version: ${error.message}`);
}

console.log(`XCoder config ready (mode: ${mode === "p" ? "production" : "development"})`);
