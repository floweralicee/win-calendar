// Type declarations for the API exposed by the preload script via contextBridge.

export type JournalSubmitResult =
  | { ok: true; winsCount: number; message: string }
  | { ok: false; error: string }

declare global {
  interface Window {
    hana: {
      /** Submit a journal entry through the Hono server via the main process. */
      submitJournal: (text: string, dateISO: string) => Promise<JournalSubmitResult>
      /**
       * Move the native window by (dx, dy) screen pixels.
       * Called on every rAF tick while dragging.
       */
      moveBy: (dx: number, dy: number) => void
      /**
       * Expand the window upward to show the speech bubble (true),
       * or shrink it back down to sprite-only height (false).
       */
      setBubbleVisible: (visible: boolean) => void
    }
  }
}

// Vite ?url asset imports — tells TypeScript these resolve to a string URL.
declare module '*.svg?url' {
  const url: string
  export default url
}
