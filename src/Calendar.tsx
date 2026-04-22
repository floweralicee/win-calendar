import type { Win, WinsByDate } from './wins'

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

const MONTH_LABELS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const

type CalendarProps = {
  year: number
  month: number
  winsByDate: WinsByDate
  onSelectWin: (win: Win) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onJumpToToday: () => void
}

type CalendarCell =
  | { kind: 'day'; day: number; isoDate: string }
  | { kind: 'empty' }

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
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

export function Calendar({
  year,
  month,
  winsByDate,
  onSelectWin,
  onPreviousMonth,
  onNextMonth,
  onJumpToToday,
}: CalendarProps) {
  const cells = buildMonthGrid(year, month)

  return (
    <div className="calendar">
      <header className="calendar-header">
        <div className="calendar-heading-group">
          <button
            type="button"
            className="calendar-nav-button"
            onClick={onPreviousMonth}
            aria-label="Previous month"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <h1 className="calendar-month">
            <button
              type="button"
              className="calendar-month-button"
              onClick={onJumpToToday}
              title="Jump to today"
            >
              {MONTH_LABELS[month]}
            </button>
          </h1>
          <button
            type="button"
            className="calendar-nav-button"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className="calendar-year" aria-label={String(year)}>
          <span className="calendar-year-bullet" aria-hidden="true">•</span>
          <span className="calendar-year-number">{year}</span>
          <span className="calendar-year-bullet" aria-hidden="true">•</span>
        </div>
      </header>

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

            return (
              <div key={index} className="calendar-cell" role="gridcell">
                <span className="calendar-day-number">{cell.day}</span>
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
