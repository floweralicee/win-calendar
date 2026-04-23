import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import onboarding from './routes/onboarding.ts'
import journal from './routes/journal.ts'
import wins from './routes/wins.ts'

// Load operator-owned secrets from `server/.env` before any route handler runs.
// Keys live there, never in the codebase or per-user config. Route modules only
// read process.env inside handlers, so loading here (after imports, before serve)
// is sufficient.
const here = path.dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: path.resolve(here, '../.env') })

const app = new Hono()

app.use('*', cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/', onboarding)
app.route('/', journal)
app.route('/', wins)

const port = Number(process.env.PORT ?? 8787)

serve({
  fetch: app.fetch,
  port,
  hostname: '127.0.0.1',
})

console.log(`[win-calendar/server] listening on http://127.0.0.1:${port}`)

if (!process.env.AI_GATEWAY_API_KEY) {
  console.warn('[win-calendar/server] AI_GATEWAY_API_KEY is not set — /api/journal will fail.')
}
if (!process.env.RESEND_API_KEY) {
  console.warn('[win-calendar/server] RESEND_API_KEY is not set — morning emails will not send.')
}
