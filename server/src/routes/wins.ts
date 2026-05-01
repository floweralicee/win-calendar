import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { readConfig } from '../config-store.ts'
import { getRevealAtMap, readTimeline, deleteWin, updateWinAreaInFile } from '../obsidian.ts'
import { parseTimelineMarkdown } from '../timeline-parser.ts'
import { LIFE_AREAS, type LifeArea } from '../claude.ts'

const wins = new Hono()

/** Repo root (`win-calendar/`), not `process.cwd()` — `npm` may run with a different cwd. */
function winCalendarRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
}

/**
 * Returns the wins the UI should render right now. The server enforces the
 * reveal filter: any win whose `revealAt` is still in the future is omitted
 * entirely. The browser never sees tonight's wins until morning.
 */
wins.get('/api/wins', async (c) => {
  const config = await readConfig()
  const demoTimelineEnv = process.env.WIN_CALENDAR_DEMO_TIMELINE?.trim()

  let timelineSource: string
  let revealAtMap: Record<string, string>

  if (demoTimelineEnv) {
    const resolved = path.isAbsolute(demoTimelineEnv)
      ? demoTimelineEnv
      : path.resolve(winCalendarRepoRoot(), demoTimelineEnv)
    timelineSource = await readFile(resolved, 'utf8')
    revealAtMap = config ? await getRevealAtMap(config.obsidianPath) : {}
  } else {
    if (!config) {
      return c.json({ winsByDate: {} })
    }
    const [fromVault, fromState] = await Promise.all([
      readTimeline(config.obsidianPath),
      getRevealAtMap(config.obsidianPath),
    ])
    timelineSource = fromVault
    revealAtMap = fromState
  }

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

/**
 * Updates the `area:` tag of a single win in the timeline file.
 * Respects WIN_CALENDAR_DEMO_TIMELINE so edits hit the demo file in demo mode.
 */
wins.patch('/api/wins/:winId', async (c) => {
  const winId = c.req.param('winId')
  if (!winId) return c.json({ error: 'winId is required.' }, 400)

  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Body must be JSON.' }, 400)
  }

  const newArea = body.area
  if (
    typeof newArea !== 'string' ||
    !(LIFE_AREAS as readonly string[]).includes(newArea)
  ) {
    return c.json({ error: `area must be one of: ${LIFE_AREAS.join(', ')}.` }, 400)
  }

  const demoTimelineEnv = process.env.WIN_CALENDAR_DEMO_TIMELINE?.trim()

  let targetFilePath: string
  if (demoTimelineEnv) {
    targetFilePath = path.isAbsolute(demoTimelineEnv)
      ? demoTimelineEnv
      : path.resolve(winCalendarRepoRoot(), demoTimelineEnv)
  } else {
    const config = await readConfig()
    if (!config) return c.json({ error: 'Not onboarded yet.' }, 400)
    targetFilePath = path.join(
      config.obsidianPath,
      'WinCalendar',
      'timeline-life.md',
    )
  }

  const updated = await updateWinAreaInFile(targetFilePath, winId, newArea as LifeArea)
  if (!updated) return c.json({ error: 'Win not found in timeline.' }, 404)

  return c.json({ ok: true })
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
