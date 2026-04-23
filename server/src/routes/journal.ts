import { Hono } from 'hono'
import { readConfig } from '../config-store.ts'
import {
  appendJournalEntry,
  appendWinsToTimeline,
  recordWinState,
  type PersistedWin,
} from '../obsidian.ts'
import { extractWinsFromJournal } from '../claude.ts'
import { scheduleMorningEmail } from '../resend.ts'

const journal = new Hono()

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

journal.post('/api/journal', async (c) => {
  const config = await readConfig()
  if (!config) {
    return c.json({ error: 'Not onboarded yet.' }, 400)
  }

  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Body must be JSON.' }, 400)
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const dateISO = typeof body.dateISO === 'string' ? body.dateISO.trim() : ''
  if (!text) return c.json({ error: 'Journal text cannot be empty.' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return c.json({ error: 'dateISO must be YYYY-MM-DD.' }, 400)
  }

  await appendJournalEntry(config.obsidianPath, dateISO, text)

  let extracted
  try {
    extracted = await extractWinsFromJournal({
      journalText: text,
      todayISO: dateISO,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error calling AI Gateway.'
    return c.json({ error: `Win extraction failed: ${message}` }, 502)
  }

  if (extracted.length === 0) {
    return c.json({
      ok: true,
      winsCount: 0,
      message:
        "Nothing was obviously a win tonight. That is also a life. Rest well.",
    })
  }

  // TEST MODE: reveal wins immediately so they show on the calendar right away.
  const revealAt = new Date().toISOString()

  const persisted: PersistedWin[] = extracted.map((win) => ({
    id: `${win.date}-${slugify(win.title)}`,
    date: win.date,
    title: win.title,
    whatHappened: win.whatHappened,
    lifeImpact: win.lifeImpact,
    whyItMatters: win.whyItMatters,
    revealAt,
  }))

  await appendWinsToTimeline(config.obsidianPath, persisted)

  let scheduledEmailId: string | undefined
  try {
    const result = await scheduleMorningEmail({
      to: config.email,
      winsDateISO: dateISO,
      wins: persisted,
    })
    scheduledEmailId = result.emailId
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown email error.'
    console.warn('[journal] Resend schedule failed:', message)
  }

  const persistedWithEmail = persisted.map((win) => ({ ...win, scheduledEmailId }))
  await recordWinState(config.obsidianPath, persistedWithEmail)

  return c.json({
    ok: true,
    winsCount: persisted.length,
    message: 'Great job, you have achieved so much today. Now go to sleep.',
  })
})

export default journal
