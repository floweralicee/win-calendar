import { Hono } from 'hono'
import { readConfig } from '../config-store.ts'
import { getRevealAtMap, readTimeline, deleteWin } from '../obsidian.ts'
import { parseTimelineMarkdown } from '../timeline-parser.ts'

const wins = new Hono()

/**
 * Returns the wins the UI should render right now. The server enforces the
 * reveal filter: any win whose `revealAt` is still in the future is omitted
 * entirely. The browser never sees tonight's wins until morning.
 */
wins.get('/api/wins', async (c) => {
  const config = await readConfig()
  if (!config) {
    return c.json({ winsByDate: {} })
  }

  const [timelineSource, revealAtMap] = await Promise.all([
    readTimeline(config.obsidianPath),
    getRevealAtMap(config.obsidianPath),
  ])

  const allWinsByDate = parseTimelineMarkdown(timelineSource)
  const now = Date.now()

  const visible: Record<string, unknown[]> = {}
  for (const [date, winsForDate] of Object.entries(allWinsByDate)) {
    const kept = winsForDate.filter((win) => {
      const revealAt = revealAtMap[win.id]
      if (!revealAt) return true
      return Date.parse(revealAt) <= now
    })
    if (kept.length > 0) visible[date] = kept
  }

  return c.json({ winsByDate: visible })
})

wins.delete('/api/wins/:winId', async (c) => {
  const config = await readConfig()
  if (!config) {
    return c.json({ error: 'Not onboarded yet.' }, 400)
  }
  const winId = c.req.param('winId')
  if (!winId) {
    return c.json({ error: 'winId is required.' }, 400)
  }
  await deleteWin(config.obsidianPath, winId)
  return c.json({ ok: true })
})

export default wins
