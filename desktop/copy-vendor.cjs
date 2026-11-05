/*
 * Copies the plugin JavaScript that the desktop runtime loads at boot:
 *   - cordova-plugin-file www/  (from node_modules, same code as Android)
 *   - cordova-plugin-device www/device.js
 *   - the repo's own plugins: sdcard, system, server, terminal,
 *     websocket, custom-tabs, webview
 *
 * Run before `electron-builder` (the workflow does it, or `npm run vendor`).
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const vendor = path.join(root, "vendor");

fs.rmSync(vendor, { recursive: true, force: true });

function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const from = path.join(src, entry.name);
		const to = path.join(dest, entry.name);
		if (entry.isDirectory()) copyDir(from, to);
		else fs.copyFileSync(from, to);
	}
}

// cordova-plugin-file (installed as a devDependency of this folder)
const fileWww = path.join(root, "node_modules", "cordova-plugin-file", "www");
if (!fs.existsSync(fileWww)) {
	console.error(
		"cordova-plugin-file is missing — run `npm install` inside desktop/ first.",
	);
	process.exit(1);
}
copyDir(fileWww, path.join(vendor, "cordova-plugin-file"));

// cordova-plugin-device (only the www/device.js module)
const deviceWww = path.join(
	root,
	"node_modules",
	"cordova-plugin-device",
	"www",
);
if (!fs.existsSync(deviceWww)) {
	console.error(
		"cordova-plugin-device is missing — run `npm install` inside desktop/ first.",
	);
	process.exit(1);
}
fs.mkdirSync(path.join(vendor, "cordova-plugin-device"), { recursive: true });
fs.copyFileSync(
	path.join(deviceWww, "device.js"),
	path.join(vendor, "cordova-plugin-device", "device.js"),
);

// repo plugins
const repoPlugins = path.join(root, "..", "src", "plugins");
for (const name of [
	"sdcard",
	"system",
	"server",
	"terminal",
	"websocket",
	"custom-tabs",
	"webview",
]) {
	const www = path.join(repoPlugins, name, "www");
	if (fs.existsSync(www)) {
		copyDir(www, path.join(vendor, name, "www"));
	} else {
		console.warn(`[vendor] no www for plugin ${name}, skipping`);
	}
}

console.log("vendor ready:", vendor);
