import type { EisenhowerGrid, EisenhowerItem } from './eisenhower.ts'
import type { Goal } from './goals-store.ts'
import type { LifeArea, WinsByDate } from './timeline-parser.ts'
import { computeEisenhowerGrid } from './eisenhower.ts'

export const DASHBOARD_CHART_AREAS = [
  'finance',
  'social',
  'growth',
  'health',
  'career',
] as const satisfies readonly LifeArea[]
export type DashboardChartArea = (typeof DASHBOARD_CHART_AREAS)[number]

export type DashboardRangePreset = '30d' | '90d' | 'all'

export type PriorityCardModel = {
  headline: string
  evidence: string[]
}

export type DriftAlertModel = {
  areaLabel: string
  goalTitle: string
  weeksQuiet: number
  weeksToDeadlineRounded: number
  message: string
}

export type ChartWeekBucket = {
  mondayISO: string
  weekLabel: string
  totalWins: number
  rawCountsByArea: Record<DashboardChartArea, number>
  carriedByArea?: Record<DashboardChartArea, number>
}

export type DashboardSynthesis = {
  priority: PriorityCardModel
  driftAlerts: DriftAlertModel[]
  chartWeeks: ChartWeekBucket[]
  areaSeriesCarried: Record<DashboardChartArea, number[]>
  totalSeries: number[]
  /** Running sum within the selected date range — trajectory / momentum view. */
  areaSeriesCumulative: Record<DashboardChartArea, number[]>
  totalSeriesCumulative: number[]
}

const MONTH_ABBREVS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

const AREA_LABEL_EN: Record<LifeArea, string> = {
  finance: 'Finance',
  social: 'Family & friends',
  growth: 'Self-growth',
  health: 'Health',
  career: 'Career & build',
  unclassified: 'Mixed / untagged',
}

export function escapeHtmlMinimal(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function filterWinsByReveal(
  all: WinsByDate,
  revealAtMap: Record<string, string>,
  nowMs: number,
): WinsByDate {
  const visible: WinsByDate = {}
  for (const [isoDate, winsForDate] of Object.entries(all)) {
    const kept = winsForDate.filter((win) => {
      const revealAt = revealAtMap[win.id]
      if (!revealAt) return true
      return Date.parse(revealAt) <= nowMs
    })
    if (kept.length > 0) visible[isoDate] = kept
  }
  return visible
}

function getMondayOfWeek(isoDate: string): string {
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

function formatWeekLabel(mondayISO: string): string {
  const [y, m, d] = mondayISO.split('-').map(Number)
  const sunday = new Date(y, m - 1, d + 6)
  const startM = MONTH_ABBREVS[m - 1] ?? 'Mon'
  const endM = MONTH_ABBREVS[sunday.getMonth()] ?? 'Sun'
  return `${startM} ${d} – ${endM} ${sunday.getDate()}`
}

function addDaysISO(baseISO: string, deltaDays: number): string {
  const [y, m, d] = baseISO.split('-').map(Number)
  const next = new Date(y, m - 1, d + deltaDays)
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-')
}

function weeksBetweenInclusive(firstMondayISO: string, lastMondayISO: string): string[] {
  const weeks: string[] = []
  let cursor = firstMondayISO
  while (cursor.localeCompare(lastMondayISO) <= 0) {
    weeks.push(cursor)
    cursor = addDaysISO(cursor, 7)
  }
  return weeks
}

function utcTodayISO(): string {
  const today = new Date()
  return [
    today.getUTCFullYear(),
    String(today.getUTCMonth() + 1).padStart(2, '0'),
    String(today.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function utcMidnightMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function cutoffISOForPreset(preset: DashboardRangePreset, todayISO: string): string | null {
  if (preset === 'all') return null
  const days = preset === '30d' ? 30 : 90
  return addDaysISO(todayISO, -days)
}

function filterDatesOnOrAfter(winsByDate: WinsByDate, cutoffISO: string | null): WinsByDate {
  if (!cutoffISO) return winsByDate
  const out: WinsByDate = {}
  for (const [date, wins] of Object.entries(winsByDate)) {
    if (date >= cutoffISO) out[date] = wins
  }
  return out
}

function emptyAreaCounts(): Record<DashboardChartArea, number> {
  return Object.fromEntries(DASHBOARD_CHART_AREAS.map((area) => [area, 0])) as Record<
    DashboardChartArea,
    number
  >
}

export function buildGrowthChartWeekBuckets(
  winsByDate: WinsByDate,
  preset: DashboardRangePreset,
): ChartWeekBucket[] {
  const allDates = Object.keys(winsByDate).sort()
  if (allDates.length === 0) return []

  const todayISO = utcTodayISO()
  const cutoff = cutoffISOForPreset(preset, todayISO)
  const effectiveWinsByDate = filterDatesOnOrAfter(winsByDate, cutoff)

  const effectiveDates = Object.keys(effectiveWinsByDate).sort()
  if (effectiveDates.length === 0) return []

  const firstMonday = getMondayOfWeek(effectiveDates[0]!)
  const lastMonday = getMondayOfWeek(effectiveDates[effectiveDates.length - 1]!)

  const mondayKeys = weeksBetweenInclusive(firstMonday, lastMonday)
  const byMonday = new Map<string, ChartWeekBucket>()

  for (const monday of mondayKeys) {
    byMonday.set(monday, {
      mondayISO: monday,
      weekLabel: formatWeekLabel(monday),
      totalWins: 0,
      rawCountsByArea: emptyAreaCounts(),
    })
  }

  const seenWinIdsByWeek = new Map<string, Set<string>>()

  for (const [isoDate, winsForDate] of Object.entries(effectiveWinsByDate)) {
    const monday = getMondayOfWeek(isoDate)
    const bucket = byMonday.get(monday)
    if (!bucket) continue

    let seen = seenWinIdsByWeek.get(monday)
    if (!seen) {
      seen = new Set()
      seenWinIdsByWeek.set(monday, seen)
    }

    for (const win of winsForDate) {
      const areasForChart =
        win.areas?.filter((a): a is DashboardChartArea =>
          (DASHBOARD_CHART_AREAS as readonly string[]).includes(a),
        ) ?? []

      if (areasForChart.length === 0) continue

      if (!seen.has(win.id)) {
        seen.add(win.id)
        bucket.totalWins += 1
      }
      for (const area of areasForChart) {
        bucket.rawCountsByArea[area] += 1
      }
    }
  }

  return mondayKeys.map((key) => byMonday.get(key)!)
}

export function carryForwardAreaSeries(
  buckets: ChartWeekBucket[],
): Record<DashboardChartArea, number[]> {
  const series: Record<DashboardChartArea, number[]> = {
    finance: [],
    social: [],
    growth: [],
    health: [],
    career: [],
  }
  const last: Record<DashboardChartArea, number> = emptyAreaCounts()

  for (const bucket of buckets) {
    for (const area of DASHBOARD_CHART_AREAS) {
      const raw = bucket.rawCountsByArea[area]
      if (raw > 0) last[area] = raw
      series[area].push(last[area])
    }
    bucket.carriedByArea = { ...last }
  }

  return series
}

function totalSeriesFromBuckets(buckets: ChartWeekBucket[]): number[] {
  return buckets.map((bucket) => bucket.totalWins)
}

function prefixSum(values: number[]): number[] {
  let runningTotal = 0
  return values.map((increment) => {
    runningTotal += increment
    return runningTotal
  })
}

/** Cumulative tagged wins per area (raw weekly increments summed). Window resets when range presets trim weeks. */
export function cumulativeAreaSeriesFromBuckets(
  buckets: ChartWeekBucket[],
): Record<DashboardChartArea, number[]> {
  const increments: Record<DashboardChartArea, number[]> = {
    finance: [],
    social: [],
    growth: [],
    health: [],
    career: [],
  }
  for (const bucket of buckets) {
    for (const area of DASHBOARD_CHART_AREAS) {
      increments[area].push(bucket.rawCountsByArea[area])
    }
  }
  const out: Record<DashboardChartArea, number[]> = {
    finance: [],
    social: [],
    growth: [],
    health: [],
    career: [],
  }
  for (const area of DASHBOARD_CHART_AREAS) {
    out[area] = prefixSum(increments[area])
  }
  return out
}

export function cumulativeTotalSeriesFromBuckets(buckets: ChartWeekBucket[]): number[] {
  return prefixSum(totalSeriesFromBuckets(buckets))
}

function winsInGoalAreaPastCalendarWeek(winsByDate: WinsByDate, area: LifeArea): number {
  const todayISO = utcTodayISO()
  const monday = getMondayOfWeek(todayISO)
  let count = 0

  for (let offset = 0; offset < 7; offset++) {
    const date = addDaysISO(monday, offset)
    for (const win of winsByDate[date] ?? []) {
      if (win.areas?.includes(area)) count++
    }
  }
  return count
}

function lastWinDateInArea(winsByDate: WinsByDate, area: LifeArea): string | null {
  let newest: string | null = null
  for (const date of Object.keys(winsByDate).sort()) {
    const has = (winsByDate[date] ?? []).some((win) => win.areas?.includes(area))
    if (has) newest = date
  }
  return newest
}

function fullWeeksSinceLastWinInArea(winsByDate: WinsByDate, area: LifeArea): number {
  const last = lastWinDateInArea(winsByDate, area)
  if (!last) return 999

  const refISO = utcTodayISO()
  const diffDays = Math.floor((utcMidnightMs(refISO) - utcMidnightMs(last)) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 0
  return Math.floor(diffDays / 7)
}

export function computeDriftAlerts(goals: Goal[], winsByDate: WinsByDate): DriftAlertModel[] {
  const alerts: DriftAlertModel[] = []

  for (const goal of goals) {
    if (goal.status !== 'active') continue

    const weeksQuiet = fullWeeksSinceLastWinInArea(winsByDate, goal.area)
    if (weeksQuiet < 2) continue

    const target = new Date(goal.targetDate + 'T00:00:00Z')
    const now = Date.now()
    const weeksToDeadlineRounded = Math.max(
      0,
      Math.round((target.getTime() - now) / (1000 * 60 * 60 * 24 * 7)),
    )

    const areaLabel = AREA_LABEL_EN[goal.area]
    const message = `${areaLabel} has been quiet for ${weeksQuiet} weeks. Your goal "${goal.title}" is roughly ${weeksToDeadlineRounded} weeks away — one tiny tagged win here today would reverse the stall.`

    alerts.push({
      areaLabel,
      goalTitle: goal.title,
      weeksQuiet,
      weeksToDeadlineRounded,
      message,
    })
  }

  return alerts
}

function pickPriorityItem(grid: EisenhowerGrid): EisenhowerItem | null {
  if (grid.urgentImportant.length > 0) {
    return [...grid.urgentImportant].sort(
      (a, b) => a.weeksToDeadline - b.weeksToDeadline,
    )[0]!
  }
  if (grid.notUrgentImportant.length > 0) {
    return [...grid.notUrgentImportant].sort(
      (a, b) => a.weeklyAverageInArea - b.weeklyAverageInArea,
    )[0]!
  }
  return null
}

export function buildPriorityCard(
  goals: Goal[],
  winsByDate: WinsByDate,
  grid?: EisenhowerGrid,
): PriorityCardModel {
  const computed = grid ?? computeEisenhowerGrid(goals, winsByDate)
  const picked = pickPriorityItem(computed)

  if (picked) {
    const roundsWeeks = Math.max(0, Math.round(picked.weeksToDeadline))
    const areaName = AREA_LABEL_EN[picked.goal.area]
    const urgency =
      picked.quadrant === 'urgentImportant'
        ? `${areaName} is pacing at ${picked.weeklyAverageInArea.toFixed(1)} wins/week over the last 4 weeks while "${picked.goal.title}" is ~${roundsWeeks} week(s) out — that gap is what flags this as do-now.`
        : `${areaName} is at ${picked.weeklyAverageInArea.toFixed(1)} wins/week across the last 4 weeks; "${picked.goal.title}" still deserves a deliberate block this week.`

    const milestoneLine = picked.goal.weeklyMilestone
      ? `This week's milestone you wrote: ${picked.goal.weeklyMilestone}`
      : `No weekly milestone text yet — add one sentence in Goals so the next action stays concrete.`

    const headline =
      picked.quadrant === 'urgentImportant'
        ? `Protect one 45-minute block for "${picked.goal.title}" before the week rolls over.`
        : `Keep compounding "${picked.goal.title}" with one focused session before you context-switch again.`

    return {
      headline,
      evidence: [urgency, milestoneLine],
    }
  }

  const areaTotals: Record<LifeArea, number> = {
    finance: 0,
    social: 0,
    growth: 0,
    health: 0,
    career: 0,
    unclassified: 0,
  }

  for (const winsForDate of Object.values(winsByDate)) {
    for (const win of winsForDate) {
      const tags = win.areas?.length ? win.areas : (['unclassified'] as LifeArea[])
      for (const area of tags) {
        areaTotals[area] += 1
      }
    }
  }

  const ranked = (Object.entries(areaTotals) as [LifeArea, number][])
    .filter(([area]) => area !== 'unclassified')
    .sort((a, b) => b[1] - a[1])

  const defaultRanking: [LifeArea, number] = ['growth', 0]
  const [topArea, topCount]: [LifeArea, number] = ranked[0] ?? defaultRanking

  const headline =
    topCount === 0
      ? 'Add one active goal with a dated deadline — otherwise the GrowthOS dashboard only reflects history.'
      : `Without an active goal, lean into ${AREA_LABEL_EN[topArea]} — you've logged ${topCount} wins there in the surviving timeline.`

  const evidenceLines: string[] =
    topCount === 0
      ? [
          'Open Goals, anchor a single outcome you want by a calendar date, and tag tonight\'s journal wins so pacing math can attach to something.',
        ]
      : [
          `Highest tagged volume recently is ${AREA_LABEL_EN[topArea]} (${topCount} wins counted in your visible history).`,
          'When you\'re ready, convert that momentum into one dated goal so the Eisenhower layer can steer mornings.',
        ]

  return {
    headline,
    evidence: evidenceLines,
  }
}

/** Single paragraph for HTML + plaintext morning email inserts. */
export function formatDecisionEngineEmailParagraph(card: PriorityCardModel): {
  html: string
  text: string
} {
  const text = [card.headline, ...card.evidence].join(' ')
  const htmlParts = [
    `<p style="margin:28px 0 0;font-size:15px;line-height:1.55;color:#1a1a1a;"><strong>Growth compass.</strong> ${escapeHtmlMinimal(
      card.headline,
    )}</p>`,
  ]
  for (const line of card.evidence) {
    htmlParts.push(
      `<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#3a3936;">• ${escapeHtmlMinimal(
        line,
      )}</p>`,
    )
  }
  const html = htmlParts.join('')
  return { html, text: `Growth compass — ${text}` }
}

/** Deterministic suggestion for the next tangible block (no LLM). */
export function buildWhatToDoNow(
  goals: Goal[],
  winsByDate: WinsByDate,
): { action: string; citedReason: string } {
  const active = goals.filter((goal) => goal.status === 'active')
  const grid = computeEisenhowerGrid(goals, winsByDate)
  const picked = pickPriorityItem(grid)

  if (!picked || active.length === 0) {
    return {
      action: 'Add or re-activate one goal with a milestone sentence, then run this button again.',
      citedReason:
        active.length === 0
          ? 'No active goals on file — pacing and urgency comparisons need an anchor.'
          : 'Goals exist but Eisenhower did not emit a prioritized row with the current win history.',
    }
  }

  const winsThisWeek = winsInGoalAreaPastCalendarWeek(winsByDate, picked.goal.area)
  const block = picked.quadrant === 'urgentImportant' ? 45 : 25

  if (picked.goal.weeklyMilestone?.trim()) {
    return {
      action: `Set a timer for ${block} minutes and only do: ${picked.goal.weeklyMilestone.trim()}`,
      citedReason: `Pulled from your weekly milestone on "${picked.goal.title}" — ${AREA_LABEL_EN[picked.goal.area]} has ${winsThisWeek} tagged wins on the calendar week so far vs the 2/week pace we watch.`,
    }
  }

  return {
    action: `Give "${picked.goal.title}" ${block} distraction-free minutes — pick the smallest deliverable you can finish inside the timer.`,
    citedReason: `${AREA_LABEL_EN[picked.goal.area]} is averaging ${picked.weeklyAverageInArea.toFixed(
      1,
    )} wins/week over the trailing month window Eisenhower uses, and "${picked.goal.title}" sits in the ${
      picked.quadrant === 'urgentImportant' ? 'urgent + important' : 'important'
    } bucket.`,
  }
}

export function buildDashboardSynthesis(
  goals: Goal[],
  winsByDate: WinsByDate,
  chartPreset: DashboardRangePreset,
  existingGrid?: EisenhowerGrid,
): DashboardSynthesis {
  const grid = existingGrid ?? computeEisenhowerGrid(goals, winsByDate)
  const buckets = buildGrowthChartWeekBuckets(winsByDate, chartPreset)
  const areaSeriesCarried = carryForwardAreaSeries(buckets)
  const areaSeriesCumulative = cumulativeAreaSeriesFromBuckets(buckets)
  const totalSeries = totalSeriesFromBuckets(buckets)
  const totalSeriesCumulative = cumulativeTotalSeriesFromBuckets(buckets)

  return {
    priority: buildPriorityCard(goals, winsByDate, grid),
    driftAlerts: computeDriftAlerts(goals, winsByDate),
    chartWeeks: buckets,
    areaSeriesCarried,
    totalSeries,
    areaSeriesCumulative,
    totalSeriesCumulative,
  }
}
