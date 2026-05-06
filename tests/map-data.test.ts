import { describe, expect, it } from 'vitest'

import { buildMapData } from '../server/src/map-data.ts'
import type { Goal } from '../server/src/goals-store.ts'
import type { WinsByDate } from '../server/src/timeline-parser.ts'

const goals: Goal[] = [
  {
    id: 'career-goal',
    title: 'Ship GrowthOS',
    area: 'career',
    targetDate: '2026-06-01',
    weeklyMilestone: 'Ship one layer',
    status: 'active',
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'health-goal',
    title: 'Rebuild baseline',
    area: 'health',
    targetDate: '2026-05-01',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

const winsByDate: WinsByDate = {
  '2026-01-06': [
    {
      date: '2026-01-06',
      title: 'Old career win',
      body: '',
      id: 'old-career',
      spansRange: false,
      areas: ['career'],
    },
  ],
  '2026-01-14': [
    {
      date: '2026-01-14',
      title: 'Career and growth win',
      body: '',
      id: 'career-growth',
      spansRange: false,
      areas: ['career', 'growth'],
    },
  ],
  '2026-01-15': [
    {
      date: '2026-01-15',
      title: 'Health win',
      body: '',
      id: 'health',
      spansRange: false,
      areas: ['health'],
    },
  ],
}

describe('map data', () => {
  it('creates area, goal, and weekly cluster nodes', () => {
    const mapData = buildMapData(goals, winsByDate)

    expect(mapData.nodes.filter((node) => node.kind === 'area')).toHaveLength(5)
    expect(mapData.nodes).toContainEqual({
      kind: 'goal',
      id: 'goal-career-goal',
      area: 'career',
      title: 'Ship GrowthOS',
      status: 'active',
      targetDate: '2026-06-01',
    })
    expect(mapData.nodes).toContainEqual({
      kind: 'cluster',
      id: 'cluster-career-2026-01-12',
      area: 'career',
      week: '2026-01-12',
      count: 1,
    })
  })

  it('connects goals only to clusters after the goal was created', () => {
    const mapData = buildMapData(goals, winsByDate)
    const goalClusterEdges = mapData.edges.filter(
      (edge) => edge.kind === 'goal-cluster' && edge.source === 'goal-career-goal',
    )

    expect(goalClusterEdges).toContainEqual({
      source: 'goal-career-goal',
      target: 'cluster-career-2026-01-12',
      kind: 'goal-cluster',
    })
    expect(goalClusterEdges).not.toContainEqual({
      source: 'goal-career-goal',
      target: 'cluster-career-2026-01-05',
      kind: 'goal-cluster',
    })
  })
})
