import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { readConfig } from '../config-store.ts'
import { deleteWin, updateWinAreasInFile } from '../obsidian.ts'
import { LIFE_AREAS, type LifeArea } from '../claude.ts'
import { readVisibleWinsByDate } from '../wins-query.ts'

const wins = new Hono()

/** Repo root (`win-calendar/`), not `process.cwd()` because npm may run elsewhere. */
function winCalendarRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
}

/**
 * Returns the wins the UI should render right now. The server enforces the
 * reveal filter: any win whose `revealAt` is still in the future is omitted
 * entirely. The browser never sees tonight's wins until morning.
 */
wins.get('/api/wins', async (c) => {
  return c.json({ winsByDate: await readVisibleWinsByDate() })
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

  const newAreas = body.areas
  if (
    !Array.isArray(newAreas) ||
    newAreas.length === 0 ||
    !newAreas.every(
      (a): a is LifeArea =>
        typeof a === 'string' && (LIFE_AREAS as readonly string[]).includes(a),
    )
  ) {
    return c.json({ error: `areas must be a non-empty array of: ${LIFE_AREAS.join(', ')}.` }, 400)
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

  const updated = await updateWinAreasInFile(targetFilePath, winId, newAreas)
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
