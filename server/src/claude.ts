import { generateText, createGateway } from 'ai'
import { WINS_EXTRACTION_SYSTEM_PROMPT } from './prompts.ts'

export type ExtractedWin = {
  date: string
  title: string
  whatHappened: string
  lifeImpact: string
  whyItMatters: string
}

export type ExtractWinsInput = {
  journalText: string
  /** ISO YYYY-MM-DD used as the default date when the model doesn't find one. */
  todayISO: string
}

// Vercel AI Gateway model slug. No per-user key — this is the operator's key,
// shared by every user of the app.
const MODEL_SLUG = 'anthropic/claude-haiku-4.5'

function isExtractedWin(value: unknown): value is ExtractedWin {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.date === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.whatHappened === 'string' &&
    typeof candidate.lifeImpact === 'string' &&
    typeof candidate.whyItMatters === 'string'
  )
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fencedMatch) return fencedMatch[1].trim()
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null
  return trimmed.slice(firstBrace, lastBrace + 1)
}

export async function extractWinsFromJournal(
  input: ExtractWinsInput,
): Promise<ExtractedWin[]> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error(
      'AI_GATEWAY_API_KEY is not set. Add it to `server/.env` (see server/.env.example).',
    )
  }

  const userMessage =
    `Today is ${input.todayISO}.\n\n` +
    'Journal entry:\n' +
    '"""\n' +
    input.journalText.trim() +
    '\n"""'

  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  const result = await generateText({
    model: gateway(MODEL_SLUG),
    system: WINS_EXTRACTION_SYSTEM_PROMPT,
    prompt: userMessage,
  })

  const responseText = result.text ?? ''
  if (!responseText.trim()) {
    throw new Error('AI Gateway returned an empty response.')
  }

  const jsonChunk = extractJsonObject(responseText)
  if (!jsonChunk) {
    throw new Error('AI Gateway response did not contain a JSON object.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonChunk)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    throw new Error(`AI Gateway response was not valid JSON: ${message}`)
  }

  if (!parsed || typeof parsed !== 'object' || !('wins' in parsed)) {
    throw new Error('AI Gateway response missing `wins` array.')
  }

  const winsUnknown = (parsed as { wins: unknown }).wins
  if (!Array.isArray(winsUnknown)) {
    throw new Error('AI Gateway response `wins` is not an array.')
  }

  const wins: ExtractedWin[] = []
  for (const candidate of winsUnknown) {
    if (isExtractedWin(candidate)) {
      wins.push({
        date: candidate.date,
        title: candidate.title.trim(),
        whatHappened: candidate.whatHappened.trim(),
        lifeImpact: candidate.lifeImpact.trim(),
        whyItMatters: candidate.whyItMatters.trim(),
      })
    }
  }

  return wins
}
