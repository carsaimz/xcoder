/*
 * XCoder desktop — native service implementations.
 *
 * Every Cordova plugin the app talks to through `cordova.exec()` is
 * re-implemented here over Electron/Node APIs. The plugin *JavaScript* shipped
 * in `vendor/` (and the vendored cordova-plugin-file) is the exact code that
 * runs on Android, so as long as these services speak the same action names
 * and result shapes the app behaves identically.
 *
 * Supported services:
 *   File        — cordova-plugin-file over Node fs
 *   SDcard      — cordova-plugin-sdcard over Node fs (+ workspace search index)
 *   System      — cordova-plugin-system over Electron/Node
 *   Device      — cordova-plugin-device
 *   Clipboard   — cordova-plugin-clipboard
 *   Browser     — in-app browser window
 *   Executor    — child_process (real host shell, streaming)
 *   Server      — Node http (live preview server)
 *   CustomTabs  — opens the user browser
 */
"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn, execFile } = require("node:child_process");
const { pathToFileURL, fileURLToPath } = require("node:url");
const crypto = require("node:crypto");

/* ------------------------------------------------------------------ */
/* FileError codes (cordova-plugin-file)                               */
/* ------------------------------------------------------------------ */
const FERR = {
        NOT_FOUND: 1,
        SECURITY: 2,
        ABORT: 3,
        NOT_READABLE: 4,
        ENCODING: 5,
        NO_MODIFICATION: 6,
        INVALID_STATE: 7,
        SYNTAX: 8,
        INVALID_MODIFICATION: 9,
        QUOTA: 10,
        TYPE_MISMATCH: 11,
        PATH_EXISTS: 12,
};

function ferr(code) {
        const error = new Error(`FileError ${code}`);
        error.fileErrorCode = code;
        return error;
}

/** Sentinel: handler already streamed its own success callbacks. */
const NO_FINAL = Symbol("no-final");

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
const state = {
        watchers: new Map(), // id -> fs.FSWatcher
        processes: new Map(), // uuid -> child process
        servers: new Map(), // port -> { server, onRequest, sockets }
        index: new Map(), // rootUrl -> Map(url -> entry)
        scanIds: new Set(),
        intentHandler: null, // renderer callId of set-intent-handler
        pendingIntent: null,
        ws: null, // lazily required 'ws'
};

/** Directory layout handed to us by main.cjs (from app.getPath()). */
let paths = {
        userData: os.tmpdir(),
        files: os.tmpdir(),
        cache: os.tmpdir(),
        home: os.homedir(),
        documents: appPath("documents"),
        downloads: appPath("downloads"),
        appDir: __dirname,
        version: "0.0.0",
};

function appPath(name) {
        try {
                return os.homedir()
                        ? require("node:path").join(os.homedir(), name)
                        : os.tmpdir();
        } catch {
                return os.tmpdir();
        }
}

/** Update runtime paths (called before every dispatch by main.cjs). */
function setPaths(next) {
        paths = { ...paths, ...next };
}

/** Shared shutdown (before-quit). */
function shutdown() {
        for (const watcher of state.watchers.values()) {
                try {
                        watcher.close();
                } catch {
                        /* noop */
                }
        }
        state.watchers.clear();
        for (const child of state.processes.values()) {
                try {
                        child.kill();
                } catch {
                        /* noop */
                }
        }
        state.processes.clear();
        for (const { server, sockets } of state.servers.values()) {
                for (const socket of sockets) socket.destroy();
                try {
                        server.close();
                } catch {
                        /* noop */
                }
        }
        state.servers.clear();
}

/* ------------------------------------------------------------------ */
/* URL helpers                                                         */
/* ------------------------------------------------------------------ */
function fsRoots() {
        return {
                root: { dir: path.parse(paths.home).root || "/", name: "root" },
                files: { dir: paths.files, name: "files" },
                documents: { dir: paths.documents, name: "documents" },
                cache: { dir: paths.cache, name: "cache" },
                persistent: { dir: paths.files, name: "persistent" },
                temporary: { dir: paths.cache, name: "temporary" },
                sdcard: { dir: paths.home, name: "sdcard" },
                "files-external": { dir: paths.files, name: "files-external" },
                "cache-external": { dir: paths.cache, name: "cache-external" },
        };
}

/** Convert any URL the renderer passes to a real filesystem path. */
function toRealPath(input) {
        if (typeof input !== "string" || !input) {
                throw ferr(FERR.ENCODING);
        }
        let url = input;

        // cdvfile://localhost/<fsname>/<path>
        const cdv = /^cdvfile:\/\/localhost\/([^/]+)(\/.*)?$/.exec(url);
        if (cdv) {
                const roots = fsRoots();
                const root = roots[cdv[1]] || roots.root;
                const rest = cdv[2] ? decodeURIComponent(cdv[2]) : "/";
                return path.resolve(root.dir, "." + rest.replace(/^\/+/, "/"));
        }

        if (/^file:\/\//i.test(url)) {
                return fileURLToPath(url);
        }

        // Plain paths: /home/..., C:\..., /C:/...
        url = url.replace(/^\/([A-Za-z]:[\\/])/, "$1");
        if (/^([A-Za-z]:[\\/]|\/)/.test(url)) return path.normalize(url);

        // content:// has no meaning on desktop
        if (/^content:/i.test(url)) {
                const error = new Error("content:// URIs are not supported on desktop");
                error.fileErrorCode = FERR.NOT_FOUND;
                throw error;
        }

        throw ferr(FERR.ENCODING);
}

/** Real path -> file:// URL (directories keep a trailing slash). */
function realUrl(realPath, isDirectory = false) {
        let href = pathToFileURL(realPath).href;
        if (isDirectory && !href.endsWith("/")) href += "/";
        return href;
}

function fsNameFor(realPath) {
        const roots = fsRoots();
        for (const [key, root] of Object.entries(roots)) {
                if (key === "root") continue;
                const rel = path.relative(root.dir, realPath);
                if (!rel.startsWith("..") && !path.isAbsolute(rel)) return key;
        }
        return "root";
}

/** cordova-plugin-file entry JSON. */
async function entryFor(realPath, fsName = null) {
        const stat = await fsp.stat(realPath);
        fsName = fsName || fsNameFor(realPath);
        const roots = fsRoots();
        const root = roots[fsName] || roots.root;
        const rel = path
                .relative(root.dir, realPath)
                .split(path.sep)
                .join("/")
                .replace(/^\/+/, "");
        return {
                isFile: stat.isFile(),
                isDirectory: stat.isDirectory(),
                name: path.basename(realPath) || realPath,
                fullPath: "/" + rel,
                nativeURL: realUrl(realPath, stat.isDirectory()),
                filesystem: fsName,
                filesystemName: fsName,
                size: stat.size,
                lastModified: stat.mtimeMs,
        };
}

function errorCodeOf(error) {
        if (error && typeof error.fileErrorCode === "number") return error.fileErrorCode;
        if (error && error.code === "ENOENT") return FERR.NOT_FOUND;
        if (error && error.code === "EACCES") return FERR.NOT_READABLE;
        if (error && error.code === "EEXIST") return FERR.PATH_EXISTS;
        if (error && error.code === "EPERM") return FERR.NO_MODIFICATION;
        return FERR.INVALID_MODIFICATION;
}

/**
 * Serialize an exec failure for the renderer. Only genuine filesystem errors
 * carry a numeric `fileErrorCode` (rebuilds cordova's FileError contract);
 * every other service error keeps its plain message.
 * @param {Error|string} error
 * @returns {{ done: boolean, error: string, fileErrorCode?: number }}
 */
function execErrorPayload(error) {
        const message =
                typeof error === "string" ? error : error?.message || String(error);
        let fileErrorCode;
        if (error && typeof error === "object") {
                if (typeof error.fileErrorCode === "number") {
                        fileErrorCode = error.fileErrorCode;
                } else if (error.code === "ENOENT") {
                        fileErrorCode = FERR.NOT_FOUND;
                } else if (error.code === "EACCES") {
                        fileErrorCode = FERR.NOT_READABLE;
                } else if (error.code === "EEXIST") {
                        fileErrorCode = FERR.PATH_EXISTS;
                } else if (error.code === "EPERM") {
                        fileErrorCode = FERR.NO_MODIFICATION;
                }
        }
        return { done: true, error: message, fileErrorCode };
}

/* ------------------------------------------------------------------ */
/* Encoding helpers                                                    */
/* ------------------------------------------------------------------ */
const ENCODINGS = {
        "UTF-8": "utf8",
        UTF8: "utf8",
        "US-ASCII": "ascii",
        ASCII: "ascii",
        "ISO-8859-1": "latin1",
        LATIN1: "latin1",
        "WINDOWS-1252": "latin1",
        "CP1252": "latin1",
        "ISO-8859-15": "latin1",
        "UTF-16": "utf16le",
        "UTF-16LE": "utf16le",
        "UCS-2": "utf16le",
        UCS2: "utf16le",
        BINARY: "latin1",
        BASE64: "base64",
        HEX: "hex",
};

function nodeEnc(name) {
        return ENCODINGS[String(name || "UTF-8").toUpperCase()] || "utf8";
}

function toArrayBuffer(data) {
        if (data instanceof ArrayBuffer) return data;
        if (ArrayBuffer.isView(data)) {
                return data.buffer.slice(
                        data.byteOffset,
                        data.byteOffset + data.byteLength,
                );
        }
        if (typeof data === "string") {
                const buffer = Buffer.from(data, "utf8");
                return buffer.buffer.slice(
                        buffer.byteOffset,
                        buffer.byteOffset + buffer.byteLength,
                );
        }
        return data;
}

/* ------------------------------------------------------------------ */
/* Service: File (cordova-plugin-file)                                 */
/* ------------------------------------------------------------------ */
async function fileService(action, args) {
        switch (action) {
                case "requestAllPaths": {
                        const www = path.join(paths.appDir, "app", "www");
                        const withSlash = (p) => realUrl(p, true);
                        return {
                                applicationDirectory: withSlash(www),
                                applicationStorageDirectory: withSlash(paths.userData),
                                dataDirectory: withSlash(paths.files),
                                cacheDirectory: withSlash(paths.cache),
                                externalApplicationStorageDirectory: withSlash(paths.userData),
                                externalDataDirectory: withSlash(paths.files),
                                externalCacheDirectory: withSlash(paths.cache),
                                externalRootDirectory: withSlash(paths.home),
                                rootDirectory: withSlash(path.parse(paths.home).root || "/"),
                                documentsDirectory: withSlash(paths.documents),
                                sharedDirectory: withSlash(paths.home),
                                syncedDataDirectory: withSlash(paths.cache),
                                tempDirectory: withSlash(paths.cache),
                        };
                }

                case "requestFileSystem": {
                        const [type] = args;
                        const isTemp = Number(type) === 0;
                        const dir = isTemp ? paths.cache : paths.files;
                        const name = isTemp ? "temporary" : "persistent";
                        return { name, root: await entryFor(dir, name) };
                }

                case "resolveLocalFileSystemURI": {
                        const realPath = toRealPath(args[0]);
                        try {
                                await fsp.stat(realPath);
                        } catch (error) {
                                // Match Android: a missing/unreadable entry must fail
                                // with the NUMERIC FileError code (NOT_FOUND_ERR = 1),
                                // never a raw Node error — the app's exists() checks
                                // `err.code === 1` to resolve false.
                                throw ferr(errorCodeOf(error));
                        }
                        return entryFor(realPath, fsNameFor(realPath));
                }

                case "readEntries": {
                        const dir = toRealPath(args[0]);
                        const names = await fsp.readdir(dir);
                        const entries = [];
                        for (const name of names) {
                                try {
                                        entries.push(await entryFor(path.join(dir, name)));
                                } catch {
                                        /* vanished mid-scan */
                                }
                        }
                        return entries;
                }

                case "getFile":
                case "getDirectory": {
                        const [dirArg, nameArg, options] = args;
                        const dir = toRealPath(dirArg);
                        const target = resolveWithin(dir, String(nameArg || ""));
                        const wantCreate = !!options?.create;
                        const exclusive = !!options?.exclusive;
                        let stat = null;
                        try {
                                stat = await fsp.stat(target);
                        } catch {
                                stat = null;
                        }
                        if (!stat) {
                                if (!wantCreate) throw ferr(FERR.NOT_FOUND);
                                if (action === "getFile") await fsp.writeFile(target, "");
                                else await fsp.mkdir(target, { recursive: false });
                        } else {
                                const isDir = stat.isDirectory();
                                if (action === "getFile" && isDir) throw ferr(FERR.TYPE_MISMATCH);
                                if (action === "getDirectory" && !isDir) throw ferr(FERR.TYPE_MISMATCH);
                                if (wantCreate && exclusive) throw ferr(FERR.PATH_EXISTS);
                        }
                        return entryFor(target);
                }

                case "getFileMetadata": {
                        const target = toRealPath(args[0]);
                        const stat = await fsp.stat(target);
                        return {
                                size: stat.size,
                                type: stat.isDirectory() ? null : "text/plain",
                                name: path.basename(target),
                                lastModifiedDate: stat.mtimeMs,
                                modificationTime: stat.mtime.toISOString(),
                        };
                }

                case "getParent": {
                        const target = toRealPath(args[0]);
                        const parent = path.dirname(target);
                        return entryFor(parent);
                }

                case "readFile": {
                        const buffer = await fsp.readFile(toRealPath(args[0]));
                        return toArrayBuffer(buffer);
                }

                case "readAsText": {
                        const [urlArg, enc, start, end] = args;
                        let buffer = await fsp.readFile(toRealPath(urlArg));
                        if (Number.isFinite(start) || Number.isFinite(end)) {
                                buffer = buffer.subarray(start || 0, end ?? undefined);
                        }
                        return buffer.toString(nodeEnc(enc));
                }

                case "readAsDataURL": {
                        const buffer = await fsp.readFile(toRealPath(args[0]));
                        return `data:application/octet-stream;base64,${buffer.toString("base64")}`;
                }

                case "readAsBinaryString": {
                        const buffer = await fsp.readFile(toRealPath(args[0]));
                        return buffer.toString("latin1");
                }

                case "readAsArrayBuffer": {
                        const buffer = await fsp.readFile(toRealPath(args[0]));
                        return toArrayBuffer(buffer);
                }

                case "write": {
                        const [urlArg, data, append] = args;
                        const target = toRealPath(urlArg);
                        const buffer = Buffer.isBuffer(data)
                                ? data
                                : typeof data === "string"
                                        ? Buffer.from(data, "utf8")
                                        : Buffer.from(toArrayBuffer(data));
                        if (append) {
                                await fsp.appendFile(target, buffer);
                        } else {
                                await fsp.writeFile(target, buffer);
                        }
                        const stat = await fsp.stat(target);
                        return stat.size;
                }

                case "truncate": {
                        const [urlArg, size] = args;
                        await fsp.truncate(toRealPath(urlArg), Number(size) || 0);
                        return Number(size) || 0;
                }

                case "remove": {
                        const target = toRealPath(args[0]);
                        const stat = await fsp.stat(target);
                        if (stat.isDirectory()) {
                                const children = await fsp.readdir(target);
                                if (children.length) throw ferr(FERR.INVALID_MODIFICATION);
                                await fsp.rmdir(target);
                        } else {
                                await fsp.unlink(target);
                        }
                        return "";
                }

                case "removeRecursively": {
                        const target = toRealPath(args[0]);
                        await fsp.rm(target, { recursive: true, force: true });
                        return "";
                }

                case "copyTo":
                        return transferEntry(args, false);

                case "moveTo":
                        return transferEntry(args, true);

                case "testFileExists": {
                        try {
                                await fsp.stat(toRealPath(args[0]));
                                return 1;
                        } catch {
                                return 0;
                        }
                }

                case "setMetadata":
                        return "";

                default:
                        throw new Error(`File service: unsupported action "${action}"`);
        }
}

/** Resolve `name` inside `dir`, refusing traversal above `dir`. */
function resolveWithin(dir, name) {
        const clean = String(name).replace(/^\/+/, "");
        const target = path.resolve(dir, clean);
        const rel = path.relative(dir, target);
        if (rel.startsWith("..") && !path.isAbsolute(rel)) {
                throw ferr(FERR.ENCODING);
        }
        return target;
}

async function transferEntry(args, isMove) {
        const [srcArg, parentArg, nameArg] = args;
        const src = toRealPath(srcArg);
        const parent = toRealPath(parentArg);
        const name = String(nameArg || path.basename(src));
        const dest = resolveWithin(parent, name);

        if (src === dest) throw ferr(FERR.INVALID_MODIFICATION);

        let destStat = null;
        try {
                destStat = await fsp.stat(dest);
        } catch {
                destStat = null;
        }
        if (destStat) throw ferr(FERR.PATH_EXISTS);

        const srcStat = await fsp.stat(src);
        if (isMove && srcStat.isDirectory() && path.dirname(src) === parent) {
                await fsp.rename(src, dest);
        } else if (srcStat.isDirectory()) {
                await fsp.cp(src, dest, { recursive: true, errorOnExist: true, force: false });
                if (isMove) await fsp.rm(src, { recursive: true, force: true });
        } else if (isMove) {
                try {
                        await fsp.rename(src, dest);
                } catch {
                        await fsp.copyFile(src, dest);
                        await fsp.unlink(src);
                }
        } else {
                await fsp.copyFile(src, dest);
        }
        return entryFor(dest);
}

/* ------------------------------------------------------------------ */
/* Service: SDcard (cordova-plugin-sdcard)                             */
/* ------------------------------------------------------------------ */
async function sdcardService(action, args, emit) {
        switch (action) {
                case "copy": {
                        const [src, dest] = args.map(toRealPath);
                        await fsp.cp(src, dest, { recursive: true, force: true });
                        return "";
                }
                case "move": {
                        const [src, dest] = args.map(toRealPath);
                        await fsp.cp(src, dest, { recursive: true, force: true });
                        await fsp.rm(src, { recursive: true, force: true });
                        return "";
                }
                case "create directory": {
                        await fsp.mkdir(path.join(toRealPath(args[0]), String(args[1])), {
                                recursive: true,
                        });
                        return "";
                }
                case "create file": {
                        const target = path.join(toRealPath(args[0]), String(args[1]));
                        await fsp.mkdir(path.dirname(target), { recursive: true });
                        await fsp.writeFile(target, "", { flag: "wx" }).catch((error) => {
                                if (error.code !== "EEXIST") throw error;
                        });
                        return target;
                }
                case "delete": {
                        await fsp.rm(toRealPath(args[0]), { recursive: true, force: true });
                        return "";
                }
                case "exists": {
                        try {
                                await fsp.stat(toRealPath(args[0]));
                                return 1;
                        } catch {
                                return 0;
                        }
                }
                case "format uri": {
                        return toRealPath(args[0]);
                }
                case "get path": {
                        const dir = path.dirname(toRealPath(args[0]));
                        return path.join(dir, String(args[1] || ""));
                }
                case "storage permission":
                        return "granted";
                case "list volumes": {
                        const volumes = [
                                {
                                        name: "Home",
                                        uuid: "primary",
                                        path: paths.home,
                                        isPrimary: true,
                                },
                        ];
                        if (process.platform === "win32") {
                                for (const letter of "DEFGHIJKLMNOPQRSTUVWXYZ") {
                                        const drive = `${letter}:\\`;
                                        if (fs.existsSync(drive)) {
                                                volumes.push({
                                                        name: `${letter}:`,
                                                        uuid: `drive-${letter}`,
                                                        path: drive,
                                                        isPrimary: false,
                                                });
                                        }
                                }
                        } else if (fs.existsSync("/media") || fs.existsSync("/mnt")) {
                                for (const base of ["/media", "/mnt"]) {
                                        try {
                                                for (const entry of await fsp.readdir(base)) {
                                                        const full = path.join(base, entry);
                                                        if (fs.statSync(full).isDirectory()) {
                                                                volumes.push({
                                                                        name: entry,
                                                                        uuid: `vol-${entry}`,
                                                                        path: full,
                                                                        isPrimary: false,
                                                                });
                                                        }
                                                }
                                        } catch {
                                                /* unreadable mount base */
                                        }
                                }
                        }
                        return volumes;
                }
                case "list directory": {
                        const dir = toRealPath(args[0]);
                        const names = await fsp.readdir(dir);
                        const out = [];
                        for (const name of names) {
                                try {
                                        const stat = await fsp.stat(path.join(dir, name));
                                        out.push({
                                                name,
                                                path: path.join(dir, name),
                                                isFile: stat.isFile(),
                                                isDirectory: stat.isDirectory(),
                                                size: stat.size,
                                                lastModified: stat.mtimeMs,
                                        });
                                } catch {
                                        /* skip */
                                }
                        }
                        return out;
                }
                case "open document file":
                case "get image": {
                        const file = await pickFile();
                        if (!file) throw new Error("cancelled");
                        const stat = await fsp.stat(file);
                        return {
                                uri: realUrl(file),
                                url: realUrl(file),
                                name: path.basename(file),
                                size: stat.size,
                        };
                }
                case "rename": {
                        const src = toRealPath(args[0]);
                        await fsp.rename(src, path.join(path.dirname(src), String(args[1])));
                        return "";
                }
                case "read": {
                        const buffer = await fsp.readFile(toRealPath(args[0]));
                        return toArrayBuffer(buffer);
                }
                case "readAsText": {
                        const buffer = await fsp.readFile(toRealPath(args[0]));
                        return buffer.toString(nodeEnc(args[1]));
                }
                case "write": {
                        const target = toRealPath(args[0]);
                        const data = args[1];
                        const buffer =
                                typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(toArrayBuffer(data));
                        await fsp.mkdir(path.dirname(target), { recursive: true });
                        await fsp.writeFile(target, buffer);
                        return "";
                }
                case "writeText": {
                        const target = toRealPath(args[0]);
                        await fsp.mkdir(path.dirname(target), { recursive: true });
                        await fsp.writeFile(target, String(args[1] ?? ""), nodeEnc(args[2]) === "utf16le" ? "utf16le" : "utf8");
                        return "";
                }
                case "stats": {
                        const target = toRealPath(args[0]);
                        const stat = await fsp.stat(target);
                        return {
                                name: path.basename(target),
                                isFile: stat.isFile(),
                                isDirectory: stat.isDirectory(),
                                isLink: stat.isSymbolicLink(),
                                size: stat.size,
                                lastModified: stat.mtimeMs,
                                modifiedDate: stat.mtimeMs,
                                canRead: true,
                                canWrite: true,
                        };
                }
                case "watch file": {
                        const [file, id] = args;
                        try {
                                const watcher = fs.watch(toRealPath(file), () => emit(""));
                                state.watchers.set(String(id), watcher);
                        } catch {
                                /* file may not exist yet */
                        }
                        return "";
                }
                case "unwatch file": {
                        const watcher = state.watchers.get(String(args[0]));
                        if (watcher) {
                                watcher.close();
                                state.watchers.delete(String(args[0]));
                        }
                        return "";
                }
                case "list encodings":
                        return Object.keys(ENCODINGS);
                case "workspace scan":
                        return workspaceScan(args[0], emit);
                case "workspace search":
                        return workspaceSearch(args[0], emit);
                case "workspace query":
                        return workspaceQuery(args[0]);
                case "workspace update":
                case "workspace mark dirty":
                case "workspace clear":
                        return "";
                case "workspace cancel":
                        state.scanIds.delete(String(args[0]));
                        return "";
                default:
                        throw new Error(`SDcard service: unsupported action "${action}"`);
        }
}

/* ------------------------------------------------------------------ */
/* Workspace index / search (in-memory, desktop)                       */
/* ------------------------------------------------------------------ */
const EXCLUDED_DIRS = new Set([
        "node_modules",
        ".git",
        "dist",
        "build",
        "out",
        "__pycache__",
        ".gradle",
        "platforms",
        ".venv",
        "venv",
        "coverage",
]);

function urlOfDir(dir) {
        return realUrl(dir, true);
}

async function walkIndex(root, options, onProgress, cancelled) {
        const map = state.index.get(urlOfDir(root)) || new Map();
        state.index.set(urlOfDir(root), map);
        let visited = 0;

        async function visit(dir, depth) {
                if (cancelled()) return;
                let dirents;
                try {
                        dirents = await fsp.readdir(dir, { withFileTypes: true });
                } catch {
                        return;
                }
                for (const dirent of dirents) {
                        if (cancelled()) return;
                        if (dirent.name.startsWith(".") && !options.showHiddenFiles) continue;
                        const full = path.join(dir, dirent.name);
                        const url = realUrl(full, dirent.isDirectory());
                        if (dirent.isDirectory()) {
                                if (depth > 12) continue;
                                if (EXCLUDED_DIRS.has(dirent.name)) continue;
                                if (options.excludeFolders?.includes(dirent.name)) continue;
                                map.set(url, {
                                        name: dirent.name,
                                        url,
                                        path: full,
                                        isDirectory: true,
                                        isFile: false,
                                });
                                await visit(full, depth + 1);
                        } else if (dirent.isFile()) {
                                map.set(url, {
                                        name: dirent.name,
                                        url,
                                        path: full,
                                        isDirectory: false,
                                        isFile: true,
                                });
                                visited++;
                                if (visited % 200 === 0) onProgress(visited);
                        }
                }
        }

        await visit(root, 0);
        return visited;
}

async function workspaceScan(options, emit) {
        const rootUrl = options.rootUrl || "";
        const id = String(options.id || "");
        const root = toRealPath(rootUrl);
        state.scanIds.add(id);
        const cancelled = () => !state.scanIds.has(id);
        try {
                emit({ type: "status", message: "Indexing files…" });
                await walkIndex(
                        root,
                        {
                                showHiddenFiles: !!options.showHiddenFiles,
                                excludeFolders: options.excludeFolders,
                        },
                        (visited) => emit({ type: "progress", data: Math.min(visited / 40, 99) }),
                        cancelled,
                );
                if (cancelled()) return { type: "cancelled" };
                return { type: "done", count: state.index.get(urlOfDir(root))?.size || 0 };
        } catch (error) {
                return { type: "error", error: error.message };
        } finally {
                state.scanIds.delete(id);
        }
}

async function workspaceQuery(options) {
        const text = String(options.text || "").toLowerCase();
        const limit = Number(options.limit) || 200;
        const cursor = Number(options.cursor) || 0;
        const entries = [];

        for (const map of state.index.values()) {
                for (const entry of map.values()) {
                        if (options.includeDirectories || entry.isFile) {
                                if (!text || entry.name.toLowerCase().includes(text)) {
                                        entries.push(entry);
                                }
                        }
                }
        }

        // No index yet? Build a quick one from the roots.
        if (!entries.length && options.roots?.length) {
                for (const root of options.roots) {
                        try {
                                await walkIndex(
                                        toRealPath(root),
                                        { showHiddenFiles: false },
                                        () => {},
                                        () => false,
                                );
                        } catch {
                                /* skip unreadable root */
                        }
                }
                for (const map of state.index.values()) {
                        for (const entry of map.values()) {
                                if (entry.isFile && (!text || entry.name.toLowerCase().includes(text))) {
                                        entries.push(entry);
                                }
                        }
                }
        }

        entries.sort((a, b) => a.name.localeCompare(b.name));
        return { entries: entries.slice(cursor, cursor + limit), cursor: cursor + limit };
}

function searchFlags(options = {}) {
        return {
                regex: !!options.regex,
                caseSensitive: !!options.caseSensitive,
                wholeWord: !!options.wholeWord,
        };
}

function buildMatcher(search, flags) {
        if (flags.regex) {
                const re = new RegExp(search, flags.caseSensitive ? "g" : "gi");
                return (text) => {
                        re.lastIndex = 0;
                        const matches = [];
                        let match;
                        while ((match = re.exec(text)) && matches.length < 500) {
                                matches.push(match);
                                if (match.index === re.lastIndex) re.lastIndex++;
                        }
                        return matches;
                };
        }
        const needle = flags.caseSensitive ? search : search.toLowerCase();
        return (text) => {
                const haystack = flags.caseSensitive ? text : text.toLowerCase();
                const matches = [];
                let idx = haystack.indexOf(needle);
                while (idx !== -1 && matches.length < 500) {
                        matches.push({ index: idx, length: needle.length });
                        idx = haystack.indexOf(needle, idx + Math.max(1, needle.length));
                }
                return matches.map((match) => ({ index: match.index, length: match.length }));
        };
}

function matchAtLines(text, matches) {
        const lines = text.split("\n");
        const lineStarts = [];
        let offset = 0;
        for (const line of lines) {
                lineStarts.push(offset);
                offset += line.length + 1;
        }
        return matches.map((match) => {
                let lineNo = 0;
                for (let i = 0; i < lineStarts.length; i++) {
                        if (lineStarts[i] <= match.index) lineNo = i;
                        else break;
                }
                return {
                        position: { start: { row: lineNo, column: match.index - lineStarts[lineNo] } },
                        line: lines[lineNo].slice(0, 400),
                        text: lines[lineNo].slice(0, 400),
                };
        });
}

function applyReplace(text, matches, replace) {
        let out = "";
        let last = 0;
        for (const match of matches) {
                out += text.slice(last, match.index);
                out += replace ?? "";
                last = match.index + match.length;
        }
        out += text.slice(last);
        return out;
}

async function workspaceSearch(options, emit) {
        const id = String(options.id || "");
        state.scanIds.add(id);
        const cancelled = () => !state.scanIds.has(id);
        const mode = options.mode === "replace" ? "replace" : "search";
        const flags = searchFlags(options.options);
        const matcher = buildMatcher(String(options.search || ""), flags);
        const results = [];

        const searchFile = async (entry) => {
                let text;
                try {
                        text = await fsp.readFile(entry.path || toRealPath(entry.url), "utf8");
                } catch {
                        return;
                }
                const matches = matcher(text);
                if (!matches.length) return;
                if (mode === "replace") {
                        const replaced = applyReplace(text, matches, options.replace);
                        await fsp.writeFile(entry.path || toRealPath(entry.url), replaced, "utf8");
                        results.push({
                                type: "replace-result",
                                file: { name: entry.name, url: entry.url, isFile: true },
                                text: replaced,
                        });
                } else {
                        results.push({
                                type: "search-result",
                                data: {
                                        file: { name: entry.name, url: entry.url, isFile: true },
                                        matches: matchAtLines(text, matches),
                                },
                        });
                }
        };

        try {
                emit({ type: "status", message: "Searching…" });
                const files = Array.isArray(options.files) ? options.files : [];
                for (const file of files) {
                        if (cancelled()) return { type: "cancelled" };
                        try {
                                await searchFile({
                                        name: file.name || path.basename(String(file.url || "")),
                                        url: file.url,
                                        path: toRealPath(file.url),
                                });
                        } catch {
                                /* unreadable open file */
                        }
                }
                for (const root of options.roots || []) {
                        let rootPath;
                        try {
                                rootPath = toRealPath(root);
                        } catch {
                                continue;
                        }
                        const map = state.index.get(urlOfDir(rootPath)) || new Map();
                        if (!map.size) {
                                await walkIndex(
                                        rootPath,
                                        { showHiddenFiles: true },
                                        () => {},
                                        cancelled,
                                );
                        }
                        const indexed = state.index.get(urlOfDir(rootPath));
                        if (!indexed) continue;
                        for (const entry of indexed.values()) {
                                if (cancelled()) return { type: "cancelled" };
                                if (!entry.isFile) continue;
                                if (files.some((file) => file.url === entry.url)) continue;
                                await searchFile(entry);
                                if (results.length >= 30) {
                                        emit({ type: "search-results", data: results.splice(0) });
                                }
                        }
                }
                if (results.length) emit({ type: "search-results", data: results.splice(0) });
                return { type: mode === "replace" ? "done-replacing" : "done-searching" };
        } catch (error) {
                return { type: "error", error: error.message };
        } finally {
                state.scanIds.delete(id);
        }
}

/* ------------------------------------------------------------------ */
/* Service: System (cordova-plugin-system)                             */
/* ------------------------------------------------------------------ */
async function systemService(action, args, emit, ctx) {
        const { shell, clipboard, nativeTheme, BrowserWindow } = ctx.electron;
        switch (action) {
                case "isManageExternalStorageDeclared":
                case "hasGrantedStorageManager":
                case "is-external-storage-manager":
                        return "true";
                case "requestStorageManager":
                case "request-permission":
                case "request-permissions":
                case "manage-all-files":
                        return "granted";
                case "has-permission":
                        return "granted";
                case "copyToUri": {
                        const src = toRealPath(args[0]);
                        const destDir = toRealPath(args[1]);
                        const dest = path.join(destDir, String(args[2] || path.basename(src)));
                        await fsp.mkdir(destDir, { recursive: true });
                        await fsp.cp(src, dest, { recursive: true, force: true });
                        return dest;
                }
                case "fileExists": {
                        try {
                                await fsp.stat(toRealPath(args[0]));
                                return 1;
                        } catch {
                                return 0;
                        }
                }
                case "createSymlink": {
                        await fsp.symlink(toRealPath(args[0]), toRealPath(args[1])).catch(
                                (error) => {
                                        if (error.code !== "EEXIST") throw error;
                                },
                        );
                        return "";
                }
                case "writeText": {
                        const target = toRealPath(args[0]);
                        await fsp.mkdir(path.dirname(target), { recursive: true });
                        await fsp.writeFile(target, String(args[1] ?? ""), "utf8");
                        return "";
                }
                case "deleteFile": {
                        await fsp.rm(toRealPath(args[0]), { recursive: true, force: true });
                        return "";
                }
                case "setExec": {
                        if (process.platform !== "win32") {
                                await fsp.chmod(toRealPath(args[0]), 0o755);
                        }
                        return "";
                }
                case "getInstaller":
                        return "desktop";
                case "shareText":
                        clipboard.writeText(String(args[0] ?? ""));
                        return "";
                case "getNativeLibraryPath":
                        return paths.files;
                case "getFilesDir":
                        return paths.files;
                case "getRewardStatus":
                        return "0";
                case "redeemReward":
                        return "";
                case "extractAsset": {
                        const asset = path.join(paths.appDir, "assets", String(args[0]));
                        try {
                                await fsp.access(asset);
                        } catch {
                                throw new Error(`Asset not available on desktop: ${args[0]}`);
                        }
                        const dest = String(args[1]);
                        await fsp.mkdir(path.dirname(dest), { recursive: true });
                        await fsp.copyFile(asset, dest);
                        return "";
                }
                case "getParentPath":
                        return path.dirname(toRealPath(args[0]));
                case "listChildren": {
                        const names = await fsp.readdir(toRealPath(args[0]));
                        return names;
                }
                case "mkdirs": {
                        await fsp.mkdir(toRealPath(args[0]), { recursive: true });
                        return "";
                }
                case "getArch":
                        return process.arch;
                case "clearCache": {
                        const entries = await fsp.readdir(paths.cache).catch(() => []);
                        for (const entry of entries) {
                                await fsp
                                        .rm(path.join(paths.cache, entry), { recursive: true, force: true })
                                        .catch(() => {});
                        }
                        return "";
                }
                case "get-webkit-info":
                        return {
                                packageName: "Electron",
                                versionName: process.versions.chrome || "unknown",
                        };
                case "is-powersave-mode":
                        return "false";
                case "file-action": {
                        const target = toRealPath(args[0]);
                        const error = await shell.openPath(target);
                        if (error) throw new Error(error);
                        return "";
                }
                case "get-app-info": {
                        const versionCode = Number.parseInt(paths.version.replace(/\D/g, ""), 10) || 0;
                        return {
                                appName: "XCoder",
                                packageName: "com.carsaimz.xcoder",
                                versionName: paths.version,
                                versionCode,
                                installer: "desktop",
                        };
                }
                case "add-shortcut":
                case "remove-shortcut":
                case "pin-shortcut":
                case "pin-file-shortcut":
                        return "";
                case "get-android-version":
                        return "0";
                case "open-in-browser": {
                        const url = String(args[0] || "");
                        if (/^https?:/i.test(url)) await shell.openExternal(url);
                        return "";
                }
                case "launch-app":
                        throw new Error("launch-app is not supported on desktop");
                case "in-app-browser": {
                        const [url, title] = args;
                        openChildBrowser(String(url || ""), title);
                        return "done";
                }
                case "set-ui-theme":
                        nativeTheme.themeSource = isDarkTheme(args[1]) ? "dark" : "light";
                        return "";
                case "set-intent-handler":
                        state.intentHandler = ctx.callId;
                        return "";
                case "get-cordova-intent":
                        return state.pendingIntent;
                case "set-input-type":
                case "set-native-context-menu-disabled":
                        return "";
                case "get-global-setting":
                        return "1";
                case "compare-file-text": {
                        try {
                                const buffer = await fsp.readFile(toRealPath(args[0]));
                                const text = buffer.toString(nodeEnc(args[1]));
                                return text === String(args[2]) ? 0 : 1;
                        } catch {
                                return 1;
                        }
                }
                case "compare-texts":
                        return String(args[0]) === String(args[1]) ? 0 : 1;
                case "get-available-encodings": {
                        // Same shape as the Android plugin: { [name]: { label, aliases, name } }
                        const map = {};
                        for (const encoding of DESKTOP_ENCODING_LIST) {
                                map[encoding.name] = encoding;
                        }
                        return map;
                }
                case "decode": {
                        // args: [buffer (ArrayBuffer|TypedArray), charset] -> text
                        return decodeWithCharset(Buffer.from(toArrayBuffer(args[0])), args[1]);
                }
                case "encode": {
                        // args: [text, charset] -> ArrayBuffer
                        return encodeWithCharset(String(args[0] ?? ""), args[1]);
                }
                default:
                        throw new Error(`System service: unsupported action "${action}"`);
        }
}

/* ------------------------------------------------------------------ */
/* Charset support (desktop)                                           */
/* ------------------------------------------------------------------ */

// Charsets the desktop runtime can round-trip. Node ships full-ICU inside
// Electron, so TextDecoder covers every decode entry; encoding is limited to
// the sets Buffer understands (plus latin1 approximations for the western
// single-byte sets). Mirrors the Android "get-available-encodings" answer.
const DESKTOP_ENCODING_LIST = [
        { label: "Unicode (UTF-8)", aliases: ["utf8", "unicode", "cp65001"], name: "UTF-8" },
        { label: "ISO-8859-1 (Latin-1)", aliases: ["latin1", "iso88591", "l1", "cp819"], name: "ISO-8859-1" },
        { label: "Windows-1252 (Western)", aliases: ["cp1252", "win1252", "ansi", "windows1252"], name: "windows-1252" },
        { label: "Unicode (UTF-16 Little Endian)", aliases: ["utf16le", "ucs2", "ucs-2", "utf-16le"], name: "UTF-16LE" },
        { label: "Unicode (UTF-16 Big Endian)", aliases: ["utf16be", "utf-16be"], name: "UTF-16BE" },
        { label: "ASCII", aliases: ["ascii", "us", "us-ascii"], name: "US-ASCII" },
];

function decodeWithCharset(buffer, charset) {
        const name = String(charset || "UTF-8");
        if (name.toUpperCase() === "UTF-16BE") {
                // Node has no native utf16be; swap pairs and decode LE.
                const swapped = Buffer.from(buffer);
                swapped.swap16();
                return swapped.toString("utf16le");
        }
        try {
                return new TextDecoder(name, { fatal: false }).decode(buffer);
        } catch {
                return buffer.toString(nodeEnc(name));
        }
}

function encodeWithCharset(text, charset) {
        const name = String(charset || "UTF-8").toUpperCase();
        let buffer;
        if (name === "UTF-16BE") {
                buffer = Buffer.from(text, "utf16le");
                buffer.swap16();
        } else {
                buffer = Buffer.from(text, nodeEnc(name));
        }
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function isDarkTheme(scheme) {
        try {
                const json = typeof scheme === "string" ? JSON.parse(scheme) : scheme;
                const color = json?.["editor-colors"]?.["default-background"];
                if (typeof color === "string" && color.startsWith("#")) {
                        const value = color.slice(1);
                        const r = Number.parseInt(value.slice(0, 2), 16) || 0;
                        const g = Number.parseInt(value.slice(2, 4), 16) || 0;
                        const b = Number.parseInt(value.slice(4, 6), 16) || 0;
                        return r * 0.299 + g * 0.587 + b * 0.114 < 128;
                }
        } catch {
                /* keep default */
        }
        return true;
}

function openChildBrowser(url, title) {
        const { BrowserWindow } = require("electron");
        const win = new BrowserWindow({
                width: 1000,
                height: 760,
                autoHideMenuBar: true,
                title: title || "XCoder",
        });
        win.loadURL(url);
        return win;
}

/* ------------------------------------------------------------------ */
/* Service: Executor (terminal over child_process)                     */
/* ------------------------------------------------------------------ */
function shellForPlatform() {
        if (process.platform === "win32") {
                return { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c"] };
        }
        return { file: "/bin/sh", args: ["-c"] };
}

function executorService(action, args, emit) {
        switch (action) {
                case "start": {
                        const [command] = args;
                        const uuid = crypto.randomUUID();
                        const shell = shellForPlatform();
                        const child = spawn(shell.file, [...shell.args, String(command)], {
                                env: process.env,
                                cwd: paths.home,
                        });
                        state.processes.set(uuid, child);

                        emit(uuid); // first message is always the process UUID

                        const makePump = (prefix) => {
                                let rest = "";
                                return (chunk) => {
                                        rest += chunk.toString("utf8");
                                        const lines = rest.split("\n");
                                        rest = lines.pop() || "";
                                        for (const line of lines) emit(`${prefix}:${line}`);
                                };
                        };
                        const pumpOut = makePump("stdout");
                        const pumpErr = makePump("stderr");
                        child.stdout.on("data", pumpOut);
                        child.stderr.on("data", pumpErr);
                        child.on("error", (error) => emit(`stderr:${error.message}`));
                        child.on("close", (code) => {
                                emit(`exit:${code ?? 0}`);
                                state.processes.delete(uuid);
                        });
                        // Streaming service: never fire the final success callback again
                        // (Executor.start treats every success() call after the first as output).
                        return NO_FINAL;
                }
                case "write": {
                        const [uuid, input] = args;
                        const child = state.processes.get(String(uuid));
                        if (!child) throw new Error("no such process");
                        child.stdin.write(String(input ?? "") + "\n");
                        return "";
                }
                case "stop": {
                        const child = state.processes.get(String(args[0]));
                        if (child) {
                                try {
                                        child.kill();
                                } catch {
                                        /* already dead */
                                }
                                state.processes.delete(String(args[0]));
                        }
                        return "";
                }
                case "spawn": {
                        const [cmd] = args;
                        return spawnStream(cmd, emit);
                }
                default:
                        throw new Error(`Executor service: unsupported action "${action}"`);
        }
}

/** Executor.spawn: raw process exposed over a local WebSocket. */
function spawnStream(cmd, emit) {
        let WebSocketServer;
        try {
                WebSocketServer = (state.ws ||= require("ws")).WebSocketServer;
        } catch {
                throw new Error("spawn is not available on this desktop build");
        }

        const uuid = crypto.randomUUID();
        const shell = shellForPlatform();
        const isCmdArray = Array.isArray(cmd);
        const command = isCmdArray ? cmd[0] : String(cmd);
        const commandArgs = isCmdArray ? cmd.slice(1) : [];
        const child = spawn(command, commandArgs, {
                shell: !isCmdArray,
                env: process.env,
                cwd: paths.home,
        });
        state.processes.set(uuid, child);

        const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 }, () => {
                const { port } = wss.address();
                emit(port);
        });
        wss.on("connection", (socket) => {
                socket.on("message", (data) => {
                        child.stdin.write(data);
                });
                child.stdout.on("data", (chunk) => socket.send(chunk));
                child.stderr.on("data", (chunk) => socket.send(chunk));
                child.on("close", (code) => {
                        socket.send(`\n[process exited with code ${code ?? 0}]`);
                        socket.close();
                        wss.close();
                        state.processes.delete(uuid);
                });
        });
        // The listening callback already emitted the port.
        return NO_FINAL;
}

/* ------------------------------------------------------------------ */
/* Service: Server (live preview)                                      */
/* ------------------------------------------------------------------ */
function serverService(action, args, emit) {
        switch (action) {
                case "start": {
                        const port = Number(args[0]) || 8888;
                        if (state.servers.has(port)) {
                                throw new Error("Server already running");
                        }
                        const http = require("node:http");
                        const sockets = new Set();
                        const server = http.createServer((req, res) => {
                                const requestId = crypto.randomUUID();
                                const entry = state.servers.get(port);
                                if (!entry?.onRequest) {
                                        res.writeHead(404);
                                        res.end();
                                        return;
                                }
                                entry.responses.set(requestId, res);
                                entry.onRequest({
                                        requestId,
                                        path: req.url || "/",
                                        method: req.method,
                                        headers: req.headers,
                                });
                        });
                        const entry = { server, onRequest: null, responses: new Map(), sockets };
                        state.servers.set(port, entry);
                        server.on("connection", (socket) => {
                                sockets.add(socket);
                                socket.on("close", () => sockets.delete(socket));
                        });
                        server.on("error", (error) => {
                                state.servers.delete(port);
                                throw error;
                        });
                        server.listen(port, "127.0.0.1");
                        // Final success callback == openBrowser() in the app; fires exactly once.
                        return undefined;
                }
                case "setOnRequestHandler": {
                        const entry = state.servers.get(Number(args[0]));
                        if (entry) entry.onRequest = (req) => emit(req);
                        return "";
                }
                case "send": {
                        const entry = state.servers.get(Number(args[0]));
                        const res = entry?.responses.get(String(args[1]));
                        if (res) {
                                entry.responses.delete(String(args[1]));
                                const data = args[2] || {};
                                const body =
                                        typeof data.body === "string"
                                                ? data.body
                                                : data.body != null
                                                        ? JSON.stringify(data.body)
                                                        : "";
                                res.writeHead(data.status || 200, data.headers || { "Content-Type": "text/html" });
                                res.end(body);
                        }
                        return "";
                }
                case "stop": {
                        const port = Number(args[0]);
                        const entry = state.servers.get(port);
                        if (entry) {
                                for (const socket of entry.sockets) socket.destroy();
                                for (const res of entry.responses.values()) res.destroy();
                                entry.server.close();
                                state.servers.delete(port);
                        }
                        return "";
                }
                default:
                        throw new Error(`Server service: unsupported action "${action}"`);
        }
}

/* ------------------------------------------------------------------ */
/* Remaining small services                                            */
/* ------------------------------------------------------------------ */
async function deviceService(action) {
        if (action !== "getDeviceInfo") {
                throw new Error(`Device service: unsupported action "${action}"`);
        }
        return {
                manufacturer: "Desktop",
                model: `${os.type()} ${os.arch()}`,
                platform: "android", // keeps app behaviour identical to the Android build
                uuid: crypto
                        .createHash("sha256")
                        .update(`${os.hostname()}${os.platform()}${os.homedir()}`)
                        .digest("hex")
                        .slice(0, 32),
                version: process.versions.electron || "0",
                cordovaVersion: "desktop",
                isVirtual: false,
                serial: "desktop",
                name: "XCoder Desktop",
        };
}

async function clipboardService(action, args, emit, ctx) {
        const { clipboard } = ctx.electron;
        if (action === "copy") {
                clipboard.writeText(String(args[0] ?? ""));
                return "";
        }
        if (action === "paste") {
                return clipboard.readText();
        }
        throw new Error(`Clipboard service: unsupported action "${action}"`);
}

async function browserService(action, args) {
        if (action !== "open") {
                throw new Error(`Browser service: unsupported action "${action}"`);
        }
        const [url, theme, isConsole] = args;
        openChildBrowser(String(url || ""), isConsole ? "Console" : "Browser");
        return "done";
}

async function customTabsService(action, args, emit, ctx) {
        if (action !== "open") {
                throw new Error(`CustomTabs service: unsupported action "${action}"`);
        }
        const url = String(args[0] || "");
        if (/^https?:/i.test(url)) await ctx.electron.shell.openExternal(url);
        return "";
}

function websocketService(action, args, emit) {
        let WebSocket;
        try {
                WebSocket = (state.ws ||= require("ws")).WebSocket;
        } catch {
                throw new Error("WebSocket relay is not available on this desktop build");
        }

        switch (action) {
                case "open":
                case "connect": {
                        const [url, instanceId] = args;
                        const id = String(instanceId || url);
                        const socket = new WebSocket(String(url));
                        state.watchers.set(`ws-${id}`, { close: () => socket.close() });
                        socket.on("open", () => emit({ instanceId: id, event: "open" }));
                        socket.on("message", (data) => emit({ instanceId: id, event: "message", data: data.toString() }));
                        socket.on("close", () => emit({ instanceId: id, event: "close" }));
                        socket.on("error", (error) => emit({ instanceId: id, event: "error", data: error.message }));
                        return id;
                }
                case "send": {
                        const id = String(args[0]);
                        const holder = state.watchers.get(`ws-${id}`);
                        holder?.socket?.send?.(String(args[1] ?? ""));
                        return "";
                }
                case "close": {
                        const id = String(args[0]);
                        state.watchers.get(`ws-${id}`)?.close();
                        state.watchers.delete(`ws-${id}`);
                        return "";
                }
                default:
                        throw new Error(`WebSocket service: unsupported action "${action}"`);
        }
}

/* ------------------------------------------------------------------ */
/* Dialog helper                                                       */
/* ------------------------------------------------------------------ */
async function pickFile() {
        const { dialog } = require("electron");
        const win = require("electron").BrowserWindow.getAllWindows()[0];
        const result = await dialog.showOpenDialog(win, {
                properties: ["openFile"],
        });
        return result.canceled ? null : result.filePaths[0];
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */
const SERVICE_HANDLERS = {
        File: fileService,
        SDcard: sdcardService,
        System: systemService,
        Executor: executorService,
        BackgroundExecutor: executorService,
        Server: serverService,
        Device: deviceService,
        Clipboard: clipboardService,
        Browser: browserService,
        CustomTabs: customTabsService,
        WebSocket: websocketService,
        XCoderWebView: async () => {
                throw new Error("XCoderWebView is not supported on desktop");
        },
};

/**
 * Handle one exec() call from the renderer.
 * @param {object} ctx {service, action, args, win, appRoot, paths, electron, callId}
 * @param {(payload: object) => void} emit stream events to the renderer
 * @returns {Promise<any>} final result (undefined allowed)
 */
async function dispatch(ctx, emit) {
        setPaths(ctx.paths || {});
        const handler = SERVICE_HANDLERS[ctx.service];
        if (!handler) {
                throw new Error(`Unknown Cordova service: ${ctx.service}`);
        }
        const context = {
                ...ctx,
                electron: require("electron"),
        };
        const result = await handler(ctx.action, ctx.args, emit, context);
        // Streaming handlers already delivered all success callbacks; the
        // sentinel travels back so main.cjs skips the final emit.
        return result === NO_FINAL ? NO_FINAL : result;
}

/** Re-deliver an OS deep link (xcoder://…) to the registered intent handler. */
function emitIntent(intent) {
        state.pendingIntent = intent;
        if (state.intentHandler) {
                return { callId: state.intentHandler, payload: intent };
        }
        return null;
}

module.exports = {
        NO_FINAL,
        dispatch,
        emitIntent,
        setPaths,
        errorCodeOf,
        execErrorPayload,
        paths: (app) => ({
                userData: app.getPath("userData"),
                files: path.join(app.getPath("userData"), "files"),
                cache: path.join(app.getPath("userData"), "cache"),
                home: app.getPath("home"),
                documents: safePath(app, "documents"),
                downloads: safePath(app, "downloads"),
                appDir: __dirname,
                version: app.getVersion(),
        }),
        shutdown,
};

function safePath(app, name) {
        try {
                return app.getPath(name);
        } catch {
                return path.join(app.getPath("home"), name);
        }
}
