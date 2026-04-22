# Win Calendar — Agent Instructions

<!-- This is the single source of truth for all AI coding agents. CLAUDE.md is a symlink to this file. -->
<!-- AGENTS.md spec: https://github.com/agentsmd/agents.md — supported by Claude Code, Cursor, Copilot, Gemini CLI, and others. -->

## Overview

Win Calendar is a personal monthly calendar that shows Alice's "winning list" — the wins of the day — for every day of the month. The UI is intentionally austere: a printed-paper-style month grid with **nothing else on screen**. No navigation chrome, no sidebars, no toolbars, no theming toggles. The calendar itself is the product.

### Current Phase

- **Phase 1 — Infrastructure** *(done)*: calendar grid, design tokens, Monday-first weeks, empty-cell dots.
- **Phase 2 — Wins rendering** *(in progress)*: parse a timeline markdown file, place entries on the day(s) they cover, render **only the title** inside each day cell, and open a **modal** with the full body when a title is clicked.
- **Phase 3 — Automated ingest** *(not started)*: a scheduled local job that reads Alice's Obsidian journal and writes the wins data the calendar consumes (planning only — do not implement until asked).

## Design Base

The visual philosophy is inspired by [chenglou/pretext](https://github.com/chenglou/pretext) — precise, measured, minimal typography over anything decorative. Rules to uphold:

- **Typography first.** The month title is a letter-spaced wordmark; the year sits on the same baseline with bullet delimiters (`• 2025 •`).
- **Thin rules, no shadows.** 1px hairline rules in a warm neutral (`--rule`) separate cells. No card shadows, no gradients.
- **Off-white paper on a warm gray frame.** The calendar is a white "page" centered on a light gray background, printed-calendar style.
- **No UI other than the grid.** If a new feature needs UI, prefer modifying the grid cell itself (e.g., wins inside the day cell) before adding new surfaces.

Reference image: a minimal monthly calendar with uppercase day labels (MON–SUN), day numbers top-left in each cell, and small open dots marking leading/trailing days outside the current month.

## Architecture

- **Framework**: React 18 + TypeScript, bundled with Vite
- **Rendering**: client-side SPA, single route (the current month)
- **State**: local component state only, no global store yet. The currently-selected win (for the detail modal) is lifted to `App`.
- **Styling**: hand-written CSS with design tokens in `:root` custom properties (no Tailwind, no CSS-in-JS)
- **Week start**: Monday (MON–SUN order)
- **Date math**: native `Date` — first weekday is computed as `(jsWeekday + 6) % 7` to rebase Sunday-first to Monday-first
- **Wins data source**: a markdown timeline file (today: `example/TIMELINE-finance.md`) imported via Vite's `?raw` loader and parsed at runtime into `WinsByDate` (`Record<'YYYY-MM-DD', Win[]>`). When the automated ingest of Phase 3 lands, that pipeline should write **the same data contract** so the UI stays unchanged.

### Key Architecture Decisions

**No framework beyond React + Vite.** We are deliberately avoiding Next.js, React Router, state managers, UI kits, and icon libraries. The calendar is one screen and does not need them. Resist the urge to add any.

**Pure date math, no libraries.** No `date-fns`, `dayjs`, `luxon`, or Temporal polyfills. The logic is ~10 lines of arithmetic in `buildMonthGrid`. Keep it that way unless we need timezone-correct recurrence, at which point introduce Temporal.

**CSS custom properties as the design system.** All colors, fonts, and spacing-relevant tokens live as `--*` variables in `src/styles.css` `:root`. Components reference the tokens, never hard-coded hex values. This is the seed of the future design system and must scale to dark mode / theming without refactors.

**Grid via two nested grids.** The weekday header and the day cells are two separate CSS grids with the same `repeat(7, 1fr)` template so they align visually while staying semantically distinct (`columnheader` vs `gridcell`).

**Empty cells for out-of-month days.** Leading and trailing days (e.g., Mon–Tue before Jan 1, Sat–Sun after Jan 31) render as `kind: 'empty'` cells with a small open dot, not with adjacent-month day numbers. This matches the reference image.

**Timeline parsing is deterministic, not AI-driven.** `src/wins.ts` splits the source markdown on `## ` headings, parses the date portion (`Mon DD, YYYY`, `Mon DD–DD, YYYY`, or `Week of Mon DD–DD, YYYY`), and stops at `## Summary`. Entries that cover a date range are **expanded to one win record per day** so they appear on every day they touched. No model calls at runtime. If the timeline format changes, update the parser rather than shifting work into the UI.

**Dash tolerance.** Timeline headings in the example use an **em dash** `—` (U+2014) between date and title, and en dashes `–` (U+2013) inside date ranges. The parser accepts em dash, en dash, and hyphen in both positions so that hand-written timelines aren't silently dropped. If you edit `src/wins.ts`, preserve this tolerance.

**Titles in cells, body in a modal.** The calendar cell shows **only the win title** (clamped to two lines). Clicking a title opens `WinDetail`, a single modal that renders the full body with lightweight inline markdown (paragraph breaks and `**bold**` spans only — no `dangerouslySetInnerHTML`). This is the one deliberate exception to the "no UI other than the grid" rule: it's triggered by interaction and collapses when dismissed.

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~11 | Vite entry HTML. Single `#root` mount point, no meta chrome beyond viewport + title. |
| `src/main.tsx` | ~11 | React bootstrap. Mounts `<App />` in `StrictMode` and imports `styles.css`. |
| `src/App.tsx` | ~60 | Top-level component. Parses the timeline markdown (memoized), owns `visibleYear` / `visibleMonth` / `selectedWin` state, supplies `goToPreviousMonth` / `goToNextMonth` / `goToToday` callbacks, and wires the ESC keyboard shortcut. |
| `src/Calendar.tsx` | ~140 | Month grid + win titles inside day cells. Owns `buildMonthGrid()`, weekday/month labels, the ‹/› nav chevrons, the clickable month label (jump to today), and the `onSelectWin` callback shape. Does not render win bodies — those live in the modal. |
| `src/WinDetail.tsx` | ~85 | The detail modal opened when a win title is clicked. Renders lightweight inline markdown (paragraphs + `**bold**`). Closes on backdrop click, the × button, or ESC (ESC is handled in `App`). |
| `src/wins.ts` | ~130 | Deterministic timeline-markdown parser. Exports `Win`, `WinsByDate`, and `parseTimelineMarkdown()`. Expands multi-day entries to one record per day. Stops at `## Summary`. |
| `src/vite-env.d.ts` | ~6 | Vite client types + the `*.md?raw` module declaration. |
| `src/styles.css` | ~240 | Design tokens (`:root` custom properties), calendar grid styles, win-title styles, and modal styles. No other stylesheets exist. |
| `example/TIMELINE-finance.md` | — | Example timeline used as the current data source. The canonical format for Phase 3's automated ingest to target. Do not delete without providing a replacement at the same path. |
| `vite.config.ts` | ~9 | Vite config. `@vitejs/plugin-react`, dev server on port 5173. |
| `tsconfig.json` | ~22 | App TS config. `strict`, `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`. |
| `tsconfig.node.json` | ~14 | Node-side TS config for `vite.config.ts` (`composite: true` required by project references). |
| `package.json` | ~24 | Scripts (`dev`, `build`, `preview`, `typecheck`) and minimal deps. |

## Build & Run

```bash
# Install deps (first time or after deps change)
npm install

# Dev server at http://localhost:5173
npm run dev

# Production build to /dist
npm run build

# Preview the production build locally
npm run preview

# Type-check only, no emit
npm run typecheck
```

Node 18+ is required (Vite 5 dropped Node 16). If `bun` becomes available later, `bun install` / `bun run dev` are drop-in replacements — the scripts don't depend on npm specifically.

## Code Style & Conventions

### Variable and Method Naming

- Be as clear and specific with variable and method names as possible.
- **Optimize for clarity over concision.** A reader with zero context should understand what a name means.
- Do NOT use single-character variable names. Short loop indices (`i`, `day`) are fine where their meaning is obvious from context.
- When passing props or arguments, keep the same names as the original variable. Do not shorten or abbreviate (`currentMonthCells`, not `cells2`).

### TypeScript / React Conventions

- `"strict": true` is non-negotiable. Fix type errors at the source, do not `any`-cast.
- Prefer **discriminated unions** for cell/state shapes (see `CalendarCell`). No nullable "sometimes a day, sometimes empty" fields.
- Components are **function components** only. Hooks only inside components.
- No `default` exports except where a bundler/framework specifically requires it (none do here). Use named exports.
- Keep components small enough that their file could be read top-to-bottom in under a minute. Split before they grow past ~200 lines.
- Arrays of labels/options that never change live as **module-level `as const` arrays**, not inside the component body.

### Styling Conventions

- All colors, fonts, and shared sizes go through `--*` custom properties in `src/styles.css`. Do not hard-code a hex value inside a component-specific selector.
- Use `clamp()` for the handful of type sizes that need to scale with viewport. Do not write per-breakpoint media queries unless a real breakpoint reveals itself.
- Border/rule treatment: 1px solid `var(--rule)`. Never mix multiple rule widths in the grid.
- No box shadows on the calendar body beyond the near-invisible `0 1px 0 rgba(0,0,0,0.02)` page edge.

### Accessibility Conventions

- The grid uses ARIA roles `grid` / `row` / `columnheader` / `gridcell`. Keep them in sync if the markup changes.
- Out-of-month empty cells are `aria-hidden="true"` — they are decorative dots, not dates.
- The `•` characters around the year are `aria-hidden`; the year number itself is announced via the wrapper's `aria-label`.

## Do NOT

- Do not add a router, state manager, UI kit (shadcn, MUI, Chakra), icon library, or animation library.
- Do not add a date library (`date-fns`, `dayjs`, `luxon`). The current date math is 10 lines; keep it that way.
- Do not add a markdown renderer (`marked`, `react-markdown`, `remark`). `WinDetail` renders a deliberately tiny subset inline. If the timeline format outgrows that subset, expand the inline renderer by a step, don't pull in a library.
- Do not add a sidebar, settings panel, or any other surface beyond the existing header. Month navigation chevrons and the click-month-to-jump-to-today affordance are allowed (Alice explicitly asked for them); anything further needs a new explicit ask.
- Do not render the full win body inside the calendar cell. Titles only — the body belongs to the modal.
- Do not switch the week start away from Monday without an explicit request.
- Do not ship dark mode toggles, theme pickers, or multiple color schemes. One calm palette is the design.
- Do not use `dangerouslySetInnerHTML` for timeline content.
- Do not add analytics, auth, or telemetry.
- Do not silently drop entries whose dates the parser can't read. Log a warning or fail loudly — missing wins are worse than noisy ones because Alice can't self-correct what she can't see.
- Do not rename the project, the `win-calendar` directory, or the `--frame`/`--paper`/`--rule`/`--weekday-bg`/`--weekday-ink`/`--day-ink`/`--empty-dot`/`--win-ink`/`--win-muted`/`--win-hover-bg`/`--backdrop` token names.

## Git Workflow

- Branch naming: `feature/description` or `fix/description`
- Commit messages: imperative mood, concise, explain the "why" not the "what"
- Do not force-push to `main`
- The remote `origin` is `https://github.com/floweralicee/win-calendar.git`

## Self-Update Instructions

<!-- AI agents: follow these instructions to keep this file accurate. -->

When you make changes to this project that affect the information in this file, update this file **in the same change** to reflect those changes. Specifically:

1. **New files**: add new source files to the "Key Files" table with their purpose and approximate line count.
2. **Deleted files**: remove entries for files that no longer exist.
3. **Architecture changes**: update the Architecture section if you introduce new patterns, frameworks, routing, or significant structural changes (e.g., when the "winning list" data model lands, document where it lives and how it's persisted).
4. **Design tokens**: if you add, remove, or rename a `--*` custom property in `styles.css`, update the `Do NOT` list and any Architecture/Styling notes that reference it.
5. **Build changes**: update the Build & Run section if scripts, Node version, or package manager expectations change.
6. **New conventions**: if the user establishes a new coding convention during a session, add it to the appropriate Conventions section.
7. **Line-count drift**: if a file's line count changes by more than ~50 lines, update the approximate count in the Key Files table.
8. **New phases**: when a major feature lands (e.g., winning list entry UI, persistence, multi-month view), add a short "Phase N — <name>" heading in Overview or Architecture describing what exists now vs. what is still off-limits.

Do NOT update this file for minor edits, bug fixes, or changes that don't affect the documented architecture or conventions.

## Wins Data Contract (what Phase 3 must produce)

The UI reads a `WinsByDate` map: `Record<'YYYY-MM-DD', Win[]>` where `Win` is:

```ts
type Win = {
  date: string        // ISO YYYY-MM-DD; one record per calendar day the win touches
  title: string       // shown in the cell, clamped to 2 lines
  body: string        // markdown; currently only paragraphs and **bold** render
  id: string          // stable across runs; current parser uses `${date}-${slug(title)}`
  spansRange: boolean // true when the source entry covered multiple days
}
```

Whatever pipeline fills this (today: `parseTimelineMarkdown(example/TIMELINE-finance.md)`; tomorrow: an Obsidian-ingest agent) must keep this shape. New fields may be added but existing fields must not be renamed or change semantics without updating `src/Calendar.tsx` and `src/WinDetail.tsx` in the same change.
