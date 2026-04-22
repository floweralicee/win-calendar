# Win Calendar — Agent Instructions

<!-- This is the single source of truth for all AI coding agents. CLAUDE.md is a symlink to this file. -->
<!-- AGENTS.md spec: https://github.com/agentsmd/agents.md — supported by Claude Code, Cursor, Copilot, Gemini CLI, and others. -->

## Overview

Win Calendar is a personal monthly calendar that, once fully built, will show Alice's "winning list" — the wins of the day — for every day of the month. The UI is intentionally austere: a printed-paper-style month grid with **nothing else on screen**. No navigation chrome, no sidebars, no toolbars, no theming toggles. The calendar itself is the product.

This phase of the project only contains the **calendar infrastructure**. The "winning list" content and its interactions are **not yet implemented** and must only be added when explicitly requested.

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
- **State**: local component state only, no global store yet
- **Styling**: hand-written CSS with design tokens in `:root` custom properties (no Tailwind, no CSS-in-JS)
- **Week start**: Monday (MON–SUN order)
- **Date math**: native `Date` — first weekday is computed as `(jsWeekday + 6) % 7` to rebase Sunday-first to Monday-first

### Key Architecture Decisions

**No framework beyond React + Vite.** We are deliberately avoiding Next.js, React Router, state managers, UI kits, and icon libraries. The calendar is one screen and does not need them. Resist the urge to add any.

**Pure date math, no libraries.** No `date-fns`, `dayjs`, `luxon`, or Temporal polyfills. The logic is ~10 lines of arithmetic in `buildMonthGrid`. Keep it that way unless we need timezone-correct recurrence, at which point introduce Temporal.

**CSS custom properties as the design system.** All colors, fonts, and spacing-relevant tokens live as `--*` variables in `src/styles.css` `:root`. Components reference the tokens, never hard-coded hex values. This is the seed of the future design system and must scale to dark mode / theming without refactors.

**Grid via two nested grids.** The weekday header and the day cells are two separate CSS grids with the same `repeat(7, 1fr)` template so they align visually while staying semantically distinct (`columnheader` vs `gridcell`).

**Empty cells for out-of-month days.** Leading and trailing days (e.g., Mon–Tue before Jan 1, Sat–Sun after Jan 31) render as `kind: 'empty'` cells with a small open dot, not with adjacent-month day numbers. This matches the reference image.

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~11 | Vite entry HTML. Single `#root` mount point, no meta chrome beyond viewport + title. |
| `src/main.tsx` | ~11 | React bootstrap. Mounts `<App />` in `StrictMode` and imports `styles.css`. |
| `src/App.tsx` | ~6 | Top-level component. Resolves today's date and renders a single `<Calendar>` for the current month. |
| `src/Calendar.tsx` | ~80 | The only real component. Owns `buildMonthGrid()`, weekday/month label constants, and the grid markup. Where the "winning list" per day will eventually live — inside `calendar-cell`. |
| `src/styles.css` | ~130 | Design tokens (`:root` custom properties) and all calendar styles. No other stylesheets exist. |
| `vite.config.ts` | ~9 | Vite config. `@vitejs/plugin-react`, dev server on port 5173. |
| `tsconfig.json` | ~22 | App TS config. `strict`, `noUnusedLocals`, `noUnusedParameters`, `jsx: react-jsx`. |
| `tsconfig.node.json` | ~13 | Node-side TS config for `vite.config.ts`. |
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
- Do not add month/year navigation, a header toolbar, a sidebar, or any settings surface unless the user explicitly asks.
- Do not add the "winning list" UI or data model until the user explicitly asks for it in a follow-up. The infra exists to be ready; the feature itself is a separate phase.
- Do not switch the week start away from Monday without an explicit request.
- Do not ship dark mode toggles, theme pickers, or multiple color schemes. One calm palette is the design.
- Do not add analytics, auth, or telemetry.
- Do not rename the project, the `win-calendar` directory, or the `--frame`/`--paper`/`--rule`/`--weekday-bg`/`--weekday-ink`/`--day-ink`/`--empty-dot` token names.

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
