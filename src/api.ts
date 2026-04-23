import type { WinsByDate } from './wins'

export type PublicConfig = {
  onboarded: boolean
  obsidianPath?: string
  email?: string
  timezone?: string
  revealHour?: number
}

export type OnboardingPayload = {
  obsidianPath: string
  email: string
  timezone: string
  revealHour?: number
}

export type JournalSubmitResult = {
  ok: boolean
  winsCount: number
  message: string
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new Error(`Server returned ${response.status} with non-JSON body.`)
  }
  if (!response.ok) {
    const message =
      json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `Server returned ${response.status}.`
    throw new Error(message)
  }
  return json as T
}

export async function fetchConfig(): Promise<PublicConfig> {
  const response = await fetch('/api/config')
  return parseJsonOrThrow<PublicConfig>(response)
}

export async function submitOnboarding(payload: OnboardingPayload): Promise<PublicConfig> {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow<PublicConfig>(response)
}

export async function fetchWins(): Promise<WinsByDate> {
  const response = await fetch('/api/wins')
  const json = await parseJsonOrThrow<{ winsByDate: WinsByDate }>(response)
  return json.winsByDate ?? {}
}

export async function submitJournal(payload: { text: string; dateISO: string }): Promise<JournalSubmitResult> {
  const response = await fetch('/api/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow<JournalSubmitResult>(response)
}

export async function deleteWin(winId: string): Promise<void> {
  const response = await fetch(`/api/wins/${encodeURIComponent(winId)}`, {
    method: 'DELETE',
  })
  await parseJsonOrThrow<{ ok: boolean }>(response)
}
