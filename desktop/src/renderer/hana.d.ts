// Type declarations for the API exposed by the preload script via contextBridge.

export type JournalSubmitResult =
  | { ok: true; winsCount: number; message: string }
  | { ok: false; error: string }

declare global {
  interface Window {
    hana: {
      submitJournal: (text: string, dateISO: string) => Promise<JournalSubmitResult>
      setPosition: (x: number, y: number) => void
    }
  }
}

// Vite ?url asset imports — tells TypeScript these resolve to a string URL.
declare module '*.svg?url' {
  const url: string
  export default url
}
