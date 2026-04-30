import { useState, useEffect } from 'react'
import type { Win, WinsByDate, LifeArea } from './wins'
import { LIFE_AREAS } from './wins'

// Plays the grow animation only once per browser session — not every time
// the user toggles back to the bloom view.
let bloomHasAnimatedThisSession = false

/** The 5 displayable areas in the canonical ring order (clockwise from top). */
const BLOOM_AREAS: LifeArea[] = ['finance', 'social', 'growth', 'health', 'career']

const AREA_LABELS: Record<LifeArea, string> = {
  finance: 'Finance',
  social: 'Social',
  growth: 'Growth',
  health: 'Health',
  career: 'Career',
  unclassified: 'Unclassified',
}

type WeekData = {
  mondayISO: string
  weekLabel: string
  counts: Record<LifeArea, number>
  winsPerArea: Record<LifeArea, Win[]>
}

type PopoverState = {
  mondayISO: string
  area: LifeArea
  weekLabel: string
  wins: Win[]
  /** Fixed-position coordinates in viewport pixels. */
  clientX: number
  clientY: number
} | null

// ─── Date helpers (no library) ───────────────────────────────────────────────

const MONTH_ABBREVS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function getMondayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const jsDay = date.getDay() // 0 = Sunday
  const mondayOffset = (jsDay + 6) % 7 // 0 when already Monday
  const monday = new Date(y, m - 1, d - mondayOffset)
  return [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, '0'),
    String(monday.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatWeekLabel(mondayISO: string): string {
  const [y, m, d] = mondayISO.split('-').map(Number)
  const sunday = new Date(y, m - 1, d + 6)
  return `${MONTH_ABBREVS[m - 1]} ${d} – ${MONTH_ABBREVS[sunday.getMonth()]} ${sunday.getDate()}`
}

function buildWeeklyData(winsByDate: WinsByDate): WeekData[] {
  const weekMap = new Map<string, WeekData>()

  for (const [isoDate, winsForDate] of Object.entries(winsByDate)) {
    const monday = getMondayOfWeek(isoDate)
    if (!weekMap.has(monday)) {
      const counts = Object.fromEntries(LIFE_AREAS.map((a) => [a, 0])) as Record<LifeArea, number>
      const winsPerArea = Object.fromEntries(LIFE_AREAS.map((a) => [a, [] as Win[]])) as Record<LifeArea, Win[]>
      weekMap.set(monday, { mondayISO: monday, weekLabel: formatWeekLabel(monday), counts, winsPerArea })
    }
    const week = weekMap.get(monday)!
    for (const win of winsForDate) {
      const area: LifeArea = win.area ?? 'unclassified'
      week.counts[area]++
      week.winsPerArea[area].push(win)
    }
  }

  return Array.from(weekMap.values()).sort((a, b) => a.mondayISO.localeCompare(b.mondayISO))
}

// ─── SVG geometry helpers ────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Converts polar coordinates (angle from north, clockwise) to SVG x/y.
 * 0° = top of circle, 90° = right, 180° = bottom, 270° = left.
 */
function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = degToRad(angleDeg - 90)
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

/**
 * Builds an SVG path string for an annular sector (donut slice).
 * The arc sweeps clockwise from startDeg to endDeg.
 */
function describeAnnularSector(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number,
): string {
  const [x1i, y1i] = polarToXY(cx, cy, rInner, startDeg)
  const [x2i, y2i] = polarToXY(cx, cy, rInner, endDeg)
  const [x1o, y1o] = polarToXY(cx, cy, rOuter, startDeg)
  const [x2o, y2o] = polarToXY(cx, cy, rOuter, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  const fmt = (n: number) => n.toFixed(3)
  return [
    `M ${fmt(x1i)} ${fmt(y1i)}`,
    `A ${fmt(rInner)} ${fmt(rInner)} 0 ${largeArc} 1 ${fmt(x2i)} ${fmt(y2i)}`,
    `L ${fmt(x2o)} ${fmt(y2o)}`,
    `A ${fmt(rOuter)} ${fmt(rOuter)} 0 ${largeArc} 0 ${fmt(x1o)} ${fmt(y1o)}`,
    'Z',
  ].join(' ')
}

// ─── Bloom constants ─────────────────────────────────────────────────────────

const CX = 320
const CY = 320
const INNER_RADIUS = 52  // inner edge of the first (oldest) ring
const ARC_GAP_DEG = 3    // gap between adjacent area arcs within a ring
const AREA_SECTOR_DEG = 360 / BLOOM_AREAS.length // 72° per area

// ─── BloomView component ─────────────────────────────────────────────────────

type BloomViewProps = {
  winsByDate: WinsByDate
}

export function BloomView({ winsByDate }: BloomViewProps) {
  const weeks = buildWeeklyData(winsByDate)
  const [popover, setPopover] = useState<PopoverState>(null)
  const [shouldAnimate, setShouldAnimate] = useState(!bloomHasAnimatedThisSession)

  useEffect(() => {
    bloomHasAnimatedThisSession = true
    // Remove the animation class one frame after mount so toggling back to
    // bloom view never re-plays the animation.
    const timer = setTimeout(() => setShouldAnimate(false), 700)
    return () => clearTimeout(timer)
  }, [])

  // ── Ring geometry ──────────────────────────────────────────────────────────

  const numWeeks = weeks.length
  // Fit all rings within a radius of 264px from center.
  const availableRadius = 264
  const ringPitch = numWeeks > 0
    ? Math.min(44, Math.floor(availableRadius / numWeeks))
    : 44
  const ringWidth = Math.max(10, ringPitch - 6)

  // Scale arc thickness to the busiest area/week combo.
  const maxWinCount = Math.max(
    1,
    ...weeks.flatMap((week) => BLOOM_AREAS.map((area) => week.counts[area])),
  )

  // ── Interaction ────────────────────────────────────────────────────────────

  function handleArcClick(
    event: React.MouseEvent,
    week: WeekData,
    area: LifeArea,
  ) {
    event.stopPropagation()
    // Toggle off if the same arc is clicked again.
    if (popover?.mondayISO === week.mondayISO && popover?.area === area) {
      setPopover(null)
      return
    }
    setPopover({
      mondayISO: week.mondayISO,
      area,
      weekLabel: week.weekLabel,
      wins: week.winsPerArea[area],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (numWeeks === 0) {
    return (
      <div className="bloom-empty">
        <p>No wins yet. Write your first journal entry and the bloom will grow.</p>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bloom-container" onClick={() => setPopover(null)}>
      <svg
        viewBox="0 0 640 640"
        className={`bloom-svg${shouldAnimate ? ' bloom-animate' : ''}`}
        aria-label="Growth ring bloom — each ring is one week, each arc is a life area"
        role="img"
      >
        {weeks.map((week, weekIndex) => {
          // Ring slots stack outward: innermost = oldest week.
          const ringCenterRadius = INNER_RADIUS + weekIndex * ringPitch + ringWidth / 2

          return (
            <g key={week.mondayISO}>
              {BLOOM_AREAS.map((area, areaIndex) => {
                const count = week.counts[area]

                const startDeg = areaIndex * AREA_SECTOR_DEG + ARC_GAP_DEG / 2
                const endDeg = (areaIndex + 1) * AREA_SECTOR_DEG - ARC_GAP_DEG / 2

                // Hairline (1.5px) for zero wins; grows up to ringWidth–2 for max wins.
                const minThickness = 1.5
                const maxThickness = ringWidth - 2
                const thickness = count === 0
                  ? minThickness
                  : minThickness + (count / maxWinCount) * (maxThickness - minThickness)

                const rInner = ringCenterRadius - thickness / 2
                const rOuter = ringCenterRadius + thickness / 2
                const pathD = describeAnnularSector(CX, CY, rInner, rOuter, startDeg, endDeg)

                const isHairline = count === 0
                const isInteractive = count > 0

                return (
                  <path
                    key={area}
                    d={pathD}
                    fill={isHairline ? 'none' : `var(--ring-${area})`}
                    stroke={isHairline ? `var(--ring-${area})` : 'none'}
                    strokeWidth={isHairline ? 1 : 0}
                    opacity={isHairline ? 0.18 : 0.82}
                    className={isInteractive ? 'bloom-arc-interactive' : undefined}
                    onClick={isInteractive ? (e) => handleArcClick(e, week, area) : undefined}
                    role={isInteractive ? 'button' : undefined}
                    aria-label={
                      isInteractive
                        ? `${AREA_LABELS[area]}, ${count} win${count !== 1 ? 's' : ''}, ${week.weekLabel}`
                        : undefined
                    }
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Legend row */}
      <div className="bloom-legend" aria-hidden="true">
        {BLOOM_AREAS.map((area) => (
          <span key={area} className="bloom-legend-item">
            <span className="bloom-legend-dot" data-area={area} />
            {AREA_LABELS[area]}
          </span>
        ))}
      </div>

      {/* Arc click popover */}
      {popover !== null && (
        <div
          className="bloom-popover"
          style={{ left: popover.clientX + 14, top: popover.clientY + 14 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={`${AREA_LABELS[popover.area]} wins for ${popover.weekLabel}`}
        >
          <div className="bloom-popover-header">
            <span className="bloom-popover-dot" data-area={popover.area} />
            <span className="bloom-popover-area">{AREA_LABELS[popover.area]}</span>
            <span className="bloom-popover-week">{popover.weekLabel}</span>
          </div>
          <ul className="bloom-popover-list">
            {popover.wins.map((win) => (
              <li key={win.id} className="bloom-popover-win">
                {win.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
