import type { WinsByDate, LifeArea } from './wins'

export type GoalStatus = 'active' | 'achieved' | 'paused'

export type Goal = {
  id: string
  title: string
  area: LifeArea
  targetDate: string
  weeklyMilestone?: string
  status: GoalStatus
  createdAt: string
}

export type GoalInput = {
  title: string
  area: LifeArea
  targetDate: string
  weeklyMilestone?: string
  status?: GoalStatus
}

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

export async function fetchGoals(): Promise<Goal[]> {
  const response = await fetch('/api/goals')
  const json = await parseJsonOrThrow<{ goals: Goal[] }>(response)
  return json.goals ?? []
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const response = await fetch('/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await parseJsonOrThrow<{ goal: Goal }>(response)
  return json.goal
}

export async function updateGoal(id: string, updates: Partial<GoalInput & { status: GoalStatus }>): Promise<Goal> {
  const response = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const json = await parseJsonOrThrow<{ goal: Goal }>(response)
  return json.goal
}

export async function removeGoal(id: string): Promise<void> {
  const response = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await parseJsonOrThrow<{ ok: boolean }>(response)
}

export async function updateWinAreas(winId: string, areas: LifeArea[]): Promise<void> {
  const response = await fetch(`/api/wins/${encodeURIComponent(winId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ areas }),
  })
  await parseJsonOrThrow<{ ok: boolean }>(response)
}
