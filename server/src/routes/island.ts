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

    // Try to read OS file
    let osContent = ''
    for (const p of [
      path.join(vaultPath, '000_IMPORTANT', 'alice_os_v4.md'),
      path.join(vaultPath, 'truth-mirror-profile', 'os.md'),
    ]) {
      try { osContent = await readFile(p, 'utf-8'); break } catch { /* continue */ }
    }

    // Try to read intelligence profile
    let intelContent = ''
    for (const p of [
      path.join(vaultPath, '000_IMPORTANT', 'intelligence_profile.md'),
      path.join(vaultPath, 'truth-mirror-profile', 'intelligence.md'),
    ]) {
      try { intelContent = await readFile(p, 'utf-8'); break } catch { /* continue */ }
    }

    // Extract name from 姓名 table row
    let name = 'Alice'
    const nameMatch = osContent.match(/姓名\s+([^\n|]+)/)
    if (nameMatch) name = nameMatch[1].trim()

    // Extract tagline from 职业 row
    let tagline = 'Builder · Creator'
    const taglineMatch = osContent.match(/现职业\s+([^\n|]+)/)
    if (taglineMatch) tagline = taglineMatch[1].trim().replace(/\s+/g, ' ')
    if (!taglineMatch) tagline = 'Animator → Builder → Creator'

    // Extract operating mode — paragraph after Clarity 驱动型 heading
    let operatingMode = ''
    const clarityMatch = osContent.match(/Clarity\s*驱动型[^>]*\n+>\s*(.+?)(?:\n\n|\n>)/s)
    if (clarityMatch) {
      operatingMode = clarityMatch[1].replace(/>\s*/g, '').trim().split('\n').slice(0, 2).join(' ')
    }
    if (!operatingMode) operatingMode = 'Clarity-driven — needs a clear map to move. Once clarity appears, can\'t stop.'

    // Extract peak window from energy table
    let peakWindow = '7–11am'
    const peakMatch = osContent.match(/早上\s*7[^|]+\|\s*([^|]+)\|/)
    if (peakMatch) peakWindow = '7–11am'

    // Extract fuel — the 3 Clarity sources
    let fuel = 'Small wins · Seeing the data · Social feedback'
    const fuelMatch = osContent.match(/Clarity 的三个来源[\s\S]*?\| \*\*(.+?)\*\*[\s\S]*?\| \*\*(.+?)\*\*[\s\S]*?\| \*\*(.+?)\*\*/)
    if (fuelMatch) fuel = [fuelMatch[1], fuelMatch[2], fuelMatch[3]].join(' · ')

    // Extract strengths table from intelligence profile
    type Strength = { strength: string; expression: string }
    const strengths: Strength[] = []
    const strengthsSection = intelContent.match(/## Strengths Summary([\s\S]+?)(?:\n##|$)/)
    if (strengthsSection) {
      const rows = strengthsSection[1].matchAll(/\|\s*(.+?)\s*\|\s*(.+?)\s*\|/g)
      for (const row of rows) {
        const s = row[1].trim()
        const e = row[2].trim()
        if (s && s !== 'Strength' && s !== '---' && s !== '---|') {
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
