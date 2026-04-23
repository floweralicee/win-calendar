import { useState, type FormEvent } from 'react'
import { submitOnboarding, type OnboardingPayload, type PublicConfig } from './api'

type OnboardingProps = {
  onComplete: (config: PublicConfig) => void
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  } catch {
    return 'America/Los_Angeles'
  }
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [obsidianPath, setObsidianPath] = useState('')
  const [email, setEmail] = useState('')
  const [timezone, setTimezone] = useState(detectTimezone())
  const [revealHour, setRevealHour] = useState(7)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const payload: OnboardingPayload = {
      obsidianPath: obsidianPath.trim(),
      email: email.trim(),
      timezone: timezone.trim(),
      revealHour,
    }

    try {
      const next = await submitOnboarding(payload)
      onComplete(next)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      setErrorMessage(message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <p className="onboarding-eyebrow">Set up Win Calendar</p>
        <h1 className="onboarding-title">One-time setup.</h1>
        <p className="onboarding-subtitle">
          Everything stays on this Mac. Your journal and wins are written into your Obsidian vault. The app's API
          keys are managed by the operator in <code>server/.env</code> — you don't need to provide any.
        </p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <label className="onboarding-field">
            <span className="onboarding-label">Obsidian vault folder</span>
            <input
              type="text"
              value={obsidianPath}
              onChange={(event) => setObsidianPath(event.target.value)}
              placeholder="/Users/you/Documents/Obsidian/MyVault"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <span className="onboarding-hint">
              Absolute path. We'll create a <code>WinCalendar/</code> subfolder inside it.
            </span>
          </label>

          <label className="onboarding-field">
            <span className="onboarding-label">Your email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
            <span className="onboarding-hint">Where the morning recap will land.</span>
          </label>

          <div className="onboarding-field-row">
            <label className="onboarding-field">
              <span className="onboarding-label">Timezone</span>
              <input
                type="text"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="America/Los_Angeles"
                required
              />
            </label>
            <label className="onboarding-field">
              <span className="onboarding-label">Reveal hour</span>
              <input
                type="number"
                value={revealHour}
                min={0}
                max={23}
                onChange={(event) => setRevealHour(Number(event.target.value))}
                required
              />
              <span className="onboarding-hint">Local hour (0–23) when wins show and the email sends.</span>
            </label>
          </div>

          {errorMessage && <p className="onboarding-error">{errorMessage}</p>}

          <button type="submit" className="onboarding-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save and open calendar'}
          </button>
        </form>
      </div>
    </div>
  )
}
