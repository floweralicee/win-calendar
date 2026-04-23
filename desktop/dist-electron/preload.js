"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose a narrow, typed API to the renderer. The renderer has no access to
// Node or Electron APIs directly (contextIsolation: true, nodeIntegration: false).
electron_1.contextBridge.exposeInMainWorld('hana', {
    /**
     * Submit a journal entry through the Hono server. The main process makes the
     * actual HTTP request so CORS is not a concern.
     */
    submitJournal: (text, dateISO) => electron_1.ipcRenderer.invoke('journal:submit', { text, dateISO }),
    /**
     * Move the native window by a delta (dx, dy) in screen pixels.
     * Main process applies the delta to the current window position via
     * getPosition() — the renderer never needs to know the absolute position.
     * Called on every rAF tick during drag.
     */
    moveBy: (dx, dy) => electron_1.ipcRenderer.send('pet:moveBy', { dx, dy }),
    /**
     * Tell the main process to expand or shrink the window height to
     * accommodate the speech bubble. The window grows upward (y decreases)
     * so the sprite stays anchored at the same screen position.
     */
    setBubbleVisible: (visible) => electron_1.ipcRenderer.send('pet:setBubbleVisible', { visible }),
});
