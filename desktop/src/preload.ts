import { contextBridge, ipcRenderer } from 'electron'

export type JournalSubmitResult =
  | { ok: true; winsCount: number; message: string }
  | { ok: false; error: string }

// Expose a narrow, typed API to the renderer. The renderer has no access to
// Node or Electron APIs directly (contextIsolation: true, nodeIntegration: false).
contextBridge.exposeInMainWorld('hana', {
  /**
   * Submit a journal entry through the Hono server. The main process makes the
   * actual HTTP request so CORS is not a concern.
   */
  submitJournal: (text: string, dateISO: string): Promise<JournalSubmitResult> =>
    ipcRenderer.invoke('journal:submit', { text, dateISO }),

  /**
   * Move the native window to the given screen coordinates and persist position.
   * Called continuously during drag.
   */
  setPosition: (x: number, y: number): void =>
    ipcRenderer.send('pet:setPosition', { x, y }),
})
