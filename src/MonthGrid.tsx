import type { Win, WinsByDate, LifeArea } from './wins'
import { LIFE_AREAS } from './wins'

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

type CalendarCell =
  | { kind: 'day'; day: number; isoDate: string }
  | { kind: 'empty' }

export function toIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month, 1)
  const jsWeekday = firstOfMonth.getDay()
  const mondayOffset = (jsWeekday + 6) % 7

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: CalendarCell[] = []
  for (let i = 0; i < mondayOffset; i++) cells.push({ kind: 'empty' })
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ kind: 'day', day, isoDate: toIsoDate(year, month, day) })
  }
  while (cells.length % 7 !== 0) cells.push({ kind: 'empty' })

  return cells
}

export type MonthGridProps = {
  year: number
  month: number
  winsByDate: WinsByDate
  onSelectWin: (win: Win) => void
  onDeleteWin: (win: Win) => void
}

/** Month weekday header + day cells only — no calendar chrome. */
export function MonthGrid({
  year,
  month,
  winsByDate,
  onSelectWin,
  onDeleteWin,
}: MonthGridProps) {
  const cells = buildMonthGrid(year, month)

  return (
    <div className="calendar-grid" role="grid">
      <div className="calendar-weekday-row" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-cells">
        {cells.map((cell, index) => {
          if (cell.kind === 'empty') {
            return (
              <div
                key={index}
                className="calendar-cell calendar-cell-empty"
                role="gridcell"
                aria-hidden="true"
              >
                <span className="calendar-empty-dot" />
              </div>
            )
          }

          const winsForDay = winsByDate[cell.isoDate] ?? []

          const areasThisDay: LifeArea[] = LIFE_AREAS.filter(
            (area) =>
              area !== 'unclassified' &&
              winsForDay.some((win) => win.areas?.includes(area)),
          )

          return (
            <div key={index} className="calendar-cell" role="gridcell">
              <span className="calendar-day-number">{cell.day}</span>
              {areasThisDay.length > 0 && (
                <div className="calendar-area-dots" aria-hidden="true">
                  {areasThisDay.map((area) => (
                    <span key={area} className="calendar-area-dot" data-area={area} />
                  ))}
                </div>
              )}
              {winsForDay.length > 0 && (
                <ul className="calendar-win-list">
                  {winsForDay.map((win) => (
                    <li key={win.id} className="calendar-win-item">
                      <button
                        type="button"
                        className={
                          'calendar-win-title' +
                          (win.spansRange ? ' calendar-win-title-ranged' : '')
                        }
                        onClick={() => onSelectWin(win)}
                        title={win.title}
                      >
                        {win.title}
                      </button>
                      <button
                        type="button"
                        className="calendar-win-delete"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteWin(win)
                        }}
                        aria-label={`Delete win: ${win.title}`}
                        title="Delete this win"
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
