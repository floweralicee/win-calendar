import { Hono } from 'hono'
import { generateText, createGateway } from 'ai'
import { REFRAME_SYSTEM_PROMPT } from '../prompts.ts'

type ReframeResult = {
  reframed: string
  durationMins: number
}

function isReframeResult(value: unknown): value is ReframeResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.reframed === 'string' &&
    typeof candidate.durationMins === 'number'
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

const reframe = new Hono()

reframe.post('/api/reframe', async (c) => {
  let body: { task?: unknown }
  try {
    body = await c.req.json<{ task?: unknown }>()
  } catch {
    return c.json({ error: 'Request body must be JSON.' }, 400)
  }

  const task = typeof body.task === 'string' ? body.task.trim() : ''
  if (!task) {
    return c.json({ error: '`task` is required and must be a non-empty string.' }, 400)
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return c.json(
      { error: 'AI_GATEWAY_API_KEY is not set. Add it to server/.env.' },
      500,
    )
  }

  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  let responseText: string
  try {
    const result = await generateText({
      model: gateway('anthropic/claude-haiku-4.5'),
      system: REFRAME_SYSTEM_PROMPT,
      prompt: task,
    })
    responseText = result.text ?? ''
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AI error'
    return c.json({ error: `AI call failed: ${message}` }, 502)
  }

  const jsonChunk = extractJsonObject(responseText)
  if (!jsonChunk) {
    return c.json({ error: 'AI response did not contain a JSON object.' }, 502)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonChunk)
  } catch {
    return c.json({ error: 'AI response was not valid JSON.' }, 502)
  }

  if (!isReframeResult(parsed)) {
    return c.json({ error: 'AI response missing `reframed` or `durationMins`.' }, 502)
  }

  return c.json({
    reframed: parsed.reframed.trim(),
    durationMins: Math.max(1, Math.round(parsed.durationMins)),
  })
})

export default reframe
