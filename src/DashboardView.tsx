import { useEffect, useMemo, useState } from 'react'
import {
  fetchDashboard,
  fetchNowAction,
  type DashboardArea,
  type DashboardPayload,
  type DashboardRange,
  type WeeklyGrowthPoint,
} from './api'

const DASHBOARD_AREAS: DashboardArea[] = ['finance', 'social', 'growth', 'health', 'career']

const AREA_LABELS: Record<DashboardArea, string> = {
  finance: 'Finance',
  social: 'Family',
  growth: 'Growth',
  health: 'Health',
  career: 'Career',
}

const RANGE_LABELS: Record<DashboardRange, string> = {
  '30d': '30D',
  '90d': '90D',
  all: 'ALL',
}

type ChartSeriesPoint = {
  x: number
  y: number
  weekLabel: string
  value: number
}

type ChartSeries = {
  key: DashboardArea | 'total'
  label: string
  points: ChartSeriesPoint[]
}

type TooltipState = {
  point: WeeklyGrowthPoint
  clientX: number
  clientY: number
} | null

function heldValue(previousValue: number, currentValue: number): number {
  return currentValue === 0 ? previousValue : currentValue
}

function buildChartSeries(points: WeeklyGrowthPoint[], width: number, height: number): ChartSeries[] {
  const displayValuesByKey: Record<DashboardArea | 'total', number[]> = {
    finance: [],
    social: [],
    growth: [],
    health: [],
    career: [],
    total: [],
  }

  for (const point of points) {
    for (const area of DASHBOARD_AREAS) {
      const previousValue = displayValuesByKey[area][displayValuesByKey[area].length - 1] ?? 0
      displayValuesByKey[area].push(heldValue(previousValue, point.countsByArea[area]))
    }
    const previousTotal = displayValuesByKey.total[displayValuesByKey.total.length - 1] ?? 0
    displayValuesByKey.total.push(heldValue(previousTotal, point.total))
  }

  const maxValue = Math.max(1, ...Object.values(displayValuesByKey).flat())
  const horizontalStep = points.length <= 1 ? 0 : width / (points.length - 1)

  const makeSeries = (key: DashboardArea | 'total', label: string): ChartSeries => ({
    key,
    label,
    points: displayValuesByKey[key].map((value, index) => ({
      x: points.length <= 1 ? width / 2 : index * horizontalStep,
      y: height - (value / maxValue) * height,
      weekLabel: points[index].weekLabel,
      value,
    })),
  })

  return [
    ...DASHBOARD_AREAS.map((area) => makeSeries(area, AREA_LABELS[area])),
    makeSeries('total', 'Total'),
  ]
}

function seriesPath(points: ChartSeriesPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  const commands = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`]
  for (let index = 1; index < points.length; index++) {
    const previousPoint = points[index - 1]
    const point = points[index]
    const controlX = (previousPoint.x + point.x) / 2
    commands.push(
      `C ${controlX.toFixed(2)} ${previousPoint.y.toFixed(2)} ${controlX.toFixed(2)} ${point.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
  }
  return commands.join(' ')
}

function formatDeadline(weeksToDeadline: number): string {
  const rounded = Math.ceil(weeksToDeadline)
  if (rounded <= 0) return 'overdue'
  if (rounded === 1) return '1 week'
  return `${rounded} weeks`
}

export function DashboardView() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeRange, setActiveRange] = useState<DashboardRange>('all')
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const [nowActionMessage, setNowActionMessage] = useState<string | null>(null)
  const [isLoadingNowAction, setIsLoadingNowAction] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDashboard()
      .then((nextDashboard) => {
        if (cancelled) return
        setDashboard(nextDashboard)
        setActiveRange(nextDashboard.chart.defaultRange)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'Dashboard failed to load.')
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activePoints = dashboard?.chart.ranges[activeRange] ?? []
  const chartSeries = useMemo(() => buildChartSeries(activePoints, 100, 44), [activePoints])
  const hoverGuideX = tooltip
    ? activePoints.findIndex((point) => point.weekStartISO === tooltip.point.weekStartISO)
    : -1

  async function handleNowActionClick() {
    setIsLoadingNowAction(true)
    setNowActionMessage(null)
    try {
      const action = await fetchNowAction()
      setNowActionMessage(`${action.label} ${action.reason}`)
    } catch (error: unknown) {
      setNowActionMessage(error instanceof Error ? error.message : 'Could not generate a next action.')
    } finally {
      setIsLoadingNowAction(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="dashboard-empty">
        <p>Reading your wins, goals, and weekly pace.</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="dashboard-empty">
        <p>{errorMessage}</p>
      </div>
    )
  }

  if (!dashboard) return null

  const priorityCard = dashboard.decision.priorityCard
  const urgentItems = dashboard.eisenhowerGrid.urgentImportant
  const importantItems = dashboard.eisenhowerGrid.notUrgentImportant

  return (
    <div className="dashboard-container" onMouseLeave={() => setTooltip(null)}>
      <section className="dashboard-priority" aria-label="Today's priority">
        <div>
          <p className="dashboard-kicker">Today</p>
          <h2>{priorityCard.title}</h2>
          <p>{priorityCard.body}</p>
        </div>
        <ul className="dashboard-evidence">
          {priorityCard.evidence.map((evidence) => (
            <li key={evidence}>{evidence}</li>
          ))}
        </ul>
      </section>

      <section className="dashboard-chart-panel" aria-label="Growth portfolio chart">
        <div className="dashboard-section-header">
          <div>
            <p className="dashboard-kicker">Growth Portfolio</p>
            <h2>Weekly proof by life area</h2>
          </div>
          <div className="dashboard-range-toggle" role="group" aria-label="Chart range">
            {(Object.keys(RANGE_LABELS) as DashboardRange[]).map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={activeRange === range}
                onClick={() => setActiveRange(range)}
              >
                {RANGE_LABELS[range]}
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-chart-wrap">
          <svg className="dashboard-chart" viewBox="0 0 100 54" role="img" aria-label="Weekly growth portfolio chart">
            <line className="dashboard-grid-line" x1="0" y1="44" x2="100" y2="44" />
            <line className="dashboard-grid-line" x1="0" y1="22" x2="100" y2="22" />
            <line className="dashboard-grid-line" x1="0" y1="0" x2="100" y2="0" />
            {hoverGuideX >= 0 && activePoints.length > 1 && (
              <line
                className="dashboard-hover-guide"
                x1={(hoverGuideX / (activePoints.length - 1)) * 100}
                y1="0"
                x2={(hoverGuideX / (activePoints.length - 1)) * 100}
                y2="44"
              />
            )}
            {chartSeries.map((series) => (
              <path
                key={series.key}
                className="dashboard-line"
                data-area={series.key}
                d={seriesPath(series.points)}
                fill="none"
              />
            ))}
            {activePoints.map((point, index) => {
              const x = activePoints.length <= 1 ? 50 : (index / (activePoints.length - 1)) * 100
              return (
                <rect
                  key={point.weekStartISO}
                  className="dashboard-hit-column"
                  x={Math.max(0, x - 2)}
                  y="0"
                  width="4"
                  height="44"
                  onMouseEnter={(event) =>
                    setTooltip({ point, clientX: event.clientX, clientY: event.clientY })
                  }
                  onMouseMove={(event) =>
                    setTooltip({ point, clientX: event.clientX, clientY: event.clientY })
                  }
                />
              )
            })}
          </svg>
        </div>

        <ul className="dashboard-legend">
          {chartSeries.map((series) => (
            <li key={series.key}>
              <span className="dashboard-legend-dot" data-area={series.key} aria-hidden />
              {series.label}
            </li>
          ))}
        </ul>
      </section>

      <div className="dashboard-lower-grid">
        <section className="dashboard-card" aria-label="Active goals">
          <div className="dashboard-section-header">
            <div>
              <p className="dashboard-kicker">Goals</p>
              <h2>Active progress</h2>
            </div>
          </div>
          {dashboard.activeGoalProgress.length === 0 ? (
            <p className="dashboard-muted">Add active goals to see progress against weekly milestones.</p>
          ) : (
            <ul className="dashboard-goal-list">
              {dashboard.activeGoalProgress.slice(0, 5).map((item) => (
                <li key={item.goal.id} className="dashboard-goal-item">
                  <div className="dashboard-goal-row">
                    <span className="dashboard-area-dot" data-area={item.goal.area} aria-hidden />
                    <span>{item.goal.title}</span>
                    <span>{formatDeadline(item.weeksToDeadline)}</span>
                  </div>
                  <div className="dashboard-progress-track" aria-hidden>
                    <span style={{ width: `${item.progressRatio * 100}%` }} />
                  </div>
                  <p>
                    {item.thisWeekWinsInArea}/{item.targetWinsPerWeek} wins this week
                    {item.goal.weeklyMilestone ? ` - ${item.goal.weeklyMilestone}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-card" aria-label="Eisenhower grid">
          <div className="dashboard-section-header">
            <div>
              <p className="dashboard-kicker">Eisenhower</p>
              <h2>This week's priorities</h2>
            </div>
          </div>
          <div className="dashboard-eisenhower">
            <div>
              <h3>Urgent + Important</h3>
              {urgentItems.length === 0 ? (
                <p className="dashboard-muted">No urgent goal gaps right now.</p>
              ) : (
                urgentItems.map((item) => <p key={item.goal.id}>{item.goal.title}</p>)
              )}
            </div>
            <div>
              <h3>Important</h3>
              {importantItems.length === 0 ? (
                <p className="dashboard-muted">No active goals yet.</p>
              ) : (
                importantItems.map((item) => <p key={item.goal.id}>{item.goal.title}</p>)
              )}
            </div>
          </div>
        </section>
      </div>

      {dashboard.decision.driftAlerts.length > 0 && (
        <section className="dashboard-alerts" aria-label="Drift alerts">
          {dashboard.decision.driftAlerts.map((alert) => (
            <p key={alert.goalId}>{alert.message}</p>
          ))}
        </section>
      )}

      <section className="dashboard-now" aria-label="What to do now">
        <button type="button" onClick={handleNowActionClick} disabled={isLoadingNowAction}>
          {isLoadingNowAction ? 'Thinking...' : 'What to do now'}
        </button>
        <p>{nowActionMessage ?? dashboard.decision.nowAction.reason}</p>
      </section>

      {tooltip && (
        <div
          className="dashboard-tooltip"
          style={{ left: tooltip.clientX + 12, top: tooltip.clientY + 12 }}
        >
          <strong>{tooltip.point.weekLabel}</strong>
          {DASHBOARD_AREAS.map((area) => (
            <span key={area}>
              {AREA_LABELS[area]}: {tooltip.point.countsByArea[area]}
            </span>
          ))}
          <span>Total: {tooltip.point.total}</span>
        </div>
      )}
    </div>
  )
}
