# Win Calendar — Agent Instructions

<!-- This is the single source of truth for all AI coding agents. CLAUDE.md is a symlink to this file. -->
<!-- AGENTS.md spec: https://github.com/agentsmd/agents.md — supported by Claude Code, Cursor, Copilot, Gemini CLI, and others. -->

## Overview

Win Calendar is a personal monthly calendar that shows Alice's "winning list" — the wins of the day — for every day of the month. The UI is intentionally austere: a printed-paper-style month grid with **nothing else on screen**. No navigation chrome, no sidebars, no toolbars, no theming toggles. The calendar itself is the product.

### Current Phase

- **Phase 1 — Infrastructure** *(done)*: calendar grid, design tokens, Monday-first weeks, empty-cell dots.
- **Phase 2 — Wins rendering** *(done)*: parse a timeline markdown file, place entries on the day(s) they cover, render **only the title** inside each day cell, and open a **modal** with the full body when a title is clicked.
- **Phase 3 — Autolayer** *(in progress, branch `feature/autolayer`)*: night-time journal composer (text or dictation) → local Hono server → Claude extracts wins → append to `<obsidian>/WinCalendar/timeline-life.md` → schedule a morning email via Resend `scheduled_at` → hide wins from the UI until `revealAt` passes. First-run onboarding collects the Obsidian vault path, email, timezone, reveal hour, Anthropic key, and Resend key into `~/.win-calendar/config.json` (mode 0600).

## Design Base

The visual philosophy is inspired by [chenglou/pretext](https://github.com/chenglou/pretext) — precise, measured, minimal typography over anything decorative. Rules to uphold:

- **Typography first.** The month title is a letter-spaced wordmark; the year sits on the same baseline with bullet delimiters (`• 2025 •`).
- **Thin rules, no shadows.** 1px hairline rules in a warm neutral (`--rule`) separate cells. No card shadows, no gradients.
- **Off-white paper on a warm gray frame.** The calendar is a white "page" centered on a light gray background, printed-calendar style.
- **No UI other than the grid.** If a new feature needs UI, prefer modifying the grid cell itself (e.g., wins inside the day cell) before adding new surfaces.

Reference image: a minimal monthly calendar with uppercase day labels (MON–SUN), day numbers top-left in each cell, and small open dots marking leading/trailing days outside the current month.

## Architecture

- **Frontend**: React 18 + TypeScript, bundled with Vite. Client-side SPA, single route (the current month).
- **Backend**: local Hono server on `127.0.0.1:8787`, run via `tsx watch`. Both start together with `npm run dev` (via `concurrently`). Vite dev server proxies `/api/*` to the Hono server.
- **State**: local component state only, no global store. `App` owns the `config` gate, the fetched `winsByDate`, the visible month, the selected win (for detail modal), and whether the journal composer is open.
- **Styling**: hand-written CSS with design tokens in `:root` custom properties (no Tailwind, no CSS-in-JS).
- **Week start**: Monday (MON–SUN order).
- **Date math**: native `Date` — first weekday is `(jsWeekday + 6) % 7`. Server-side timezone math is done with `Intl.DateTimeFormat` offsets, no date library.
- **Wins data source**: `<obsidian>/WinCalendar/timeline-life.md`, appended by the server each time a journal is submitted. The frontend fetches parsed wins from `GET /api/wins`, not from a `?raw` import. The `example/TIMELINE-finance.md` seed stays in the repo as a reference/fixture.
- **Reveal model**: `<obsidian>/WinCalendar/.state.json` maps `winId → { revealAt, scheduledEmailId }`. `GET /api/wins` filters out wins whose `revealAt > now`. The server is the trust boundary — the browser never sees tonight's wins until morning.
- **LLM**: `ai` (Vercel AI SDK) with model string `anthropic/claude-haiku-4.5`. All calls route through **Vercel AI Gateway** automatically when `AI_GATEWAY_API_KEY` is set in `process.env`. No direct Anthropic SDK, no per-user LLM key.
- **Email**: `resend` SDK. `scheduleMorningEmail()` uses `scheduledAt: "<tomorrow at revealHour in user TZ (UTC ISO)>"` so delivery happens even if the local server is off in the morning.
- **Secrets live in `server/.env`, never in code, never in user config.** Two env vars are required at boot: `AI_GATEWAY_API_KEY` and `RESEND_API_KEY`. An optional `RESEND_FROM_EMAIL` defaults to `onboarding@resend.dev`. The env file is loaded with `dotenv` at server bootstrap from `server/.env`; see `server/.env.example` for the shape. Git blocks `server/.env` via the global `.env*` ignore.
- **Multi-tenant posture**: LLM and email keys are **operator-owned** (one Resend account, one AI Gateway key for the whole app). Per-user config (`~/.win-calendar/config.json`) holds **only** Obsidian path, email, timezone, and reveal hour — zero API material.
- **Network posture**: Hono binds to `127.0.0.1` only. `readConfig()` is the single accessor; `toPublicConfig()` is a no-op strip now that keys don't live there, but the function stays as a future safety belt.

### Key Architecture Decisions

**No framework beyond React + Vite.** We are deliberately avoiding Next.js, React Router, state managers, UI kits, and icon libraries. The calendar is one screen and does not need them. Resist the urge to add any.

**Pure date math, no libraries.** No `date-fns`, `dayjs`, `luxon`, or Temporal polyfills. The logic is ~10 lines of arithmetic in `buildMonthGrid`. Keep it that way unless we need timezone-correct recurrence, at which point introduce Temporal.

**CSS custom properties as the design system.** All colors, fonts, and spacing-relevant tokens live as `--*` variables in `src/styles.css` `:root`. Components reference the tokens, never hard-coded hex values. This is the seed of the future design system and must scale to dark mode / theming without refactors.

**Grid via two nested grids.** The weekday header and the day cells are two separate CSS grids with the same `repeat(7, 1fr)` template so they align visually while staying semantically distinct (`columnheader` vs `gridcell`).

**Empty cells for out-of-month days.** Leading and trailing days (e.g., Mon–Tue before Jan 1, Sat–Sun after Jan 31) render as `kind: 'empty'` cells with a small open dot, not with adjacent-month day numbers. This matches the reference image.

**Timeline parsing is deterministic, not AI-driven.** `src/wins.ts` splits the source markdown on `## ` headings, parses the date portion (`Mon DD, YYYY`, `Mon DD–DD, YYYY`, or `Week of Mon DD–DD, YYYY`), and stops at `## Summary`. Entries that cover a date range are **expanded to one win record per day** so they appear on every day they touched. No model calls at runtime. If the timeline format changes, update the parser rather than shifting work into the UI.

**Dash tolerance.** Timeline headings in the example use an **em dash** `—` (U+2014) between date and title, and en dashes `–` (U+2013) inside date ranges. The parser accepts em dash, en dash, and hyphen in both positions so that hand-written timelines aren't silently dropped. If you edit `src/wins.ts`, preserve this tolerance.

**Titles in cells, body in a modal.** The calendar cell shows **only the win title** (clamped to two lines). Clicking a title opens `WinDetail`, a single modal that renders the full body with lightweight inline markdown (paragraph breaks and `**bold**` spans only — no `dangerouslySetInnerHTML`). This is the one deliberate exception to the "no UI other than the grid" rule: it's triggered by interaction and collapses when dismissed.

**Autolayer is onboarding-gated.** On every load, `App` calls `GET /api/config`. If `onboarded === false`, the app renders `<Onboarding>` instead of the calendar. Onboarding collects **only** per-user preferences: absolute Obsidian path, email, timezone (auto-detected), and reveal hour. API keys are **not** in the onboarding form — they're operator-owned and live in `server/.env`. The server validates the Obsidian path with `fs.stat` + writability before saving, then creates `<obsidian>/WinCalendar/{journal/,.state.json,timeline-life.md}`.

**Voice input stays 100% in the browser.** The journal composer uses `webkitSpeechRecognition` / `SpeechRecognition`. Audio never leaves the machine and the server never receives an audio blob. If the browser doesn't support it, the mic button hides.

**No cron, no launchd.** Scheduling is outsourced to Resend's `scheduled_at`, so the local server does not need to be running in the morning for the email to arrive. The UI reveal is driven purely by `revealAt` comparisons in `GET /api/wins`, so the user must open the app for wins to show up — that is intended. If we ever want the email to also act as a push of the wins, Resend is the canonical timing source.

**Parser duplication is intentional.** `src/wins.ts` (browser) and `server/src/timeline-parser.ts` (node) are intentionally two copies of the same parser. They must stay in lockstep. If you change one, change the other in the same edit, or the server will serve wins the UI can't render.

## Key Files

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~11 | Vite entry HTML. Single `#root` mount point, no meta chrome beyond viewport + title. |
| `src/main.tsx` | ~11 | React bootstrap. Mounts `<App />` in `StrictMode` and imports `styles.css`. |
| `src/App.tsx` | ~130 | Top-level component. Calls `fetchConfig()` / `fetchWins()` on mount; gates on `onboarded`; owns visible month state, selected win, and whether the journal composer is open. Exposes `reload()` so the composer can refresh the calendar after submit. |
| `src/Calendar.tsx` | ~160 | Month grid + win titles inside day cells. Owns `buildMonthGrid()`, weekday/month labels, the ‹/› nav chevrons, the clickable month label, and the **Journal** button on the right of the header. Does not render win bodies — those live in the modal. |
| `src/WinDetail.tsx` | ~85 | The detail modal opened when a win title is clicked. Renders lightweight inline markdown (paragraphs + `**bold**`). Closes on backdrop click, the × button, or ESC (ESC is handled in `App`). |
| `src/Onboarding.tsx` | ~115 | First-run form. Per-user fields only: Obsidian path, email, timezone (auto-detected), reveal hour. API keys are operator-managed and never asked here. Posts to `/api/config` and calls `onComplete` on success. |
| `src/JournalComposer.tsx` | ~180 | Nightly journal modal. Textarea + optional dictation via Web Speech API. On submit, shows the returned "Great job…" message and nothing else — the wins themselves never come back to the client. |
| `src/api.ts` | ~60 | Typed fetch wrappers for `/api/config`, `/api/wins`, `/api/journal`. All error paths raise `Error` with the server's message. |
| `src/wins.ts` | ~130 | Deterministic timeline-markdown parser (browser copy). Exports `Win`, `WinsByDate`, `parseTimelineMarkdown()`. |
| `src/vite-env.d.ts` | ~6 | Vite client types + the `*.md?raw` module declaration (still used by the example fixture). |
| `src/styles.css` | ~560 | Design tokens + calendar, win-title, detail modal, onboarding, journal composer, and app-status styles. Single stylesheet. |
| `example/TIMELINE-finance.md` | — | Example timeline. Used as the fixture/seed for design decisions. Not the live source at runtime — the server reads `<obsidian>/WinCalendar/timeline-life.md` instead. |
| `vite.config.ts` | ~14 | Vite config. `@vitejs/plugin-react`, dev server on port 5173, `/api` proxy to `127.0.0.1:8787`. |
| `tsconfig.json` | ~22 | App TS config. `strict`, `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`. |
| `tsconfig.node.json` | ~14 | Node-side TS config for `vite.config.ts` (`composite: true` required by project references). |
| `package.json` | ~30 | Scripts (`dev`, `dev:web`, `dev:server`, `build`, `preview`, `typecheck`) and deps. |

### Backend (`server/`)

| File | Lines | Purpose |
|------|-------|---------|
| `server/src/index.ts` | ~45 | Hono app bound to `127.0.0.1:8787`. Loads `server/.env` via `dotenv` before routes serve traffic, mounts the three route modules and `/api/health`, warns on boot if `AI_GATEWAY_API_KEY` or `RESEND_API_KEY` are missing. CORS limited to `localhost:5173`. |
| `server/src/routes/onboarding.ts` | ~55 | `GET /api/config` (public shape) and `POST /api/config`. Validates Obsidian path with `fs.stat` + writability, persists with mode 0600. Accepts only per-user fields — no API keys. |
| `server/src/routes/journal.ts` | ~100 | `POST /api/journal`: writes raw journal → calls AI Gateway → appends to timeline-life.md → records `revealAt` → schedules the Resend email. Returns only `{ ok, winsCount, message }`. Never returns wins. |
| `server/src/routes/wins.ts` | ~40 | `GET /api/wins`: reads timeline-life.md + `.state.json`, filters by `revealAt <= now`, returns `WinsByDate`. |
| `server/src/config-store.ts` | ~80 | Reads/writes `~/.win-calendar/config.json` (mode 0600). Per-user fields only: `obsidianPath`, `email`, `timezone`, `revealHour`. Exposes `readConfig()`, `writeConfig()`, `toPublicConfig()`, `validateObsidianPath()`. |
| `server/src/obsidian.ts` | ~165 | Vault layout + IO. Ensures `WinCalendar/` + `journal/`, creates an initial `timeline-life.md` header, appends journal entries, renders & appends win blocks, reads/writes `.state.json`, exposes `getRevealAtMap()`. |
| `server/src/claude.ts` | ~105 | AI Gateway wrapper. Calls `generateText({ model: 'anthropic/claude-sonnet-4.5' })` from the `ai` SDK; throws if `AI_GATEWAY_API_KEY` is unset; extracts and validates the JSON object; returns `ExtractedWin[]`. Filename is historical — despite the name, there is no direct Anthropic SDK dependency. |
| `server/src/resend.ts` | ~170 | Resend SDK wrapper. Reads `RESEND_API_KEY` + `RESEND_FROM_EMAIL` from `process.env` at call time. `computeNextRevealInstantISO()` turns "tomorrow at revealHour in user's IANA TZ" into UTC; `scheduleMorningEmail()` renders HTML + text bodies and schedules via `scheduledAt`. |
| `server/src/prompts.ts` | ~30 | The system prompt for win extraction. Strict "JSON only, wins must be real" instruction. |
| `server/src/timeline-parser.ts` | ~110 | Server copy of the `src/wins.ts` parser. Kept in lockstep intentionally. |
| `server/tsconfig.json` | ~20 | Node TS config. `allowImportingTsExtensions`, `types: ["node"]`, `noEmit`. |
| `server/.env` | — | **Not committed.** Operator secrets: `AI_GATEWAY_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Loaded at boot via `dotenv`. |
| `server/.env.example` | — | Committed placeholder showing the expected keys without values. |

## Build & Run

```bash
# Install deps (first time or after deps change)
npm install

# Starts Vite (5173) + Hono (8787) together
npm run dev

# Frontend only (useful when poking UI without calling APIs)
npm run dev:web

# Hono only, with tsx watch
npm run dev:server

# Production build of the frontend to /dist (server has no build step; run via tsx)
npm run build

# Preview the production build locally
npm run preview

# Frontend type-check only, no emit
npm run typecheck

# Server type-check (no npm script yet; run directly):
npx tsc -p server/tsconfig.json --noEmit
```

Node 18+ is required (Vite 5 dropped Node 16). The server uses `.ts` imports with `allowImportingTsExtensions`, run via `tsx`. If `bun` becomes available later, `bun run dev` / `bun run server/src/index.ts` are drop-in replacements.

### First run expectations

1. Copy `server/.env.example` to `server/.env` and fill in both keys:
   - `AI_GATEWAY_API_KEY` — from Vercel AI Gateway.
   - `RESEND_API_KEY` — from Resend.
   - Optional `RESEND_FROM_EMAIL` (defaults to `onboarding@resend.dev`, which can only deliver to the email that owns the Resend account — fine for single-operator testing).
2. `npm install`, `npm run dev`.
3. Open `http://localhost:5173`. The app fetches `/api/config`; the response is `{ onboarded: false }`, so `<Onboarding>` renders.
4. Fill in per-user fields only: Obsidian vault absolute path, email, reveal hour (default 7). No API keys here. The server creates `<obsidian>/WinCalendar/{journal/,timeline-life.md,.state.json}` and writes `~/.win-calendar/config.json` with mode 0600.
5. The calendar appears, empty. Click **Journal**, write anything, submit. Expect:
   - `<obsidian>/WinCalendar/journal/YYYY-MM-DD.md` contains the raw text.
   - `<obsidian>/WinCalendar/timeline-life.md` has new `## <Date> — <Title>` blocks.
   - `<obsidian>/WinCalendar/.state.json` has entries with `revealAt` for each win.
   - Resend has a scheduled email listed; the calendar still shows no wins for today (hidden until reveal hour).
6. Tomorrow morning at reveal hour: the email arrives; reopening the app shows the wins in their day cells.

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
- Do not add a date library (`date-fns`, `dayjs`, `luxon`, Temporal polyfills). The date math that exists (both in `buildMonthGrid` and `computeNextRevealInstantISO`) is ~30 lines; keep it that way.
- Do not add a markdown renderer (`marked`, `react-markdown`, `remark`). `WinDetail` renders a deliberately tiny subset inline. If the timeline format outgrows that subset, expand the inline renderer by a step, don't pull in a library.
- Do not add a sidebar, settings panel, or any other surface beyond the existing header. Month navigation chevrons, the click-month-to-jump-to-today affordance, and the **Journal** button are allowed (Alice explicitly asked for them); anything further needs a new explicit ask.
- Do not render the full win body inside the calendar cell. Titles only — the body belongs to the modal.
- Do not switch the week start away from Monday without an explicit request.
- Do not ship dark mode toggles, theme pickers, or multiple color schemes. One calm palette is the design.
- Do not use `dangerouslySetInnerHTML` for timeline content.
- Do not add analytics, auth, or telemetry.
- Do not silently drop entries whose dates the parser can't read. Log a warning or fail loudly — missing wins are worse than noisy ones because Alice can't self-correct what she can't see.
- **Do not return unrevealed wins to the client.** `GET /api/wins` must always filter by `revealAt`. The "hidden until morning" guarantee is server-enforced; do not move that check into the browser.
- **Do not hard-code API keys anywhere in the repo or in any committed file.** The only legal home for `AI_GATEWAY_API_KEY`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` is `server/.env` (git-ignored). Do not paste a key into chat, a comment, a test, or a log line. If you need a placeholder, use `server/.env.example` with empty values.
- **Do not put API keys in `~/.win-calendar/config.json`.** That file is per-user preferences only. Keys are operator-scoped and shared across all users of this instance.
- **Do not add per-user LLM or email key fields back to `<Onboarding>`.** If a user ever needs to override the operator key in the future (e.g. BYO mode), add a separate, opt-in screen; don't pollute the first-run form.
- **Do not ship API keys to the client.** `GET /api/config` must never include key values. The browser has no business knowing them.
- **Do not route LLM calls around the AI Gateway.** All Claude traffic goes through `ai`'s default gateway resolution (driven by `AI_GATEWAY_API_KEY`). Do not reintroduce `@anthropic-ai/sdk` or set a custom `baseURL` to bypass the gateway.
- **Do not bind the Hono server to `0.0.0.0`.** It stays on `127.0.0.1`. If you need to proxy from the browser through Vite, that's already wired in `vite.config.ts`.
- **Do not let `POST /api/journal` return the extracted wins.** The composer only surfaces the "Great job…" message. Returning wins would defeat the evening-reveal.
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

## Wins Data Contract

The UI reads a `WinsByDate` map: `Record<'YYYY-MM-DD', Win[]>` where `Win` is:

```ts
type Win = {
  date: string        // ISO YYYY-MM-DD; one record per calendar day the win touches
  title: string       // shown in the cell, clamped to 2 lines
  body: string        // markdown; currently only paragraphs and **bold** render
  id: string          // stable across runs; parser uses `${date}-${slug(title)}`
  spansRange: boolean // true when the source entry covered multiple days
}
```

The server computes this from `<obsidian>/WinCalendar/timeline-life.md` using `server/src/timeline-parser.ts`, then filters by `.state.json`'s `revealAt` before serving it. `src/wins.ts` parses the same format for compatibility with the legacy `example/TIMELINE-finance.md` fixture and is kept in lockstep with the server copy.

## Config & State Contracts

`~/.win-calendar/config.json` (mode 0600, created by the server). Per-user preferences only — **no API keys**:

```ts
type StoredConfig = {
  obsidianPath: string   // absolute, must be a writable directory
  email: string
  timezone: string       // IANA, e.g. "America/Los_Angeles"
  revealHour: number     // 0-23, local hour wins unlock and email sends
}
```

`GET /api/config` returns exactly the same shape with an added `onboarded: boolean`. There are no secret fields; `toPublicConfig()` is retained as a future safety belt.

Operator secrets live in `server/.env` (git-ignored):

```
AI_GATEWAY_API_KEY=...       # Vercel AI Gateway key, used by the `ai` SDK
RESEND_API_KEY=...           # Operator's Resend account key
RESEND_FROM_EMAIL=...        # Verified sender; defaults to onboarding@resend.dev
```

`<obsidian>/WinCalendar/.state.json`:

```ts
type StateFile = {
  version: 1
  wins: Record<string, { revealAt: string; scheduledEmailId?: string }>
}
```

`revealAt` is a UTC ISO 8601 instant. Any win whose id appears in `state.wins` with `revealAt > now` is filtered out of `GET /api/wins`. Wins whose id is absent (e.g. the legacy fixture) are always visible — that preserves the "no state == no hiding" default.
