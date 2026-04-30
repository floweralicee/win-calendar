import { useState } from 'react'
import type { Win, WinsByDate, LifeArea } from './wins'
import { LIFE_AREAS } from './wins'

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_SIZE = 13
const CELL_GAP = 3
const CELL_PITCH = CELL_SIZE + CELL_GAP // 16px per cell + gap

const DAY_ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const

const MONTH_ABBREVS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

// RGBA channel values for each area color, kept in sync with --ring-* CSS tokens.
// Using explicit RGBA lets us set background-color alpha without touching element
// opacity (which would also dim the today outline).
const AREA_RGB: Record<LifeArea, string> = {
  finance:      '184, 151,  58',
  social:       '184, 112, 106',
  growth:       '110, 158, 116',
  health:       ' 94, 151, 168',
  career:       '114, 114, 168',
  unclassified: '106, 104, 100',
}

// Opacity at each intensity level (1 win → 2 wins → 3 wins → 4+ wins).
const INTENSITY_STOPS = [0.26, 0.52, 0.74, 0.92] as const

// Area tiebreak order when two areas have equal wins on a day.
const DOMINANT_AREA_TIEBREAK: LifeArea[] = [
  'career', 'growth', 'finance', 'health', 'social', 'unclassified',
]

// ─── Types ────────────────────────────────────────────────────────────────────

type CellData = {
  isoDate: string
  winCount: number
  dominantArea: LifeArea | null // null = no wins
  wins: Win[]
  isToday: boolean
  isFuture: boolean
}

type MonthMarker = {
  label: string
  /** Column index (0–51) at which this month label should appear. */
  weekIndex: number
}

type TooltipState = {
  displayDate: string
  wins: Win[]
  clientX: number
  clientY: number
} | null

// ─── Date helpers (no library) ────────────────────────────────────────────────

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

function dominantAreaForDay(wins: Win[]): LifeArea | null {
  if (wins.length === 0) return null
  const counts = new Map<LifeArea, number>()
  for (const win of wins) {
    const area: LifeArea = win.area ?? 'unclassified'
    counts.set(area, (counts.get(area) ?? 0) + 1)
  }
  const maxCount = Math.max(...counts.values())
  // Tiebreak: career first, then growth, finance, health, social, unclassified.
  for (const area of DOMINANT_AREA_TIEBREAK) {
    if ((counts.get(area) ?? 0) === maxCount) return area
  }
  return 'unclassified'
}

function intensityOpacity(winCount: number): number {
  if (winCount === 0) return 0
  const idx = Math.min(winCount - 1, INTENSITY_STOPS.length - 1)
  return INTENSITY_STOPS[idx]
}

/**
 * Builds the 52-column × 7-row date grid ending at (and including) the
 * current week. Column 0 = oldest week (51 weeks ago), column 51 = this week.
 * Rows 0–6 = Mon–Sun.
 */
function buildYearGrid(winsByDate: WinsByDate): {
  columns: CellData[][]
  monthMarkers: MonthMarker[]
  totalWins: number
} {
  const today = new Date()
  const todayISO = toISODate(today)

  // Find Monday of current week.
  const jsDay = today.getDay()
  const mondayOffset = (jsDay + 6) % 7
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() - mondayOffset)

  // Start 51 full weeks before current Monday.
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

      column.push({
        isoDate,
        winCount: wins.length,
        dominantArea: dominantAreaForDay(wins),
        wins,
        isToday: isoDate === todayISO,
        isFuture: isoDate > todayISO,
      })

      // Add a month marker at the first day of each new month (top row only).
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

  const areaHadWins = (area: LifeArea) =>
    LIFE_AREAS.includes(area) &&
    columns.some((col) => col.some((cell) => cell.dominantArea === area))

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
        {/* Month labels above the grid */}
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

        {/* Body: day-of-week labels + the grid itself */}
        <div className="heatmap-body">
          <div className="heatmap-day-labels" aria-hidden="true">
            {DAY_ROW_LABELS.map((label, rowIndex) => (
              <span key={rowIndex} className="heatmap-day-label">
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
                const area = cell.dominantArea
                const opacity = intensityOpacity(cell.winCount)

                // Background: RGBA so only the fill is dimmed, not the today outline.
                let backgroundColor: string
                if (cell.winCount > 0 && area !== null) {
                  backgroundColor = `rgba(${AREA_RGB[area]}, ${opacity})`
                } else {
                  backgroundColor = '' // let CSS class handle empty cells
                }

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
                    style={backgroundColor ? { backgroundColor } : undefined}
                    onMouseEnter={(e) => handleCellEnter(e, cell)}
                    role="gridcell"
                    aria-label={
                      cell.winCount > 0
                        ? `${formatDisplayDate(cell.isoDate)}: ${cell.winCount} win${cell.winCount !== 1 ? 's' : ''}`
                        : undefined
                    }
                  />
                )
              }),
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="heatmap-legend" aria-hidden="true">
          <span className="heatmap-legend-text">Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <div
              key={level}
              className="heatmap-legend-cell"
              style={
                level > 0
                  ? {
                      backgroundColor: `rgba(${AREA_RGB.career}, ${INTENSITY_STOPS[Math.min(level - 1, INTENSITY_STOPS.length - 1)]})`,
                    }
                  : undefined
              }
            />
          ))}
          <span className="heatmap-legend-text">More</span>

          {/* Area color chips for whichever areas have data */}
          <span className="heatmap-legend-divider" aria-hidden="true">·</span>
          {(Object.keys(AREA_RGB) as LifeArea[])
            .filter((area) => area !== 'unclassified' && areaHadWins(area))
            .map((area) => (
              <span key={area} className="heatmap-legend-area">
                <span
                  className="heatmap-legend-area-dot"
                  style={{ backgroundColor: `rgba(${AREA_RGB[area]}, 0.88)` }}
                />
                {area}
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
