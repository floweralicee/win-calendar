import { useEffect, useMemo, useState } from 'react'
import { Calendar } from './Calendar'
import { WinDetail } from './WinDetail'
import { parseTimelineMarkdown, type Win } from './wins'
import timelineMarkdown from '../example/TIMELINE-finance.md?raw'

function addMonths(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const total = year * 12 + monthIndex + delta
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 }
}

export function App() {
  const winsByDate = useMemo(() => parseTimelineMarkdown(timelineMarkdown), [])

  const today = new Date()
  const [visibleYear, setVisibleYear] = useState(today.getFullYear())
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth())

  const [selectedWin, setSelectedWin] = useState<Win | null>(null)

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

  return (
    <>
      <Calendar
        year={visibleYear}
        month={visibleMonth}
        winsByDate={winsByDate}
        onSelectWin={setSelectedWin}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onJumpToToday={goToToday}
      />
      {selectedWin && <WinDetail win={selectedWin} onClose={() => setSelectedWin(null)} />}
    </>
  )
}
