import { Hono } from 'hono'
import { readFile } from 'fs/promises'
import path from 'path'
import { readConfig } from '../config-store.js'
import { parseGameState, defaultGameState } from '../game-state-parser.js'

const island = new Hono()

island.get('/game-state', async (c) => {
  try {
    const config = readConfig()
    const gameStatePath = path.join(config.obsidianPath, '06_WINS', '_game-state.md')
    let markdown: string
    try {
      markdown = await readFile(gameStatePath, 'utf-8')
    } catch {
      return c.json(defaultGameState())
    }
    return c.json(parseGameState(markdown))
  } catch (err) {
    console.error('[island/game-state]', err)
    return c.json(defaultGameState())
  }
})

island.get('/profile', async (c) => {
  try {
    const config = readConfig()
    const vaultPath = config.obsidianPath

    // Prefer truth-mirror-profile (clean, structured for UI) → fall back to full OS files
    let osContent = ''
    for (const p of [
      path.join(vaultPath, '000_IMPORTANT', 'truth-mirror-profile', 'os.md'),
      path.join(vaultPath, 'truth-mirror-profile', 'os.md'),
      path.join(vaultPath, '000_IMPORTANT', 'alice_os_v4.md'),
    ]) {
      try { osContent = await readFile(p, 'utf-8'); break } catch { /* continue */ }
    }

    let intelContent = ''
    for (const p of [
      path.join(vaultPath, '000_IMPORTANT', 'truth-mirror-profile', 'intelligence.md'),
      path.join(vaultPath, 'truth-mirror-profile', 'intelligence.md'),
      path.join(vaultPath, '000_IMPORTANT', 'intelligence_profile.md'),
    ]) {
      try { intelContent = await readFile(p, 'utf-8'); break } catch { /* continue */ }
    }

    // ── Name ─────────────────────────────────────────────────────────────────
    let name = 'Alice'
    const nameSimple = osContent.match(/^name:\s*(.+)$/m)           // 'name: Alice Chen'
    const nameCJK    = osContent.match(/姓名\s+([^\n|]+)/)           // CJK table row
    if (nameSimple)   name = nameSimple[1].trim()
    else if (nameCJK) name = nameCJK[1].trim()

    // ── Tagline ───────────────────────────────────────────────────────────────
    let tagline = 'Animator → Builder → Creator'
    const taglineSimple = osContent.match(/^tagline:\s*(.+)$/m)
    const taglineCJK    = osContent.match(/现职业\s+([^\n|]+)/)
    if (taglineSimple)   tagline = taglineSimple[1].trim()
    else if (taglineCJK) tagline = taglineCJK[1].trim().replace(/\s+/g, ' ')

    // ── Operating mode ────────────────────────────────────────────────────────
    let operatingMode = "Clarity-driven — needs a clear map to move. Once clarity appears, can't stop."
    // Simple os.md: paragraph after '## Core:' heading
    const coreMatch   = osContent.match(/## Core[^\n]*\n+(.+?)(?:\n\n|\n##)/s)
    // Full alice_os_v4: blockquote after Clarity 驱动型 heading
    const clarityZhMatch = osContent.match(/Clarity\s*驱动型[^>]*\n+>\s*(.+?)(?:\n\n|\n>)/s)
    if (coreMatch)      operatingMode = coreMatch[1].replace(/\n/g, ' ').trim().slice(0, 200)
    else if (clarityZhMatch) operatingMode = clarityZhMatch[1].replace(/>\s*/g, '').trim().split('\n').slice(0, 2).join(' ')

    // ── Peak window ───────────────────────────────────────────────────────────
    let peakWindow = '7–11am'
    // Simple os.md: line starting with '7–11am:' or '7-11am'
    const peakSimple = osContent.match(/^7[–\-]11am/m)
    const peakLabel  = osContent.match(/^Peak window[^\n]*\n+([^\n]+)/im)
    if (peakSimple) peakWindow = '7–11am'
    else if (peakLabel) peakWindow = peakLabel[1].replace(/^[\d–\-am:\s]+/, '').trim() || '7–11am'

    // ── Fuel ──────────────────────────────────────────────────────────────────
    let fuel = 'Small wins · Seeing the data · Social feedback'
    // Simple os.md: bullet list after '## Fuel' heading
    const fuelSection = osContent.match(/## Fuel[^\n]*\n+([\s\S]+?)(?:\n##|$)/i)
    const fuelCJK     = osContent.match(/Clarity 的三个来源[\s\S]*?\| \*\*(.+?)\*\*[\s\S]*?\| \*\*(.+?)\*\*[\s\S]*?\| \*\*(.+?)\*\*/)
    if (fuelSection) {
      const items = fuelSection[1].split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(l => l && !l.startsWith('#'))
        .slice(0, 3)
      if (items.length) fuel = items.join(' · ')
    } else if (fuelCJK) {
      fuel = [fuelCJK[1], fuelCJK[2], fuelCJK[3]].join(' · ')
    }

    // ── Strengths ─────────────────────────────────────────────────────────────
    type Strength = { strength: string; expression: string }
    const strengths: Strength[] = []
    const strengthsSection = intelContent.match(/## Strengths Summary([\s\S]+?)(?:\n##|$)/)
    if (strengthsSection) {
      const rows = strengthsSection[1].matchAll(/\|\s*(.+?)\s*\|\s*(.+?)\s*\|/g)
      for (const row of rows) {
        const s = row[1].trim()
        const e = row[2].trim()
        if (s && !s.startsWith('-') && s !== 'Strength' && s !== '---') {
          strengths.push({ strength: s, expression: e })
        }
      }
    }

    return c.json({ name, tagline, operatingMode, peakWindow, fuel, strengths })
  } catch (err) {
    console.error('[island/profile]', err)
    return c.json({
      name: 'Alice',
      tagline: 'Animator → Builder → Creator',
      operatingMode: 'Clarity-driven — needs a clear map to move.',
      peakWindow: '7–11am',
      fuel: 'Small wins · Seeing the data · Social feedback',
      strengths: [],
    })
  }
})

export { island }
