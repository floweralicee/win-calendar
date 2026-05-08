import { Hono } from 'hono'
import { readFile } from 'fs/promises'
import path from 'path'
import { readConfig } from '../config-store.js'
import { parseGameState, defaultGameState } from '../game-state-parser.js'

const island = new Hono()

function repoAnimalCrossingPath(filename: string): string {
  return path.join(process.cwd(), 'animal-crossing', filename)
}

async function readGameStateMarkdown(): Promise<string | null> {
  try {
    const config = await readConfig()
    if (!config) {
      try {
        return await readFile(repoAnimalCrossingPath('_game-state.md'), 'utf-8')
      } catch {
        return null
      }
    }
    const vaultGamePath = path.join(config.obsidianPath, '06_WINS', '_game-state.md')
    return await readFile(vaultGamePath, 'utf-8')
  } catch {
    try {
      return await readFile(repoAnimalCrossingPath('_game-state.md'), 'utf-8')
    } catch {
      return null
    }
  }
}

island.get('/game-state', async (c) => {
  try {
    const markdown = await readGameStateMarkdown()
    if (!markdown) return c.json(defaultGameState())
    return c.json(parseGameState(markdown))
  } catch (err) {
    console.error('[island/game-state]', err)
    return c.json(defaultGameState())
  }
})

type Strength = { strength: string; expression: string }

function parseStrengthsFromIntel(intelContent: string): Strength[] {
  const strengths: Strength[] = []
  const strengthsSection = intelContent.match(/## Strengths Summary([\s\S]+?)(?:\n##|$)/)
  if (!strengthsSection) return strengths
  const rows = strengthsSection[1].matchAll(/\|\s*(.+?)\s*\|\s*(.+?)\s*\|/g)
  for (const row of rows) {
    const strengthCell = row[1].trim()
    const expressionCell = row[2].trim()
    if (
      strengthCell &&
      strengthCell !== 'Strength' &&
      !strengthCell.startsWith('---')
    ) {
      strengths.push({ strength: strengthCell, expression: expressionCell })
    }
  }
  return strengths
}

function parseChineseOs(osContent: string): {
  name: string
  tagline: string
  operatingMode: string
  peakWindow: string
  fuel: string
} {
  let name = 'Alice'
  const nameMatch = osContent.match(/姓名\s+([^\n|]+)/)
  if (nameMatch) name = nameMatch[1].trim()

  let tagline = 'Animator → Builder → Creator'
  const taglineMatch = osContent.match(/现职业\s+([^\n|]+)/)
  if (taglineMatch) tagline = taglineMatch[1].trim().replace(/\s+/g, ' ')

  let operatingMode = ''
  const clarityMatch = osContent.match(/Clarity\s*驱动型[^>]*\n+>\s*(.+?)(?:\n\n|\n>)/s)
  if (clarityMatch) {
    operatingMode = clarityMatch[1]
      .replace(/>\s*/g, '')
      .trim()
      .split('\n')
      .slice(0, 2)
      .join(' ')
  }
  if (!operatingMode) {
    operatingMode =
      "Clarity-driven — needs a clear map to move. Once clarity appears, can't stop."
  }

  let peakWindow = '7–11am'
  const peakMatch = osContent.match(/早上\s*7[^|]+\|\s*([^|]+)\|/)
  if (peakMatch) peakWindow = '7–11am'

  let fuel = 'Small wins · Seeing the data · Social feedback'
  const fuelMatch = osContent.match(
    /Clarity 的三个来源[\s\S]*?\| \*\*(.+?)\*\*[\s\S]*?\| \*\*(.+?)\*\*[\s\S]*?\| \*\*(.+?)\*\*/,
  )
  if (fuelMatch) fuel = [fuelMatch[1], fuelMatch[2], fuelMatch[3]].join(' · ')

  return { name, tagline, operatingMode, peakWindow, fuel }
}

function parseEnglishOs(osContent: string): {
  name: string
  tagline: string
  operatingMode: string
  peakWindow: string
  fuel: string
} {
  const name = osContent.match(/^name:\s*(.+)$/im)?.[1]?.trim() ?? 'Alice Chen'
  const tagline =
    osContent.match(/^tagline:\s*(.+)$/im)?.[1]?.trim() ?? 'Animator → Builder → Creator'

  const coreMatch = osContent.match(/^## Core[^\n]*\n+([\s\S]+?)(?=\n## |\n*$)/im)
  let operatingMode = ''
  if (coreMatch) {
    const firstBlock = coreMatch[1].split(/\n\n+/)[0] ?? ''
    operatingMode = firstBlock
      .replace(/^>\s*/gm, '')
      .replace(/\n+/g, ' ')
      .trim()
  }
  if (!operatingMode) {
    operatingMode =
      "Clarity-driven — needs a clear map to move. Once clarity appears, can't stop."
  }

  const peakMatch = osContent.match(/^## Peak window\s*\n+([\s\S]+?)(?=\n## |\n*$)/im)
  let peakWindow = '7–11am'
  if (peakMatch) {
    const firstLine =
      peakMatch[1]
        .trim()
        .split('\n')
        .find((line) => line.trim().length > 0) ?? ''
    peakWindow = firstLine.replace(/^[-*]\s*/, '').slice(0, 140)
  }

  const fuelMatch = osContent.match(/^## Fuel[^\n]*\n+([\s\S]+?)(?=\n## |\n*$)/im)
  let fuel = 'Small wins · Seeing the data · Social feedback'
  if (fuelMatch) {
    const lines = fuelMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const bullets = lines
      .filter((line) => /^[-*]/.test(line))
      .map((line) => line.replace(/^[-*]\s*/, ''))
    if (bullets.length > 0) fuel = bullets.join(' · ')
  }

  return { name, tagline, operatingMode, peakWindow, fuel }
}

async function readFirstExisting(paths: string[]): Promise<string> {
  let lastError: unknown
  for (const filePath of paths) {
    try {
      return await readFile(filePath, 'utf-8')
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('No readable path')
}

island.get('/profile', async (c) => {
  try {
    const config = await readConfig()

    const vaultOsPaths = config
      ? [
          path.join(config.obsidianPath, '000_IMPORTANT', 'truth-mirror-profile', 'os.md'),
          path.join(config.obsidianPath, 'truth-mirror-profile', 'os.md'),
          path.join(config.obsidianPath, '000_IMPORTANT', 'alice_os_v4.md'),
        ]
      : []

    const vaultIntelPaths = config
      ? [
          path.join(config.obsidianPath, '000_IMPORTANT', 'truth-mirror-profile', 'intelligence.md'),
          path.join(config.obsidianPath, 'truth-mirror-profile', 'intelligence.md'),
          path.join(config.obsidianPath, '000_IMPORTANT', 'intelligence_profile.md'),
        ]
      : []

    const repoOsPaths = [
      path.join(process.cwd(), 'animal-crossing', 'truth-mirror-profile', 'os.md'),
      repoAnimalCrossingPath('os.md'),
    ]

    const repoIntelPaths = [
      path.join(process.cwd(), 'animal-crossing', 'truth-mirror-profile', 'intelligence.md'),
      repoAnimalCrossingPath('intelligence.md'),
    ]

    let osContent = ''
    try {
      osContent = await readFirstExisting([...vaultOsPaths, ...repoOsPaths])
    } catch {
      osContent = ''
    }

    let intelContent = ''
    try {
      intelContent = await readFirstExisting([...vaultIntelPaths, ...repoIntelPaths])
    } catch {
      intelContent = ''
    }

    const chineseOs = /姓名/.test(osContent)
    const parsedOs = chineseOs ? parseChineseOs(osContent) : parseEnglishOs(osContent)

    const strengths = parseStrengthsFromIntel(intelContent)

    return c.json({
      ...parsedOs,
      strengths,
    })
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
