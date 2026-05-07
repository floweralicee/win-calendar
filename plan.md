# GrowthOS — Product Roadmap
> Living document. Updated as stages complete. Agents must read this before touching any code.
> Last updated: 2026-05-05

---

## Vision

A personal growth OS that lives on your desktop. You tell it what you did. It learns your energy patterns, maps your wins to the areas of your life that matter, and tells you — based on evidence — what to focus on next. Not a productivity app. A growth mirror.

---

## Core Areas (the 5 Life Rings)

Every win, task, and goal belongs to one of these areas.

| Area | Color Token | What it tracks |
|------|-------------|----------------|
| 💰 Finance | `--ring-finance` | Income, savings, investments, money moves |
| 👥 Family & Friends | `--ring-social` | Relationships, conversations, presence |
| 🌱 Self-Growth | `--ring-growth` | Learning, reflection, identity, journaling |
| 🏃 Health | `--ring-health` | Movement, sleep, food, energy |
| 🚀 Career & Build | `--ring-career` | Work, projects, shipping, skills |

---

## Architecture Principles (don't violate these)

1. **Read AGENTS.md first.** All existing conventions apply. This doc adds to them.
2. **One stage at a time.** Complete and ship each stage before starting the next.
3. **Data schema is sacred.** Every stage that adds data fields must document them in `server/src/schema.md`. Never break backwards compatibility with existing `timeline-life.md` files.
4. **No new dependencies without a reason in this file.** The existing stack (React, Hono, Vite, AI SDK, Resend) handles everything. Add a dep only if it's truly irreplaceable — note it here.
5. **Design language carries forward.** Warm paper aesthetic. Thin rules. No shadows. No color overload. Ring colors are the only visual layer — keep them muted.
6. **AI suggestions are evidence-based, not generic.** Every suggestion must cite specific past data. No "try to be more productive" — only "on 7 previous Tuesdays, your deepest work happened before 11am."
7. **SVG-only for all visualisations.** No D3, Chart.js, canvas, or any visualisation library. This rule applies to every phase including 10 and 11.

---

## Stages

---

### ✅ Stage 1 — Infrastructure
*Status: DONE*

Monthly calendar grid. Design tokens. Empty cell dots. Mon-first weeks.

---

### ✅ Stage 2 — Wins Rendering
*Status: DONE*

Parse timeline markdown, place wins on days, modal for detail view.

---

### ✅ Stage 3 — Autolayer
*Status: DONE*

Night journal composer → Claude extracts wins → appended to vault → morning reveal email via Resend.

---

### ✅ Stage 4 — Desktop Pet
*Status: DONE (branch `feature/desktop`)*

Hana pet. Four states. Speech bubble text input. Wins through existing pipeline. Global shortcut `Cmd+Shift+H`.

---

### ✅ Stage 5 — Life Ring Tags
*Status: DONE (branch `feature/aliceos`)*

AI extraction classifies each win into one of 5 areas. `timeline-life.md` gains `area:` field. Both parsers updated in lockstep. Calendar day cells show colored presence dots per area. Detail modal shows area pill.

**Data change:**
```
## Apr 30, 2026 — Shipped the categorization feature
area: career
```

---

### ✅ Stage 6 — Growth Ring Bloom
*Status: DONE (branch `feature/aliceos`)*

Second view toggle: **Bloom**. SVG radial bloom — each concentric ring = one week, each arc = one life area, arc thickness = win count. First-load scale animation. Click arc → popover with wins for that area/week.

---

### ✅ Stage 7 — Momentum Heatmap
*Status: DONE (branch `feature/aliceos`)*

Third view toggle: **Year**. GitHub-style 52×7 grid per area. Cell intensity = win count. Hover tooltip. Today outline ring.

---

### ✅ Stage 8 — Goal System + Eisenhower Layer
*Status: DONE (branch `feature/aliceos`)*

Fifth view toggle: **Goals**. Full CRUD for goals (area / deadline / milestone / status). Goals in `~/.win-calendar/goals.json`. Morning email adds Eisenhower grid from active goals + win history. Urgency = deadline ≤ 6 weeks AND < 2 wins/week in that area.

---

### ✅ Stage 9 — Orbit Trajectory
*Status: DONE*

Sixth view toggle: **Orbit**. SVG spiral of all wins in chronological order (centre = earliest). Hairline connecting path. Area-colored dots. Hover = date + title. Click opens `WinDetail`.

---

### 🔲 Stage 10 — Dashboard View
*Status: NOT STARTED — Decision Engine Layer 3 (Synthesis + Output)*
*Prerequisite: Stage 9 complete ✅*

**What it adds:**

Seventh view toggle: **Dashboard**. Everything that was email-only comes into the app.

**Growth Portfolio Chart** (centrepiece):
- 5 area lines + 1 neutral total line — hand-written SVG, no chart library
- X axis = weeks, Y axis = wins per week
- Default: all-time. Toggle: 30d / 90d / all-time
- Lines: 1.5px, soft curves (not step-chart). Total line: 2px, `var(--day-ink)`
- Horizontal-only hairline grid in `var(--rule)`
- Hover tooltip: week label + per-area breakdown
- When a category has zero wins for weeks: line holds flat at last value (does not drop to zero)

**Other Dashboard components:**
- Active goals + progress bars (wins toward weekly milestone)
- Eisenhower grid rendered visually (reuses `server/src/eisenhower.ts` output)
- Today's suggestion (Decision Engine Layer 3 output — same content as email, surfaced in-app)
- "What to do now" button: generates one next action from current time, energy, and goal gaps

**Decision Engine Layer 3 (Synthesis):**
```
Input:  goals + deadlines + win history + energy patterns (Layer 1 + 2)
Output: one priority card, optional drift alert, "What to do now" action
```

Priority card rules:
- Always ONE thing. Never a list.
- Always cites evidence: goal deadline + win gap + energy pattern.
- Degrades gracefully when data is missing.
- Never generic. "Work on your finance goal" is invalid. "Send 10 emails from your teaching waitlist" is valid.

Drift alert (shown when triggered, not always):
> "[Category] has been quiet for [N] weeks. Your [goal title] is [X] weeks away. One small win in this area today would count."

**New files:**
- `src/DashboardView.tsx` (~300 lines)
- `server/src/decision-engine.ts` (~120 lines)
- `server/src/routes/dashboard.ts` (~60 lines) — `GET /api/dashboard` returns priority card + drift alerts + chart data

**No new npm dependencies.**

**Definition of done:**
- [ ] Dashboard view added to view toggle (8th button)
- [ ] Growth chart renders with all 5 area lines + total line, hand-written SVG
- [ ] All-time default, 30d / 90d / all-time toggle works
- [ ] Hover tooltip shows week + per-area breakdown
- [ ] Active goals + progress bars render with real data
- [ ] Eisenhower grid renders visually
- [ ] Priority card renders with cited evidence
- [ ] Drift alerts fire when a goal category goes quiet ≥ 2 weeks
- [ ] "What to do now" button calls `GET /api/dashboard/now` and shows result
- [ ] Morning email updated to include Decision Engine paragraph
- [ ] No new npm dependencies

---

### 🔲 Stage 11 — Life Map
*Status: NOT STARTED*
*Prerequisite: Stage 10 complete*

**What it adds:**

Eighth view toggle: **Map**. A force-directed SVG graph showing the shape of your life as a connected map — goals, life areas, and win clusters as nodes, relationships as edges.

Not a knowledge graph. Not a data dashboard. Just: here is where your energy is going and how it connects to what you want.

**Nodes — three types:**

| Type | Shape | Diameter | Fill | Stroke |
|------|-------|----------|------|--------|
| Life area | Circle | 48px | `var(--ring-*)` at 15% opacity | `var(--ring-*)` full, 1.5px |
| Goal | Circle | 28px | `var(--paper)` | `var(--ring-*)` matching area, 1px |
| Win cluster | Circle | 8–14px (scales with count) | `var(--ring-*)` at 70% opacity | none |

Win clusters = one node per area per week. Not individual wins — that would be noise.

**Labels:**
- Life area: area name, letter-spaced small caps, same typographic treatment as month title
- Goal: goal title, clamped to 1 line, `var(--win-ink)` 80% opacity, rendered as SVG `<text>`
- Win cluster: no label — hover shows tooltip (week + count)

**Edges — hairlines `var(--rule)` at 60% opacity:**
- Life area → Goal (each goal connects to its area)
- Life area → Win cluster (each cluster connects to its area)
- Goal → Win cluster (cluster's area matches goal's area AND win happened after goal was created — shows progress)

No edge labels. Connections speak for themselves.

**Interactions:**
- Hover goal node → show goal title + deadline + status as tooltip
- Hover win cluster → show week label + win count
- Click goal node → open goals view filtered to that goal
- Click life area node → highlight all connected nodes, dim the rest
- Click canvas background → clear highlight

**Force simulation — hand-written, no D3:**
- Repulsion between all nodes (inverse-square)
- Spring attraction along edges (Hooke's law)
- Centering force toward viewport centre
- Life area nodes have 3× stronger centering than goals; win clusters have weakest centering
- ~120 frames at 60fps on mount, then static (no continuous animation)
- Result: life areas settle near centre, goals orbit around their area, win clusters cluster around their area's edge

**Layout intent:**
- Life areas: loosely spread, near centre
- Goals: orbit their area node
- Win clusters: cloud around their area, recent weeks slightly further out
- Overall: organic, not rigid — feels discovered, not designed

**New files:**
- `src/MapView.tsx` (~250 lines) — force simulation + SVG render
- `server/src/map-data.ts` (~80 lines) — builds `MapNode[]` + `MapEdge[]` from wins + goals, no SVG
- `server/src/routes/map.ts` (~30 lines) — `GET /api/map`

**New CSS tokens (add to `src/styles.css`):**
```css
--map-area-r: 24px;
--map-goal-r: 14px;
--map-cluster-r-min: 4px;
--map-cluster-r-max: 7px;
--map-edge-opacity: 0.6;
```

**Data contract:**
```ts
type MapNode =
  | { kind: 'area';    id: string; area: LifeArea; label: string }
  | { kind: 'goal';    id: string; area: LifeArea; title: string; status: GoalStatus }
  | { kind: 'cluster'; id: string; area: LifeArea; week: string; count: number }

type MapEdge = {
  source: string
  target: string
  kind: 'area-goal' | 'area-cluster' | 'goal-cluster'
}
```

`GET /api/map` returns `{ nodes: MapNode[], edges: MapEdge[] }`. Pure data — no SVG, no layout coordinates. Force simulation runs entirely in `MapView.tsx`.

**Empty state:**
If fewer than 2 active goals exist: render area nodes only (no goals, no clusters), with copy: "Add goals to see how your wins connect to what you're building."

**No new npm dependencies.**

**Definition of done:**
- [ ] Map view added to view toggle (8th button, after Dashboard)
- [ ] `GET /api/map` returns correct nodes and edges from real data
- [ ] Force simulation settles correctly — areas near centre, goals orbit areas, clusters near areas
- [ ] All three node types render correctly with correct sizing and color
- [ ] Edges render as hairlines connecting the right nodes
- [ ] Hover tooltips work on goals and clusters
- [ ] Click life area node highlights connected nodes correctly
- [ ] Empty state renders when < 2 active goals
- [ ] No continuous animation after settle — static after ~120 frames
- [ ] No new npm dependencies
- [ ] No regressions on existing views

---

## Dependency Map

```
Stage 1  ✅
  └─ Stage 2  ✅
       └─ Stage 3  ✅
            └─ Stage 4  ✅
                 └─ Stage 5  ✅
                      └─ Stage 6  ✅
                           └─ Stage 7  ✅
                                └─ Stage 8  ✅
                                     └─ Stage 9  ✅
                                          └─ Stage 10  🔲  ← START HERE
                                               └─ Stage 11  🔲
```

---

## Data Schema Evolution

| Stage | New fields / files |
|-------|--------------------|
| 5 | `area:` field on win blocks in `timeline-life.md` |
| 8 | `~/.win-calendar/goals.json` |
| 9 | `energy:` and `timeBlocks:` fields on win entries |
| 10 | `GET /api/dashboard` endpoint + `server/src/decision-engine.ts` |
| 11 | `GET /api/map` endpoint + `server/src/map-data.ts` |

Backwards compatibility rule: all new fields are optional. The parser must not break on entries that predate the field.

---

## Decision Engine — Architecture

> This is the core of the whole system. Everything else — tags, bloom, heatmap, goals, energy — is data collection. The Decision Engine turns that data into a decision.

```
Layer 1 (Stage 8) — Goal Intelligence
  What matters? What is urgent? What is important?
  Input:  active goals + target dates + recent win counts per area
  Output: Eisenhower placement of this week's priorities

Layer 2 (Stage 9) — Energy Intelligence
  When are you sharpest? What work fits what state?
  Input:  logged energy levels + time blocks + historical win patterns
  Output: time-of-day recommendations matched to task type

Layer 3 (Stage 10) — Synthesis
  Given what matters (Layer 1), when you're best (Layer 2),
  and what you've actually been doing (win history + chart trends) —
  what should you do RIGHT NOW?
  Input:  all of the above
  Output: one decision, clearly stated, with cited evidence
```

### Decision Engine data dependencies

| What it needs | Source | Available at stage |
|---|---|---|
| Area tags on wins | `timeline-life.md` `area:` field | Stage 5 ✅ |
| Historical win counts per area | Parsed timeline | Stage 5 ✅ |
| Active goals + deadlines | `~/.win-calendar/goals.json` | Stage 8 ✅ |
| Eisenhower placement logic | `server/src/eisenhower.ts` | Stage 8 ✅ |
| Energy levels + time blocks | `timeline-life.md` `energy:` field | Stage 9 |
| Historical energy patterns | Server model (10+ entries) | Stage 9 |
| Growth chart trends | Aggregated win data | Stage 10 |

---

## Open Design Questions

- **Stage 9:** Should energy be a slider (1–5) or descriptive word (low / medium / high / exceptional)? Words are faster; numbers are easier to model.
- **Stage 10:** "What to do now" — does this write to ONE-THING.md in the vault, or is it app-only?
- **Stage 10 chart:** When a category has zero wins for weeks, line holds flat at last value. *(Resolved)*
- **Stage 11:** Win clusters represent one week per area. Should very old weeks (> 12 weeks ago) be faded or omitted to keep the map from getting cluttered? Suggestion: fade clusters older than 8 weeks to 30% opacity, omit clusters older than 16 weeks entirely.

---

## What This Is NOT

- Not a task manager (use Things, Notion, Linear for that)
- Not a social app (wins are private by default)
- Not a generic productivity dashboard (everything is personalized to your data)
- Not a replacement for journaling (it reads journals, doesn't replace them)

---

*Start with Stage 10. Read AGENTS.md. Read this file. Then read the relevant stage definition. Then and only then touch code.*
