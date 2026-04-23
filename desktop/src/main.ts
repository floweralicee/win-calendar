import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Persist pet position across launches using a simple JSON file in userData.
// We avoid electron-store to keep deps minimal.
// ---------------------------------------------------------------------------

type SavedPosition = { x: number; y: number }

function positionFilePath(): string {
  return path.join(app.getPath('userData'), 'hana-position.json')
}

function loadSavedPosition(): SavedPosition | null {
  try {
    const raw = fs.readFileSync(positionFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as SavedPosition
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
    return null
  } catch {
    return null
  }
}

function savePosition(x: number, y: number): void {
  try {
    fs.writeFileSync(positionFilePath(), JSON.stringify({ x, y }), 'utf8')
  } catch {
    // Non-fatal — position just won't persist.
  }
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

const WINDOW_SIZE = 128
const HONO_BASE_URL = 'http://127.0.0.1:8787'
const TOGGLE_SHORTCUT = process.platform === 'darwin' ? 'Command+Shift+H' : 'Control+Shift+H'

let mainWindow: BrowserWindow | null = null

function getDefaultPosition(): SavedPosition {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  return {
    x: width - WINDOW_SIZE - 32,
    y: height - WINDOW_SIZE - 32,
  }
}

function createPetWindow(): void {
  const saved = loadSavedPosition()
  const { x, y } = saved ?? getDefaultPosition()

  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE + 160, // extra height for the speech bubble above the pet
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Keep the window on top even over fullscreen apps on macOS.
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  // Do not show in the macOS Expose / Mission Control thumbnails.
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

// The renderer calls this to forward a journal entry to the Hono server.
// We do the fetch in the main process so Node's fetch (with no CORS restriction)
// is used rather than the renderer's sandboxed fetch.
ipcMain.handle(
  'journal:submit',
  async (_event, payload: { text: string; dateISO: string }) => {
    try {
      const response = await fetch(`${HONO_BASE_URL}/api/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await response.json()) as {
        ok?: boolean
        winsCount?: number
        message?: string
        error?: string
      }
      if (!response.ok) {
        return { ok: false, error: json.error ?? `Server error ${response.status}` }
      }
      return { ok: true, winsCount: json.winsCount ?? 0, message: json.message ?? '' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error'
      return { ok: false, error: message }
    }
  },
)

// Renderer sends updated position after each drag so we persist it.
ipcMain.on('pet:setPosition', (_event, { x, y }: { x: number; y: number }) => {
  if (mainWindow) {
    mainWindow.setPosition(Math.round(x), Math.round(y))
    savePosition(Math.round(x), Math.round(y))
  }
})

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createPetWindow()

  globalShortcut.register(TOGGLE_SHORTCUT, () => {
    if (!mainWindow) {
      createPetWindow()
      return
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
    }
  })

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked and no windows are open.
    if (BrowserWindow.getAllWindows().length === 0) createPetWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// On macOS the app should stay running even when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
