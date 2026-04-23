import { Resend } from 'resend'
import type { PersistedWin } from './obsidian.ts'

export type ScheduleMorningEmailInput = {
  to: string
  /** ISO YYYY-MM-DD the wins are for. */
  winsDateISO: string
  wins: PersistedWin[]
}

export type ScheduleMorningEmailResult = {
  emailId: string
}

/**
 * Converts a local "tomorrow at revealHour" in the user's IANA timezone into a
 * UTC ISO 8601 instant Resend accepts. We intentionally do this with
 * Intl.DateTimeFormat offset math rather than pulling in a timezone library.
 */
export function computeNextRevealInstantISO(
  nowInstant: Date,
  timezone: string,
  revealHour: number,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  }).formatToParts(nowInstant)

  const localYear = Number(parts.find((part) => part.type === 'year')?.value)
  const localMonth = Number(parts.find((part) => part.type === 'month')?.value)
  const localDay = Number(parts.find((part) => part.type === 'day')?.value)
  const localHourRaw = parts.find((part) => part.type === 'hour')?.value ?? '0'
  const localHour = Number(localHourRaw === '24' ? '0' : localHourRaw)

  // If it's already past the reveal hour today, target tomorrow. Otherwise target today.
  let targetYear = localYear
  let targetMonth = localMonth
  let targetDay = localDay
  if (localHour >= revealHour) {
    const next = new Date(Date.UTC(localYear, localMonth - 1, localDay + 1))
    targetYear = next.getUTCFullYear()
    targetMonth = next.getUTCMonth() + 1
    targetDay = next.getUTCDate()
  }

  // Guess UTC with the reveal hour, then correct by the actual offset that
  // tz would produce at that wall-clock instant.
  const naiveUtcGuess = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, revealHour, 0, 0))
  const offsetMinutes = getTimezoneOffsetMinutes(naiveUtcGuess, timezone)
  const correctedUtc = new Date(naiveUtcGuess.getTime() - offsetMinutes * 60_000)
  return correctedUtc.toISOString()
}

function getTimezoneOffsetMinutes(instant: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const lookup: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(
    lookup.year,
    (lookup.month ?? 1) - 1,
    lookup.day ?? 1,
    lookup.hour === 24 ? 0 : lookup.hour ?? 0,
    lookup.minute ?? 0,
    lookup.second ?? 0,
  )
  return (asUtc - instant.getTime()) / 60_000
}

function renderEmailHtml(winsDateISO: string, wins: PersistedWin[]): string {
  const humanDate = formatHumanDate(winsDateISO)
  const blocks = wins
    .map(
      (win) => `
    <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e6e4e0;">
      <h2 style="margin:0 0 8px;font-size:18px;font-weight:500;color:#1a1a1a;">${escapeHtml(
        win.title,
      )}</h2>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#2a2a2a;"><strong>What happened:</strong> ${escapeHtml(
        win.whatHappened,
      )}</p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#2a2a2a;"><strong>Life impact:</strong> ${escapeHtml(
        win.lifeImpact,
      )}</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#2a2a2a;"><strong>Why it matters:</strong> ${escapeHtml(
        win.whyItMatters,
      )}</p>
    </div>`,
    )
    .join('')

  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Inter,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7a7874;">Yesterday \u2014 ${escapeHtml(
        humanDate,
      )}</p>
      <h1 style="margin:0 0 24px;font-size:28px;font-weight:500;color:#1a1a1a;">Look what you did.</h1>
      ${blocks}
      <p style="margin:24px 0 0;font-size:12px;color:#7a7874;">From your Win Calendar. Go see them on the calendar whenever you\u2019re ready.</p>
    </div>
  </body>
</html>`
}

function renderEmailText(winsDateISO: string, wins: PersistedWin[]): string {
  const humanDate = formatHumanDate(winsDateISO)
  const winText = wins
    .map(
      (win) =>
        `${win.title}\n` +
        `  What happened: ${win.whatHappened}\n` +
        `  Life impact:   ${win.lifeImpact}\n` +
        `  Why it matters: ${win.whyItMatters}`,
    )
    .join('\n\n')
  return `Yesterday — ${humanDate}\n\nLook what you did.\n\n${winText}\n\nFrom your Win Calendar.`
}

function formatHumanDate(isoDate: string): string {
  const [yearStr, monthStr, dayStr] = isoDate.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const monthName = monthNames[month - 1] ?? monthStr
  return `${monthName} ${day}, ${year}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function scheduleMorningEmail(
  input: ScheduleMorningEmailInput,
): Promise<ScheduleMorningEmailResult> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to `server/.env` (see server/.env.example).',
    )
  }
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  const resend = new Resend(resendKey)
  const subject = `Good morning \u2014 yesterday\u2019s wins`

  // TEST MODE: no scheduledAt — sends immediately.
  const response = await resend.emails.send({
    from,
    to: input.to,
    subject,
    html: renderEmailHtml(input.winsDateISO, input.wins),
    text: renderEmailText(input.winsDateISO, input.wins),
  })

  if (response.error) {
    throw new Error(`Resend error: ${response.error.message}`)
  }
  const id = response.data?.id
  if (!id) {
    throw new Error('Resend returned no email id.')
  }
  return { emailId: id }
}
