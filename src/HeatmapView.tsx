import { useState } from 'react'
import type { Win, WinsByDate, LifeArea } from './wins'

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_SIZE = 13
const CELL_GAP = 3
const CELL_PITCH = CELL_SIZE + CELL_GAP // 16px per cell + gap

const DAY_ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const

const MONTH_ABBREVS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

// The 5 named areas in display order (top → bottom within each stacked cell).
const HEATMAP_AREAS: LifeArea[] = ['finance', 'social', 'growth', 'health', 'career']

// RGBA channels kept in sync with --ring-* CSS tokens. Using inline RGBA
// (not element opacity) so the today outline ring is never dimmed.
const AREA_RGB: Record<LifeArea, string> = {
  finance:      '184, 151,  58',
  social:       '184, 112, 106',
  growth:       '110, 158, 116',
  health:       ' 94, 151, 168',
  career:       '114, 114, 168',
  unclassified: '106, 104, 100',
}

const AREA_LABELS: Record<LifeArea, string> = {
  finance: 'Finance',
  social: 'Social',
  growth: 'Growth',
  health: 'Health',
  career: 'Career',
  unclassified: 'Other',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CellData = {
  isoDate: string
  winCount: number
  /** Per-area win counts for the 5 named areas (not unclassified). */
  stripCounts: Record<LifeArea, number>
  wins: Win[]
  isToday: boolean
  isFuture: boolean
}

type MonthMarker = {
  label: string
  weekIndex: number
}

type TooltipState = {
  displayDate: string
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
  totalWins: number
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
  let totalWins = 0

  for (let week = 0; week < 52; week++) {
    const column: CellData[] = []

    for (let day = 0; day < 7; day++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + week * 7 + day)
      const isoDate = toISODate(d)
      const wins = winsByDate[isoDate] ?? []
      totalWins += wins.length

      // Count wins per named area for this day's stacked cell strips.
      const stripCounts: Record<LifeArea, number> = {
        finance: 0, social: 0, growth: 0, health: 0, career: 0, unclassified: 0,
      }
      for (const win of wins) {
        const area: LifeArea = win.area ?? 'unclassified'
        stripCounts[area]++
      }

      column.push({
        isoDate,
        winCount: wins.length,
        stripCounts,
        wins,
        isToday: isoDate === todayISO,
        isFuture: isoDate > todayISO,
      })

      // Month label at the start of each new month (top row only).
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

  return { columns, monthMarkers, totalWins }
}

// ─── Component ────────────────────────────────────────────────────────────────

type HeatmapViewProps = {
  winsByDate: WinsByDate
}

export function HeatmapView({ winsByDate }: HeatmapViewProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const { columns, monthMarkers, totalWins } = buildYearGrid(winsByDate)

  function handleCellEnter(event: React.MouseEvent, cell: CellData) {
    if (cell.isFuture || cell.winCount === 0) {
      setTooltip(null)
      return
    }
    setTooltip({
      displayDate: formatDisplayDate(cell.isoDate),
      wins: cell.wins,
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  // Which areas actually appear anywhere in the visible year (for the legend).
  const activeAreas = HEATMAP_AREAS.filter((area) =>
    columns.some((col) => col.some((cell) => cell.stripCounts[area] > 0)),
  )

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
        {/* Month labels */}
        <div className="heatmap-months">
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

        {/* Day-of-week labels + grid */}
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
            aria-label="Win activity over the past year"
          >
            {columns.flatMap((column) =>
              column.map((cell) => {
                // Build the strips: one per named area with at least 1 win.
                const activeStrips = HEATMAP_AREAS.filter(
                  (area) => cell.stripCounts[area] > 0,
                )

                // Each strip's height is proportional to that area's share of
                // the day's wins, summed across the named areas only.
                const namedTotal = activeStrips.reduce(
                  (sum, area) => sum + cell.stripCounts[area],
                  0,
                )

                return (
                  <div
                    key={cell.isoDate}
                    className={[
                      'heatmap-cell',
                      cell.isToday && 'heatmap-cell-today',
                      cell.isFuture && 'heatmap-cell-future',
                      cell.winCount > 0 && 'heatmap-cell-filled',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={(e) => handleCellEnter(e, cell)}
                    role="gridcell"
                    aria-label={
                      cell.winCount > 0
                        ? `${formatDisplayDate(cell.isoDate)}: ${cell.winCount} win${cell.winCount !== 1 ? 's' : ''}`
                        : undefined
                    }
                  >
                    {activeStrips.map((area) => {
                      const share = cell.stripCounts[area] / (namedTotal || 1)
                      const heightPx = Math.max(1, share * CELL_SIZE)
                      return (
                        <div
                          key={area}
                          className="heatmap-cell-strip"
                          style={{
                            height: heightPx,
                            backgroundColor: `rgba(${AREA_RGB[area]}, 0.88)`,
                          }}
                        />
                      )
                    })}
                  </div>
                )
              }),
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="heatmap-legend" aria-hidden="true">
          {activeAreas.map((area) => (
            <span key={area} className="heatmap-legend-area">
              <span
                className="heatmap-legend-area-dot"
                style={{ backgroundColor: `rgba(${AREA_RGB[area]}, 0.88)` }}
              />
              {AREA_LABELS[area]}
            </span>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip !== null && (
        <div
          className="heatmap-tooltip"
          style={{ left: tooltip.clientX + 14, top: tooltip.clientY + 14 }}
          role="tooltip"
        >
          <p className="heatmap-tooltip-date">{tooltip.displayDate}</p>
          <ul className="heatmap-tooltip-list">
            {tooltip.wins.slice(0, 6).map((win) => (
              <li key={win.id} className="heatmap-tooltip-win">
                {win.area && win.area !== 'unclassified' && (
                  <span
                    className="heatmap-tooltip-dot"
                    style={{ backgroundColor: `rgba(${AREA_RGB[win.area]}, 0.88)` }}
                  />
                )}
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
