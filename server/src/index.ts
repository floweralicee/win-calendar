import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import onboarding from './routes/onboarding.ts'
import journal from './routes/journal.ts'
import wins from './routes/wins.ts'
import goals from './routes/goals.ts'
import dashboard from './routes/dashboard.ts'
import map from './routes/map.ts'

// Load operator-owned secrets from `server/.env` before any route handler runs.
// Keys live there, never in the codebase or per-user config. Route modules only
// read process.env inside handlers, so loading here (after imports, before serve)
// is sufficient.
const here = path.dirname(fileURLToPath(import.meta.url))
const repoRootEnvPath = path.resolve(here, '../../.env')
const serverEnvPath = path.resolve(here, '../.env')
// Root `.env` is optional (e.g. `WIN_CALENDAR_DEMO_TIMELINE`); `server/.env` wins on conflicts.
loadDotenv({ path: repoRootEnvPath })
loadDotenv({ path: serverEnvPath, override: true })

const app = new Hono()

app.use('*', cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/', onboarding)
app.route('/', journal)
app.route('/', wins)
app.route('/', goals)
app.route('/', dashboard)
app.route('/', map)

const port = Number(process.env.PORT ?? 8787)

serve({
  fetch: app.fetch,
  port,
  hostname: '127.0.0.1',
})

console.log(`[win-calendar/server] listening on http://127.0.0.1:${port}`)
if (process.env.WIN_CALENDAR_DEMO_TIMELINE?.trim()) {
  console.log(
    `[win-calendar/server] Demo timeline: ${process.env.WIN_CALENDAR_DEMO_TIMELINE.trim()} (resolved from repo root)`,
  )
}

if (!process.env.AI_GATEWAY_API_KEY) {
  console.warn('[win-calendar/server] AI_GATEWAY_API_KEY is not set — /api/journal will fail.')
}
if (!process.env.RESEND_API_KEY) {
  console.warn('[win-calendar/server] RESEND_API_KEY is not set — morning emails will not send.')
}
