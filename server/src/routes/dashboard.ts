import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { readConfig } from '../config-store.ts'
import {
  buildDashboardSynthesis,
  buildWhatToDoNow,
  filterWinsByReveal,
  type DashboardRangePreset,
} from '../decision-engine.ts'
import { computeEisenhowerGrid } from '../eisenhower.ts'
import { readGoals } from '../goals-store.ts'
import type { Goal } from '../goals-store.ts'
import { getRevealAtMap, readTimeline } from '../obsidian.ts'
import { parseTimelineMarkdown } from '../timeline-parser.ts'

const dashboard = new Hono()

const TARGET_WINS_PER_WEEK = 2

function winCalendarRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
}

function parseRangeQuery(value: string | undefined): DashboardRangePreset {
  if (value === '30d' || value === '90d') return value
  return 'all'
}

function dashboardUtcTodayISO(): string {
  const today = new Date()
  return [
    today.getUTCFullYear(),
    String(today.getUTCMonth() + 1).padStart(2, '0'),
    String(today.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function dashboardAddDays(baseISO: string, deltaDays: number): string {
  const [y, m, d] = baseISO.split('-').map(Number)
  const next = new Date(y, m - 1, d + deltaDays)
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-')
}

function dashboardMondayUtc(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const jsDay = date.getDay()
  const mondayOffset = (jsDay + 6) % 7
  const monday = new Date(y, m - 1, d - mondayOffset)
  return [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, '0'),
    String(monday.getDate()).padStart(2, '0'),
  ].join('-')
}

async function loadDashboardContext(): Promise<{
  timelineSource: string
  revealAtMap: Record<string, string>
}> {
  const config = await readConfig()
  const demoTimelineEnv = process.env.WIN_CALENDAR_DEMO_TIMELINE?.trim()

  if (demoTimelineEnv) {
    const resolved = path.isAbsolute(demoTimelineEnv)
      ? demoTimelineEnv
      : path.resolve(winCalendarRepoRoot(), demoTimelineEnv)
    const timelineSource = await readFile(resolved, 'utf8')
    const revealAtMap = config ? await getRevealAtMap(config.obsidianPath) : {}
    return { timelineSource, revealAtMap }
  }

  if (!config) {
    const error = new Error('Not onboarded yet.')
    ;(error as Error & { status: number }).status = 400
    throw error
  }

  const [timelineSource, revealAtMap] = await Promise.all([
    readTimeline(config.obsidianPath),
    getRevealAtMap(config.obsidianPath),
  ])
  return { timelineSource, revealAtMap }
}

function buildGoalRows(goals: Goal[], visibleByDate: ReturnType<typeof parseTimelineMarkdown>) {
  const utcISO = dashboardUtcTodayISO()
  const mondayISO = dashboardMondayUtc(utcISO)

  return goals
    .filter((goal) => goal.status === 'active')
    .map((goal) => {
      let winsThisWeek = 0

      for (let offset = 0; offset < 7; offset++) {
        const date = dashboardAddDays(mondayISO, offset)
        for (const win of visibleByDate[date] ?? []) {
          if (win.areas?.includes(goal.area)) winsThisWeek++
        }
      }

      const pace01 = Math.min(1, winsThisWeek / TARGET_WINS_PER_WEEK)

      return {
        goalId: goal.id,
        title: goal.title,
        area: goal.area,
        targetDate: goal.targetDate,
        weeklyMilestone: goal.weeklyMilestone ?? null,
        winsThisCalendarWeek: winsThisWeek,
        targetWinsPerWeek: TARGET_WINS_PER_WEEK,
        pace01,
      }
    })
}

dashboard.get('/api/dashboard', async (c) => {
  const preset = parseRangeQuery(c.req.query('range'))

  let ctx: { timelineSource: string; revealAtMap: Record<string, string> }
  try {
    ctx = await loadDashboardContext()
  } catch (error: unknown) {
    const fallbackStatus = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    const message = error instanceof Error ? error.message : 'Failed loading dashboard inputs.'
    if (fallbackStatus === 400) {
      return c.json({ error: message }, 400)
    }
    console.warn('[dashboard]', error)
    return c.json({ error: message }, 500)
  }

  const parsed = parseTimelineMarkdown(ctx.timelineSource)
  const visible = filterWinsByReveal(parsed, ctx.revealAtMap, Date.now())
  const goals = await readGoals()
  const eisenhower = computeEisenhowerGrid(goals, visible)
  const synthesis = buildDashboardSynthesis(goals, visible, preset, eisenhower)

  const goalRows = buildGoalRows(goals, visible)

  return c.json({
    range: preset,
    priority: synthesis.priority,
    driftAlerts: synthesis.driftAlerts,
    eisenhower,
    chart: {
      weeks: synthesis.chartWeeks,
      areaSeriesCarried: synthesis.areaSeriesCarried,
      totalSeries: synthesis.totalSeries,
      areaSeriesCumulative: synthesis.areaSeriesCumulative,
      totalSeriesCumulative: synthesis.totalSeriesCumulative,
    },
    goalProgress: goalRows,
  })
})

dashboard.get('/api/dashboard/now', async (c) => {
  try {
    const ctx = await loadDashboardContext()
    const parsed = parseTimelineMarkdown(ctx.timelineSource)
    const visible = filterWinsByReveal(parsed, ctx.revealAtMap, Date.now())
    const goals = await readGoals()
    const suggestion = buildWhatToDoNow(goals, visible)
    return c.json({ ok: true, ...suggestion })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed crafting “what to do now”.'
    if (typeof (error as { status?: number }).status === 'number' && (error as { status: number }).status === 400) {
      return c.json({ error: message }, 400)
    }
    console.warn('[dashboard/now]', error)
    return c.json({ error: message }, 500)
  }
})

export default dashboard
