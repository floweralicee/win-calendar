import { useState } from 'react'
import type { Win, WinsByDate, LifeArea } from './wins'

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_SIZE = 11
const CELL_GAP = 2
const CELL_PITCH = CELL_SIZE + CELL_GAP

const DAY_ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const

const MONTH_ABBREVS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

// The 5 named life areas rendered as separate streams, in display order.
const HEATMAP_AREAS: LifeArea[] = ['finance', 'social', 'growth', 'health', 'career']

const AREA_LABELS: Record<LifeArea, string> = {
  finance: 'Finance',
  social: 'Social',
  growth: 'Growth',
  health: 'Health',
  career: 'Career',
  unclassified: 'Other',
}

// RGB values for each area color — kept in sync with --ring-* CSS tokens.
const AREA_RGB: Record<LifeArea, [number, number, number]> = {
  finance:      [184, 151,  58],
  social:       [184, 112, 106],
  growth:       [110, 158, 116],
  health:       [ 94, 151, 168],
  career:       [114, 114, 168],
  unclassified: [106, 104, 100],
}

/**
 * 4-step intensity scale.
 *
 * 1 win  → tint:  area color blended 68% with white — clearly visible but light
 * 2 wins → full:  pure area color at 100%
 * 3 wins → dark:  area color at 80% brightness (visibly deeper than full)
 * 4+wins → deep:  area color at 62% brightness (rich, saturated)
 *
 * Going light → full → progressively darker means streak density reads
 * immediately: more activity = richer, darker cell.
 */
type IntensityStep =
  | { kind: 'tint'; whiteMix: number }
  | { kind: 'dark'; factor: number }

const INTENSITY_STEPS: IntensityStep[] = [
  { kind: 'tint', whiteMix: 0.68 },  // 1 win
  { kind: 'tint', whiteMix: 1.00 },  // 2 wins  (whiteMix 1 = pure area color)
  { kind: 'dark', factor: 0.80 },    // 3 wins
  { kind: 'dark', factor: 0.62 },    // 4+ wins
]

function intensityColor(area: LifeArea, count: number): string | undefined {
  if (count === 0) return undefined
  const [r, g, b] = AREA_RGB[area]
  const step = INTENSITY_STEPS[Math.min(count - 1, INTENSITY_STEPS.length - 1)]
  if (step.kind === 'tint') {
    const w = step.whiteMix
    return `rgb(${Math.round(255*(1-w)+r*w)}, ${Math.round(255*(1-w)+g*w)}, ${Math.round(255*(1-w)+b*w)})`
  }
  const f = step.factor
  return `rgb(${Math.round(r*f)}, ${Math.round(g*f)}, ${Math.round(b*f)})`
}

function areaColor(area: LifeArea): string {
  const [r, g, b] = AREA_RGB[area]
  return `rgb(${r}, ${g}, ${b})`
}

// Left offset (px) for the shared month label row:
// area-name column (68px) + body gap (6px) + day-label column (26px) + grid gap (6px)
const MONTH_LABEL_LEFT_OFFSET = 68 + 6 + 26 + 6

// ─── Types ────────────────────────────────────────────────────────────────────

type CellData = {
  isoDate: string
  /** Win count per named area for this day. */
  countsByArea: Record<LifeArea, number>
  wins: Win[]
  isToday: boolean
  isFuture: boolean
}

type MonthMarker = {
  label: string
  weekIndex: number
}

type TooltipState = {
  area: LifeArea
  displayDate: string
  count: number
  wins: Win[]
  clientX: number
  clientY: number
} | null

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISODate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
  return `${dayName}, ${MONTH_ABBREVS[m - 1]} ${d}`
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function buildYearGrid(winsByDate: WinsByDate): {
  columns: CellData[][]
  monthMarkers: MonthMarker[]
  totalByArea: Record<LifeArea, number>
} {
  const today = new Date()
  const todayISO = toISODate(today)

  // Monday of the current week.
  const jsDay = today.getDay()
  const mondayOffset = (jsDay + 6) % 7
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() - mondayOffset)

  // Start 51 full weeks before the current Monday.
  const startDate = new Date(currentMonday)
  startDate.setDate(currentMonday.getDate() - 51 * 7)

  const columns: CellData[][] = []
  const monthMarkers: MonthMarker[] = []
  let lastMonthSeen = -1

  const totalByArea: Record<LifeArea, number> = {
    finance: 0, social: 0, growth: 0, health: 0, career: 0, unclassified: 0,
  }

  for (let week = 0; week < 52; week++) {
    const column: CellData[] = []

    for (let day = 0; day < 7; day++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + week * 7 + day)
      const isoDate = toISODate(d)
      const wins = winsByDate[isoDate] ?? []

      const countsByArea: Record<LifeArea, number> = {
        finance: 0, social: 0, growth: 0, health: 0, career: 0, unclassified: 0,
      }
      for (const win of wins) {
        // A win with multiple areas counts toward each area it belongs to.
        const areas = win.areas && win.areas.length > 0 ? win.areas : (['unclassified'] as LifeArea[])
        for (const area of areas) {
          countsByArea[area]++
          totalByArea[area]++
        }
      }

      column.push({
        isoDate,
        countsByArea,
        wins,
        isToday: isoDate === todayISO,
        isFuture: isoDate > todayISO,
      })

      if (day === 0) {
        const monthIndex = d.getMonth()
        if (monthIndex !== lastMonthSeen) {
          monthMarkers.push({ label: MONTH_ABBREVS[monthIndex], weekIndex: week })
          lastMonthSeen = monthIndex
        }
      }
    }

    columns.push(column)
  }

  return { columns, monthMarkers, totalByArea }
}

// ─── Component ────────────────────────────────────────────────────────────────

type HeatmapViewProps = {
  winsByDate: WinsByDate
}

export function HeatmapView({ winsByDate }: HeatmapViewProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const { columns, monthMarkers, totalByArea } = buildYearGrid(winsByDate)

  const totalWins = HEATMAP_AREAS.reduce((sum, area) => sum + totalByArea[area], 0)

  function handleCellEnter(
    event: React.MouseEvent,
    cell: CellData,
    area: LifeArea,
  ) {
    const count = cell.countsByArea[area]
    if (cell.isFuture || count === 0) {
      setTooltip(null)
      return
    }
    // Show only the wins for this area on this day.
    const areaWins = cell.wins.filter((w) =>
      w.areas && w.areas.length > 0 ? w.areas.includes(area) : area === 'unclassified',
    )
    setTooltip({
      area,
      displayDate: formatDisplayDate(cell.isoDate),
      count,
      wins: areaWins,
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  return (
    <div
      className="heatmap-container"
      onMouseLeave={() => setTooltip(null)}
      onClick={() => setTooltip(null)}
    >
      <p className="heatmap-summary">
        {totalWins} win{totalWins !== 1 ? 's' : ''} in the past year
      </p>

      <div className="heatmap-scroll">
        {/* Shared month labels — offset to align with the grids below */}
        <div
          className="heatmap-months"
          style={{ paddingLeft: MONTH_LABEL_LEFT_OFFSET }}
        >
          {monthMarkers.map((marker) => (
            <span
              key={`${marker.label}-${marker.weekIndex}`}
              className="heatmap-month-label"
              style={{ left: marker.weekIndex * CELL_PITCH }}
            >
              {marker.label}
            </span>
          ))}
        </div>

        {/* One heatmap stream per life area */}
        {HEATMAP_AREAS.map((area) => (
          <div key={area} className="heatmap-area-section">
            {/* Area name column */}
            <div className="heatmap-area-name-col">
              <span
                className="heatmap-area-name"
                style={{ color: areaColor(area) }}
              >
                {AREA_LABELS[area]}
              </span>
              <span className="heatmap-area-total">
                {totalByArea[area]}
              </span>
            </div>

            {/* Grid body */}
            <div className="heatmap-body">
              <div className="heatmap-day-labels" aria-hidden="true">
                {DAY_ROW_LABELS.map((label, i) => (
                  <span key={i} className="heatmap-day-label">
                    {label}
                  </span>
                ))}
              </div>

              <div
                className="heatmap-grid"
                role="grid"
                aria-label={`${AREA_LABELS[area]} wins over the past year`}
              >
                {columns.flatMap((column) =>
                  column.map((cell) => {
                    const count = cell.countsByArea[area]

                    return (
                      <div
                        key={cell.isoDate}
                        className={[
                          'heatmap-cell',
                          cell.isToday && 'heatmap-cell-today',
                          cell.isFuture && 'heatmap-cell-future',
                          count > 0 && 'heatmap-cell-filled',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={
                          count > 0
                            ? { backgroundColor: intensityColor(area, count) }
                            : undefined
                        }
                        onMouseEnter={(e) => handleCellEnter(e, cell, area)}
                        role="gridcell"
                        aria-label={
                          count > 0
                            ? `${formatDisplayDate(cell.isoDate)}: ${count} ${AREA_LABELS[area].toLowerCase()} win${count !== 1 ? 's' : ''}`
                            : undefined
                        }
                      />
                    )
                  }),
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {tooltip !== null && (
        <div
          className="heatmap-tooltip"
          style={{ left: tooltip.clientX + 14, top: tooltip.clientY + 14 }}
          role="tooltip"
        >
          <div className="heatmap-tooltip-header">
            <span
              className="heatmap-tooltip-dot"
              style={{ backgroundColor: areaColor(tooltip.area) }}
            />
            <span className="heatmap-tooltip-area">
              {AREA_LABELS[tooltip.area]}
            </span>
            <span className="heatmap-tooltip-date">{tooltip.displayDate}</span>
          </div>
          <ul className="heatmap-tooltip-list">
            {tooltip.wins.slice(0, 6).map((win) => (
              <li key={win.id} className="heatmap-tooltip-win">
                {win.title}
              </li>
            ))}
            {tooltip.wins.length > 6 && (
              <li className="heatmap-tooltip-more">
                +{tooltip.wins.length - 6} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
