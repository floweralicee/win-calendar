import { Hono } from 'hono'
import {
  readGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  type Goal,
  type GoalStatus,
} from '../goals-store.ts'
import { LIFE_AREAS, type LifeArea } from '../claude.ts'

const goals = new Hono()

const VALID_STATUSES: GoalStatus[] = ['active', 'achieved', 'paused']

goals.get('/api/goals', async (c) => {
  const goalsList = await readGoals()
  return c.json({ goals: goalsList })
})

goals.post('/api/goals', async (c) => {
  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Body must be JSON.' }, 400)
  }

  const { title, area, targetDate, weeklyMilestone, status } = body

  if (typeof title !== 'string' || !title.trim()) {
    return c.json({ error: 'title is required.' }, 400)
  }
  if (
    typeof area !== 'string' ||
    !(LIFE_AREAS as readonly string[]).includes(area)
  ) {
    return c.json({ error: `area must be one of: ${LIFE_AREAS.join(', ')}.` }, 400)
  }
  if (
    typeof targetDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
  ) {
    return c.json({ error: 'targetDate must be YYYY-MM-DD.' }, 400)
  }

  const goalStatus: GoalStatus =
    typeof status === 'string' && VALID_STATUSES.includes(status as GoalStatus)
      ? (status as GoalStatus)
      : 'active'

  const goal = await addGoal({
    title: title.trim(),
    area: area as LifeArea,
    targetDate,
    weeklyMilestone:
      typeof weeklyMilestone === 'string' && weeklyMilestone.trim()
        ? weeklyMilestone.trim()
        : undefined,
    status: goalStatus,
  })

  return c.json({ goal }, 201)
})

goals.patch('/api/goals/:goalId', async (c) => {
  const goalId = c.req.param('goalId')
  if (!goalId) return c.json({ error: 'goalId is required.' }, 400)

  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Body must be JSON.' }, 400)
  }

  const updates: Partial<Omit<Goal, 'id' | 'createdAt'>> = {}

  if (typeof body.title === 'string' && body.title.trim()) {
    updates.title = body.title.trim()
  }
  if (
    typeof body.area === 'string' &&
    (LIFE_AREAS as readonly string[]).includes(body.area)
  ) {
    updates.area = body.area as LifeArea
  }
  if (
    typeof body.targetDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)
  ) {
    updates.targetDate = body.targetDate
  }
  if (typeof body.weeklyMilestone === 'string') {
    updates.weeklyMilestone = body.weeklyMilestone.trim() || undefined
  }
  if (
    typeof body.status === 'string' &&
    VALID_STATUSES.includes(body.status as GoalStatus)
  ) {
    updates.status = body.status as GoalStatus
  }

  const updated = await updateGoal(goalId, updates)
  if (!updated) return c.json({ error: 'Goal not found.' }, 404)

  return c.json({ goal: updated })
})

goals.delete('/api/goals/:goalId', async (c) => {
  const goalId = c.req.param('goalId')
  if (!goalId) return c.json({ error: 'goalId is required.' }, 400)

  const deleted = await deleteGoal(goalId)
  if (!deleted) return c.json({ error: 'Goal not found.' }, 404)

  return c.json({ ok: true })
})

export default goals
