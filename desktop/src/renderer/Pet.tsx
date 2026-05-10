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

// Pet sprite states (unchanged from Phase 4):
//   active  = idle/default  (active.svg; after a saved win → active2)
//   hover   = pointer over pet
//   eat     = bubble open (eat.svg)
//   sleep   = long idle (sleep.svg)
//   touch   = dragging (drag.svg)
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

/**
 * Focus Mode flow steps. The bubble renders different content at each step.
 * 'off' means the user is in the classic journal mode (existing behaviour).
 *
 *   off       → classic "What's your win?" journal bubble
 *   input     → "What's on your mind today?" — user types a task
 *   reframing → Claude is rewriting the task (num1/num2 flicker)
 *   confirm   → show reframed task + Accept / Nah buttons
 *   timer     → countdown running, "you're doing it."
 *   debrief   → "What did you accomplish in X mins?" textarea
 */
type FocusStep = 'off' | 'input' | 'reframing' | 'confirm' | 'timer' | 'debrief'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLEEP_DELAY_MS = 30_000
const SUCCESS_DISMISS_MS = 2_000
const PROCESSING_NUM_FLIP_MS = 350
const BURP_FRAME_MS = 280

const BURP_FRAME_URLS = [burp1Url, burp2Url, burp3Url] as const

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

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
    // Autoplay or decode failures are ignored — animation still plays.
  })
}

function todayISO(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Format seconds as MM:SS for the countdown display. */
function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Pet() {
  // --- existing pet state ---
  const [petState, setPetState] = useState<PetState>('active')
  const [activeIdleUsesWinSprite, setActiveIdleUsesWinSprite] = useState(false)
  const [journalText, setJournalText] = useState('')
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({ kind: 'idle' })
  const [journalOverlay, setJournalOverlay] = useState<JournalSpriteOverlay>({ kind: 'none' })
  const [processingShowsSecondNum, setProcessingShowsSecondNum] = useState(false)
  const [showWinCelebrateSpriteInEat, setShowWinCelebrateSpriteInEat] = useState(false)

  // --- Focus Mode state ---
  const [focusStep, setFocusStep] = useState<FocusStep>('off')
  /** The raw task the user typed in the input step. Preserved for "Nah" loops. */
  const [focusRawTask, setFocusRawTask] = useState('')
  /** The reframed task returned by Claude. */
  const [focusReframedTask, setFocusReframedTask] = useState('')
  /** Duration in minutes returned by Claude (default 25). */
  const [focusDurationMins, setFocusDurationMins] = useState(25)
  /** Countdown in seconds — counts down from focusDurationMins * 60. */
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(0)
  /** Error from the reframe API call, shown in confirm step if it fails. */
  const [focusReframeError, setFocusReframeError] = useState('')
  /** Text user types in debrief step. */
  const [focusDebriefText, setFocusDebriefText] = useState('')

  // --- refs ---
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const debriefTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const burpScheduleTimeoutIdsRef = useRef<number[]>([])
  const focusCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Drag refs — closures never go stale.
  const isDraggingRef = useRef(false)
  const lastScreenPosRef = useRef({ x: 0, y: 0 })
  const rafHandleRef = useRef<number | null>(null)
  const pendingDeltaRef = useRef({ dx: 0, dy: 0 })

  // -------------------------------------------------------------------------
  // Sleep timer
  // -------------------------------------------------------------------------

  const resetSleepTimer = useCallback(() => {
    if (sleepTimerRef.current !== null) clearTimeout(sleepTimerRef.current)
    sleepTimerRef.current = setTimeout(() => {
      setPetState((current) => {
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
  // Num1/num2 loop while focus is reframing (reuse same mechanic)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (focusStep !== 'reframing') return
    setProcessingShowsSecondNum(false)
    const intervalId = window.setInterval(() => {
      setProcessingShowsSecondNum((previous) => !previous)
    }, PROCESSING_NUM_FLIP_MS)
    return () => clearInterval(intervalId)
  }, [focusStep])

  // -------------------------------------------------------------------------
  // Bubble visibility + textarea focus — opens when entering eat state
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (petState === 'eat') {
      window.hana.setBubbleVisible(true)
      // Focus the right textarea depending on which step we're in.
      setTimeout(() => {
        if (focusStep === 'off' || focusStep === 'input') {
          textareaRef.current?.focus()
        } else if (focusStep === 'debrief') {
          debriefTextareaRef.current?.focus()
        }
      }, 50)
    }
  }, [petState, focusStep])

  // Also focus debrief textarea when step transitions to 'debrief'.
  useEffect(() => {
    if (focusStep === 'debrief') {
      setTimeout(() => debriefTextareaRef.current?.focus(), 50)
    }
  }, [focusStep])

  // -------------------------------------------------------------------------
  // Focus countdown timer
  // -------------------------------------------------------------------------

  const clearFocusCountdown = useCallback(() => {
    if (focusCountdownIntervalRef.current !== null) {
      clearInterval(focusCountdownIntervalRef.current)
      focusCountdownIntervalRef.current = null
    }
  }, [])

  function startFocusCountdown(durationMins: number): void {
    clearFocusCountdown()
    const totalSeconds = durationMins * 60
    setFocusSecondsLeft(totalSeconds)
    focusCountdownIntervalRef.current = setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          clearFocusCountdown()
          setFocusStep('debrief')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Cleanup countdown on unmount.
  useEffect(() => {
    return () => clearFocusCountdown()
  }, [clearFocusCountdown])

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
      lastScreenPosRef.current = { x: event.screenX, y: event.screenY }
      pendingDeltaRef.current.dx += dx
      pendingDeltaRef.current.dy += dy
      if (rafHandleRef.current === null) {
        rafHandleRef.current = requestAnimationFrame(flushMoveDelta)
      }
    }

    function handleMouseUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current)
        rafHandleRef.current = null
        const { dx, dy } = pendingDeltaRef.current
        if (dx !== 0 || dy !== 0) {
          window.hana.moveBy(dx, dy)
          pendingDeltaRef.current = { dx: 0, dy: 0 }
        }
      }
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
  // Interaction handlers — pet sprite
  // -------------------------------------------------------------------------

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    isDraggingRef.current = true
    lastScreenPosRef.current = { x: event.screenX, y: event.screenY }
    pendingDeltaRef.current = { dx: 0, dy: 0 }
    if (petState !== 'eat') setPetState('touch')
    resetSleepTimer()
  }

  function handleMouseEnter() {
    if (petState === 'active') {
      setPetState('hover')
      resetSleepTimer()
    } else if (petState === 'sleep') {
      setPetState('active')
      resetSleepTimer()
    }
  }

  function handleMouseLeave() {
    if (petState === 'hover') setPetState('active')
  }

  function handleDoubleClick() {
    if (petState === 'sleep') {
      setPetState('active')
      resetSleepTimer()
      return
    }
    if (petState === 'active' || petState === 'hover') {
      // Open Focus Mode (input step).
      setFocusStep('input')
      setFocusRawTask('')
      setFocusReframedTask('')
      setFocusReframeError('')
      setFocusDebriefText('')
      setSubmitStatus({ kind: 'idle' })
      setShowWinCelebrateSpriteInEat(false)
      setPetState('eat')
      resetSleepTimer()
    }
  }

  function handlePetClick() {
    if (petState === 'sleep') {
      setPetState('active')
      resetSleepTimer()
    }
  }

  // -------------------------------------------------------------------------
  // Dismiss helpers
  // -------------------------------------------------------------------------

  function dismissBubble() {
    clearBurpScheduleTimeouts()
    clearFocusCountdown()
    setJournalOverlay({ kind: 'none' })
    setShowWinCelebrateSpriteInEat(false)
    window.hana.setBubbleVisible(false)
    setPetState('active')
    setJournalText('')
    setSubmitStatus({ kind: 'idle' })
    setFocusStep('off')
    setFocusRawTask('')
    setFocusReframedTask('')
    setFocusReframeError('')
    setFocusDebriefText('')
    resetSleepTimer()
  }

  // -------------------------------------------------------------------------
  // Burp animation (reused for both journal and debrief submit)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Classic journal submit (existing flow, unchanged)
  // -------------------------------------------------------------------------

  async function handleJournalSubmit() {
    const trimmedText = journalText.trim()
    if (!trimmedText) {
      dismissBubble()
      return
    }
    setSubmitStatus({ kind: 'submitting' })
    setJournalOverlay({ kind: 'processing' })

    const result = await window.hana.submitJournal(trimmedText, todayISO())

    if (result.ok) {
      const winWord = result.winsCount === 1 ? 'win' : 'wins'
      const feedbackMessage =
        result.winsCount > 0 ? `✓ ${result.winsCount} ${winWord} saved!` : '✓ Noted!'
      setSubmitStatus({ kind: 'success', message: feedbackMessage })
      setJournalText('')

      if (result.winsCount > 0) {
        await scheduleBurpAnimationThenFinish()
        setTimeout(() => dismissBubble(), SUCCESS_DISMISS_MS)
      } else {
        setJournalOverlay({ kind: 'none' })
        setTimeout(() => dismissBubble(), SUCCESS_DISMISS_MS)
      }
    } else {
      setJournalOverlay({ kind: 'none' })
      setSubmitStatus({ kind: 'error', message: result.error })
    }
  }

  function handleJournalKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') dismissBubble()
    else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleJournalSubmit()
    }
  }

  // -------------------------------------------------------------------------
  // Focus Mode handlers
  // -------------------------------------------------------------------------

  async function handleFocusInputSubmit() {
    const trimmedTask = focusRawTask.trim()
    if (!trimmedTask) {
      dismissBubble()
      return
    }
    setFocusStep('reframing')
    setFocusReframeError('')

    const result = await window.hana.reframeTask(trimmedTask)

    if (result.ok) {
      setFocusReframedTask(result.reframed)
      setFocusDurationMins(result.durationMins)
      setFocusStep('confirm')
    } else {
      setFocusReframeError(result.error)
      setFocusStep('input') // drop back to input so user can retry
    }
  }

  function handleFocusInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') dismissBubble()
    else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleFocusInputSubmit()
    }
  }

  function handleAccept() {
    setFocusStep('timer')
    startFocusCountdown(focusDurationMins)
  }

  function handleNah() {
    // Loop back to input, pre-filled with the original task.
    setFocusStep('input')
    setFocusReframedTask('')
    setFocusReframeError('')
    // focusRawTask stays so the textarea shows their original text.
  }

  async function handleDebriefSubmit() {
    const trimmedDebrief = focusDebriefText.trim()
    // Save whatever the user wrote as a win, then burp.
    const textToSave = trimmedDebrief || `Worked on: ${focusReframedTask}`

    setSubmitStatus({ kind: 'submitting' })
    setJournalOverlay({ kind: 'processing' })

    const result = await window.hana.submitJournal(textToSave, todayISO())

    if (result.ok) {
      setSubmitStatus({ kind: 'success', message: '✓ Session saved!' })
      await scheduleBurpAnimationThenFinish()
      setTimeout(() => dismissBubble(), SUCCESS_DISMISS_MS)
    } else {
      // Burp anyway — the user still did the work.
      setJournalOverlay({ kind: 'none' })
      setSubmitStatus({ kind: 'idle' })
      await scheduleBurpAnimationThenFinish()
      setTimeout(() => dismissBubble(), SUCCESS_DISMISS_MS)
    }
  }

  function handleDebriefKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') dismissBubble()
    else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleDebriefSubmit()
    }
  }

  // -------------------------------------------------------------------------
  // Render helpers — bubble content per focusStep
  // -------------------------------------------------------------------------

  function renderFocusBubbleContent() {
    // Burp / success overlay takes priority across all steps.
    if (journalOverlay.kind === 'burp' || submitStatus.kind === 'success') {
      return (
        <p className="bubble-feedback bubble-feedback-success">
          {submitStatus.kind === 'success' ? submitStatus.message : '🎉'}
        </p>
      )
    }

    switch (focusStep) {
      case 'input':
        return (
          <>
            {focusReframeError && (
              <p className="bubble-feedback bubble-feedback-error">{focusReframeError}</p>
            )}
            <textarea
              ref={textareaRef}
              className="bubble-textarea"
              value={focusRawTask}
              placeholder="What's on your mind today?"
              onChange={(e) => setFocusRawTask(e.target.value)}
              onKeyDown={handleFocusInputKeyDown}
              rows={3}
            />
            <div className="bubble-actions">
              <button
                type="button"
                className="bubble-submit-button"
                onClick={() => void handleFocusInputSubmit()}
              >
                Go ↵
              </button>
            </div>
          </>
        )

      case 'reframing':
        return (
          <p className="bubble-feedback bubble-feedback-loading">Thinking…</p>
        )

      case 'confirm':
        return (
          <>
            <p className="focus-challenge-card">{focusReframedTask}</p>
            <div className="accept-nah-row">
              <button
                type="button"
                className="btn-accept"
                onClick={handleAccept}
              >
                ✊ Accept
              </button>
              <button
                type="button"
                className="btn-nah"
                onClick={handleNah}
              >
                ↩ Nah, something else
              </button>
            </div>
          </>
        )

      case 'timer':
        return (
          <>
            <p className="focus-timer">{formatCountdown(focusSecondsLeft)}</p>
            <p className="focus-timer-label">you're doing it.</p>
          </>
        )

      case 'debrief': {
        const isSubmitting = submitStatus.kind === 'submitting'
        return (
          <>
            <p className="focus-debrief-prompt">
              What did you accomplish in {focusDurationMins} min?
            </p>
            <textarea
              ref={debriefTextareaRef}
              className="bubble-textarea"
              value={focusDebriefText}
              placeholder="I worked on…"
              onChange={(e) => setFocusDebriefText(e.target.value)}
              onKeyDown={handleDebriefKeyDown}
              disabled={isSubmitting}
              rows={3}
            />
            {!isSubmitting && (
              <div className="bubble-actions">
                <button
                  type="button"
                  className="bubble-submit-button"
                  onClick={() => void handleDebriefSubmit()}
                >
                  Done ↵
                </button>
              </div>
            )}
            {isSubmitting && (
              <p className="bubble-feedback bubble-feedback-loading">Saving…</p>
            )}
          </>
        )
      }

      default:
        return null
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const showBubble = petState === 'eat'
  const isFocusMode = focusStep !== 'off'

  return (
    <div className="pet-root">
      {showBubble && (
        <div className="speech-bubble">
          <button
            type="button"
            className="bubble-close-button"
            onClick={dismissBubble}
            aria-label="Close"
          >
            ✕
          </button>

          {isFocusMode ? (
            renderFocusBubbleContent()
          ) : (
            <>
              {submitStatus.kind === 'success' ? (
                <p className="bubble-feedback bubble-feedback-success">{submitStatus.message}</p>
              ) : submitStatus.kind === 'error' ? (
                <div className="bubble-error-block">
                  <p className="bubble-feedback bubble-feedback-error">{submitStatus.message}</p>
                  <button
                    type="button"
                    className="bubble-retry-button"
                    onClick={() => void handleJournalSubmit()}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="bubble-cancel-button"
                    onClick={dismissBubble}
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
                  onKeyDown={handleJournalKeyDown}
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
                    onClick={() => void handleJournalSubmit()}
                  >
                    Save win ↵
                  </button>
                </div>
              )}
            </>
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
