import type { Win, WinsByDate, LifeArea } from './wins'
import { LIFE_AREAS } from './wins'
import { BloomView } from './BloomView'
import { HeatmapView } from './HeatmapView'

type ActiveView = 'month' | 'bloom' | 'year'

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
  onDeleteWin: (win: Win) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onJumpToToday: () => void
  onOpenJournal: () => void
  activeView: ActiveView
  onSetView: (view: ActiveView) => void
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
  onDeleteWin,
  onPreviousMonth,
  onNextMonth,
  onJumpToToday,
  onOpenJournal,
  activeView,
  onSetView,
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
        <div className="calendar-header-right">
          <div className="calendar-year" aria-label={String(year)}>
            <span className="calendar-year-bullet" aria-hidden="true">•</span>
            <span className="calendar-year-number">{year}</span>
            <span className="calendar-year-bullet" aria-hidden="true">•</span>
          </div>
          <div className="calendar-view-toggle" role="group" aria-label="View">
            <button
              type="button"
              className="calendar-view-toggle-button"
              aria-pressed={activeView === 'month'}
              onClick={() => onSetView('month')}
            >
              Month
            </button>
            <button
              type="button"
              className="calendar-view-toggle-button"
              aria-pressed={activeView === 'bloom'}
              onClick={() => onSetView('bloom')}
            >
              Bloom
            </button>
            <button
              type="button"
              className="calendar-view-toggle-button"
              aria-pressed={activeView === 'year'}
              onClick={() => onSetView('year')}
            >
              Year
            </button>
          </div>
          <button
            type="button"
            className="calendar-journal-button"
            onClick={onOpenJournal}
            title="Write tonight's journal"
          >
            Journal
          </button>
        </div>
      </header>

      {activeView === 'bloom' && <BloomView winsByDate={winsByDate} />}
      {activeView === 'year' && <HeatmapView winsByDate={winsByDate} />}

      <div className="calendar-grid" role="grid" style={{ display: activeView !== 'month' ? 'none' : undefined }}>
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

            // Collect the unique area values present this day, in canonical
            // order (finance → social → growth → health → career), excluding
            // unclassified wins and wins with no area tag.
            const areasThisDay: LifeArea[] = LIFE_AREAS.filter(
              (area) =>
                area !== 'unclassified' &&
                winsForDay.some((win) => win.area === area),
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
                          onClick={(e) => { e.stopPropagation(); onDeleteWin(win) }}
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
    </div>
  )
}
