import { promises as fs, constants as fsConstants } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CONFIG_DIR = path.join(os.homedir(), '.win-calendar')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

/**
 * Per-user config stored on disk. Intentionally does NOT hold API keys — those
 * are operator-owned and live in `server/.env` (loaded into process.env at
 * bootstrap). See `server/.env.example` for the keys this server expects.
 */
export type StoredConfig = {
  obsidianPath: string
  email: string
  timezone: string
  revealHour: number
}

export type PublicConfig = {
  onboarded: boolean
  obsidianPath?: string
  email?: string
  timezone?: string
  revealHour?: number
}

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
}

export async function readConfig(): Promise<StoredConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoredConfig>
    if (
      typeof parsed.obsidianPath !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.timezone !== 'string'
    ) {
      return null
    }
    return {
      obsidianPath: parsed.obsidianPath,
      email: parsed.email,
      timezone: parsed.timezone,
      revealHour: typeof parsed.revealHour === 'number' ? parsed.revealHour : 7,
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function writeConfig(config: StoredConfig): Promise<void> {
  await ensureConfigDir()
  const json = JSON.stringify(config, null, 2)
  await fs.writeFile(CONFIG_PATH, json, { mode: 0o600 })
  await fs.chmod(CONFIG_PATH, 0o600)
}

export function toPublicConfig(config: StoredConfig | null): PublicConfig {
  if (!config) return { onboarded: false }
  return {
    onboarded: true,
    obsidianPath: config.obsidianPath,
    email: config.email,
    timezone: config.timezone,
    revealHour: config.revealHour,
  }
}

export async function validateObsidianPath(candidate: string): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  try {
    const stat = await fs.stat(candidate)
    if (!stat.isDirectory()) return { ok: false, reason: 'Not a directory' }
    await fs.access(candidate, fsConstants.W_OK)
    return { ok: true }
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return { ok: false, reason: 'Folder does not exist' }
    if (err.code === 'EACCES') return { ok: false, reason: 'Folder is not writable' }
    return { ok: false, reason: err.message ?? 'Unknown error' }
  }
}
