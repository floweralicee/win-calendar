import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { LifeArea } from './claude.ts'

const GOALS_FILE = path.join(os.homedir(), '.win-calendar', 'goals.json')

export type GoalStatus = 'active' | 'achieved' | 'paused'

export type Goal = {
  /** Stable id: timestamp + title slug. */
  id: string
  title: string
  /** Which life area this goal lives in. */
  area: LifeArea
  /** ISO YYYY-MM-DD deadline. */
  targetDate: string
  /** Optional short description of this week's concrete milestone. */
  weeklyMilestone?: string
  status: GoalStatus
  /** ISO timestamp when created. */
  createdAt: string
}

type GoalsFile = {
  version: 1
  goals: Goal[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function readGoalsFile(): Promise<GoalsFile> {
  try {
    const raw = await fs.readFile(GOALS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as GoalsFile
    if (parsed.version !== 1 || !Array.isArray(parsed.goals)) {
      return { version: 1, goals: [] }
    }
    return parsed
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, goals: [] }
    }
    throw error
  }
}

async function writeGoalsFile(file: GoalsFile): Promise<void> {
  const dir = path.dirname(GOALS_FILE)
  await fs.mkdir(dir, { recursive: true })
  // Mode 0600 — same as config.json; goals are personal data.
  await fs.writeFile(GOALS_FILE, JSON.stringify(file, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  })
}

export async function readGoals(): Promise<Goal[]> {
  const file = await readGoalsFile()
  return file.goals
}

export async function addGoal(
  data: Omit<Goal, 'id' | 'createdAt'>,
): Promise<Goal> {
  const file = await readGoalsFile()
  const id = `${Date.now()}-${slugify(data.title)}`
  const goal: Goal = { ...data, id, createdAt: new Date().toISOString() }
  file.goals.push(goal)
  await writeGoalsFile(file)
  return goal
}

export async function updateGoal(
  id: string,
  updates: Partial<Omit<Goal, 'id' | 'createdAt'>>,
): Promise<Goal | null> {
  const file = await readGoalsFile()
  const idx = file.goals.findIndex((g) => g.id === id)
  if (idx === -1) return null
  file.goals[idx] = { ...file.goals[idx], ...updates }
  await writeGoalsFile(file)
  return file.goals[idx]
}

export async function deleteGoal(id: string): Promise<boolean> {
  const file = await readGoalsFile()
  const before = file.goals.length
  file.goals = file.goals.filter((g) => g.id !== id)
  if (file.goals.length === before) return false
  await writeGoalsFile(file)
  return true
}
