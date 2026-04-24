import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Single-instance lock — prevent spawning two pets on double-click.
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit()
  // eslint-disable-next-line no-process-exit
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PET_SIZE = 128
const BUBBLE_WIDTH = 240
const BUBBLE_HEIGHT = 200
const HONO_BASE_URL = 'http://127.0.0.1:8787'
const TOGGLE_SHORTCUT = process.platform === 'darwin' ? 'Command+Shift+H' : 'Control+Shift+H'

// ---------------------------------------------------------------------------
// Persist pet position — written once on quit, not per-frame.
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

function saveCurrentPosition(): void {
  if (!mainWindow) return
  try {
    const [x, y] = mainWindow.getPosition()
    fs.writeFileSync(positionFilePath(), JSON.stringify({ x, y }), 'utf8')
  } catch {
    // Non-fatal.
  }
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
// Track whether the bubble is currently shown so we can correctly restore
// the sprite-only window height when the window is re-created.
let isBubbleVisible = false

function getDefaultPosition(): SavedPosition {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  return {
    x: width - PET_SIZE - 32,
    y: height - PET_SIZE - 32,
  }
}

function createPetWindow(): void {
  const saved = loadSavedPosition()
  const { x, y } = saved ?? getDefaultPosition()

  const windowHeight = isBubbleVisible ? PET_SIZE + BUBBLE_HEIGHT : PET_SIZE
  const windowWidth = isBubbleVisible ? BUBBLE_WIDTH : PET_SIZE

  mainWindow = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Keep the window above fullscreen apps on macOS.
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  // Show the pet on every Space, including fullscreen spaces.
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const distIndex = path.join(__dirname, '../dist-renderer/index.html')
  const forceViteDev = process.env.HANA_VITE === '1'

  if (app.isPackaged) {
    mainWindow.loadFile(distIndex)
  } else if (forceViteDev) {
    mainWindow.loadURL('http://localhost:5174')
  } else if (fs.existsSync(distIndex)) {
    // Lets `npx electron .` work after `npm run build:renderer` without a Vite dev server.
    mainWindow.loadFile(distIndex)
  } else {
    console.warn(
      '[hana] No dist-renderer/index.html — run `npm run build:renderer` once, ' +
        'or start Vite (`npm run dev:renderer`) and set HANA_VITE=1.',
    )
    mainWindow.loadURL('http://localhost:5174')
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray(): void {
  // Use a PNG for the tray icon — SVG is not supported on all platforms.
  // Fall back to an empty image if the asset is missing so the app still runs.
  const iconPath = path.join(__dirname, '../hana-icon/active.svg')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    // Resize to standard menu-bar size (16×16 logical px on macOS).
    if (!icon.isEmpty()) {
      icon = icon.resize({ width: 16, height: 16 })
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Hana')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show Hana',
        click: () => {
          if (!mainWindow) createPetWindow()
          else mainWindow.show()
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit(),
      },
    ]),
  )
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

// Delta-based window movement — renderer sends (dx, dy) per rAF tick.
// We use getPosition() as the source of truth, not a cached JSON value.
ipcMain.on('pet:moveBy', (_event, { dx, dy }: { dx: number; dy: number }) => {
  if (!mainWindow) return
  const [x, y] = mainWindow.getPosition()
  mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy))
})

// Expand window upward when the speech bubble opens; shrink when it closes.
// The sprite stays at the same screen position because we adjust y by the
// same amount we change the height.
ipcMain.on('pet:setBubbleVisible', (_event, { visible }: { visible: boolean }) => {
  if (!mainWindow) return
  isBubbleVisible = visible
  const [x, y] = mainWindow.getPosition()
  if (visible) {
    // Expand upward and widen. Shift x left so the sprite stays centered under
    // the bubble: offset = (BUBBLE_WIDTH - PET_SIZE) / 2
    const xOffset = Math.round((BUBBLE_WIDTH - PET_SIZE) / 2)
    mainWindow.setSize(BUBBLE_WIDTH, PET_SIZE + BUBBLE_HEIGHT)
    mainWindow.setPosition(x - xOffset, y - BUBBLE_HEIGHT)
  } else {
    const xOffset = Math.round((BUBBLE_WIDTH - PET_SIZE) / 2)
    mainWindow.setSize(PET_SIZE, PET_SIZE)
    mainWindow.setPosition(x + xOffset, y + BUBBLE_HEIGHT)
  }
})

// Forward journal submission to the local Hono server from Node so we avoid
// renderer CORS restrictions.
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

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createPetWindow()
  createTray()

  // Bring the existing window to front if a second instance tries to launch.
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })

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

  // macOS: re-create window when the dock icon is clicked with no open windows.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPetWindow()
  })
})

// Persist position once on quit instead of on every drag frame.
app.on('before-quit', () => {
  saveCurrentPosition()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// macOS: keep the process alive when all windows are closed (tray is the exit).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
