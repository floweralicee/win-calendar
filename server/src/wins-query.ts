import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readConfig } from './config-store.ts'
import { getRevealAtMap, readTimeline } from './obsidian.ts'
import { parseTimelineMarkdown, type WinsByDate } from './timeline-parser.ts'

function winCalendarRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
}

export async function readVisibleWinsByDate(now: Date = new Date()): Promise<WinsByDate> {
  const config = await readConfig()
  const demoTimelineEnv = process.env.WIN_CALENDAR_DEMO_TIMELINE?.trim()

  let timelineSource: string
  let revealAtMap: Record<string, string>

  if (demoTimelineEnv) {
    const resolved = path.isAbsolute(demoTimelineEnv)
      ? demoTimelineEnv
      : path.resolve(winCalendarRepoRoot(), demoTimelineEnv)
    timelineSource = await readFile(resolved, 'utf8')
    revealAtMap = config ? await getRevealAtMap(config.obsidianPath) : {}
  } else {
    if (!config) return {}
    const [fromVault, fromState] = await Promise.all([
      readTimeline(config.obsidianPath),
      getRevealAtMap(config.obsidianPath),
    ])
    timelineSource = fromVault
    revealAtMap = fromState
  }

  const allWinsByDate = parseTimelineMarkdown(timelineSource)
  const nowTime = now.getTime()
  const visible: WinsByDate = {}

  for (const [date, winsForDate] of Object.entries(allWinsByDate)) {
    const kept = winsForDate.filter((win) => {
      const revealAt = revealAtMap[win.id]
      if (!revealAt) return true
      return Date.parse(revealAt) <= nowTime
    })
    if (kept.length > 0) visible[date] = kept
  }

  return visible
}
