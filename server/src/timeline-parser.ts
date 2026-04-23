// Mirror of `src/wins.ts`'s parser so the Hono server can run it under
// node/tsx without crossing the vite<->node tsconfig boundary. Keep this
// file in lockstep with `src/wins.ts`; the parsing contract is shared.

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

export type Win = {
  date: string
  title: string
  body: string
  id: string
  spansRange: boolean
}

export type WinsByDate = Record<string, Win[]>

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function enumerateDatesInRange(
  year: number,
  monthIndex: number,
  startDay: number,
  endDay: number,
): string[] {
  const dates: string[] = []
  for (let day = startDay; day <= endDay; day++) {
    dates.push(toIsoDate(year, monthIndex, day))
  }
  return dates
}

function parseHeadingDates(headingDatePart: string): string[] | null {
  const cleaned = headingDatePart.replace(/^Week of\s+/i, '').trim()
  const match = cleaned.match(
    /^([A-Za-z]+)\s+(\d{1,2})(?:\s*[–—-]\s*(\d{1,2}))?\s*,\s*(\d{4})$/,
  )
  if (!match) return null
  const [, monthWord, startStr, endStr, yearStr] = match
  const monthIndex = MONTH_NAME_TO_INDEX[monthWord.toLowerCase()]
  if (monthIndex === undefined) return null
  const year = Number(yearStr)
  const startDay = Number(startStr)
  const endDay = endStr === undefined ? startDay : Number(endStr)
  if (Number.isNaN(year) || Number.isNaN(startDay) || Number.isNaN(endDay)) return null
  if (endDay < startDay) return null
  return enumerateDatesInRange(year, monthIndex, startDay, endDay)
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function parseTimelineMarkdown(markdown: string): WinsByDate {
  const winsByDate: WinsByDate = {}
  const sections = markdown.split(/^## /m).slice(1)

  for (const rawSection of sections) {
    const newlineIndex = rawSection.indexOf('\n')
    const headingLine = (newlineIndex === -1 ? rawSection : rawSection.slice(0, newlineIndex)).trim()
    const bodyText = newlineIndex === -1 ? '' : rawSection.slice(newlineIndex + 1)

    if (/^summary\b/i.test(headingLine)) break

    const headingParts = headingLine.split(/\s+[—–-]\s+/)
    if (headingParts.length < 2) continue

    const datePart = headingParts[0]
    const titlePart = headingParts.slice(1).join(' — ').trim()
    if (!titlePart) continue

    const dates = parseHeadingDates(datePart)
    if (!dates || dates.length === 0) continue

    const trimmedBody = bodyText
      .replace(/\n?---\s*$/, '')
      .replace(/\s+$/g, '')
      .trim()

    const spansRange = dates.length > 1
    for (const isoDate of dates) {
      const win: Win = {
        date: isoDate,
        title: titlePart,
        body: trimmedBody,
        id: `${isoDate}-${slugify(titlePart)}`,
        spansRange,
      }
      if (!winsByDate[isoDate]) winsByDate[isoDate] = []
      winsByDate[isoDate].push(win)
    }
  }

  return winsByDate
}
