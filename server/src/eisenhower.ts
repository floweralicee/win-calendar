import type { Goal } from './goals-store.ts'
import type { WinsByDate } from './timeline-parser.ts'
import type { LifeArea } from './claude.ts'

export type EisenhowerQuadrant =
  | 'urgentImportant'
  | 'notUrgentImportant'

export type EisenhowerItem = {
  goal: Goal
  quadrant: EisenhowerQuadrant
  weeksToDeadline: number
  /** Wins in this area over the past 4 weeks. */
  recentWinsInArea: number
  /** Average wins per week in this area over the same period. */
  weeklyAverageInArea: number
}

export type EisenhowerGrid = {
  /** Must happen this week — deadline within 6 weeks AND below win average. */
  urgentImportant: EisenhowerItem[]
  /** Strategic compounding — deadline > 6 weeks OR win pace is healthy. */
  notUrgentImportant: EisenhowerItem[]
}

function weeksUntilDeadline(targetDateISO: string): number {
  const target = new Date(targetDateISO + 'T00:00:00')
  const now = new Date()
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)
}

function winsInAreaOverPastWeeks(
  winsByDate: WinsByDate,
  area: LifeArea,
  weeks: number,
): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7)
  const cutoffISO = [
    cutoff.getFullYear(),
    String(cutoff.getMonth() + 1).padStart(2, '0'),
    String(cutoff.getDate()).padStart(2, '0'),
  ].join('-')

  let count = 0
  for (const [date, winsForDate] of Object.entries(winsByDate)) {
    if (date < cutoffISO) continue
    for (const win of winsForDate) {
      if (win.areas && win.areas.includes(area)) count++
    }
  }
  return count
}

/**
 * Places each active goal's weekly milestone into an Eisenhower quadrant.
 *
 * Urgency rule (both conditions must be true):
 *   1. Target date is within 6 weeks from today.
 *   2. Wins in that area over the past 4 weeks average < 2 per week.
 *
 * All active goals are by definition "important" — they are either
 * urgentImportant or notUrgentImportant. Paused/achieved goals are omitted.
 */
export function computeEisenhowerGrid(
  goals: Goal[],
  winsByDate: WinsByDate,
): EisenhowerGrid {
  const grid: EisenhowerGrid = {
    urgentImportant: [],
    notUrgentImportant: [],
  }

  const URGENCY_WEEKS_THRESHOLD = 6
  const URGENCY_WIN_RATE_THRESHOLD = 2 // wins per week
  const LOOKBACK_WEEKS = 4

  for (const goal of goals) {
    if (goal.status !== 'active') continue

    const weeksToDeadline = weeksUntilDeadline(goal.targetDate)
    const recentWins = winsInAreaOverPastWeeks(winsByDate, goal.area, LOOKBACK_WEEKS)
    const weeklyAverage = recentWins / LOOKBACK_WEEKS

    const deadlineIsClose = weeksToDeadline <= URGENCY_WEEKS_THRESHOLD
    const winPaceIsLow = weeklyAverage < URGENCY_WIN_RATE_THRESHOLD
    const isUrgent = deadlineIsClose && winPaceIsLow

    const item: EisenhowerItem = {
      goal,
      quadrant: isUrgent ? 'urgentImportant' : 'notUrgentImportant',
      weeksToDeadline,
      recentWinsInArea: recentWins,
      weeklyAverageInArea: weeklyAverage,
    }

    grid[item.quadrant].push(item)
  }

  return grid
}
