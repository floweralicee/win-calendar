export type VillagerStatus = 'active' | 'quiet' | 'dormant'

export type Villager = {
  emoji: string
  name: string
  status: VillagerStatus
  detail: string
}

export type GameState = {
  tokens: number
  streak: number
  activeQuest: string | null
  weeklyQuest: string | null
  weeklyQuestProgress: { current: number; total: number } | null
  activeArc: string | null
  arcProgress: { current: number; total: number; label: string } | null
  arcDay: number | null
  villagers: Villager[]
  lastUpdated: string | null
}

export function defaultGameState(): GameState {
  return {
    tokens: 0,
    streak: 0,
    activeQuest: null,
    weeklyQuest: null,
    weeklyQuestProgress: null,
    activeArc: null,
    arcProgress: null,
    arcDay: null,
    villagers: [],
    lastUpdated: null,
  }
}

export function parseGameState(markdown: string): GameState {
  const state = defaultGameState()

  // Last updated date from header
  const headerMatch = markdown.match(/\[GAME STATE\s*[—–-]\s*(.+?)\]/)
  if (headerMatch) state.lastUpdated = headerMatch[1].trim()

  // Clarity Tokens
  const tokensMatch = markdown.match(/Clarity Tokens:\s*(\d+)/)
  if (tokensMatch) state.tokens = parseInt(tokensMatch[1], 10)

  // Streak
  const streakMatch = markdown.match(/Current streak:\s*(\d+)\s*days?/i)
  if (streakMatch) state.streak = parseInt(streakMatch[1], 10)

  // Active quest — strip trailing [started ...] annotation
  const questMatch = markdown.match(/Active quest:\s*(.+?)(?:\s*\[started[^\]]*\])?\s*$/m)
  if (questMatch) state.activeQuest = questMatch[1].trim() || null

  // Weekly quest — strip trailing [N/M days] annotation, parse progress
  const weeklyMatch = markdown.match(/Weekly quest:\s*(.+?)(?:\s*\[(\d+)\/(\d+)\s*days?\])?\s*$/m)
  if (weeklyMatch) {
    state.weeklyQuest = weeklyMatch[1].trim() || null
    if (weeklyMatch[2] && weeklyMatch[3]) {
      state.weeklyQuestProgress = {
        current: parseInt(weeklyMatch[2], 10),
        total: parseInt(weeklyMatch[3], 10),
      }
    }
  }

  // Active arc — "Name — Day N — $X/$Y" or similar
  const arcMatch = markdown.match(/Active arc:\s*(.+?)\s*[—–-]\s*Day\s*(\d+)\s*[—–-]\s*(.+?)\s*$/m)
  if (arcMatch) {
    state.activeArc = arcMatch[1].trim()
    state.arcDay = parseInt(arcMatch[2], 10)
    // Parse progress from "X/Y" pattern — handles $3.5K/$5K, 70%, plain numbers
    const progressStr = arcMatch[3].trim()
    const numericProgress = progressStr.match(/([\d.]+[KkMm%]?)\s*\/\s*([\d.]+[KkMm%]?)/)
    if (numericProgress) {
      const parseVal = (s: string): number => {
        const n = parseFloat(s)
        if (/[Kk]/.test(s)) return n * 1000
        if (/[Mm]/.test(s)) return n * 1000000
        return n
      }
      state.arcProgress = {
        current: parseVal(numericProgress[1]),
        total: parseVal(numericProgress[2]),
        label: progressStr,
      }
    }
  } else {
    // Try simpler arc format without Day N
    const simpleArcMatch = markdown.match(/Active arc:\s*(.+?)\s*$/m)
    if (simpleArcMatch && simpleArcMatch[1].trim() !== 'none') {
      state.activeArc = simpleArcMatch[1].trim()
    }
  }

  // Villagers — lines like: "  🦊 The Perfectionist: active (seen 3x this week)"
  const villagersSection = markdown.match(/Villagers[^:]*:([\s\S]*?)(?:\n\n|\n##|$)/i)
  if (villagersSection) {
    const lines = villagersSection[1].split('\n')
    for (const line of lines) {
      // Match: optional whitespace, emoji, name, colon, status, optional (detail)
      const m = line.match(/^\s*([\p{Emoji_Presentation}\p{Extended_Pictographic}]+)\s+(.+?):\s*(active|quiet|dormant)(?:\s*\(([^)]+)\))?/u)
      if (m) {
        state.villagers.push({
          emoji: m[1].trim(),
          name: m[2].trim(),
          status: m[3] as VillagerStatus,
          detail: m[4]?.trim() ?? '',
        })
      }
    }
  }

  return state
}
