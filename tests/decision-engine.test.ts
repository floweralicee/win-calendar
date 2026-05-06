import { describe, expect, it } from 'vitest'

import {
  buildDecision,
  buildGoalProgress,
  buildWeeklyGrowthPoints,
} from '../server/src/decision-engine.ts'
import type { Goal } from '../server/src/goals-store.ts'
import type { WinsByDate } from '../server/src/timeline-parser.ts'

const NOW = new Date('2026-01-21T12:00:00')

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-career',
    title: 'Ship Dashboard',
    area: 'career',
    targetDate: '2026-02-15',
    weeklyMilestone: 'Finish one tested dashboard slice.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const winsByDate: WinsByDate = {
  '2026-01-06': [
    {
      date: '2026-01-06',
      title: 'Mapped dashboard data',
      body: '',
      id: '2026-01-06-mapped-dashboard-data',
      spansRange: false,
      areas: ['career'],
    },
  ],
  '2026-01-20': [
    {
      date: '2026-01-20',
      title: 'Drafted chart UI',
      body: '',
      id: '2026-01-20-drafted-chart-ui',
      spansRange: false,
      areas: ['career', 'growth'],
    },
  ],
}

describe('decision engine', () => {
  it('builds weekly growth points with empty weeks preserved', () => {
    const points = buildWeeklyGrowthPoints(winsByDate, 'all', NOW)

    expect(points.map((point) => point.weekStartISO)).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
    ])
    expect(points.map((point) => point.countsByArea.career)).toEqual([1, 0, 1])
    expect(points.map((point) => point.total)).toEqual([1, 0, 1])
  })

  it('prioritizes the active goal with the largest current weekly gap', () => {
    const decision = buildDecision([goal()], winsByDate, NOW)

    expect(decision.priorityCard.goalId).toBe('goal-career')
    expect(decision.priorityCard.area).toBe('career')
    expect(decision.priorityCard.evidence).toContain('1 of 2 target wins logged this week.')
    expect(decision.nowAction.label).toBe('Finish one tested dashboard slice.')
  })

  it('computes active goal progress from the current week', () => {
    const [progress] = buildGoalProgress([goal()], winsByDate, NOW)

    expect(progress.thisWeekWinsInArea).toBe(1)
    expect(progress.targetWinsPerWeek).toBe(2)
    expect(progress.progressRatio).toBe(0.5)
  })
})
