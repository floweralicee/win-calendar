import { useEffect, useRef, useState } from 'react'
import { submitJournal } from './api'

type JournalComposerProps = {
  onClose: () => void
  onSubmitted: () => void
}

function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type SpeechRecognitionLike = {
  start: () => void
  stop: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

export function JournalComposer({ onClose, onSubmitted }: JournalComposerProps) {
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionConstructor() !== null)
    textareaRef.current?.focus()
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !successMessage) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, successMessage])

  const startListening = () => {
    const Ctor = getSpeechRecognitionConstructor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      let appended = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          appended += (result[0]?.transcript ?? '') + ' '
        }
      }
      if (appended) {
        setText((previous) => (previous ? previous.trimEnd() + ' ' + appended.trim() : appended.trim()))
      }
    }
    recognition.onerror = () => {
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    setIsSubmitting(true)
    setErrorMessage(null)
    stopListening()
    try {
      const result = await submitJournal({
        text: text.trim(),
        dateISO: toLocalISODate(new Date()),
      })
      setSuccessMessage(result.message)
      onSubmitted()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      setErrorMessage(message)
      setIsSubmitting(false)
    }
  }

  if (successMessage) {
    return (
      <div className="journal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="journal-sheet journal-sheet-success"
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="journal-success-eyebrow">Done</p>
          <p className="journal-success-message">{successMessage}</p>
          <button type="button" className="journal-success-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="journal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="journal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-composer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="journal-header">
          <p className="journal-eyebrow">Tonight</p>
          <h2 id="journal-composer-title" className="journal-title">
            What happened today?
          </h2>
          <button
            type="button"
            className="journal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <textarea
          ref={textareaRef}
          className="journal-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type or dictate. Don't edit yourself — the agent will pull the real wins out in the morning."
          rows={10}
        />

        <div className="journal-actions">
          {speechSupported && (
            <button
              type="button"
              className={'journal-mic' + (isListening ? ' journal-mic-active' : '')}
              onClick={isListening ? stopListening : startListening}
              disabled={isSubmitting}
            >
              <span aria-hidden="true">{isListening ? '■' : '●'}</span>
              <span>{isListening ? 'Stop' : 'Dictate'}</span>
            </button>
          )}
          <div className="journal-actions-spacer" />
          {errorMessage && <p className="journal-error">{errorMessage}</p>}
          <button
            type="button"
            className="journal-submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !text.trim()}
          >
            {isSubmitting ? 'Sending…' : 'Submit and sleep'}
          </button>
        </div>
      </div>
    </div>
  )
}
