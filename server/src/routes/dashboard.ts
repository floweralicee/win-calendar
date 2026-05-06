import { Hono } from 'hono'

import { buildDashboardData, buildDecision } from '../decision-engine.ts'
import { readGoals } from '../goals-store.ts'
import { readVisibleWinsByDate } from '../wins-query.ts'

const dashboard = new Hono()

dashboard.get('/api/dashboard', async (c) => {
  const [goals, winsByDate] = await Promise.all([
    readGoals(),
    readVisibleWinsByDate(),
  ])

  return c.json(buildDashboardData(goals, winsByDate))
})

dashboard.get('/api/dashboard/now', async (c) => {
  const [goals, winsByDate] = await Promise.all([
    readGoals(),
    readVisibleWinsByDate(),
  ])

  return c.json({ action: buildDecision(goals, winsByDate).nowAction })
})

export default dashboard
