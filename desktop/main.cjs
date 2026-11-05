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
        Menu,
        nativeTheme,
        shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const services = require("./services.cjs");

const SCHEME = "xcoder";
const isMac = process.platform === "darwin";
const RELEASES_URL = "https://github.com/carsaimz/xcoder/releases";

/** Menu labels — pt-BR when the OS locale says so, English otherwise. */
function menuLabels() {
        const pt = (app.getLocale() || "").toLowerCase().startsWith("pt");
        return pt
                ? {
                        file: "&Arquivo",
                        newFile: "Novo arquivo",
                        openFile: "Abrir arquivo...",
                        openFolder: "Abrir pasta...",
                        save: "Salvar",
                        saveAll: "Salvar tudo",
                        closeTab: "Fechar aba",
                        closeAll: "Fechar todas as abas",
                        exit: "Sair",
                        edit: "&Editar",
                        undo: "Desfazer",
                        redo: "Refazer",
                        cut: "Cortar",
                        copy: "Copiar",
                        paste: "Colar",
                        selectAll: "Selecionar tudo",
                        findFile: "Localizar arquivo...",
                        palette: "Paleta de comandos...",
                        view: "&Visualizar",
                        zoomIn: "Ampliar",
                        zoomOut: "Reduzir",
                        zoomReset: "Tamanho real",
                        sidebar: "Alternar barra lateral",
                        fullscreen: "Tela cheia",
                        reload: "Recarregar janela",
                        devtools: "Ferramentas de desenvolvedor",
                        terminal: "&Terminal",
                        newTerminal: "Novo terminal",
                        console: "Console",
                        help: "Aj&uda",
                        docs: "Documentação",
                        releases: "Releases",
                        report: "Reportar bug",
                        updates: "Verificar atualizações...",
                        about: "Sobre o XCoder",
                        aboutBody:
                                "XCoder %s — editor de código com IA para Android, Windows e Linux.\n\nFork do Acode, licença MIT.\nhttps://github.com/carsaimz/xcoder",
                        upToDateTitle: "Verificar atualizações",
                        upToDate: "Você já está na versão mais recente (%s).",
                        newVersion: "Nova versão disponível: %s (instalada: %s).",
                        openReleases: "Abrir releases",
                        close: "Fechar",
                        checkFailed:
                                "Não foi possível verificar atualizações agora — verifique sua conexão.",
                }
                : {
                        file: "&File",
                        newFile: "New file",
                        openFile: "Open file...",
                        openFolder: "Open folder...",
                        save: "Save",
                        saveAll: "Save all",
                        closeTab: "Close tab",
                        closeAll: "Close all tabs",
                        exit: "Exit",
                        edit: "&Edit",
                        undo: "Undo",
                        redo: "Redo",
                        cut: "Cut",
                        copy: "Copy",
                        paste: "Paste",
                        selectAll: "Select all",
                        findFile: "Find file...",
                        palette: "Command palette...",
                        view: "&View",
                        zoomIn: "Zoom in",
                        zoomOut: "Zoom out",
                        zoomReset: "Actual size",
                        sidebar: "Toggle sidebar",
                        fullscreen: "Full screen",
                        reload: "Reload window",
                        devtools: "Developer tools",
                        terminal: "&Terminal",
                        newTerminal: "New terminal",
                        console: "Console",
                        help: "&Help",
                        docs: "Documentation",
                        releases: "Releases",
                        report: "Report a bug",
                        updates: "Check for updates...",
                        about: "About XCoder",
                        aboutBody:
                                "XCoder %s — AI code editor for Android, Windows and Linux.\n\nAcode fork, MIT licensed.\nhttps://github.com/carsaimz/xcoder",
                        upToDateTitle: "Check for updates",
                        upToDate: "You are already on the latest version (%s).",
                        newVersion: "New version available: %s (installed: %s).",
                        openReleases: "Open releases",
                        close: "Close",
                        checkFailed:
                                "Could not check for updates right now — check your connection.",
                };
}

/**
 * Sends a command to the renderer's menu bridge (lib/desktopMenu.js), which
 * maps it onto the same command registry the app UI uses. Accelerators that
 * the web app already binds are DISPLAYED but not registered
 * (registerAccelerator: false) so user-remapped key bindings keep working.
 */
function menuCommand(command) {
        return () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send("xcoder:menu-command", command);
                }
        };
}

function adjustZoom(delta) {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const contents = mainWindow.webContents;
        const next =
                delta === null ? 0 : Math.max(-3, Math.min(3, contents.getZoomLevel() + delta));
        contents.setZoomLevel(next);
        try {
                const state = readWindowState();
                state.zoomLevel = next;
                fs.writeFileSync(stateFile(), JSON.stringify(state));
        } catch {
                /* ignore */
        }
}

async function checkForUpdates() {
        const L = menuLabels();
        const installed = app.getVersion();
        let latest = null;
        try {
                const res = await fetch(
                        "https://api.github.com/repos/carsaimz/xcoder/releases/latest",
                        {
                                headers: { Accept: "application/vnd.github+json" },
                                signal: AbortSignal.timeout(15000),
                        },
                );
                if (res.ok) {
                        latest = (await res.json()).tag_name?.replace(/^v/, "") || null;
                }
        } catch {
                /* network error handled below */
        }

        if (!latest) {
                dialog.showMessageBox(mainWindow, {
                        type: "info",
                        title: L.upToDateTitle,
                        message: L.checkFailed,
                        buttons: [L.close],
                });
                return;
        }

        const outdated = latest !== installed;
        const choice = dialog.showMessageBoxSync(mainWindow, {
                type: "info",
                title: L.upToDateTitle,
                message: outdated
                        ? L.newVersion.replace("%s", latest).replace("%s", installed)
                        : L.upToDate.replace("%s", installed),
                buttons: outdated ? [L.openReleases, L.close] : [L.close],
                defaultId: 0,
                cancelId: outdated ? 1 : 0,
        });
        if (outdated && choice === 0) shell.openExternal(RELEASES_URL);
}

function showAbout() {
        const L = menuLabels();
        dialog.showMessageBox(mainWindow, {
                type: "info",
                title: L.about,
                message: L.aboutBody.replace("%s", app.getVersion()),
                buttons: [L.close],
        });
}

function buildMenu() {
        const L = menuLabels();
        // `web` commands are bound inside the webview too — display the
        // accelerator but let the page handle the key (user remaps honoured).
        const web = (label, accelerator, command) => ({
                label,
                accelerator,
                registerAccelerator: !isMac ? false : undefined,
                click: menuCommand(command),
        });

        const template = [
                {
                        label: L.file,
                        submenu: [
                                web(L.newFile, "CmdOrCtrl+N", "new-file"),
                                web(L.openFile, "CmdOrCtrl+O", "open-file"),
                                web(L.openFolder, "CmdOrCtrl+Shift+O", "open-folder"),
                                { type: "separator" },
                                web(L.save, "CmdOrCtrl+S", "save"),
                                web(L.saveAll, "CmdOrCtrl+Alt+S", "save-all-changes"),
                                { type: "separator" },
                                web(L.closeTab, "CmdOrCtrl+Q", "close-current-tab"),
                                web(L.closeAll, "CmdOrCtrl+Shift+Q", "close-all-tabs"),
                                { type: "separator" },
                                !isMac
                                        ? { label: L.exit, role: "quit" }
                                        : { role: "quit", label: L.exit },
                        ],
                },
                {
                        label: L.edit,
                        submenu: [
                                web(L.undo, "CmdOrCtrl+Z", "undo"),
                                web(L.redo, "CmdOrCtrl+Y", "redo"),
                                { type: "separator" },
                                { role: "cut", label: L.cut },
                                { role: "copy", label: L.copy },
                                { role: "paste", label: L.paste },
                                web(L.selectAll, "CmdOrCtrl+A", "selectall"),
                                { type: "separator" },
                                web(L.findFile, "CmdOrCtrl+P", "find-file"),
                                web(L.palette, "CmdOrCtrl+Shift+P", "command-palette"),
                        ],
                },
                {
                        label: L.view,
                        submenu: [
                                {
                                        label: L.zoomIn,
                                        accelerator: "CmdOrCtrl+=",
                                        click: () => adjustZoom(0.5),
                                },
                                {
                                        label: L.zoomOut,
                                        accelerator: "CmdOrCtrl+-",
                                        click: () => adjustZoom(-0.5),
                                },
                                {
                                        label: L.zoomReset,
                                        accelerator: "CmdOrCtrl+0",
                                        click: () => adjustZoom(null),
                                },
                                { type: "separator" },
                                web(L.sidebar, "CmdOrCtrl+B", "toggle-sidebar"),
                                web(L.fullscreen, "F11", "toggle-fullscreen"),
                                { type: "separator" },
                                { role: "reload", label: L.reload },
                                { role: "toggleDevTools", label: L.devtools },
                        ],
                },
                {
                        label: L.terminal,
                        submenu: [
                                web(L.newTerminal, "Ctrl+`", "new-terminal"),
                                web(L.console, "Ctrl+Shift+J", "console"),
                        ],
                },
                {
                        label: L.help,
                        submenu: [
                                {
                                        label: L.docs,
                                        click: () =>
                                                shell.openExternal("https://xcoderapp.vercel.app/docs"),
                                },
                                {
                                        label: L.releases,
                                        click: () => shell.openExternal(RELEASES_URL),
                                },
                                {
                                        label: L.report,
                                        click: () =>
                                                shell.openExternal(
                                                        "https://github.com/carsaimz/xcoder/issues/new/choose",
                                                ),
                                },
                                { type: "separator" },
                                {
                                        label: L.updates,
                                        click: () => checkForUpdates(),
                                },
                                { label: L.about, click: () => showAbout() },
                        ],
                },
        ];

        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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

        // Restore the persisted UI zoom once the page can render it.
        mainWindow.webContents.on("did-finish-load", () => {
                const zoom = readWindowState().zoomLevel;
                if (Number.isFinite(zoom) && zoom !== 0) {
                        mainWindow.webContents.setZoomLevel(zoom);
                }
        });

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
        const fallback = { width: 1280, height: 800, zoomLevel: 0 };
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

                buildMenu();

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
