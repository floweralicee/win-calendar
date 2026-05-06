import type { Goal, GoalStatus } from './goals-store.ts'
import type { LifeArea, Win, WinsByDate } from './timeline-parser.ts'

export type MapNode =
  | { kind: 'area'; id: string; area: LifeArea; label: string }
  | { kind: 'goal'; id: string; area: LifeArea; title: string; status: GoalStatus; targetDate: string }
  | { kind: 'cluster'; id: string; area: LifeArea; week: string; count: number }

export type MapEdge = {
  source: string
  target: string
  kind: 'area-goal' | 'area-cluster' | 'goal-cluster'
}

export type MapData = {
  nodes: MapNode[]
  edges: MapEdge[]
}

const MAP_AREAS = ['finance', 'social', 'growth', 'health', 'career'] as const
type MapArea = typeof MAP_AREAS[number]

const AREA_LABELS: Record<MapArea, string> = {
  finance: 'Finance',
  social: 'Family & Friends',
  growth: 'Self-Growth',
  health: 'Health',
  career: 'Career & Build',
}

type ClusterAccumulator = {
  id: string
  area: MapArea
  week: string
  count: number
  winDates: string[]
}

function toIsoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function mondayForIsoDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return toIsoDate(date)
}

function winAreas(win: Win): MapArea[] {
  const areas = win.areas?.filter((area): area is MapArea =>
    (MAP_AREAS as readonly string[]).includes(area),
  )
  return areas && areas.length > 0 ? areas : []
}

export function buildMapData(goals: Goal[], winsByDate: WinsByDate): MapData {
  const nodes: MapNode[] = MAP_AREAS.map((area) => ({
    kind: 'area',
    id: `area-${area}`,
    area,
    label: AREA_LABELS[area],
  }))

  const edges: MapEdge[] = []
  const activeGoals = goals.filter((goal) => goal.status === 'active')
  for (const goal of activeGoals) {
    if (!(MAP_AREAS as readonly string[]).includes(goal.area)) continue
    nodes.push({
      kind: 'goal',
      id: `goal-${goal.id}`,
      area: goal.area,
      title: goal.title,
      status: goal.status,
      targetDate: goal.targetDate,
    })
    edges.push({
      source: `area-${goal.area}`,
      target: `goal-${goal.id}`,
      kind: 'area-goal',
    })
  }

  const clustersById = new Map<string, ClusterAccumulator>()
  for (const [isoDate, winsForDate] of Object.entries(winsByDate)) {
    const week = mondayForIsoDate(isoDate)
    for (const win of winsForDate) {
      for (const area of winAreas(win)) {
        const id = `cluster-${area}-${week}`
        const existing = clustersById.get(id)
        if (existing) {
          existing.count++
          existing.winDates.push(isoDate)
        } else {
          clustersById.set(id, {
            id,
            area,
            week,
            count: 1,
            winDates: [isoDate],
          })
        }
      }
    }
  }

  const clusters = Array.from(clustersById.values()).sort((left, right) =>
    left.week.localeCompare(right.week) || left.area.localeCompare(right.area),
  )
  for (const cluster of clusters) {
    nodes.push({
      kind: 'cluster',
      id: cluster.id,
      area: cluster.area,
      week: cluster.week,
      count: cluster.count,
    })
    edges.push({
      source: `area-${cluster.area}`,
      target: cluster.id,
      kind: 'area-cluster',
    })
  }

  for (const goal of activeGoals) {
    if (!(MAP_AREAS as readonly string[]).includes(goal.area)) continue
    const goalCreatedDate = goal.createdAt.slice(0, 10)
    for (const cluster of clusters) {
      if (cluster.area !== goal.area) continue
      if (!cluster.winDates.some((winDate) => winDate >= goalCreatedDate)) continue
      edges.push({
        source: `goal-${goal.id}`,
        target: cluster.id,
        kind: 'goal-cluster',
      })
    }
  }

  return { nodes, edges }
}
