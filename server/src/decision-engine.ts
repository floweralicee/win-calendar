import type { Goal } from './goals-store.ts'
import { computeEisenhowerGrid, type EisenhowerGrid } from './eisenhower.ts'
import type { Win, WinsByDate } from './timeline-parser.ts'

export const DASHBOARD_AREAS = ['finance', 'social', 'growth', 'health', 'career'] as const
export type DashboardArea = typeof DASHBOARD_AREAS[number]

export type DashboardRange = '30d' | '90d' | 'all'

export type WeeklyGrowthPoint = {
  weekStartISO: string
  weekLabel: string
  countsByArea: Record<DashboardArea, number>
  total: number
}

export type GoalProgress = {
  goal: Goal
  weeksToDeadline: number
  recentWinsInArea: number
  weeklyAverageInArea: number
  thisWeekWinsInArea: number
  targetWinsPerWeek: number
  progressRatio: number
}

export type PriorityCard = {
  title: string
  body: string
  evidence: string[]
  goalId?: string
  area?: DashboardArea
}

export type DriftAlert = {
  goalId: string
  area: DashboardArea
  message: string
  quietWeeks: number
}

export type NowAction = {
  label: string
  reason: string
  goalId?: string
}

export type DashboardDecision = {
  priorityCard: PriorityCard
  driftAlerts: DriftAlert[]
  nowAction: NowAction
}

export type DashboardData = {
  chart: {
    defaultRange: DashboardRange
    ranges: Record<DashboardRange, WeeklyGrowthPoint[]>
  }
  activeGoalProgress: GoalProgress[]
  eisenhowerGrid: EisenhowerGrid
  decision: DashboardDecision
}

type FlatWin = {
  isoDate: string
  win: Win
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const TARGET_WINS_PER_WEEK = 2

const AREA_LABELS: Record<DashboardArea, string> = {
  finance: 'Finance',
  social: 'Family & Friends',
  growth: 'Self-Growth',
  health: 'Health',
  career: 'Career & Build',
}

function emptyAreaCounts(): Record<DashboardArea, number> {
  return {
    finance: 0,
    social: 0,
    growth: 0,
    health: 0,
    career: 0,
  }
}

function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function mondayForDate(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const mondayOffset = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - mondayOffset)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatWeekLabel(weekStartISO: string): string {
  const [, monthStr, dayStr] = weekStartISO.split('-')
  const monthIndex = Number(monthStr) - 1
  const day = Number(dayStr)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[monthIndex]} ${day}`
}

function flattenWins(winsByDate: WinsByDate): FlatWin[] {
  const flatWins: FlatWin[] = []
  for (const [isoDate, winsForDate] of Object.entries(winsByDate)) {
    for (const win of winsForDate) {
      flatWins.push({ isoDate, win })
    }
  }
  flatWins.sort((left, right) => {
    const byDate = left.isoDate.localeCompare(right.isoDate)
    return byDate !== 0 ? byDate : left.win.id.localeCompare(right.win.id)
  })
  return flatWins
}

function winAreas(win: Win): DashboardArea[] {
  const areas = win.areas?.filter((area): area is DashboardArea =>
    (DASHBOARD_AREAS as readonly string[]).includes(area),
  )
  return areas && areas.length > 0 ? areas : []
}

function countWinsInAreaSince(winsByDate: WinsByDate, area: DashboardArea, cutoffISO: string): number {
  let count = 0
  for (const [isoDate, winsForDate] of Object.entries(winsByDate)) {
    if (isoDate < cutoffISO) continue
    for (const win of winsForDate) {
      if (winAreas(win).includes(area)) count++
    }
  }
  return count
}

function countQuietWeeks(winsByDate: WinsByDate, area: DashboardArea, now: Date): number {
  const currentMonday = mondayForDate(now)
  let quietWeeks = 0
  for (let weekOffset = 0; weekOffset < 12; weekOffset++) {
    const weekStartISO = toIsoDate(addDays(currentMonday, -weekOffset * 7))
    const weekEndISO = toIsoDate(addDays(currentMonday, -weekOffset * 7 + 6))
    let weekCount = 0
    for (const [isoDate, winsForDate] of Object.entries(winsByDate)) {
      if (isoDate < weekStartISO || isoDate > weekEndISO) continue
      for (const win of winsForDate) {
        if (winAreas(win).includes(area)) weekCount++
      }
    }
    if (weekCount > 0) break
    quietWeeks++
  }
  return quietWeeks
}

function weeksUntilDeadline(targetDateISO: string, now: Date): number {
  const target = new Date(`${targetDateISO}T00:00:00`)
  return (target.getTime() - now.getTime()) / (7 * ONE_DAY_MS)
}

export function buildWeeklyGrowthPoints(
  winsByDate: WinsByDate,
  range: DashboardRange,
  now: Date = new Date(),
): WeeklyGrowthPoint[] {
  const flatWins = flattenWins(winsByDate)
  const currentMonday = mondayForDate(now)
  let firstMonday: Date

  if (range === '30d') {
    firstMonday = mondayForDate(addDays(now, -29))
  } else if (range === '90d') {
    firstMonday = mondayForDate(addDays(now, -89))
  } else {
    const firstDate = flatWins[0]?.isoDate
    firstMonday = firstDate ? mondayForDate(new Date(`${firstDate}T00:00:00`)) : currentMonday
  }

  const pointsByWeek = new Map<string, WeeklyGrowthPoint>()
  for (let weekStart = new Date(firstMonday); weekStart <= currentMonday; weekStart = addDays(weekStart, 7)) {
    const weekStartISO = toIsoDate(weekStart)
    pointsByWeek.set(weekStartISO, {
      weekStartISO,
      weekLabel: formatWeekLabel(weekStartISO),
      countsByArea: emptyAreaCounts(),
      total: 0,
    })
  }

  for (const { isoDate, win } of flatWins) {
    if (isoDate > toIsoDate(now)) continue
    const weekStartISO = toIsoDate(mondayForDate(new Date(`${isoDate}T00:00:00`)))
    const point = pointsByWeek.get(weekStartISO)
    if (!point) continue
    const areas = winAreas(win)
    for (const area of areas) {
      point.countsByArea[area]++
    }
    if (areas.length > 0) point.total++
  }

  return Array.from(pointsByWeek.values())
}

export function buildGoalProgress(goals: Goal[], winsByDate: WinsByDate, now: Date = new Date()): GoalProgress[] {
  const fourWeekCutoffISO = toIsoDate(addDays(now, -28))
  const currentWeekCutoffISO = toIsoDate(mondayForDate(now))

  return goals
    .filter((goal) => goal.status === 'active' && (DASHBOARD_AREAS as readonly string[]).includes(goal.area))
    .map((goal) => {
      const area = goal.area as DashboardArea
      const recentWinsInArea = countWinsInAreaSince(winsByDate, area, fourWeekCutoffISO)
      const weeklyAverageInArea = recentWinsInArea / 4
      const thisWeekWinsInArea = countWinsInAreaSince(winsByDate, area, currentWeekCutoffISO)
      return {
        goal,
        weeksToDeadline: weeksUntilDeadline(goal.targetDate, now),
        recentWinsInArea,
        weeklyAverageInArea,
        thisWeekWinsInArea,
        targetWinsPerWeek: TARGET_WINS_PER_WEEK,
        progressRatio: Math.min(1, thisWeekWinsInArea / TARGET_WINS_PER_WEEK),
      }
    })
    .sort((left, right) => {
      const byProgress = left.progressRatio - right.progressRatio
      return byProgress !== 0 ? byProgress : left.weeksToDeadline - right.weeksToDeadline
    })
}

export function buildDriftAlerts(goals: Goal[], winsByDate: WinsByDate, now: Date = new Date()): DriftAlert[] {
  const alerts: DriftAlert[] = []
  for (const goal of goals) {
    if (goal.status !== 'active') continue
    if (!(DASHBOARD_AREAS as readonly string[]).includes(goal.area)) continue
    const area = goal.area as DashboardArea
    const quietWeeks = countQuietWeeks(winsByDate, area, now)
    if (quietWeeks < 2) continue
    const weeks = Math.max(0, Math.ceil(weeksUntilDeadline(goal.targetDate, now)))
    alerts.push({
      goalId: goal.id,
      area,
      quietWeeks,
      message: `${AREA_LABELS[area]} has been quiet for ${quietWeeks} weeks. Your ${goal.title} goal is ${weeks} weeks away. One small win in this area today would count.`,
    })
  }
  return alerts
}

export function buildDecision(
  goals: Goal[],
  winsByDate: WinsByDate,
  now: Date = new Date(),
): DashboardDecision {
  const goalProgress = buildGoalProgress(goals, winsByDate, now)
  const driftAlerts = buildDriftAlerts(goals, winsByDate, now)
  const mostImportantGoal = goalProgress[0]

  if (!mostImportantGoal) {
    return {
      priorityCard: {
        title: 'Create one active goal.',
        body: 'The dashboard has win history, but it needs at least one active goal to turn that evidence into a clear next decision.',
        evidence: [
          'No active goals are saved yet.',
          'Wins are already classified by life area, so a goal can connect to existing momentum immediately.',
        ],
      },
      driftAlerts,
      nowAction: {
        label: 'Add one active goal with a deadline.',
        reason: 'The Decision Engine needs a target before it can prioritize the next action.',
      },
    }
  }

  const area = mostImportantGoal.goal.area as DashboardArea
  const deadlineWeeks = Math.max(0, Math.ceil(mostImportantGoal.weeksToDeadline))
  const milestone = mostImportantGoal.goal.weeklyMilestone?.trim()
  const actionLabel = milestone || `Make one visible win for ${mostImportantGoal.goal.title}.`

  return {
    priorityCard: {
      title: mostImportantGoal.goal.title,
      body: `${actionLabel} This is the clearest next move because ${AREA_LABELS[area]} is behind its weekly pace while the deadline is ${deadlineWeeks} weeks away.`,
      evidence: [
        `${mostImportantGoal.recentWinsInArea} ${AREA_LABELS[area]} wins in the past 4 weeks (${mostImportantGoal.weeklyAverageInArea.toFixed(1)}/week).`,
        `${mostImportantGoal.thisWeekWinsInArea} of ${TARGET_WINS_PER_WEEK} target wins logged this week.`,
        `${deadlineWeeks} weeks until ${mostImportantGoal.goal.targetDate}.`,
      ],
      goalId: mostImportantGoal.goal.id,
      area,
    },
    driftAlerts,
    nowAction: {
      label: actionLabel,
      reason: `It advances ${mostImportantGoal.goal.title} and closes the largest current goal gap.`,
      goalId: mostImportantGoal.goal.id,
    },
  }
}

export function buildDashboardData(
  goals: Goal[],
  winsByDate: WinsByDate,
  now: Date = new Date(),
): DashboardData {
  const eisenhowerGrid = computeEisenhowerGrid(goals, winsByDate)
  return {
    chart: {
      defaultRange: 'all',
      ranges: {
        '30d': buildWeeklyGrowthPoints(winsByDate, '30d', now),
        '90d': buildWeeklyGrowthPoints(winsByDate, '90d', now),
        all: buildWeeklyGrowthPoints(winsByDate, 'all', now),
      },
    },
    activeGoalProgress: buildGoalProgress(goals, winsByDate, now),
    eisenhowerGrid,
    decision: buildDecision(goals, winsByDate, now),
  }
}
