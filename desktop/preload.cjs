/*
 * XCoder desktop — Cordova compatibility runtime (preload).
 *
 * Runs before the web app with Node access (sandbox: false) but inside the
 * page world (contextIsolation: false) so the app sees `cordova`, `device`,
 * `sdcard`, `system`, `resolveLocalFileSystemURL`, … exactly like on Android.
 *
 * Pieces:
 *   1. cordova.exec bridge over IPC (streaming-capable)
 *   2. tiny CommonJS module registry that loads the vendored plugin JS
 *      (the exact www/ code that ships on Android) and cordova core shims
 *   3. clobbers identical to each plugin.xml
 *   4. onCordovaReady → requestAllPaths → cordova.file → deviceready
 *   5. xcoder:// deep links re-injected as intents
 */
"use strict";

const { ipcRenderer } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/* ------------------------------------------------------------------ */
/* 1. exec bridge                                                      */
/* ------------------------------------------------------------------ */
const channels = new Map(); // callId -> { success, fail }
let callSeq = 0;

ipcRenderer.on("xcoder:exec:event", (_event, message) => {
	const { callId, result, done, error } = message || {};
	const channel = channels.get(callId);
	if (!channel) return;
	if (error !== undefined && error !== null && done) {
		channels.delete(callId);
		channel.fail && channel.fail(error);
		return;
	}
	if (done) {
		channels.delete(callId);
		channel.success && channel.success(result);
		return;
	}
	// streaming callback (Executor output, Server requests, intents…)
	channel.success && channel.success(result);
});

/* ------------------------------------------------------------------ */
/* 2. cordova global + core modules                                    */
/* ------------------------------------------------------------------ */
const nativeSymbols = {};
for (const name of ["FileReader", "File", "ProgressEvent", "FileError"]) {
	nativeSymbols[name] = window[name];
}

function makeChannel(type) {
	const handlers = [];
	const channel = {
		type,
		subscribe(fn) {
			handlers.push(fn);
		},
		unsubscribe(fn) {
			const index = handlers.indexOf(fn);
			if (index !== -1) handlers.splice(index, 1);
		},
		fire(arg) {
			for (const handler of [...handlers]) handler(arg);
		},
	};
	return channel;
}

const channelApi = {
	onCordovaReady: makeChannel("onCordovaReady"),
	onNativeReady: makeChannel("onNativeReady"),
	onPluginsReady: makeChannel("onPluginsReady"),
	onDeviceReady: makeChannel("onDeviceReady"),
	onResume: makeChannel("onResume"),
	onPause: makeChannel("onPause"),
	_wait: new Set(),
	createSticky(type) {
		this[type] = makeChannel(type);
		return this[type];
	},
	waitForInitialization(name) {
		this._wait.add(name);
	},
	initializationComplete(name) {
		this._wait.delete(name);
	},
};

const argscheck = {
	checkArgs() {
		/* desktop accepts all valid calls; signature enforcement is not needed */
	},
};

const modulemapper = {
	clobbers(id, target) {
		try {
			window[target.replace(/^window\./, "")] = registryRequire(id);
		} catch (error) {
			console.warn("[xcoder-desktop] clobber failed", id, target, error);
		}
	},
	defaults(id, target) {
		this.clobbers(id, target);
	},
	overrides(id, target) {
		this.clobbers(id, target);
	},
	merges(id, target) {
		try {
			const target_ = target.replace(/^window\./, "");
			const source = registryRequire(id);
			window[target_] = Object.assign(window[target_] || {}, source);
		} catch (error) {
			console.warn("[xcoder-desktop] merge failed", id, target, error);
		}
	},
	getOriginalSymbol(_win, symbol) {
		return nativeSymbols[symbol] ?? window[symbol];
	},
};

const utils = {
	extend(derived, base) {
		// mirrors cordova-js utils.extend (DirectoryEntry relies on __super__)
		function Surrogate() {}
		Surrogate.prototype = base.prototype;
		derived.prototype = new Surrogate();
		derived.__super__ = base.prototype;
		derived.prototype.constructor = derived;
	},
	defineGetter(obj, prop, getter) {
		Object.defineProperty(obj, prop, {
			configurable: true,
			enumerable: true,
			get: getter,
		});
	},
	defineGetterSetter(obj, prop, getter, setter) {
		const descriptor = {
			configurable: true,
			enumerable: true,
			get: getter,
		};
		if (setter) descriptor.set = setter;
		Object.defineProperty(obj, prop, descriptor);
	},
};

const cordovaCore = {
	exec,
	argscheck,
	channel: channelApi,
	modulemapper,
	utils,
};

const cordova = (window.cordova = {
	version: "xcoder-desktop",
	platformId: "android",
	plugins: {},
	require: registryRequire,
	exec,
	fireDocumentEvent(name) {
		document.dispatchEvent(new Event(name));
	},
	file: null,
	websocket: null,
});

function exec(success, fail, service, action, args) {
	const callId = `c${++callSeq}`;
	channels.set(callId, { success, fail });
	ipcRenderer.send("xcoder:exec", {
		callId,
		service,
		action,
		args: args || [],
	});
	return null;
}

/* ------------------------------------------------------------------ */
/* 3. module registry + vendor loader                                  */
/* ------------------------------------------------------------------ */
const registry = new Map(); // alias -> exports

function registryRequire(id) {
	if (id === "cordova") return cordova;
	if (id.startsWith("cordova/")) {
		return cordovaCore[id.slice(8)];
	}
	const found = registry.get(id);
	if (!found) throw new Error(`[xcoder-desktop] unknown module: ${id}`);
	return found;
}

function loadVendorFile(file, alias) {
	const normalized = path.resolve(file);
	if (moduleCache.has(normalized)) {
		const cached = moduleCache.get(normalized).exports;
		if (alias) registry.set(alias, cached);
		return cached;
	}
	const source = fs.readFileSync(file, "utf8");
	const module = { exports: {} };
	moduleCache.set(normalized, module);
	const localRequire = (request) => {
		if (request.startsWith("./") || request.startsWith("../")) {
			const resolved = path.resolve(path.dirname(file), request);
			return registryRequire(pathToAlias(resolved));
		}
		return registryRequire(request);
	};
	const factory = vm.runInThisContext(
		`(function (exports, require, module, __filename, __dirname) {\n${source}\n})`,
		{ filename: file },
	);
	factory(module.exports, localRequire, module, file, path.dirname(file));
	if (alias) registry.set(alias, module.exports);
	return module.exports;
}

const moduleCache = new Map(); // abs path -> module
const aliasCache = new Map(); // abs path -> alias id

function pathToAlias(resolved) {
	let normalized = path.resolve(resolved);
	if (!aliasCache.has(normalized) && !path.extname(normalized) && fs.existsSync(normalized + ".js")) {
		normalized += ".js";
	}
	if (!aliasCache.has(normalized)) {
		const id = `m${aliasCache.size + 1}`;
		aliasCache.set(normalized, id);
		if (moduleCache.has(normalized)) {
			registry.set(id, moduleCache.get(normalized).exports);
		} else {
			loadVendorFile(normalized, id);
		}
	}
	return aliasCache.get(normalized);
}

/* ------------------------------------------------------------------ */
/* 4. boot sequence                                                    */
/* ------------------------------------------------------------------ */
const VENDOR = path.join(__dirname, "vendor");

function boot() {
	// --- cordova-plugin-file -------------------------------------
	const fileWww = path.join(VENDOR, "cordova-plugin-file");
	const fileModules = {};
	if (fs.existsSync(fileWww)) {
		for (const name of [
			"fileSystems",
			"Flags",
			"FileError",
			"Metadata",
			"ProgressEvent",
			"FileSystem",
			"DirectoryReader",
			"Entry",
			"FileEntry",
			"DirectoryEntry",
			"File",
			"FileWriter",
			"LocalFileSystem",
			"requestFileSystem",
			"resolveLocalFileSystemURI",
			"fileSystemPaths",
		]) {
			const file = path.join(fileWww, `${name}.js`);
			if (fs.existsSync(file)) {
				fileModules[name] = loadVendorFile(file, `cordova-plugin-file.${name}`);
			}
		}

		// clobbers, mirroring plugin.xml
		const clobber = (name, target) => {
			if (fileModules[name]) window[target] = fileModules[name];
		};
		clobber("LocalFileSystem", "LocalFileSystem");
		clobber("FileSystem", "FileSystem");
		clobber("DirectoryEntry", "DirectoryEntry");
		clobber("DirectoryReader", "DirectoryReader");
		clobber("Entry", "Entry");
		clobber("FileEntry", "FileEntry");
		clobber("File", "File");
		clobber("FileError", "FileError");
		clobber("FileReader", "FileReader");
		clobber("FileWriter", "FileWriter");
		clobber("Flags", "Flags");
		clobber("Metadata", "Metadata");
		clobber("ProgressEvent", "ProgressEvent");
		// Desktop transport: entries travel as cdvfile:// URLs (the Android
		// runtime uses http /__cdvfile_name__/ forms served by its WebView
		// server - pointless here). Patched after clobbering.
		if (fileModules.FileSystem) {
			fileModules.FileSystem.prototype.__format__ = function (fullPath) {
				let rest = fileModules.FileSystem.encodeURIPath(fullPath || "/");
				if (!/^\//.test(rest)) rest = "/" + rest;
				return `cdvfile://localhost/${this.name}${rest}`;
			};
		}
		const androidEntry = path.join(fileWww, "android", "Entry.js");
		if (fs.existsSync(androidEntry) && window.Entry) {
			Object.assign(window.Entry.prototype, loadVendorFile(androidEntry));
		}
		clobber("requestFileSystem", "requestFileSystem");
		window.webkitRequestFileSystem = window.requestFileSystem;
		const resolveModule = fileModules.resolveLocalFileSystemURI;
		window.resolveLocalFileSystemURL =
			resolveModule.resolveLocalFileSystemURL || resolveModule;
		window.webkitResolveLocalFileSystemURL = window.resolveLocalFileSystemURL;
	}

	// --- repo plugins ----------------------------------------------
	const load = (rel, alias) => {
		const file = path.join(VENDOR, rel);
		return fs.existsSync(file) ? loadVendorFile(file, alias) : null;
	};

	window.sdcard = load("sdcard/www/plugin.js", "xcoder.sdcard");
	window.system = load("system/www/plugin.js", "xcoder.system");
	window.CreateServer = load("server/www/server.js", "xcoder.server");
	window.Terminal = load("terminal/www/Terminal.js", "xcoder.terminal");
	window.Executor = load("terminal/www/Executor.js", "xcoder.executor");
	window.CustomTabs = load("custom-tabs/www/customtabs.js", "xcoder.customtabs");
	const websocketModule = load("websocket/www/websocket.js", "xcoder.websocket");
	if (websocketModule) cordova.websocket = websocketModule;

	// --- device ------------------------------------------------------
	const deviceModule = load(
		"cordova-plugin-device/device.js",
		"cordova-plugin-device.device",
	);
	if (deviceModule) window.device = deviceModule;

	// --- clipboard ---------------------------------------------------
	window.plugins = window.plugins || {};
	window.plugins.clipboard = {
		copy(text, onSuccess, onFail) {
			exec(onSuccess, onFail, "Clipboard", "copy", [String(text ?? "")]);
		},
		paste(onSuccess, onFail) {
			exec(onSuccess, onFail, "Clipboard", "paste", []);
		},
	};

	// --- small stubs the app expects ---------------------------------
	if (!window.statusbar) {
		window.statusbar = {
			setBackgroundColor() {},
			setTextColor() {},
			setStyleLight() {},
			setStyleDark() {},
		};
	}

	navigator.app = navigator.app || {};
	navigator.app.exitApp = () => {
		ipcRenderer.send("xcoder:exit");
	};
	navigator.app.overrideButton = () => {};
	navigator.app.clearHistory = () => {};
	navigator.app.loadUrl = (url) => {
		window.location.assign(url);
	};

	// --- cordova.file + deviceready ----------------------------------

	channelApi.onNativeReady.fire();
	channelApi.onPluginsReady.fire();
	channelApi.onCordovaReady.fire();

	const fileExports = registry.get("cordova-plugin-file.fileSystemPaths");
	if (fileExports?.file) {
		cordova.file = fileExports.file;
	}

	// Wait for requestAllPaths (and device info) before deviceready, with a
	// hard timeout so a stuck exec can never hang the splash screen.
	let ready = false;
	const goReady = () => {
		if (ready) return;
		ready = true;
		channelApi.onDeviceReady.fire();
		document.dispatchEvent(new Event("deviceready"));
		ipcRenderer.send("xcoder:ready");
		flushDeepLinks();
	};
	setTimeout(goReady, 3000);
	const poll = setInterval(() => {
		if (channelApi._wait.size === 0 && cordova.file) {
			clearInterval(poll);
			goReady();
		}
	}, 25);
	setTimeout(() => clearInterval(poll), 3200);
}

/* ------------------------------------------------------------------ */
/* 5. deep links (site login / GitHub OAuth come back this way)        */
/* ------------------------------------------------------------------ */
let intentCallback = null; // app's HandleIntent, captured at registration
const pendingLinks = [];

const originalSend = ipcRenderer.send.bind(ipcRenderer);
ipcRenderer.send = function (channel, payload) {
	// Track the set-intent-handler call so deep links can reach the app.
	if (
		channel === "xcoder:exec" &&
		payload?.service === "System" &&
		payload?.action === "set-intent-handler"
	) {
		intentCallback = channels.get(payload.callId)?.success || null;
		flushDeepLinks();
	}
	return originalSend(channel, payload);
};

ipcRenderer.on("xcoder:deeplink", (_event, url) => {
	if (!url) return;
	dispatchIntent({
		action: "android.intent.action.VIEW",
		data: url,
		fileUri: url,
		extras: {},
	});
});

function dispatchIntent(intent) {
	if (intentCallback) {
		try {
			intentCallback(intent);
		} catch (error) {
			console.error("[xcoder-desktop] intent handler failed", error);
		}
	} else {
		pendingLinks.push(intent);
	}
}

function flushDeepLinks() {
	while (pendingLinks.length && intentCallback) {
		dispatchIntent(pendingLinks.shift());
	}
}

boot();
