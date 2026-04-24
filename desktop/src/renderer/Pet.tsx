import { useCallback, useEffect, useRef, useState } from 'react'

import active1Url from '@hana-icon/active.svg?url'
import active2Url from '@hana-icon/new/active2.svg?url'
import burp1Url from '@hana-icon/new/burp1.svg?url'
import burp2Url from '@hana-icon/new/burp2.svg?url'
import burp3Url from '@hana-icon/new/burp3.svg?url'
import eatUrl from '@hana-icon/eat.svg?url'
import num1Url from '@hana-icon/new/num1.svg?url'
import num2Url from '@hana-icon/new/num2.svg?url'
import sleepUrl from '@hana-icon/sleep.svg?url'
import dragUrl from '@hana-icon/new/drag.svg?url'
import burpSoundUrl from '@hana-icon/new/burp1.mp3?url'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// States map to the OC Desktop Pet skill's four roles:
//   active  = idle/default  (active.svg == new/active1.svg; after a saved win → active2)
//   hover   = pointer over pet (same art as active — eat.svg only after double-click)
//   eat     = textbox open  (eat.svg)
//   sleep   = long idle     (sleep.svg)
//   touch   = dragging      (new/drag.svg)
type PetState = 'active' | 'hover' | 'eat' | 'sleep' | 'touch'

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }

/** Replaces the pet sprite during journal submit / post-save burp. */
type JournalSpriteOverlay =
  | { kind: 'none' }
  | { kind: 'processing' }
  | { kind: 'burp'; frame: 0 | 1 | 2 }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLEEP_DELAY_MS = 30_000
const SUCCESS_DISMISS_MS = 2_000
const PROCESSING_NUM_FLIP_MS = 350
const BURP_FRAME_MS = 280

const BURP_FRAME_URLS = [burp1Url, burp2Url, burp3Url] as const

function spriteUrlForPetState(
  petState: PetState,
  activeIdleUsesWinSprite: boolean,
): string {
  switch (petState) {
    case 'active':
    case 'hover':
      return activeIdleUsesWinSprite ? active2Url : active1Url
    case 'eat':
      return eatUrl
    case 'sleep':
      return sleepUrl
    case 'touch':
      return dragUrl
  }
}

function resolvePetSpriteUrl(
  petState: PetState,
  activeIdleUsesWinSprite: boolean,
  journalOverlay: JournalSpriteOverlay,
  processingShowsSecondNum: boolean,
  /** After burp, show active2 in the eat bubble until dismiss (not plain eat.svg). */
  showWinCelebrateSpriteInEat: boolean,
): string {
  if (journalOverlay.kind === 'processing') {
    return processingShowsSecondNum ? num2Url : num1Url
  }
  if (journalOverlay.kind === 'burp') {
    return BURP_FRAME_URLS[journalOverlay.frame]
  }
  if (showWinCelebrateSpriteInEat && petState === 'eat') {
    return active2Url
  }
  return spriteUrlForPetState(petState, activeIdleUsesWinSprite)
}

function playBurpSoundEffect(soundUrl: string): void {
  const audio = new Audio(soundUrl)
  void audio.play().catch(() => {
    // Autoplay or decode failures are ignored; burp animation still runs.
  })
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
  /** After at least one win is saved in this session, idle uses active2.svg. */
  const [activeIdleUsesWinSprite, setActiveIdleUsesWinSprite] = useState(false)
  const [journalText, setJournalText] = useState('')
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: 'idle' })
  const [journalOverlay, setJournalOverlay] = useState<JournalSpriteOverlay>({ kind: 'none' })
  /** Toggles num1/num2 while `journalOverlay` is processing. */
  const [processingShowsSecondNum, setProcessingShowsSecondNum] = useState(false)
  /** True from end of burp until bubble closes — pet shows active2 while success text is visible. */
  const [showWinCelebrateSpriteInEat, setShowWinCelebrateSpriteInEat] = useState(false)

  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const burpScheduleTimeoutIdsRef = useRef<number[]>([])

  // Drag state in refs so mouse-move handler closure never goes stale.
  const isDraggingRef = useRef(false)
  // Last known screen position of the pointer — re-anchored each rAF tick.
  const lastScreenPosRef = useRef({ x: 0, y: 0 })
  // Pending rAF handle so we only schedule one frame at a time.
  const rafHandleRef = useRef<number | null>(null)
  // Accumulated delta between rAF flushes.
  const pendingDeltaRef = useRef({ dx: 0, dy: 0 })

  // -------------------------------------------------------------------------
  // Sleep timer — reset on any user activity
  // -------------------------------------------------------------------------

  const resetSleepTimer = useCallback(() => {
    if (sleepTimerRef.current !== null) clearTimeout(sleepTimerRef.current)
    sleepTimerRef.current = setTimeout(() => {
      setPetState((current) => {
        // Don't override eat or touch with sleep.
        if (current === 'eat' || current === 'touch') return current
        return 'sleep'
      })
    }, SLEEP_DELAY_MS)
  }, [])

  useEffect(() => {
    resetSleepTimer()
    return () => {
      if (sleepTimerRef.current !== null) clearTimeout(sleepTimerRef.current)
    }
  }, [resetSleepTimer])

  const clearBurpScheduleTimeouts = useCallback(() => {
    for (const timeoutId of burpScheduleTimeoutIdsRef.current) {
      clearTimeout(timeoutId)
    }
    burpScheduleTimeoutIdsRef.current = []
  }, [])

  // -------------------------------------------------------------------------
  // Num1/num2 loop while the journal request is in flight
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (journalOverlay.kind !== 'processing') return
    setProcessingShowsSecondNum(false)
    const intervalId = window.setInterval(() => {
      setProcessingShowsSecondNum((previous) => !previous)
    }, PROCESSING_NUM_FLIP_MS)
    return () => clearInterval(intervalId)
  }, [journalOverlay.kind])

  // -------------------------------------------------------------------------
  // Focus textarea when entering eat state
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (petState === 'eat') {
      setTimeout(() => textareaRef.current?.focus(), 50)
      window.hana.setBubbleVisible(true)
    }
  }, [petState])

  // -------------------------------------------------------------------------
  // Global mouse-move / mouse-up for dragging (rAF-batched)
  // -------------------------------------------------------------------------

  useEffect(() => {
    function flushMoveDelta() {
      rafHandleRef.current = null
      const { dx, dy } = pendingDeltaRef.current
      if (dx !== 0 || dy !== 0) {
        window.hana.moveBy(dx, dy)
        pendingDeltaRef.current = { dx: 0, dy: 0 }
      }
    }

    function handleMouseMove(event: MouseEvent) {
      if (!isDraggingRef.current) return

      const dx = event.screenX - lastScreenPosRef.current.x
      const dy = event.screenY - lastScreenPosRef.current.y
      // Re-anchor immediately so each tick only sends what moved since last tick.
      lastScreenPosRef.current = { x: event.screenX, y: event.screenY }

      // Accumulate and schedule one rAF flush.
      pendingDeltaRef.current.dx += dx
      pendingDeltaRef.current.dy += dy
      if (rafHandleRef.current === null) {
        rafHandleRef.current = requestAnimationFrame(flushMoveDelta)
      }
    }

    function handleMouseUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      // Cancel any pending frame.
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current)
        rafHandleRef.current = null
        // Flush any remaining delta synchronously.
        const { dx, dy } = pendingDeltaRef.current
        if (dx !== 0 || dy !== 0) {
          window.hana.moveBy(dx, dy)
          pendingDeltaRef.current = { dx: 0, dy: 0 }
        }
      }
      // Return to active after touch drag; stay in eat if we were dragging with the bubble open.
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
    if (event.button !== 0) return
    event.preventDefault()

    isDraggingRef.current = true
    lastScreenPosRef.current = { x: event.screenX, y: event.screenY }
    pendingDeltaRef.current = { dx: 0, dy: 0 }

    // In eat state keep the sprite as eat.svg — the bubble stays open and the
    // pet is draggable but doesn't visually switch to touch.svg.
    if (petState !== 'eat') {
      setPetState('touch')
    }
    resetSleepTimer()
  }

  function handleMouseEnter() {
    if (petState === 'active') {
      setPetState('hover')
      resetSleepTimer()
    } else if (petState === 'sleep') {
      // Wake up on hover too.
      setPetState('active')
      resetSleepTimer()
    }
  }

  function handleMouseLeave() {
    if (petState === 'hover') {
      setPetState('active')
      // Don't reset sleep timer here — going back to active should let the
      // timer count from when the user last moved the cursor away.
    }
  }

  function handleDoubleClick() {
    if (petState === 'sleep') {
      setPetState('active')
      resetSleepTimer()
      return
    }
    if (petState === 'active' || petState === 'hover') {
      setPetState('eat')
      setJournalText('')
      setSubmitStatus({ kind: 'idle' })
      setShowWinCelebrateSpriteInEat(false)
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
    clearBurpScheduleTimeouts()
    setJournalOverlay({ kind: 'none' })
    setShowWinCelebrateSpriteInEat(false)
    window.hana.setBubbleVisible(false)
    setPetState('active')
    setJournalText('')
    setSubmitStatus({ kind: 'idle' })
    resetSleepTimer()
  }

  function scheduleBurpAnimationThenFinish(): Promise<void> {
    clearBurpScheduleTimeouts()
    return new Promise((resolve) => {
      const scheduleStep = (delayMs: number, runStep: () => void) => {
        const timeoutId = window.setTimeout(runStep, delayMs)
        burpScheduleTimeoutIdsRef.current.push(timeoutId)
      }

      setJournalOverlay({ kind: 'burp', frame: 0 })
      playBurpSoundEffect(burpSoundUrl)

      scheduleStep(BURP_FRAME_MS, () => {
        setJournalOverlay({ kind: 'burp', frame: 1 })
          scheduleStep(BURP_FRAME_MS, () => {
            setJournalOverlay({ kind: 'burp', frame: 2 })
            scheduleStep(BURP_FRAME_MS, () => {
              setJournalOverlay({ kind: 'none' })
              setActiveIdleUsesWinSprite(true)
              setShowWinCelebrateSpriteInEat(true)
              clearBurpScheduleTimeouts()
              resolve()
            })
          })
      })
    })
  }

  async function handleSubmit() {
    const trimmedText = journalText.trim()
    if (!trimmedText) {
      dismissEatState()
      return
    }

    setSubmitStatus({ kind: 'submitting' })
    setJournalOverlay({ kind: 'processing' })

    const result = await window.hana.submitJournal(trimmedText, todayISO())

    if (result.ok) {
      const winWord = result.winsCount === 1 ? 'win' : 'wins'
      const feedbackMessage =
        result.winsCount > 0
          ? `✓ ${result.winsCount} ${winWord} saved!`
          : '✓ Noted!'
      setSubmitStatus({ kind: 'success', message: feedbackMessage })
      setJournalText('')

      if (result.winsCount > 0) {
        await scheduleBurpAnimationThenFinish()
        setTimeout(() => {
          dismissEatState()
        }, SUCCESS_DISMISS_MS)
      } else {
        setJournalOverlay({ kind: 'none' })
        setTimeout(() => {
          dismissEatState()
        }, SUCCESS_DISMISS_MS)
      }
    } else {
      setJournalOverlay({ kind: 'none' })
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
          <button
            type="button"
            className="bubble-close-button"
            onClick={dismissEatState}
            aria-label="Close"
          >
            ✕
          </button>
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
            </div>
          )}
          <div className="speech-bubble-tail" />
        </div>
      )}

      <div className="pet-sprite-hit-wrap">
        <div
          className={`pet-sprite pet-sprite-${petState}`}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onClick={handlePetClick}
          role="img"
          aria-label={`Hana the desktop pet — ${petState} state`}
        >
          <img
            src={resolvePetSpriteUrl(
              petState,
              activeIdleUsesWinSprite,
              journalOverlay,
              processingShowsSecondNum,
              showWinCelebrateSpriteInEat,
            )}
            alt=""
            className="pet-image"
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}
