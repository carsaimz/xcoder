/*
 * XCoder desktop — Electron main process.
 *
 * The renderer is the exact same production web build that ships inside the
 * Android APK (www/). A small Cordova compatibility layer (preload.cjs +
 * services.cjs) re-implements the native plugin surface over Electron/Node so
 * the app boots unmodified:
 *
 *   - cordova-plugin-file   -> Node fs (File service)
 *   - cordova-plugin-sdcard -> Node fs + dialogs (SDcard service)
 *   - cordova-plugin-system -> Electron shell/dialog (System service)
 *   - Executor/Terminal     -> child_process (real host shell)
 *   - Server (preview)      -> Node http
 *   - Clipboard/Device      -> Electron APIs
 *
 * Deep links: the OS opens `xcoder://...` (site login/OAuth returns to the app
 * through it). We forward them to the renderer, which routes them through the
 * regular intent handler.
 */
const {
        app,
        BrowserWindow,
        dialog,
        ipcMain,
        nativeTheme,
        shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const services = require("./services.cjs");

const SCHEME = "xcoder";
const isMac = process.platform === "darwin";

let mainWindow = null;
let pendingDeepLink = null;

/** Resolve the directory that holds the packaged web build (app/www). */
function appRoot() {
        // electron-builder packs this folder; asar is disabled, so __dirname is a
        // plain directory both in dev and in packaged builds.
        return __dirname;
}

function indexHtml() {
        return path.join(appRoot(), "app", "www", "index.html");
}

function createWindow() {
        const bounds = readWindowState();

        mainWindow = new BrowserWindow({
                width: bounds.width,
                height: bounds.height,
                x: bounds.x,
                y: bounds.y,
                minWidth: 360,
                minHeight: 320,
                backgroundColor: "#20202c",
                autoHideMenuBar: true,
                title: "XCoder",
                webPreferences: {
                        preload: path.join(__dirname, "preload.cjs"),
                        contextIsolation: false, // the shim must live in the page world
                        nodeIntegration: false,
                        sandbox: false, // preload uses Node to load the plugin JS
                        spellcheck: false,
                },
        });

        if (bounds.maximized) mainWindow.maximize();

        mainWindow.loadFile(indexHtml());

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
                // External links (docs, login site, GitHub...) open in the user browser.
                if (/^https?:/i.test(url)) {
                        shell.openExternal(url);
                        return { action: "deny" };
                }
                return { action: "allow" };
        });

        mainWindow.on("resize", saveWindowState);
        mainWindow.on("move", saveWindowState);
        mainWindow.on("maximize", () => saveWindowState(true));
        mainWindow.on("unmaximize", () => saveWindowState(false));
        mainWindow.on("closed", () => {
                mainWindow = null;
        });
}

function stateFile() {
        return path.join(app.getPath("userData"), "desktop-window-state.json");
}

function readWindowState() {
        const fallback = { width: 1280, height: 800 };
        try {
                return { ...fallback, ...JSON.parse(fs.readFileSync(stateFile(), "utf8")) };
        } catch {
                return fallback;
        }
}

function saveWindowState(maximized) {
        try {
                const state = readWindowState();
                if (mainWindow) {
                        const b = mainWindow.getBounds();
                        state.width = b.width;
                        state.height = b.height;
                        state.x = b.x;
                        state.y = b.y;
                }
                state.maximized =
                        typeof maximized === "boolean" ? maximized : mainWindow?.isMaximized();
                fs.writeFileSync(stateFile(), JSON.stringify(state));
        } catch {
                /* ignore */
        }
}

function sendDeepLink(url) {
        if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("xcoder:deeplink", url);
        } else {
                pendingDeepLink = url;
        }
}

/** Handle a xcoder:// url coming from OS launch args or the open-url event. */
function handleArgv(argv) {
        for (const arg of argv) {
                if (typeof arg === "string" && arg.startsWith(`${SCHEME}://`)) {
                        sendDeepLink(arg);
                }
        }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
        app.quit();
} else {
        app.on("second-instance", (_event, argv) => {
                if (mainWindow) {
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.focus();
                }
                handleArgv(argv);
        });

        app.whenReady().then(() => {
                // Register xcoder:// so the website can hand OAuth/logins back to us.
                app.setAsDefaultProtocolClient(SCHEME);

                nativeTheme.on("updated", () => {
                        mainWindow?.webContents.send("xcoder:native-theme");
                });

                registerIpc();
                createWindow();

                if (process.argv.length > 1) handleArgv(process.argv);

                app.on("activate", () => {
                        if (BrowserWindow.getAllWindows().length === 0) createWindow();
                });
        });
}

app.on("open-url", (event, url) => {
        event.preventDefault();
        if (app.isReady()) sendDeepLink(url);
        else pendingDeepLink = url;
});

app.on("window-all-closed", () => {
        if (!isMac) app.quit();
});

app.on("before-quit", () => {
        services.shutdown();
});

function registerIpc() {
        ipcMain.on("xcoder:exec", (event, { callId, service, action, args }) => {
                const emit = (payload) => {
                        if (!event.sender.isDestroyed()) {
                                event.sender.send("xcoder:exec:event", { callId, ...payload });
                        }
                };
                Promise.resolve()
                        .then(() =>
                                services.dispatch(
                                        {
                                                service,
                                                action,
                                                args: args || [],
                                                win: mainWindow,
                                                appRoot: appRoot(),
                                                paths: services.paths(app),
                                                callId,
                                        },
                                        emit,
                                ),
                        )
                        .then((result) => {
                        	if (result !== services.NO_FINAL) emit({ done: true, result });
                        })
                        .catch((error) =>
                                emit({
                                        done: true,
                                        error: typeof error === "string" ? error : error.message,
                                }),
                        );
        });

        ipcMain.on("xcoder:exit", () => {
                app.quit();
        });

        ipcMain.handle("xcoder:dialog:pickFolder", async () => {
                const res = await dialog.showOpenDialog(mainWindow, {
                        properties: ["openDirectory"],
                });
                return res.canceled ? null : res.filePaths[0];
        });

        ipcMain.handle("xcoder:dialog:pickFile", async (_e, mime) => {
                const res = await dialog.showOpenDialog(mainWindow, {
                        properties: ["openFile"],
                        filters: mime ? [{ name: "Files", extensions: [mime] }] : undefined,
                });
                return res.canceled ? null : res.filePaths[0];
        });

        ipcMain.on("xcoder:ready", () => {
                // Renderer finished booting; deliver any deep link that arrived early.
                if (pendingDeepLink) {
                        sendDeepLink(pendingDeepLink);
                        pendingDeepLink = null;
                }
        });
}
