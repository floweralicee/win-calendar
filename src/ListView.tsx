import type { Win, WinsByDate } from './wins'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

type MonthGroup = {
  /** e.g. "2026-04" */
  monthKey: string
  label: string
  wins: Array<{ date: string; win: Win }>
}

function buildMonthGroups(winsByDate: WinsByDate): MonthGroup[] {
  const groupMap = new Map<string, MonthGroup>()

  for (const [isoDate, winsForDate] of Object.entries(winsByDate)) {
    const [yearStr, monthStr] = isoDate.split('-')
    const monthKey = `${yearStr}-${monthStr}`
    if (!groupMap.has(monthKey)) {
      const monthIndex = Number(monthStr) - 1
      const year = Number(yearStr)
      groupMap.set(monthKey, {
        monthKey,
        label: `${MONTH_LABELS[monthIndex]} ${year}`,
        wins: [],
      })
    }
    for (const win of winsForDate) {
      groupMap.get(monthKey)!.wins.push({ date: isoDate, win })
    }
  }

  // Sort groups: most recent month first, wins within month chronologically.
  return Array.from(groupMap.values())
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .map((group) => ({
      ...group,
      wins: group.wins.sort((a, b) => a.date.localeCompare(b.date)),
    }))
}

function formatDayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[m - 1]} ${d}`
}

type ListViewProps = {
  winsByDate: WinsByDate
  onSelectWin: (win: Win) => void
}

export function ListView({ winsByDate, onSelectWin }: ListViewProps) {
  const groups = buildMonthGroups(winsByDate)
  const totalWins = groups.reduce((sum, g) => sum + g.wins.length, 0)

  if (totalWins === 0) {
    return (
      <div className="list-empty">
        <p>No wins yet. Write your first journal entry to see them here.</p>
      </div>
    )
  }

  return (
    <div className="list-container">
      <p className="list-summary">
        {totalWins} win{totalWins !== 1 ? 's' : ''} across {groups.length} month{groups.length !== 1 ? 's' : ''}
      </p>

      {groups.map((group) => (
        <section key={group.monthKey} className="list-month-section">
          <h2 className="list-month-heading">{group.label}</h2>
          <div className="list-win-rows">
            {group.wins.map(({ date, win }) => (
              <button
                key={win.id}
                type="button"
                className="list-win-row"
                onClick={() => onSelectWin(win)}
              >
                <span className="list-win-date">{formatDayLabel(date)}</span>
                {win.areas
                  ?.filter((a) => a !== 'unclassified')
                  .map((area) => (
                    <span key={area} className="list-win-area-dot" data-area={area} aria-hidden="true" />
                  ))}
                <span className="list-win-title">{win.title}</span>
                {win.spansRange && (
                  <span className="list-win-range-badge" aria-label="spans multiple days">
                    range
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
