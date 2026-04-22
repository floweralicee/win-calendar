import { useEffect, useRef } from 'react'
import type { Win } from './wins'

type WinDetailProps = {
  win: Win
  onClose: () => void
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

export function WinDetail({ win, onClose }: WinDetailProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

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
