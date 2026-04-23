import { useCallback, useEffect, useRef, useState } from 'react'

import activeUrl from '../../../../hana-icon/active.svg?url'
import eatUrl from '../../../../hana-icon/eat.svg?url'
import sleepUrl from '../../../../hana-icon/sleep.svg?url'
import touchUrl from '../../../../hana-icon/touch.svg?url'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PetState = 'active' | 'eat' | 'sleep' | 'touch'

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLEEP_DELAY_MS = 30_000
const SUCCESS_DISMISS_MS = 2_000

const SVG_BY_STATE: Record<PetState, string> = {
  active: activeUrl,
  eat: eatUrl,
  sleep: sleepUrl,
  touch: touchUrl,
}

function todayISO(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Pet() {
  const [petState, setPetState] = useState<PetState>('active')
  const [journalText, setJournalText] = useState('')
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: 'idle' })

  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Drag state — stored in refs so mouse-move handler never goes stale.
  const isDraggingRef = useRef(false)
  const dragStartScreenRef = useRef({ x: 0, y: 0 })
  const windowStartPosRef = useRef({ x: 0, y: 0 })

  // -------------------------------------------------------------------------
  // Sleep timer — reset on any activity
  // -------------------------------------------------------------------------

  const resetSleepTimer = useCallback(() => {
    if (sleepTimerRef.current !== null) clearTimeout(sleepTimerRef.current)
    sleepTimerRef.current = setTimeout(() => {
      setPetState((current) => (current === 'eat' || current === 'touch' ? current : 'sleep'))
    }, SLEEP_DELAY_MS)
  }, [])

  useEffect(() => {
    resetSleepTimer()
    return () => {
      if (sleepTimerRef.current !== null) clearTimeout(sleepTimerRef.current)
    }
  }, [resetSleepTimer])

  // -------------------------------------------------------------------------
  // Focus the textarea when entering eat state
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (petState === 'eat') {
      // Small delay so the DOM has rendered the textarea.
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [petState])

  // -------------------------------------------------------------------------
  // Global mouse-move / mouse-up for dragging
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!isDraggingRef.current) return
      const deltaX = event.screenX - dragStartScreenRef.current.x
      const deltaY = event.screenY - dragStartScreenRef.current.y
      const newX = windowStartPosRef.current.x + deltaX
      const newY = windowStartPosRef.current.y + deltaY
      window.hana.setPosition(newX, newY)
    }

    function handleMouseUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setPetState((current) => (current === 'touch' ? 'active' : current))
      resetSleepTimer()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resetSleepTimer])

  // -------------------------------------------------------------------------
  // Interaction handlers
  // -------------------------------------------------------------------------

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    // Only drag on primary button, and not when eat state textbox is open.
    if (event.button !== 0 || petState === 'eat') return
    event.preventDefault()

    isDraggingRef.current = true
    dragStartScreenRef.current = { x: event.screenX, y: event.screenY }

    // We don't know the native window position from renderer, so we track
    // delta only. Main process accumulates absolute position from the last
    // saved value. We send the initial anchor via a special message.
    windowStartPosRef.current = { x: 0, y: 0 }

    // Tell main process drag started so it can record current window pos
    // as the anchor. We piggyback on setPosition with a special sentinel
    // (NaN signals "anchor grab" — main ignores NaN moves).
    // Actually simpler: we send screen deltas from main. The main process
    // just calls setPosition(savedX + deltaX, savedY + deltaY). So we track
    // the drag in renderer as a delta and always send absolute values based
    // on the last saved pos. The main process simply calls setPosition directly,
    // which also updates savedPos, so it naturally tracks the chain correctly.
    // Nothing extra needed here.

    setPetState('touch')
    resetSleepTimer()
  }

  function handleDoubleClick() {
    if (petState === 'sleep') {
      // Wake up first — a second double-click will open the textbox.
      setPetState('active')
      resetSleepTimer()
      return
    }
    if (petState === 'active') {
      setPetState('eat')
      setJournalText('')
      setSubmitStatus({ kind: 'idle' })
      resetSleepTimer()
    }
  }

  function handlePetClick() {
    if (petState === 'sleep') {
      setPetState('active')
      resetSleepTimer()
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      dismissEatState()
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  function dismissEatState() {
    setPetState('active')
    setJournalText('')
    setSubmitStatus({ kind: 'idle' })
    resetSleepTimer()
  }

  async function handleSubmit() {
    const trimmedText = journalText.trim()
    if (!trimmedText) {
      dismissEatState()
      return
    }

    setSubmitStatus({ kind: 'submitting' })

    const result = await window.hana.submitJournal(trimmedText, todayISO())

    if (result.ok) {
      const winWord = result.winsCount === 1 ? 'win' : 'wins'
      const feedbackMessage =
        result.winsCount > 0
          ? `✓ ${result.winsCount} ${winWord} saved!`
          : '✓ Noted!'
      setSubmitStatus({ kind: 'success', message: feedbackMessage })
      setJournalText('')
      setTimeout(() => {
        dismissEatState()
      }, SUCCESS_DISMISS_MS)
    } else {
      setSubmitStatus({ kind: 'error', message: result.error })
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const showBubble = petState === 'eat'

  return (
    <div className="pet-root">
      {showBubble && (
        <div className="speech-bubble">
          {submitStatus.kind === 'success' ? (
            <p className="bubble-feedback bubble-feedback-success">{submitStatus.message}</p>
          ) : submitStatus.kind === 'error' ? (
            <div className="bubble-error-block">
              <p className="bubble-feedback bubble-feedback-error">{submitStatus.message}</p>
              <button
                type="button"
                className="bubble-retry-button"
                onClick={() => void handleSubmit()}
              >
                Retry
              </button>
              <button
                type="button"
                className="bubble-cancel-button"
                onClick={dismissEatState}
              >
                Cancel
              </button>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              className="bubble-textarea"
              value={journalText}
              placeholder="What's your win right now?"
              onChange={(e) => setJournalText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitStatus.kind === 'submitting'}
              rows={3}
            />
          )}
          {submitStatus.kind === 'submitting' && (
            <p className="bubble-feedback bubble-feedback-loading">Saving…</p>
          )}
          {submitStatus.kind === 'idle' && (
            <div className="bubble-actions">
              <button
                type="button"
                className="bubble-submit-button"
                onClick={() => void handleSubmit()}
              >
                Save win ↵
              </button>
              <button
                type="button"
                className="bubble-dismiss-button"
                onClick={dismissEatState}
              >
                ✕
              </button>
            </div>
          )}
          <div className="speech-bubble-tail" />
        </div>
      )}

      <div
        className={`pet-sprite pet-sprite-${petState}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onClick={handlePetClick}
        role="img"
        aria-label={`Hana the desktop pet — ${petState} state`}
      >
        <img
          src={SVG_BY_STATE[petState]}
          alt=""
          className="pet-image"
          draggable={false}
        />
      </div>
    </div>
  )
}
