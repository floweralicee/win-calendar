import { Hono } from 'hono'
import {
  readConfig,
  writeConfig,
  toPublicConfig,
  validateObsidianPath,
  type StoredConfig,
} from '../config-store.ts'
import { ensureVaultLayout } from '../obsidian.ts'

const onboarding = new Hono()

onboarding.get('/api/config', async (c) => {
  const config = await readConfig()
  return c.json(toPublicConfig(config))
})

onboarding.post('/api/config', async (c) => {
  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Body must be JSON.' }, 400)
  }

  const obsidianPath = typeof body.obsidianPath === 'string' ? body.obsidianPath.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : ''
  const revealHourRaw = body.revealHour
  const revealHour =
    typeof revealHourRaw === 'number' && revealHourRaw >= 0 && revealHourRaw <= 23
      ? Math.floor(revealHourRaw)
      : 7

  if (!obsidianPath) return c.json({ error: 'Obsidian path is required.' }, 400)
  if (!email || !email.includes('@')) return c.json({ error: 'A valid email is required.' }, 400)
  if (!timezone) return c.json({ error: 'Timezone is required.' }, 400)

  const validation = await validateObsidianPath(obsidianPath)
  if (!validation.ok) {
    return c.json({ error: `Obsidian path invalid: ${validation.reason}` }, 400)
  }

  const stored: StoredConfig = {
    obsidianPath,
    email,
    timezone,
    revealHour,
  }
  await writeConfig(stored)
  await ensureVaultLayout(obsidianPath)

  return c.json(toPublicConfig(stored))
})

export default onboarding
