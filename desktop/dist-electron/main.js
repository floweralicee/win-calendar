"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ---------------------------------------------------------------------------
// Single-instance lock — prevent spawning two pets on double-click.
// ---------------------------------------------------------------------------
if (!electron_1.app.requestSingleInstanceLock()) {
    electron_1.app.quit();
    // eslint-disable-next-line no-process-exit
    process.exit(0);
}
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
/** Logical pet square (window height in sprite-only mode; matches renderer `.pet-sprite`). */
const PET_SIZE = 256;
const BUBBLE_WIDTH = 300;
const BUBBLE_HEIGHT = 220;
const HONO_BASE_URL = 'http://127.0.0.1:8787';
const TOGGLE_SHORTCUT = process.platform === 'darwin' ? 'Command+Shift+H' : 'Control+Shift+H';
function positionFilePath() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'hana-position.json');
}
function loadSavedPosition() {
    try {
        const raw = fs_1.default.readFileSync(positionFilePath(), 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number')
            return parsed;
        return null;
    }
    catch {
        return null;
    }
}
function saveCurrentPosition() {
    if (!mainWindow)
        return;
    try {
        const [x, y] = mainWindow.getPosition();
        fs_1.default.writeFileSync(positionFilePath(), JSON.stringify({ x, y }), 'utf8');
    }
    catch {
        // Non-fatal.
    }
}
// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------
let mainWindow = null;
let tray = null;
// Track whether the bubble is currently shown so we can correctly restore
// the sprite-only window height when the window is re-created.
let isBubbleVisible = false;
function getDefaultPosition() {
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    return {
        x: width - PET_SIZE - 32,
        y: height - PET_SIZE - 32,
    };
}
function createPetWindow() {
    const saved = loadSavedPosition();
    const { x, y } = saved ?? getDefaultPosition();
    const windowHeight = isBubbleVisible ? PET_SIZE + BUBBLE_HEIGHT : PET_SIZE;
    const windowWidth = isBubbleVisible ? BUBBLE_WIDTH : PET_SIZE;
    mainWindow = new electron_1.BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x,
        y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        hasShadow: false,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Keep the window above fullscreen apps on macOS.
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    // Show the pet on every Space, including fullscreen spaces.
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    const distIndex = path_1.default.join(__dirname, '../dist-renderer/index.html');
    const forceViteDev = process.env.HANA_VITE === '1';
    if (electron_1.app.isPackaged) {
        mainWindow.loadFile(distIndex);
    }
    else if (forceViteDev) {
        mainWindow.loadURL('http://localhost:5174');
    }
    else if (fs_1.default.existsSync(distIndex)) {
        // Lets `npx electron .` work after `npm run build:renderer` without a Vite dev server.
        mainWindow.loadFile(distIndex);
    }
    else {
        console.warn('[hana] No dist-renderer/index.html — run `npm run build:renderer` once, ' +
            'or start Vite (`npm run dev:renderer`) and set HANA_VITE=1.');
        mainWindow.loadURL('http://localhost:5174');
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function createTray() {
    // Use a PNG for the tray icon — SVG is not supported on all platforms.
    // Fall back to an empty image if the asset is missing so the app still runs.
    const iconPath = path_1.default.join(__dirname, '../hana-icon/active.svg');
    let icon;
    try {
        icon = electron_1.nativeImage.createFromPath(iconPath);
        // Resize to standard menu-bar size (16×16 logical px on macOS).
        if (!icon.isEmpty()) {
            icon = icon.resize({ width: 16, height: 16 });
        }
    }
    catch {
        icon = electron_1.nativeImage.createEmpty();
    }
    tray = new electron_1.Tray(icon);
    tray.setToolTip('Hana');
    tray.setContextMenu(electron_1.Menu.buildFromTemplate([
        {
            label: 'Show Hana',
            click: () => {
                if (!mainWindow)
                    createPetWindow();
                else
                    mainWindow.show();
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => electron_1.app.quit(),
        },
    ]));
}
// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
// Delta-based window movement — renderer sends (dx, dy) per rAF tick.
// We use getPosition() as the source of truth, not a cached JSON value.
electron_1.ipcMain.on('pet:moveBy', (_event, { dx, dy }) => {
    if (!mainWindow)
        return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
});
// Expand window upward when the speech bubble opens; shrink when it closes.
// The sprite stays at the same screen position because we adjust y by the
// same amount we change the height.
electron_1.ipcMain.on('pet:setBubbleVisible', (_event, { visible }) => {
    if (!mainWindow)
        return;
    isBubbleVisible = visible;
    const [x, y] = mainWindow.getPosition();
    if (visible) {
        // Expand upward and widen. Shift x left so the sprite stays centered under
        // the bubble: offset = (BUBBLE_WIDTH - PET_SIZE) / 2
        const xOffset = Math.round((BUBBLE_WIDTH - PET_SIZE) / 2);
        mainWindow.setSize(BUBBLE_WIDTH, PET_SIZE + BUBBLE_HEIGHT);
        mainWindow.setPosition(x - xOffset, y - BUBBLE_HEIGHT);
    }
    else {
        const xOffset = Math.round((BUBBLE_WIDTH - PET_SIZE) / 2);
        mainWindow.setSize(PET_SIZE, PET_SIZE);
        mainWindow.setPosition(x + xOffset, y + BUBBLE_HEIGHT);
    }
});
function friendlyJournalFetchError(error) {
    if (!(error instanceof Error))
        return 'Network error';
    const messageLower = error.message.toLowerCase();
    const cause = error.cause;
    const code = cause?.code ?? '';
    const isUnreachable = code === 'ECONNREFUSED' ||
        code === 'ENOTFOUND' ||
        messageLower.includes('fetch failed') ||
        messageLower.includes('econnrefused');
    if (isUnreachable) {
        return ("Can't reach the Win Calendar server (127.0.0.1:8787). " +
            'Open a terminal in the win-calendar folder and run: npm run dev');
    }
    return error.message;
}
// Forward journal submission to the local Hono server from Node so we avoid
// renderer CORS restrictions.
electron_1.ipcMain.handle('journal:submit', async (_event, payload) => {
    try {
        const response = await fetch(`${HONO_BASE_URL}/api/journal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        let json;
        try {
            json = (await response.json());
        }
        catch {
            return {
                ok: false,
                error: `Server returned ${response.status} with a non-JSON body.`,
            };
        }
        if (!response.ok) {
            return { ok: false, error: json.error ?? `Server error ${response.status}` };
        }
        return { ok: true, winsCount: json.winsCount ?? 0, message: json.message ?? '' };
    }
    catch (error) {
        return { ok: false, error: friendlyJournalFetchError(error) };
    }
});
// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
electron_1.app.whenReady().then(() => {
    createPetWindow();
    createTray();
    // Bring the existing window to front if a second instance tries to launch.
    electron_1.app.on('second-instance', () => {
        if (mainWindow) {
            if (!mainWindow.isVisible())
                mainWindow.show();
            mainWindow.focus();
        }
    });
    electron_1.globalShortcut.register(TOGGLE_SHORTCUT, () => {
        if (!mainWindow) {
            createPetWindow();
            return;
        }
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        }
        else {
            mainWindow.show();
        }
    });
    // macOS: re-create window when the dock icon is clicked with no open windows.
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createPetWindow();
    });
});
// Persist position once on quit instead of on every drag frame.
electron_1.app.on('before-quit', () => {
    saveCurrentPosition();
});
electron_1.app.on('will-quit', () => {
    electron_1.globalShortcut.unregisterAll();
});
// macOS: keep the process alive when all windows are closed (tray is the exit).
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
