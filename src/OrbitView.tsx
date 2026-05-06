import { useMemo, useState } from 'react'
import type { Win, WinsByDate, LifeArea } from './wins'

const DISPLAY_AREAS: LifeArea[] = ['finance', 'social', 'growth', 'health', 'career']

const MONTH_ABBREVS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function primaryArea(win: Win): LifeArea {
  const areas = win.areas?.filter((area) => area !== 'unclassified') ?? []
  return areas[0] ?? 'unclassified'
}

function flattenWinsChronological(winsByDate: WinsByDate): Array<{ isoDate: string; win: Win }> {
  const list: Array<{ isoDate: string; win: Win }> = []
  for (const [isoDate, winsForDate] of Object.entries(winsByDate)) {
    for (const win of winsForDate) {
      list.push({ isoDate, win })
    }
  }
  list.sort((a, b) => {
    const byDate = a.isoDate.localeCompare(b.isoDate)
    return byDate !== 0 ? byDate : a.win.id.localeCompare(b.win.id)
  })
  return list
}

function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${MONTH_ABBREVS[m - 1]} ${d}, ${y}`
}

type SpiralPoint = {
  x: number
  y: number
  isoDate: string
  win: Win
  area: LifeArea
  index: number
}

function buildSpiralLayout(
  entries: Array<{ isoDate: string; win: Win }>,
  viewSize: number,
): SpiralPoint[] {
  const n = entries.length
  const cx = viewSize / 2
  const cy = viewSize / 2
  const rMin = viewSize * 0.07
  const rMax = viewSize * 0.44
  const totalTurns = Math.max(2.2, Math.min(4.8, 2 + n / 22))

  return entries.map((entry, index) => {
    const u = n === 1 ? 0.5 : index / (n - 1)
    const theta = u * totalTurns * 2 * Math.PI
    const r = rMin + u * (rMax - rMin)
    const x = cx + r * Math.cos(theta - Math.PI / 2)
    const y = cy + r * Math.sin(theta - Math.PI / 2)
    return {
      x,
      y,
      isoDate: entry.isoDate,
      win: entry.win,
      area: primaryArea(entry.win),
      index,
    }
  })
}

type OrbitViewProps = {
  winsByDate: WinsByDate
  onSelectWin: (win: Win) => void
}

export function OrbitView({ winsByDate, onSelectWin }: OrbitViewProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const entries = useMemo(() => flattenWinsChronological(winsByDate), [winsByDate])
  const viewSize = 100

  const points = useMemo(
    () => buildSpiralLayout(entries, viewSize),
    [entries],
  )

  const polylinePoints =
    points.length > 0 ? points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') : ''

  const totalWins = entries.length
  const firstDate = entries[0]?.isoDate
  const lastDate = entries[entries.length - 1]?.isoDate
  const hovered = hoveredIndex !== null ? points[hoveredIndex] : null

  if (totalWins === 0) {
    return (
      <div className="orbit-empty">
        <p>No wins yet. Once you journal, your growth path appears here as a spiral in time.</p>
      </div>
    )
  }

  return (
    <div className="orbit-container">
      <p className="orbit-summary" aria-live="polite">
        {totalWins} win{totalWins !== 1 ? 's' : ''}
        {firstDate && lastDate ? ` · ${formatShortDate(firstDate)} → ${formatShortDate(lastDate)}` : ''}
      </p>

      <div className="orbit-chart-wrap">
        <svg
          className="orbit-svg"
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Growth orbit: ${totalWins} wins from ${formatShortDate(firstDate!)} to ${formatShortDate(lastDate!)}. Hover dots for titles; click to open details.`}
        >
          <title>
            {`Growth orbit from ${formatShortDate(firstDate!)} to ${formatShortDate(lastDate!)} — ${totalWins} wins along a time spiral`}
          </title>
          {polylinePoints && (
            <polyline
              className="orbit-trail"
              fill="none"
              points={polylinePoints}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {points.map((point) => {
            const isFirst = point.index === 0
            const isLast = point.index === points.length - 1
            const isHovered = hoveredIndex === point.index
            const baseR = isLast ? 1.35 : 1.05
            const r = isHovered ? baseR + 0.35 : baseR
            return (
              <g key={point.win.id}>
                <circle
                  className="orbit-hit"
                  cx={point.x}
                  cy={point.y}
                  r={2.8}
                  onMouseEnter={() => setHoveredIndex(point.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(point.index)}
                  onBlur={() => setHoveredIndex(null)}
                  onClick={() => onSelectWin(point.win)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectWin(point.win)
                    }
                  }}
                  tabIndex={0}
                  aria-label={`${formatShortDate(point.isoDate)}: ${point.win.title}`}
                />
                <circle
                  className="orbit-dot"
                  data-area={point.area}
                  cx={point.x}
                  cy={point.y}
                  r={r}
                  pointerEvents="none"
                  aria-hidden
                />
                {isFirst && (
                  <circle
                    className="orbit-endcap orbit-endcap-start"
                    cx={point.x}
                    cy={point.y}
                    r={r + 0.75}
                    pointerEvents="none"
                    aria-hidden
                  />
                )}
                {isLast && (
                  <circle
                    className="orbit-endcap orbit-endcap-now"
                    cx={point.x}
                    cy={point.y}
                    r={r + 0.55}
                    pointerEvents="none"
                    aria-hidden
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="orbit-caption" aria-live="polite">
        {hovered ? (
          <>
            <span className="orbit-caption-date">{formatShortDate(hovered.isoDate)}</span>
            <span className="orbit-caption-title">{hovered.win.title}</span>
          </>
        ) : (
          <span className="orbit-caption-hint">
            Center = earliest win · outer edge = latest · line is your path through time
          </span>
        )}
      </div>

      <ul className="orbit-legend" aria-label="Life area colors">
        {DISPLAY_AREAS.map((area) => (
          <li key={area}>
            <span className="orbit-legend-dot" data-area={area} aria-hidden />
            <span className="orbit-legend-label">
              {area.charAt(0).toUpperCase() + area.slice(1)}
            </span>
          </li>
        ))}
        <li>
          <span className="orbit-legend-dot" data-area="unclassified" aria-hidden />
          <span className="orbit-legend-label">Other</span>
        </li>
      </ul>
    </div>
  )
}
