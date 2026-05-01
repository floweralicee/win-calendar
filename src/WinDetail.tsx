import { useEffect, useRef, useState } from 'react'
import type { Win, LifeArea } from './wins'
import { LIFE_AREAS } from './wins'

const AREA_LABELS: Record<LifeArea, string> = {
  finance: 'Finance',
  social: 'Social',
  growth: 'Growth',
  health: 'Health',
  career: 'Career',
  unclassified: 'Other',
}

/** The 5 selectable areas (excludes unclassified — it's a fallback, not a choice). */
const SELECTABLE_AREAS = LIFE_AREAS.filter((a) => a !== 'unclassified')

type WinDetailProps = {
  win: Win
  onClose: () => void
  onUpdateArea: (win: Win, area: LifeArea) => Promise<void>
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function formatHumanDate(isoDate: string): string {
  const [yearStr, monthStr, dayStr] = isoDate.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  const day = Number(dayStr)
  if (Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day)) return isoDate
  return `${MONTH_LABELS[monthIndex]} ${day}, ${year}`
}

/**
 * Renders a tiny subset of markdown inline for the detail body:
 *   - **bold** spans
 *   - each non-empty line becomes its own paragraph, which matches the timeline
 *     format where "What happened / Financial impact / Why it matters" sit on
 *     consecutive lines with no blank separator.
 * Everything else is treated as literal text so we never dangerouslySetInnerHTML.
 */
function renderInlineMarkdown(source: string) {
  const paragraphs = source
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return paragraphs.map((paragraph, paragraphIndex) => {
    const parts = paragraph.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    return (
      <p key={paragraphIndex} className="win-detail-paragraph">
        {parts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={partIndex}>{part.slice(2, -2)}</strong>
          }
          return <span key={partIndex}>{part}</span>
        })}
      </p>
    )
  })
}

export function WinDetail({ win, onClose, onUpdateArea }: WinDetailProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [areaUpdateError, setAreaUpdateError] = useState<string | null>(null)
  const [savingArea, setSavingArea] = useState(false)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  async function handleAreaSelect(area: LifeArea) {
    if (area === win.area || savingArea) return
    setSavingArea(true)
    setAreaUpdateError(null)
    try {
      await onUpdateArea(win, area)
    } catch (err) {
      setAreaUpdateError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingArea(false)
    }
  }

  return (
    <div
      className="win-detail-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="win-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="win-detail-header">
          <p className="win-detail-date">{formatHumanDate(win.date)}</p>
          {/* Area tag selector — shows current area and lets user re-tag */}
          <div className="win-detail-area-row">
            {SELECTABLE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                className="win-detail-area-btn"
                aria-pressed={win.area === area}
                data-area={area}
                disabled={savingArea}
                onClick={() => handleAreaSelect(area)}
                title={`Tag as ${AREA_LABELS[area]}`}
              >
                {AREA_LABELS[area]}
              </button>
            ))}
          </div>
          {areaUpdateError && (
            <p className="win-detail-area-error">{areaUpdateError}</p>
          )}
          <h2 id="win-detail-title" className="win-detail-title">
            {win.title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="win-detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="win-detail-body">{renderInlineMarkdown(win.body)}</div>
      </div>
    </div>
  )
}
