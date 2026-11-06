// setup xcoder for the first time
// 1. install dependencies (npm is canonical — CI runs npm ci)
// 2. add cordova platform android (pinned cordova-android from node_modules)
// 3. install cordova plugins
// cordova-plugin-buildinfo
// cordova-plugin-device
// cordova-plugin-file
// all the plugins in ./src/plugins

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const PLATFORM_FILES = [".DS_Store"];
const PACKAGE_MANAGERS = new Set(["bun", "npm", "pnpm", "yarn"]);
function getPackageManager() {
	const userAgent = process.env.npm_config_user_agent;
	const packageManager = userAgent?.split("/")[0];

	if (PACKAGE_MANAGERS.has(packageManager)) {
		return packageManager;
	}

	return "npm";
}

function installDependencies() {
	const packageManager = getPackageManager();

	try {
		execSync(`${packageManager} install`, { stdio: "inherit" });
	} catch (error) {
		if (packageManager === "npm") {
			throw error;
		}

		console.warn(
			`Failed to install dependencies with ${packageManager}. Falling back to npm.`,
		);
		execSync("npm install", { stdio: "inherit" });
	}
}

installDependencies();

// Cordova platform: prefer the pinned copy in node_modules (deterministic),
// fall back to the registry. Failures must be LOUD — a masked failure
// surfaces later as "No platforms added to this project".
try {
	execSync("cordova platform add ./node_modules/cordova-android", {
		stdio: "inherit",
	});
} catch {
	try {
		execSync("cordova platform add android@15", { stdio: "inherit" });
	} catch (error) {
		console.error(
			"Failed to add Android platform. Install dependencies first " +
				"and check the Android SDK (API 36) / Java 17 setup.",
			error,
		);
	}
}

// Cross-platform (mkdir -p shell syntax does not exist on Windows cmd).
for (const dir of ["www/css/build", "www/js/build"]) {
	fs.mkdirSync(path.join(__dirname, "..", dir), { recursive: true });
}

execSync("cordova plugin add cordova-plugin-buildinfo", { stdio: "inherit" });
execSync("cordova plugin add cordova-plugin-device", { stdio: "inherit" });
execSync("cordova plugin add cordova-plugin-file", { stdio: "inherit" });

const plugins = fs.readdirSync(path.join(__dirname, "../src/plugins"));
plugins.forEach((plugin) => {
	if (PLATFORM_FILES.includes(plugin) || plugin.startsWith(".")) return;
	const pluginPath = path.join(__dirname, "../src/plugins", plugin);
	if (!fs.lstatSync(pluginPath).isDirectory()) return;
	execSync(`cordova plugin add ./src/plugins/${plugin}`, { stdio: "inherit" });
});
