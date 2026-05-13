import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  DashboardPayload,
  DashboardChartArea,
  DashboardGoalProgressPayload,
  EisenhowerGoalRow,
  DashboardChartSeriesMode,
} from './api'
import { fetchDashboard, fetchDashboardNow } from './api'

const CHART_AREAS: DashboardChartArea[] = ['finance', 'social', 'growth', 'health', 'career']

const AREA_LABEL: Record<DashboardChartArea, string> = {
  finance: 'Finance',
  social: 'Social',
  growth: 'Growth',
  health: 'Health',
  career: 'Career',
}

const CHART_DIMENSIONS = {
  width: 920,
  height: 300,
  padding: { top: 28, right: 40, bottom: 72, left: 52 },
}

type TooltipState = {
  weekIndex: number
  pointerX: number
  pointerY: number
} | null

/**
 * Builds an SVG path using rounded corner joins so the series reads smoothly without a chart library.
 */
function roundedLinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return ''
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`
  let d = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 1; i < coords.length; i++) {
    const p = coords[i]!
    d += ` L ${p.x} ${p.y}`
  }
  return d
}

function buildSeriesCoords(xs: number[], ys: number[]): Array<{ x: number; y: number }> {
  return xs.map((x, i) => ({ x, y: ys[i] ?? 0 }))
}

type GrowthPortfolioChartProps = {
  chartSeriesMode: DashboardChartSeriesMode
  weeks: DashboardPayload['chart']['weeks']
  areaSeriesPerWeek: Record<DashboardChartArea, number[]>
  totalSeriesPerWeek: number[]
  areaSeriesCumulative: Record<DashboardChartArea, number[]>
  totalSeriesCumulative: number[]
}

function GrowthPortfolioChart({
  chartSeriesMode,
  weeks,
  areaSeriesPerWeek,
  totalSeriesPerWeek,
  areaSeriesCumulative,
  totalSeriesCumulative,
}: GrowthPortfolioChartProps) {
  const { width: chartWidth, height: chartHeight, padding } = CHART_DIMENSIONS

  const { innerWidth, innerHeight } = useMemo(() => {
    const innerWidth = chartWidth - padding.left - padding.right
    const innerHeight = chartHeight - padding.top - padding.bottom
    return { innerWidth, innerHeight }
  }, [chartWidth, chartHeight, padding])

  const [tooltip, setTooltip] = useState<TooltipState>(null)

  const pointCount = weeks.length

  const areaSeries = chartSeriesMode === 'perWeek' ? areaSeriesPerWeek : areaSeriesCumulative
  const totalSeries = chartSeriesMode === 'perWeek' ? totalSeriesPerWeek : totalSeriesCumulative

  const maxYAxis = useMemo(() => {
    let maxVal = 1
    if (totalSeries.length > 0) {
      maxVal = Math.max(maxVal, ...totalSeries)
    }
    for (const area of CHART_AREAS) {
      const serie = areaSeries[area] ?? []
      if (serie.length > 0) maxVal = Math.max(maxVal, ...serie)
    }
    return maxVal
  }, [areaSeries, totalSeries])

  const scaleX = useCallback(
    (index: number) => {
      if (pointCount <= 1) return padding.left + innerWidth / 2
      return padding.left + (innerWidth * index) / (pointCount - 1)
    },
    [innerWidth, padding.left, pointCount],
  )

  const scaleY = useCallback(
    (value: number) => {
      const ratio = Math.min(1, Math.max(0, value / maxYAxis))
      return padding.top + innerHeight - ratio * innerHeight
    },
    [innerHeight, padding.top, maxYAxis],
  )

  const axisTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(maxYAxis / 4))
    const ticks: number[] = []
    for (let loop = 0; loop <= maxYAxis + step; loop += step) {
      ticks.push(loop)
      if (ticks.length > 8) break
    }
    if (ticks[ticks.length - 1]! < maxYAxis) {
      ticks.push(Math.ceil(maxYAxis))
    }
    return [...new Set(ticks)].slice(0, 8)
  }, [maxYAxis])

  const hoverColumns = useMemo(() => {
    if (pointCount === 0) return []
    return weeks.map((_weekRow, idx) => {
      const cx = scaleX(idx)
      const prevX = idx > 0 ? scaleX(idx - 1) : cx - innerWidth / (pointCount * 2)
      const nextX = idx < pointCount - 1 ? scaleX(idx + 1) : cx + innerWidth / (pointCount * 2)
      const left = idx === 0 ? padding.left : (cx + prevX) / 2
      const right = idx === pointCount - 1 ? chartWidth - padding.right : (cx + nextX) / 2
      return {
        idx,
        hitLeft: Math.max(left, padding.left),
        hitWidth: Math.max(4, Math.min(chartWidth - padding.right, right) - Math.max(left, padding.left)),
      }
    })
  }, [weeks, pointCount, scaleX, innerWidth, chartWidth, padding.left, padding.right])

  useEffect(() => {
    setTooltip(null)
  }, [weeks, chartSeriesMode])

  if (pointCount === 0) {
    return (
      <div className="dashboard-chart-placeholder">
        <p>Log a few dated wins — the Growth portfolio chart renders once timeline data arrives.</p>
      </div>
    )
  }

  const xs = weeks.map((_, index) => scaleX(index))

  return (
    <div
      className="dashboard-chart-shell"
      onPointerLeave={() => {
        setTooltip(null)
      }}
    >
      <p className="dashboard-chart-y-axis-hint">
        {chartSeriesMode === 'cumulative'
          ? 'Y-axis · cumulative wins from the first visible week onward (within the selected range).'
          : 'Y-axis · wins logged that calendar week — areas plateau at last week’s count when idle.'}
      </p>
      <svg
        className="dashboard-chart-svg"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={
          chartSeriesMode === 'cumulative'
            ? 'Growth portfolio: cumulative wins tagged by life area within the chart range.'
            : 'Growth portfolio: weekly wins by life area. Zero weeks hold the prior week’s level.'
        }
      >
        {axisTicks.map((tickValue) => {
          const y = scaleY(tickValue)
          return (
            <g key={`grid-${tickValue}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                className="dashboard-chart-gridline"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="dashboard-chart-axis-label"
              >
                {tickValue}
              </text>
            </g>
          )
        })}

        {weeks.map((weekRow, index) => {
          const baseline = chartHeight - padding.bottom + 20
          const showLabel = pointCount <= 24 || index % Math.ceil(pointCount / 12) === 0 || index === pointCount - 1
          if (!showLabel) return null
          const lx = xs[index] ?? padding.left
          return (
            <text
              key={weekRow.mondayISO}
              x={lx}
              y={baseline}
              textAnchor="middle"
              className="dashboard-chart-week-label"
            >
              {weekRow.weekLabel}
            </text>
          )
        })}

        {CHART_AREAS.map((area) => {
          const series = areaSeries[area]
          if (!series || series.length === 0) return null
          const coords = roundedLinePath(
            buildSeriesCoords(
              xs,
              series.slice(0, pointCount).map((count) => scaleY(count)),
            ),
          )
          return (
            <path
              key={area}
              d={coords}
              fill="none"
              stroke={`var(--ring-${area})`}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`dashboard-chart-line dashboard-chart-area-line dashboard-chart-area-${area}`}
            />
          )
        })}

        {totalSeries.length > 0 && (
          <path
            d={roundedLinePath(
              buildSeriesCoords(
                xs,
                totalSeries.slice(0, pointCount).map((count) => scaleY(count)),
              ),
            )}
            fill="none"
            stroke="var(--day-ink)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dashboard-chart-line dashboard-chart-total-line"
          />
        )}

        {/* Hit targets */}
        <g aria-hidden="true">
          {hoverColumns.map((columnData) => {
            return (
              <rect
                key={`hit-${weeks[columnData.idx]!.mondayISO}`}
                x={columnData.hitLeft}
                y={padding.top}
                width={columnData.hitWidth}
                height={innerHeight}
                opacity={0}
                pointerEvents="all"
                onPointerEnter={(event) => {
                  event.stopPropagation()
                  setTooltip({
                    weekIndex: columnData.idx,
                    pointerX: event.clientX,
                    pointerY: event.clientY,
                  })
                }}
                onPointerMove={(event) =>
                  setTooltip({
                    weekIndex: columnData.idx,
                    pointerX: event.clientX,
                    pointerY: event.clientY,
                  })
                }
              >
                {' '}
              </rect>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="dashboard-chart-legend" aria-hidden="true">
        {CHART_AREAS.map((area) => (
          <span key={area} className="dashboard-chart-legend-item">
            <span className="dashboard-chart-legend-swatch" data-area={area} />
            {AREA_LABEL[area]}
          </span>
        ))}
        <span key="legend-total" className="dashboard-chart-legend-item dashboard-chart-legend-total">
          <span className="dashboard-chart-legend-swatch dashboard-chart-legend-swatch-total" />
          Total {chartSeriesMode === 'cumulative' ? '(cumulative)' : '(weekly plateau)'}
        </span>
      </div>

      {tooltip !== null && weeks[tooltip.weekIndex] ? (
        <DashboardTooltipFloater
          chartSeriesMode={chartSeriesMode}
          tooltip={tooltip}
          week={weeks[tooltip.weekIndex]!}
          plottedAreas={areaSeries}
          plottedTotal={totalSeries}
        />
      ) : null}
    </div>
  )
}

function DashboardTooltipFloater({
  chartSeriesMode,
  tooltip,
  week,
  plottedAreas,
  plottedTotal,
}: {
  chartSeriesMode: DashboardChartSeriesMode
  tooltip: TooltipState
  week: DashboardPayload['chart']['weeks'][number]
  plottedAreas: Record<DashboardChartArea, number[]>
  plottedTotal: number[]
}) {
  if (!tooltip) return null

  const weekIndex = tooltip.weekIndex

  return (
    <div
      className="dashboard-chart-tooltip"
      role="tooltip"
      style={{
        position: 'fixed',
        left: tooltip.pointerX,
        top: tooltip.pointerY + 22,
      }}
    >
      <div className="dashboard-chart-tooltip-title">{week.weekLabel}</div>
      <ul className="dashboard-chart-tooltip-list">
        {CHART_AREAS.map((area) => {
          const yPlotted = plottedAreas[area]?.[weekIndex] ?? 0
          const loggedThisWeek = week.rawCountsByArea?.[area] ?? 0
          const deltaPhrase =
            chartSeriesMode === 'cumulative'
              ? loggedThisWeek > 0
                ? `+${loggedThisWeek} this week`
                : '+0 this week'
              : `logged ${loggedThisWeek} this week`
          return (
            <li key={area}>
              <span className="dashboard-chart-tooltip-dot" data-area={area} />
              <span className="dashboard-chart-tooltip-label-stack">
                <span>{AREA_LABEL[area]}</span>
                <span className="dashboard-chart-tooltip-delta">{deltaPhrase}</span>
              </span>
              <strong>{yPlotted}</strong>
            </li>
          )
        })}
        <li>
          <span className="dashboard-chart-tooltip-label-stack">
            <span>Total</span>
            <span className="dashboard-chart-tooltip-delta">
              {chartSeriesMode === 'cumulative'
                ? week.totalWins > 0
                  ? `+${week.totalWins} wins this week`
                  : '+0 wins this week'
                : `${week.totalWins} wins logged this week`}
            </span>
          </span>
          <strong>{plottedTotal[weekIndex] ?? 0}</strong>
        </li>
      </ul>
    </div>
  )
}

function GoalMomentumRow(props: DashboardGoalProgressPayload) {
  return (
    <div className="dashboard-goal-progress">
      <div className="dashboard-goal-progress-top">
        <span className="goal-card-area-dot" data-area={props.area} aria-hidden="true" />
        <div>
          <p className="dashboard-goal-progress-title">{props.title}</p>
          <p className="dashboard-goal-progress-meta">
            {props.winsThisCalendarWeek}/{props.targetWinsPerWeek} tagged wins · deadline {props.targetDate}
          </p>
        </div>
      </div>
      <div className="dashboard-progress-meter" aria-hidden="true">
        <div className="dashboard-progress-meter-fill" style={{ width: `${props.pace01 * 100}%` }} />
      </div>
      {props.weeklyMilestone && (
        <p className="dashboard-goal-progress-milestone">This week focus: {props.weeklyMilestone}</p>
      )}
    </div>
  )
}

function EisenhowerBoard(props: DashboardPayload['eisenhower']) {
  const renderQuad = (
    accent: string,
    label: string,
    items: EisenhowerGoalRow[],
    headingClass: string,
  ) => (
    <div className={`dashboard-e-quadrant ${headingClass}`}>
      <header>
        <p className={`dashboard-e-quadrant-label ${accent}`}>{label}</p>
      </header>
      {items.length === 0 ? (
        <p className="dashboard-e-empty">Nothing in this quadrant with your current pacing.</p>
      ) : (
        <ul className="dashboard-e-list">
          {items.map((row) => {
            const roundsWeek = Math.round(row.weeksToDeadline)
            return (
              <li key={row.goal.id} className="dashboard-e-row">
                <div>
                  <strong>{row.goal.title}</strong>
                  {row.goal.weeklyMilestone ? (
                    <p className="dashboard-e-milestone">This week: {row.goal.weeklyMilestone}</p>
                  ) : null}
                </div>
                <div className="dashboard-e-row-meta">
                  <span>{roundsWeek <= 0 ? 'overdue' : `${roundsWeek} wk`}</span>
                  <small>
                    {row.recentWinsInArea} wins / last 28d (~{row.weeklyAverageInArea.toFixed(1)}/wk)
                  </small>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  const bothEmpty =
    props.urgentImportant.length === 0 && props.notUrgentImportant.length === 0

  if (bothEmpty) {
    return (
      <section className="dashboard-e-shell">
        <h2>Eisenhower layer</h2>
        <p className="dashboard-e-empty-banner">
          Add at least one active goal so deadlines and win pacing can populate this grid.
        </p>
      </section>
    )
  }

  return (
    <section className="dashboard-e-shell">
      <h2>Eisenhower layer</h2>
      <div className="dashboard-e-grid">
        {renderQuad(
          'accent-urgent',
          'Urgent + important · do now',
          props.urgentImportant,
          'dashboard-e-q-urgent',
        )}
        {renderQuad(
          'accent-steady',
          'Important · keep building',
          props.notUrgentImportant,
          'dashboard-e-q-steady',
        )}
      </div>
    </section>
  )
}

export function DashboardView() {
  const [preset, setPreset] = useState<DashboardPayload['range']>('all')
  const [chartSeriesMode, setChartSeriesMode] = useState<DashboardChartSeriesMode>('perWeek')
  const [payload, setPayload] = useState<DashboardPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nowHint, setNowHint] = useState<{ action: string; citedReason: string } | null>(null)
  const [nowLoading, setNowLoading] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const data = await fetchDashboard(preset)
      setPayload(data)
    } catch (error: unknown) {
      setPayload(null)
      setLoadError(error instanceof Error ? error.message : 'Dashboard failed to load.')
    }
  }, [preset])

  useEffect(() => {
    void load()
  }, [load])

  const handleNow = async () => {
    setNowLoading(true)
    setNowHint(null)
    try {
      const result = await fetchDashboardNow()
      setNowHint({ action: result.action, citedReason: result.citedReason })
    } catch (error: unknown) {
      setNowHint({
        action: 'Could not reach the decision engine.',
        citedReason: error instanceof Error ? error.message : 'Unknown error.',
      })
    } finally {
      setNowLoading(false)
    }
  }

  return (
    <div className="dashboard-view">
      <div className="dashboard-toolbar">
        <div className="dashboard-range-toggle" role="group" aria-label="Chart range">
          {(['30d', '90d', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="dashboard-range-button"
              aria-pressed={preset === value}
              onClick={() => setPreset(value)}
            >
              {value === 'all' ? 'All time' : value}
            </button>
          ))}
        </div>
        <button type="button" className="dashboard-refresh" onClick={() => void load()}>
          Refresh data
        </button>
      </div>

      {loadError && <p className="dashboard-error">{loadError}</p>}

      {payload && (
        <>
          <section className="dashboard-priority">
            <h2>Today’s suggestion</h2>
            <p className="dashboard-priority-headline">{payload.priority.headline}</p>
            <ul className="dashboard-priority-evidence">
              {payload.priority.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          {payload.driftAlerts.length > 0 && (
            <section className="dashboard-drift">
              <h2>Drift signals</h2>
              <ul>
                {payload.driftAlerts.map((alertRow) => (
                  <li key={`${alertRow.goalTitle}-${alertRow.weeksQuiet}`}>{alertRow.message}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="dashboard-chart-board" aria-labelledby="dashboard-growth-chart-heading">
            <div className="dashboard-chart-board-header">
              <h2 id="dashboard-growth-chart-heading">Growth portfolio</h2>
              <div
                className="dashboard-range-toggle dashboard-chart-series-toggle"
                role="group"
                aria-label="Growth chart counting mode"
              >
                <button
                  type="button"
                  className="dashboard-range-button"
                  aria-pressed={chartSeriesMode === 'perWeek'}
                  onClick={() => setChartSeriesMode('perWeek')}
                >
                  Per week
                </button>
                <button
                  type="button"
                  className="dashboard-range-button"
                  aria-pressed={chartSeriesMode === 'cumulative'}
                  onClick={() => setChartSeriesMode('cumulative')}
                >
                  Cumulative
                </button>
              </div>
            </div>
            <GrowthPortfolioChart
              chartSeriesMode={chartSeriesMode}
              weeks={payload.chart.weeks}
              areaSeriesPerWeek={payload.chart.areaSeriesCarried}
              totalSeriesPerWeek={payload.chart.totalSeries}
              areaSeriesCumulative={payload.chart.areaSeriesCumulative}
              totalSeriesCumulative={payload.chart.totalSeriesCumulative}
            />
          </section>

          <section className="dashboard-goals-shell">
            <h2>Pace toward weekly milestones</h2>
            {payload.goalProgress.length === 0 ? (
              <p>No active goals — Eisenhower and pacing comparisons stay idle until Goals has something active.</p>
            ) : (
              payload.goalProgress.map((goalRow) => <GoalMomentumRow key={goalRow.goalId} {...goalRow} />)
            )}
          </section>

          <section className="dashboard-now">
            <h2>What to do now</h2>
            <p className="dashboard-now-lede">
              One deliberately small block — synthesized from Eisenhower placement and this week&apos;s pacing.
            </p>
            <button
              type="button"
              className="dashboard-now-button"
              onClick={() => void handleNow()}
              disabled={nowLoading}
            >
              {nowLoading ? 'Thinking…' : 'Generate'}
            </button>
            {nowHint && (
              <div className="dashboard-now-result">
                <p className="dashboard-now-action">{nowHint.action}</p>
                <p className="dashboard-now-reason">{nowHint.citedReason}</p>
              </div>
            )}
          </section>

          <EisenhowerBoard {...payload.eisenhower} />
        </>
      )}
    </div>
  )
}
