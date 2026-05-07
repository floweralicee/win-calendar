# GrowthOS — Agent Instructions

<!-- This is the single source of truth for all AI coding agents. CLAUDE.md is a symlink to this file. -->
<!-- AGENTS.md spec: https://github.com/agentsmd/agents.md — supported by Claude Code, Cursor, Copilot, Gemini CLI, and others. -->

## Overview

GrowthOS (repo: `win-calendar`) is a personal monthly calendar that shows Alice's "winning list" — the wins of the day — for every day of the month. The UI is intentionally austere: a printed-paper-style month grid with **nothing else on screen**. No navigation chrome, no sidebars, no toolbars, no theming toggles. The calendar itself is the product.

### Current Phase

- **Phase 1 — Infrastructure** *(done)*: calendar grid, design tokens, Monday-first weeks, empty-cell dots.
- **Phase 2 — Wins rendering** *(done)*: parse a timeline markdown file, place entries on the day(s) they cover, render **only the title** inside each day cell, and open a **modal** with the full body when a title is clicked.
- **Phase 3 — Autolayer** *(done)*: night-time journal composer (text or dictation) → local Hono server → Claude extracts wins → append to `<obsidian>/WinCalendar/timeline-life.md` → schedule a morning email via Resend `scheduled_at` → hide wins from the UI until `revealAt` passes. First-run onboarding collects the Obsidian vault path, email, timezone, and reveal hour into `~/.win-calendar/config.json` (mode 0600).
- **Phase 4 — Desktop Pet** *(done, branch `feature/desktop`)*: always-on-top Electron window showing the Hana pet character. Four interaction states (active/eat/sleep/touch). Double-clicking opens a speech-bubble textbox; typed wins are sent through the existing Claude extraction pipeline and saved to the vault. Global shortcut `Cmd+Shift+H` toggles visibility.
- **Phase 5 — Life Ring Tags** *(done, branch `feature/aliceos`)*: AI extraction classifies each win into one of 5 life areas. `timeline-life.md` gains an `area:` field. Both parsers updated in lockstep. Calendar day cells show colored presence dots per area. Detail modal shows area pill.
- **Phase 6 — Growth Ring Bloom** *(done, branch `feature/aliceos`)*: a second view toggled from the calendar header. Hand-written SVG radial bloom where each concentric ring = one week, each arc = a life area, arc thickness = win count. First-load scale animation. Click an arc to see the wins for that area/week in a popover.
- **Phase 7 — Momentum Heatmap** *(done, branch `feature/aliceos`)*: a third view (Year). GitHub-style 52×7 day grid; 5 separate streams one per life area. Cell intensity goes tint → full → dark. Hover for tooltip.
- **Phase 8 — Goal System + Eisenhower Layer** *(done, branch `feature/aliceos`)*: Goals view (5th toggle). Full CRUD for goals with area/deadline/milestone/status. Goals saved to `~/.win-calendar/goals.json`. Morning email appends an Eisenhower grid (Urgent+Important / Important) computed from active goals + win history. Urgency = deadline ≤ 6 weeks AND win pace below 2/week in that area.
- **Phase 9 — Orbit trajectory** *(done)*: sixth header toggle (**Orbit**). SVG spiral places every win in chronological order (center = earliest, outer edge = latest); a hairline path connects them as a single growth trajectory; dots are colored by primary life area; hover shows date + title; click opens `WinDetail`.
- **Phase 10 — Dashboard View** *(not started)*: seventh header toggle (**Dashboard**). Brings the Decision Engine in-app: growth portfolio chart (5 area lines + total line, hand-written SVG), active goals + progress, Eisenhower grid, today's suggestion, "What to do now" button. Decision Engine Layer 3 (Synthesis). Prerequisite: Phase 9 complete.
- **Phase 11 — Life Map** *(not started)*: eighth header toggle (**Map**). Force-directed SVG graph connecting life areas → goals → win clusters. Shows the shape of your life as a connected map. Simple, calm, no new dependencies. Prerequisite: Phase 10 complete.

## Design Base

The visual philosophy is inspired by [chenglou/pretext](https://github.com/chenglou/pretext) — precise, measured, minimal typography over anything decorative. Rules to uphold:

- **Typography first.** The month title is a letter-spaced wordmark; the year sits on the same baseline with bullet delimiters (`• 2025 •`).
- **Thin rules, no shadows.** 1px hairline rules in a warm neutral (`--rule`) separate cells. No card shadows, no gradients.
- **Off-white paper on a warm gray frame.** The calendar is a white "page" centered on a light gray background, printed-calendar style.
- **No UI other than the grid.** If a new feature needs UI, prefer modifying the grid cell itself (e.g., wins inside the day cell) before adding new surfaces.

Reference image: a minimal monthly calendar with uppercase day labels (MON–SUN), day numbers top-left in each cell, and small open dots marking leading/trailing days outside the current month.

## Architecture

- **Frontend**: React 18 + TypeScript, bundled with Vite. Client-side SPA, single route (the current month).
- **Desktop pet**: Electron app in `desktop/`. Self-contained package with its own `package.json`. Main process (`desktop/src/main.ts`) creates a frameless, transparent, always-on-top `BrowserWindow`. Renderer (`desktop/src/renderer/`) is a React app built by a separate Vite config. The pet submits wins through the existing Hono server via IPC → Node `fetch` (no CORS). Position is persisted in `app.getPath('userData')/hana-position.json`.
- **Backend**: local Hono server on `127.0.0.1:8787`, run via `tsx watch`. Both start together with `npm run dev` (via `concurrently`). Vite dev server proxies `/api/*` to the Hono server.
- **State**: local component state only, no global store. `App` owns the `config` gate, the fetched `winsByDate`, the visible month, the selected win (for detail modal), whether the journal composer is open, and the `activeView` (`'month' | 'bloom' | 'year' | 'list' | 'goals' | 'orbit' | 'dashboard' | 'map'`). `activeView` is passed to `Calendar`, which renders the appropriate view. `GoalsView` manages its own goals state internally.
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

**SVG-only for all visualisations.** Bloom, Orbit, Heatmap, and the upcoming Dashboard chart, Life Map graph are all hand-written SVG. No D3, no Chart.js, no canvas. The data shapes are simple enough that bespoke SVG math is shorter and more maintainable than a library dependency. This rule holds for Phase 10 and Phase 11.

**Force simulation for Life Map is hand-written.** Phase 11 uses a simple iterative force-directed layout (repulsion + spring + centering, ~60 lines) computed in a `useEffect` on mount. No D3-force, no physics library. Nodes settle after ~120 frames at 60fps; the result is then static (no continuous animation). See `src/MapView.tsx` when Phase 11 lands.


## Key Files

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~11 | Vite entry HTML. Single `#root` mount point, no meta chrome beyond viewport + title. |
| `src/main.tsx` | ~11 | React bootstrap. Mounts `<App />` in `StrictMode` and imports `styles.css`. |
| `src/App.tsx` | ~180 | Top-level component. Calls `fetchConfig()` / `fetchWins()` on mount; gates on `onboarded`; owns visible month state, selected win, whether the journal composer is open, and `activeView` (`'month' | 'bloom' | 'year' | 'list' | 'goals' | 'orbit' | 'dashboard' | 'map'`). Exposes `reload()` so the composer can refresh the calendar after submit. |
| `src/Calendar.tsx` | ~320 | Month grid + win titles + view toggle (Month / Bloom / Year / List / Goals / Orbit / Dashboard / Map when phases land). Renders the appropriate sub-view based on `activeView`. |
| `src/WinDetail.tsx` | ~85 | The detail modal opened when a win title is clicked. Renders lightweight inline markdown (paragraphs + `**bold**`). Closes on backdrop click, the × button, or ESC (ESC is handled in `App`). |
| `src/Onboarding.tsx` | ~115 | First-run form. Per-user fields only: Obsidian path, email, timezone (auto-detected), reveal hour. API keys are operator-managed and never asked here. Posts to `/api/config` and calls `onComplete` on success. |
| `src/JournalComposer.tsx` | ~180 | Nightly journal modal. Textarea + optional dictation via Web Speech API. On submit, shows the returned "Great job…" message and nothing else — the wins themselves never come back to the client. |
| `src/api.ts` | ~60 | Typed fetch wrappers for `/api/config`, `/api/wins`, `/api/journal`, `/api/goals`. All error paths raise `Error` with the server's message. |
| `src/wins.ts` | ~155 | Deterministic timeline-markdown parser (browser copy). Exports `Win`, `WinsByDate`, `LifeArea`, `LIFE_AREAS`, `parseTimelineMarkdown()`. Parses optional `area:` field. |
| `src/BloomView.tsx` | ~200 | Growth ring bloom SVG view. Groups `winsByDate` into weekly buckets, renders concentric rings (one per week, innermost = oldest) with 5 arc segments per ring (one per life area). Arc thickness ∝ win count. First-load scale animation (once per session). Click arc → popover listing that area/week's wins. |
| `src/HeatmapView.tsx` | ~230 | Year heatmap. 5 separate area streams stacked vertically. Each stream is a 52×7 grid for that area only, using a tint → full → dark intensity scale. Today outline ring. Hover tooltip scoped to that area's wins. |
| `src/GoalsView.tsx` | ~310 | Goals CRUD UI. List grouped by status (Active/Achieved/Paused) with area dots, deadlines, weekly milestones, inline status toggle. Inline add/edit form. Manages its own goals state via `/api/goals`. |
| `src/OrbitView.tsx` | ~220 | Chronological spiral of all wins: connecting path + area-colored dots; hover caption; click opens `WinDetail`. |
| `src/DashboardView.tsx` | — | *(Phase 10 — not yet created)* Decision Engine synthesis view: growth portfolio chart (5 area lines + total), active goals + progress, Eisenhower grid, today's suggestion, "What to do now" button. |
| `src/MapView.tsx` | — | *(Phase 11 — not yet created)* Force-directed life map: life area nodes → goal nodes → win cluster nodes. Hand-written SVG + iterative force simulation. |
| `src/vite-env.d.ts` | ~6 | Vite client types + the `*.md?raw` module declaration (still used by the example fixture). |
| `src/styles.css` | ~1020 | Design tokens (including 5 `--ring-*` area color tokens) + all view styles. Single stylesheet. Phase 10 adds `--dashboard-*` tokens if needed. Phase 11 adds `--map-node-*` tokens for node sizing. |
| `example/TIMELINE-finance.md` | — | Example timeline. Used as the fixture/seed for design decisions. Not the live source at runtime. |
| `vite.config.ts` | ~14 | Vite config. `@vitejs/plugin-react`, dev server on port 5173, `/api` proxy to `127.0.0.1:8787`. |
| `tsconfig.json` | ~22 | App TS config. `strict`, `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`. |
| `tsconfig.node.json` | ~14 | Node-side TS config for `vite.config.ts`. |
| `package.json` | ~30 | Scripts and deps. |

### Backend (`server/`)

| File | Lines | Purpose |
|------|-------|---------|
| `server/src/index.ts` | ~45 | Hono app bound to `127.0.0.1:8787`. Loads `server/.env` via `dotenv`. Mounts route modules + `/api/health`. CORS limited to `localhost:5173`. |
| `server/src/routes/onboarding.ts` | ~55 | `GET /api/config` and `POST /api/config`. Validates Obsidian path, persists with mode 0600. Per-user fields only — no API keys. |
| `server/src/routes/journal.ts` | ~100 | `POST /api/journal`: writes raw journal → AI Gateway → appends to timeline-life.md → records `revealAt` → schedules Resend email. Returns only `{ ok, winsCount, message }`. Never returns wins. |
| `server/src/routes/wins.ts` | ~40 | `GET /api/wins`: reads timeline-life.md + `.state.json`, filters by `revealAt <= now`, returns `WinsByDate`. |
| `server/src/routes/goals.ts` | ~90 | `GET/POST /api/goals`, `PATCH/DELETE /api/goals/:goalId`. Full CRUD. |
| `server/src/routes/energy.ts` | — | *(Phase 9 — not yet created)* `POST /api/energy`: stores energy level + time block. `GET /api/energy/patterns`: returns historical energy model for Decision Engine. |
| `server/src/config-store.ts` | ~80 | Reads/writes `~/.win-calendar/config.json` (mode 0600). Per-user fields only. |
| `server/src/obsidian.ts` | ~165 | Vault layout + IO. Ensures `WinCalendar/` + `journal/`, creates initial `timeline-life.md`, appends journal entries, reads/writes `.state.json`. |
| `server/src/claude.ts` | ~105 | AI Gateway wrapper. `generateText` via `ai` SDK. Extracts and validates `ExtractedWin[]`. Despite filename, no direct Anthropic SDK. |
| `server/src/resend.ts` | ~170 | Resend SDK wrapper. `computeNextRevealInstantISO()` + `scheduleMorningEmail()`. Phase 10 adds Decision Engine synthesis paragraph to the email body. |
| `server/src/prompts.ts` | ~40 | System prompt for win extraction. Asks for `areas[]`. Strict JSON-only instruction. Phase 9 adds energy extraction prompt. |
| `server/src/goals-store.ts` | ~85 | Reads/writes `~/.win-calendar/goals.json` (mode 0600). |
| `server/src/eisenhower.ts` | ~75 | Eisenhower grid from goals + win history. Phase 10 integrates this into the in-app Dashboard. |
| `server/src/decision-engine.ts` | — | *(Phase 10 — not yet created)* Layer 3 synthesis: takes goals, win history, energy patterns → outputs priority card, drift alerts, "What to do now". |
| `server/src/timeline-parser.ts` | ~110 | Server copy of `src/wins.ts` parser. Kept in lockstep intentionally. |
| `server/src/map-data.ts` | — | *(Phase 11 — not yet created)* Builds the graph data for MapView: aggregates wins into weekly clusters per area, joins with goals, returns `MapNode[]` + `MapEdge[]`. No SVG logic here — pure data transformation. |
| `server/tsconfig.json` | ~20 | Node TS config. |
| `server/.env` | — | **Not committed.** Operator secrets. |
| `server/.env.example` | — | Committed placeholder. |

### Desktop Pet (`desktop/`)

| File | Lines | Purpose |
|------|-------|---------|
| `desktop/package.json` | ~40 | Electron + React + electron-builder deps. |
| `desktop/src/main.ts` | ~120 | Electron main process. Frameless transparent always-on-top window. `Cmd+Shift+H` toggle. Tray menu. |
| `desktop/src/preload.ts` | ~30 | `contextBridge` — `window.hana.submitJournal()`, `moveBy()`, `setBubbleVisible()`. |
| `desktop/src/renderer/Pet.tsx` | ~200 | React component. Four states, sleep timer, drag, speech bubble, submit flow. |
| `hana-icon/active.svg` | 4 | Default/idle pet sprite. |
| `hana-icon/eat.svg` | 4 | Textbox-open sprite. |
| `hana-icon/sleep.svg` | 4 | Inactivity sprite. |
| `hana-icon/touch.svg` | 4 | Drag sprite. |

## Build & Run

```bash
npm install
npm run dev          # web (port 5173) + server (port 8787) concurrently
npm run dev:web      # web only
npm run dev:server   # server only
npm run build        # production build
npm run typecheck    # type-check without building
npm run desktop:dev  # Electron watch mode
```

Node 18+ required.

### First run expectations

1. Copy `server/.env.example` → `server/.env`, fill `AI_GATEWAY_API_KEY` and `RESEND_API_KEY`.
2. `npm install`, `npm run dev`.
3. Open `http://localhost:5173`. Onboarding renders (fill path, email, reveal hour — no API keys).
4. Calendar appears empty. Write a journal entry. Expect: vault files created, wins extracted, state.json populated, Resend email scheduled. Calendar shows no wins until reveal hour.
5. Morning at reveal hour: email arrives, app shows wins.

## Code Style & Conventions

### Variable and Method Naming

- Be as clear and specific with variable and method names as possible.
- **Optimize for clarity over concision.** A reader with zero context should understand what a name means.
- Do NOT use single-character variable names. Short loop indices (`i`, `day`) are fine where their meaning is obvious.
- When passing props or arguments, keep the same names as the original variable.

### TypeScript / React Conventions

- `"strict": true` is non-negotiable. Fix type errors at the source, do not `any`-cast.
- Prefer **discriminated unions** for cell/state shapes.
- Components are **function components** only. Hooks only inside components.
- No `default` exports except where a bundler/framework specifically requires it.
- Keep components under ~200 lines. Split before they grow past that.
- Arrays of labels/options that never change live as **module-level `as const` arrays**.

### Styling Conventions

- All colors, fonts, and shared sizes go through `--*` custom properties in `src/styles.css`.
- Use `clamp()` for type sizes that need to scale with viewport.
- Border/rule treatment: 1px solid `var(--rule)`. Never mix multiple rule widths.
- No box shadows on the calendar body.

### Accessibility Conventions

- Grid uses ARIA roles `grid` / `row` / `columnheader` / `gridcell`.
- Out-of-month empty cells are `aria-hidden="true"`.
- `•` characters around the year are `aria-hidden`; the year number is announced via wrapper `aria-label`.

## Do NOT

- Do not add a router, state manager, UI kit, icon library, or animation library.
- Do not add a date library. The date math that exists is ~30 lines; keep it that way.
- Do not add a markdown renderer. `WinDetail` renders a deliberately tiny subset inline.
- Do not add a sidebar, settings panel, or any surface beyond the existing header.
- Do not render the full win body inside the calendar cell. Titles only.
- Do not switch the week start away from Monday without an explicit request.
- Do not ship dark mode toggles, theme pickers, or multiple color schemes.
- Do not use `dangerouslySetInnerHTML` for timeline content.
- Do not add analytics, auth, or telemetry.
- Do not silently drop entries whose dates the parser can't read.
- **Do not return unrevealed wins to the client.**
- **Do not hard-code API keys anywhere in the repo.**
- **Do not put API keys in `~/.win-calendar/config.json`.**
- **Do not add per-user LLM or email key fields to `<Onboarding>`.**
- **Do not ship API keys to the client.**
- **Do not route LLM calls around the AI Gateway.**
- **Do not bind the Hono server to `0.0.0.0`.**
- **Do not let `POST /api/journal` return the extracted wins.**
- **Do not add D3, Chart.js, or any visualisation library.** All charts and graphs are hand-written SVG. This applies to Phase 10 (growth chart) and Phase 11 (life map) equally.
- Do not rename the project, the `win-calendar` directory, or any `--ring-*` / `--frame` / `--paper` / `--rule` / `--weekday-bg` / `--weekday-ink` / `--day-ink` / `--empty-dot` / `--win-ink` / `--win-muted` / `--win-hover-bg` / `--backdrop` token names.

## Git Workflow

- Branch naming: `feature/description` or `fix/description`
- Commit messages: imperative mood, concise, explain the "why" not the "what"
- Do not force-push to `main`
- Remote `origin`: `https://github.com/floweralicee/win-calendar.git`

## Self-Update Instructions

When you make changes that affect this file, update it **in the same change**:

1. **New files**: add to Key Files table.
2. **Deleted files**: remove entries.
3. **Architecture changes**: update Architecture section.
4. **Design tokens**: update `Do NOT` list and Architecture notes.
5. **Build changes**: update Build & Run section.
6. **New conventions**: add to Code Style.
7. **Line-count drift**: update approximate counts if a file changes by ~50+ lines.
8. **New phases**: add a short "Phase N" heading in Overview when a major feature lands.

Do NOT update for minor edits, bug fixes, or changes that don't affect documented architecture.

## Wins Data Contract

```ts
type Win = {
  date: string        // ISO YYYY-MM-DD
  title: string       // shown in cell, clamped to 2 lines
  body: string        // markdown; paragraphs and **bold** only
  id: string          // stable: `${date}-${slug(title)}`
  spansRange: boolean // true when source entry covered multiple days
}
```

## Config & State Contracts

`~/.win-calendar/config.json` (mode 0600):

```ts
type StoredConfig = {
  obsidianPath: string
  email: string
  timezone: string   // IANA
  revealHour: number // 0-23
}
```

`GET /api/config` returns the same shape plus `onboarded: boolean`.

Operator secrets in `server/.env` (git-ignored):

```
AI_GATEWAY_API_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
```

`<obsidian>/WinCalendar/.state.json`:

```ts
type StateFile = {
  version: 1
  wins: Record<string, { revealAt: string; scheduledEmailId?: string }>
}
```

## Map Data Contract (Phase 11)

```ts
type MapNode =
  | { kind: 'area';    id: string; area: LifeArea; label: string }
  | { kind: 'goal';    id: string; area: LifeArea; title: string; status: GoalStatus }
  | { kind: 'cluster'; id: string; area: LifeArea; week: string; count: number }

type MapEdge = {
  source: string  // node id
  target: string  // node id
  kind: 'area-goal' | 'area-cluster' | 'goal-cluster'
}
```

`GET /api/map` returns `{ nodes: MapNode[], edges: MapEdge[] }`. No SVG, no layout — pure data. The force simulation runs client-side in `MapView.tsx`.
