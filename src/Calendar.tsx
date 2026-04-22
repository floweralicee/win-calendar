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
}

type CalendarCell =
  | { kind: 'day'; day: number }
  | { kind: 'empty' }

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month, 1)
  const jsWeekday = firstOfMonth.getDay()
  const mondayOffset = (jsWeekday + 6) % 7

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: CalendarCell[] = []
  for (let i = 0; i < mondayOffset; i++) cells.push({ kind: 'empty' })
  for (let day = 1; day <= daysInMonth; day++) cells.push({ kind: 'day', day })
  while (cells.length % 7 !== 0) cells.push({ kind: 'empty' })

  return cells
}

export function Calendar({ year, month }: CalendarProps) {
  const cells = buildMonthGrid(year, month)

  return (
    <div className="calendar">
      <header className="calendar-header">
        <h1 className="calendar-month">{MONTH_LABELS[month]}</h1>
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
          {cells.map((cell, index) =>
            cell.kind === 'day' ? (
              <div key={index} className="calendar-cell" role="gridcell">
                <span className="calendar-day-number">{cell.day}</span>
              </div>
            ) : (
              <div
                key={index}
                className="calendar-cell calendar-cell-empty"
                role="gridcell"
                aria-hidden="true"
              >
                <span className="calendar-empty-dot" />
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
