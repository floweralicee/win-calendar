import type { Win, WinsByDate, LifeArea } from './wins'
import { BloomView } from './BloomView'
import { HeatmapView } from './HeatmapView'
import { ListView } from './ListView'
import { GoalsView } from './GoalsView'
import { OrbitView } from './OrbitView'
import { IslandView } from './IslandView'
import { MonthGrid } from './MonthGrid'

type ActiveView = 'month' | 'bloom' | 'year' | 'list' | 'goals' | 'orbit' | 'island'

/** Large heading + one-line context for non-month views (month uses the grid header instead). */
const ALT_VIEW_HEADER: Record<
  Exclude<ActiveView, 'month' | 'island'>,
  { heading: string; tagline: string }
> = {
  bloom: {
    heading: 'BLOOM',
    tagline: 'Growth rings — one week per ring, one arc per life area',
  },
  year: {
    heading: 'YEAR',
    tagline: 'Five heatmaps — finance, social, growth, health, career',
  },
  list: {
    heading: 'ALL WINS',
    tagline: 'Chronological list across every month with data',
  },
  goals: {
    heading: 'GOALS',
    tagline: 'Milestones, deadlines, and what you are steering toward',
  },
  orbit: {
    heading: 'ORBIT',
    tagline: 'Every win in time — spiral from your first step to now',
  },
}

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
  onUpdateWinAreas?: (win: Win, areas: LifeArea[]) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onJumpToToday: () => void
  onOpenJournal: () => void
  activeView: ActiveView
  onSetView: (view: ActiveView) => void
}

export function Calendar({
  year,
  month,
  winsByDate,
  onSelectWin,
  onDeleteWin,
  onUpdateWinAreas,
  onPreviousMonth,
  onNextMonth,
  onJumpToToday,
  onOpenJournal,
  activeView,
  onSetView,
}: CalendarProps) {
  if (activeView === 'island') {
    return (
      <div className="calendar calendar--island-only">
        <IslandView
          winsByDate={winsByDate}
          year={year}
          month={month}
          onSelectWin={onSelectWin}
          onDeleteWin={onDeleteWin}
          onUpdateWinAreas={onUpdateWinAreas ?? (() => {})}
          onPreviousMonth={onPreviousMonth}
          onNextMonth={onNextMonth}
          onJumpToToday={onJumpToToday}
          onOpenJournal={onOpenJournal}
          onExitIsland={() => onSetView('month')}
        />
      </div>
    )
  }

  return (
    <div className="calendar">
      <header className="calendar-header">
        {activeView === 'month' ? (
          <div className="calendar-header-top">
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
              <button
                type="button"
                className="calendar-journal-button"
                onClick={onOpenJournal}
                title="Write tonight's journal"
              >
                Journal
              </button>
            </div>
          </div>
        ) : (
          <div className="calendar-app-bar">
            <div className="calendar-app-bar-main">
              <div className="calendar-app-bar-titles">
                <p className="calendar-app-bar-wordmark" aria-hidden="true">
                  GrowthOS
                </p>
                <h1 className="calendar-app-bar-heading">
                  {ALT_VIEW_HEADER[activeView].heading}
                </h1>
                <p className="calendar-app-bar-tagline">
                  {ALT_VIEW_HEADER[activeView].tagline}
                </p>
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
          </div>
        )}

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
          <button
            type="button"
            className="calendar-view-toggle-button"
            aria-pressed={activeView === 'list'}
            onClick={() => onSetView('list')}
          >
            List
          </button>
          <button
            type="button"
            className="calendar-view-toggle-button"
            aria-pressed={activeView === 'goals'}
            onClick={() => onSetView('goals')}
          >
            Goals
          </button>
          <button
            type="button"
            className="calendar-view-toggle-button"
            aria-pressed={activeView === 'orbit'}
            onClick={() => onSetView('orbit')}
          >
            Orbit
          </button>
          <button
            type="button"
            className="calendar-view-toggle-button"
            aria-pressed={false}
            onClick={() => onSetView('island')}
          >
            Island
          </button>
        </div>
      </header>

      {activeView === 'bloom' && <BloomView winsByDate={winsByDate} />}
      {activeView === 'year' && <HeatmapView winsByDate={winsByDate} />}
      {activeView === 'list' && <ListView winsByDate={winsByDate} onSelectWin={onSelectWin} />}
      {activeView === 'goals' && <GoalsView />}
      {activeView === 'orbit' && <OrbitView winsByDate={winsByDate} onSelectWin={onSelectWin} />}

      {activeView === 'month' && (
        <MonthGrid
          year={year}
          month={month}
          winsByDate={winsByDate}
          onSelectWin={onSelectWin}
          onDeleteWin={onDeleteWin}
        />
      )}
    </div>
  )
}
