import { useCallback, useEffect, useState } from 'react'
import { Calendar } from './Calendar'
import { WinDetail } from './WinDetail'
import { Onboarding } from './Onboarding'
import { JournalComposer } from './JournalComposer'
import { fetchConfig, fetchWins, deleteWin, type PublicConfig } from './api'
import type { Win, WinsByDate } from './wins'

function addMonths(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const total = year * 12 + monthIndex + delta
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 }
}

type LoadState = 'loading' | 'ready' | 'error'

export function App() {
  const today = new Date()

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [winsByDate, setWinsByDate] = useState<WinsByDate>({})

  const [visibleYear, setVisibleYear] = useState(today.getFullYear())
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth())

  const [selectedWin, setSelectedWin] = useState<Win | null>(null)
  const [isJournalOpen, setIsJournalOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      const nextConfig = await fetchConfig()
      setConfig(nextConfig)
      if (nextConfig.onboarded) {
        const nextWins = await fetchWins()
        setWinsByDate(nextWins)
      } else {
        setWinsByDate({})
      }
      setLoadState('ready')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to contact local server.'
      setLoadError(message)
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!selectedWin) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedWin(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedWin])

  const goToPreviousMonth = () => {
    const next = addMonths(visibleYear, visibleMonth, -1)
    setVisibleYear(next.year)
    setVisibleMonth(next.monthIndex)
  }

  const goToNextMonth = () => {
    const next = addMonths(visibleYear, visibleMonth, 1)
    setVisibleYear(next.year)
    setVisibleMonth(next.monthIndex)
  }

  const goToToday = () => {
    const now = new Date()
    setVisibleYear(now.getFullYear())
    setVisibleMonth(now.getMonth())
  }

  const handleDeleteWin = useCallback(async (win: Win) => {
    await deleteWin(win.id)
    setWinsByDate((prev) => {
      const updated = { ...prev }
      for (const [date, wins] of Object.entries(updated)) {
        const filtered = wins.filter((w) => w.id !== win.id)
        if (filtered.length === 0) {
          delete updated[date]
        } else {
          updated[date] = filtered
        }
      }
      return updated
    })
  }, [])

  if (loadState === 'loading') {
    return (
      <div className="app-status">
        <p>Loading…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="app-status">
        <p className="app-status-error">Can't reach the local server.</p>
        <p className="app-status-hint">
          Make sure it's running: <code>npm run dev</code>. Error: {loadError}
        </p>
        <button type="button" className="app-status-retry" onClick={reload}>
          Retry
        </button>
      </div>
    )
  }

  if (!config?.onboarded) {
    return (
      <Onboarding
        onComplete={(nextConfig) => {
          setConfig(nextConfig)
          reload()
        }}
      />
    )
  }

  return (
    <>
      <Calendar
        year={visibleYear}
        month={visibleMonth}
        winsByDate={winsByDate}
        onSelectWin={setSelectedWin}
        onDeleteWin={handleDeleteWin}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onJumpToToday={goToToday}
        onOpenJournal={() => setIsJournalOpen(true)}
      />
      {selectedWin && <WinDetail win={selectedWin} onClose={() => setSelectedWin(null)} />}
      {isJournalOpen && (
        <JournalComposer
          onClose={() => setIsJournalOpen(false)}
          onSubmitted={reload}
        />
      )}
    </>
  )
}
