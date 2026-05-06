import { Hono } from 'hono'

import { readGoals } from '../goals-store.ts'
import { buildMapData } from '../map-data.ts'
import { readVisibleWinsByDate } from '../wins-query.ts'

const map = new Hono()

map.get('/api/map', async (c) => {
  const [goals, winsByDate] = await Promise.all([
    readGoals(),
    readVisibleWinsByDate(),
  ])

  return c.json(buildMapData(goals, winsByDate))
})

export default map
