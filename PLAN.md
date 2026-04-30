# Win Calendar — Product Roadmap
> Living document. Updated as stages complete. Agents must read this before touching any code.
> Last updated: 2026-04-30

---

## Vision

A personal growth OS that lives on your desktop. You tell it what you did. It learns your energy patterns, maps your wins to the areas of your life that matter, and tells you — based on evidence — what to focus on next. Not a productivity app. A growth mirror.

---

## Core Areas (the 5 Life Rings)

Every win, task, and goal belongs to one of these areas. The user defines what matters in each.

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
2. **One stage at a time.** Complete and ship each stage before starting the next. No parallel stage work.
3. **Data schema is sacred.** Every stage that adds data fields must document them in `server/src/schema.md` (create if it doesn't exist). Never break backwards compatibility with existing `timeline-life.md` files.
4. **No new dependencies without a reason in this file.** The existing stack (React, Hono, Vite, AI SDK, Resend) handles everything through Stage 4. Add a dep only if it's truly irreplaceable — and note it here.
5. **Design language carries forward.** Warm paper aesthetic. Thin rules. No shadows. No color overload. Ring colors are the only new visual layer — keep them muted and consistent.
6. **AI suggestions are evidence-based, not generic.** Every suggestion the system generates must cite specific past data. No "try to be more productive" — only "on 7 previous Tuesdays, your deepest work happened before 11am."

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
*Status: DONE (in progress on branch `feature/desktop`)*

Hana pet. Four states. Speech bubble text input. Wins through existing pipeline. Global shortcut.

---

### 🔲 Stage 5 — Life Ring Tags + Categorization
*Status: NOT STARTED*
*Prerequisite: Stage 4 merged*

**What it adds:**
- The AI extraction prompt is updated to classify each win into one of the 5 areas (finance, social, growth, health, career) — or "unclassified" if ambiguous.
- `timeline-life.md` win blocks gain a `area:` field (e.g., `area: career`).
- The calendar surface gains 5 small colored dots per day cell — one per area that had at least one win that day. No numbers. Just presence.
- A new `--ring-*` color token is added to `styles.css` for each area. Colors should be muted and harmonious with the existing palette (not primary-color bright).
- The detail modal shows the area tag as a small label.

**What it does NOT add:**
- No ring visualization yet. No filtering. No new pages.
- Area tag is informational only at this stage.

**Data change:**
```
## Apr 30, 2026 — Shipped the categorization feature
area: career
```

**Definition of done:**
- [ ] Extraction prompt reliably tags wins into 5 areas
- [ ] `timeline-life.md` format updated with `area:` field
- [ ] Parser updated (both browser and server copies, in lockstep)
- [ ] Calendar cells show colored dot(s) for the areas present that day
- [ ] No visual regressions on existing calendar

---

### ✅ Stage 6 — Growth Ring View
*Status: DONE*
*Branch: `feature/aliceos`*

**What it adds:**
A second view — accessible by clicking a toggle in the calendar header — that renders a **radial bloom**:
- Each week is a concentric ring (innermost = oldest visible weeks, outermost = current week).
- Each ring is divided into 5 arcs — one per life area.
- Arc thickness = number of wins in that area that week. Zero wins = hairline. Strong week = full arc.
- Color = the area's `--ring-*` token.
- Tapping an arc segment shows a popover listing the wins for that area/week.
- The bloom is centered, fills the viewport, paper background, no chrome.

**Design constraint:**
The bloom should feel *organic*, not like a data visualization. Think less "radar chart", more "growing thing". Arcs should have slightly soft edges. Rings should breathe.

**Animation:**
On first load of the bloom view, rings grow outward from center over ~600ms. On return visits, no animation (just render).

**What it does NOT add:**
- No momentum heatmap yet. No goal system. No suggestions.

**Technical note:**
Use SVG for the bloom. No canvas, no D3 dependency. The geometry is simple enough for hand-written SVG math.

**Definition of done:**
- [x] Toggle between calendar view and bloom view in the header
- [x] Bloom renders correctly with real data for at least 4 weeks
- [x] Tap/click on arc segment shows win list for that area/week
- [x] Smooth grow animation on first load
- [x] No new npm dependencies

---

### ✅ Stage 7 — Momentum Heatmap
*Status: DONE*
*Branch: `feature/aliceos`*

**What it adds:**
A third view — the **year heatmap**. GitHub-style contribution graph but for wins:
- 52 columns (weeks) × 7 rows (days). Monday at top.
- Each cell's fill intensity = number of wins that day (0 = empty, 1 = light, 3 = medium, 5+ = full).
- Color is the dominant area for that day (most wins in one area). If tied, career wins.
- Hovering/tapping a cell shows the day's wins in a small tooltip.
- A legend strip at the bottom shows area colors.
- The current day has a subtle ring indicator.

**Design constraint:**
Cells are small squares (not circles). Consistent with the paper aesthetic — warm tones, not neon. Empty cells should feel like blank paper, not gray void.

**What it does NOT add:**
- No goal system yet. No urgency/importance matrix. No energy tracking.

**Definition of done:**
- [x] Year view renders correctly
- [x] Intensity correctly reflects win count per day
- [x] Dominant area color applied correctly
- [x] Tooltip on hover/tap shows wins
- [x] View toggle in header now has 3 options: Month | Bloom | Year

---

### 🔲 Stage 8 — Goal System + Eisenhower Layer
*Status: NOT STARTED — Decision Engine Layer 1*
*Prerequisite: Stage 7 complete*

**What it adds:**
Goals are the backbone of the decision-improvement layer.

- **Goal setup UI:** A simple form (accessible from settings) where the user defines goals per area. Each goal has:
  - Title (e.g., "$5K MRR by December 2026")
  - Area (one of the 5)
  - Target date
  - An optional weekly milestone ("Send 10 emails this week")
  - Status: Active / Achieved / Paused

- **Weekly focus:** At the start of each week (Sunday night or Monday morning email), the system generates a brief based on the active goals and recent wins. It places the weekly milestones into a 2×2 Eisenhower grid:
  - **Urgent + Important:** must happen this week for a goal on track
  - **Not urgent + Important:** strategic work that compounds over time
  - **Urgent + Not important:** things that feel pressing but don't move goals
  - **Not important + Not urgent:** named and deprioritized

- **Urgency is calculated**, not felt. A milestone is "urgent" if its goal's target date is within 6 weeks AND the win count for that area is below weekly average. "Important" = directly tied to an active goal.

- **The grid appears in the Monday morning email** — not in the app UI yet (that comes in Stage 9).

**Data added:**
`~/.win-calendar/goals.json` — array of goal objects. Per-user, not in the vault.

**Definition of done:**
- [ ] Goal setup form accessible from settings
- [ ] Goals saved to `~/.win-calendar/goals.json`
- [ ] Monday morning email includes the Eisenhower grid (text/HTML)
- [ ] Urgency + importance calculated from goal data + win history
- [ ] At least one test goal works end-to-end

---

### 🔲 Stage 9 — Energy Tracking + Productivity Suggestions
*Status: NOT STARTED — Decision Engine Layer 2*
*Prerequisite: Stage 8 complete, at least 3 weeks of goal data*

**What it adds:**
Energy tracking turns the system from a *mirror* into a *coach*.

- **Energy field in journal:** When submitting wins, the user also provides:
  - Overall energy today (1–5 slider or quick-pick: low / medium / high)
  - Time blocks with intensity: "Did deep work 8–11am, admin 2–4pm, felt foggy after 5pm"
  - This is optional — the system degrades gracefully without it.

- **Energy model:** After 2+ weeks of data, the server builds a simple model:
  - Which hours had the most high-win-density days?
  - Which areas of work correlate with high vs. low energy?
  - What day-of-week patterns exist?

- **Daily suggestion in morning email:** One paragraph, evidence-based:
  > "On 6 previous Thursdays, your most productive deep work happened before 11am. Today is Thursday. Your ONE THING (from last night) is a career win. Block 8–11am."

- **Suggestion rules:**
  - Never suggest more than ONE time-block optimization per day.
  - Always cite the evidence ("on X previous days...").
  - If insufficient data (<10 entries), no suggestion — just the wins.
  - Never suggest during a low-energy pattern without acknowledging it ("Your last 3 days have been low energy. Today: one small win counts as a full day.").

**Data added:**
`energy` and `timeBlocks` fields on win entries in `timeline-life.md`.

**Definition of done:**
- [ ] Energy input added to journal composer (optional)
- [ ] Time block input added (free text, AI parses it)
- [ ] Energy model builds after 10+ entries
- [ ] Morning email includes one evidence-based suggestion when model has enough data
- [ ] Suggestion cites specific past data points
- [ ] Graceful degradation when no energy data exists

---

### 🔲 Stage 10 — Dashboard View (In-App AI OS)
*Status: NOT STARTED — Decision Engine Layer 3 (Synthesis + Output)*
*Prerequisite: Stage 9 complete*

**What it adds:**
Everything that was email-only comes into the app. A fourth view: **Dashboard**.

- Active goals + progress bars (wins toward weekly milestone)
- Eisenhower grid rendered visually
- Energy trend chart (last 30 days)
- Today's suggestion (same as email, surfaced in-app)
- "What to do now" button: generates a single next action based on current time, energy, and goal gaps

This is the full AI OS view. Not just a calendar. A decision support surface.

### Growth Chart — Portfolio View

The centrepiece of the Dashboard is a **stock-market-style growth chart** showing personal growth as a portfolio of 5 assets over time.

**What it shows:**
- 5 colored lines — one per life area (Finance / Social / Growth / Health / Career), using the same `--ring-*` color tokens from the bloom view
- 1 neutral total line — cumulative wins across all categories, always trending up
- X axis = time (weeks). Default range = all time (from first win entry). Toggle for 30d / 90d / all-time.
- Y axis = wins per week per category (individual lines) and cumulative total (total line)
- Hovering/tapping a point shows a tooltip: week label + win count per category that week

**Visual language:**
- Thin lines (1.5px), soft curves (not jagged step-chart)
- No fill under the lines — clean, not an area chart
- The total line is slightly thicker (2px) and in `--ink` (near-black)
- Grid lines are hairline `--rule` color, horizontal only, minimal
- Matches the paper aesthetic — feels like a journal, not a Bloomberg terminal

**What it communicates:**
- Career line climbing fast → you're in a build phase
- Finance line flat for 6 weeks → the $5K MRR goal needs attention
- Health line dipped → your body needs a win this week
- Total line always going up → you cannot go backwards. Every week adds.

**Implementation:** Hand-written SVG. No chart library. The data is simple enough (weekly aggregates per category) that D3 or Chart.js would be overkill and would violate the no-unnecessary-deps rule.

**Definition of done:**
- [ ] Dashboard view added to view toggle
- [ ] Growth chart renders with all 5 category lines + total line
- [ ] All-time default, with 30d / 90d / all-time toggle
- [ ] Hover tooltip shows week + per-category breakdown
- [ ] All other Dashboard components render with real data
- [ ] Decision Engine outputs rendered in full (see Decision Engine section below)
- [ ] No new npm dependencies (hand-written SVG for the chart)

---

## 🧠 Decision Engine — Architecture

> This is the core of the whole system. Everything else — tags, bloom, heatmap, goals, energy — is data collection. The Decision Engine is what turns that data into a decision.

The Decision Engine runs across Stages 8, 9, and 10. Three intelligence layers build on each other:

```
Layer 1 (Stage 8) — Goal Intelligence
  What matters? What is urgent? What is important?
  Input:  active goals + target dates + recent win counts per category
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

### What the Decision Engine produces

**1. Priority card — top of Dashboard, always visible**
> "Your ONE THING this week: [specific action]."
> "Why: [goal] is [X] weeks from deadline and your [category] wins have been flat for [N] weeks."
> "Best time to do it: [time block], based on [N] previous [day] patterns."

Rules:
- Always ONE thing. Never a list.
- Always cites the evidence: goal deadline + win gap + energy pattern.
- Degrades gracefully when data is missing — omit that layer's contribution but still output something.
- Never generic. "Work on your finance goal" is invalid output. "Send 10 emails from your teaching waitlist" is valid output.

**2. Drift alert — shown when triggered, not always**
If a category has had zero wins for 2+ weeks AND has an active goal:
> "[Category] has been quiet for [N] weeks. Your [goal title] is [X] weeks away. One small win in this area today would count."
Shown as a subtle inline callout. Not alarming. Just honest.

**3. Weekly Eisenhower grid — Monday morning email only**
The 2×2 matrix with this week's goal milestones placed by urgency + importance.
Not shown in-app every day — weekly cadence only.

**4. Daily morning email paragraph**
One paragraph synthesizing Layer 1 + Layer 2 for today specifically.
Delivered alongside the wins reveal. Always one paragraph. Always one suggestion.

### Decision Engine data dependencies

| What it needs | Source | Available at stage |
|---|---|---|
| Category tags on wins | `timeline-life.md` `area:` field | Stage 5 |
| Historical win counts per category | Parsed timeline | Stage 5 |
| Active goals + deadlines | `~/.win-calendar/goals.json` | Stage 8 |
| Eisenhower placement logic | Server calculation | Stage 8 |
| Energy levels + time blocks | `timeline-life.md` `energy:` field | Stage 9 |
| Historical energy patterns | Server model (10+ entries) | Stage 9 |
| Growth chart trends | Aggregated win data | Stage 10 |

**Minimum viable Decision Engine** (Stage 8 complete, no energy data yet):
- Priority card from goal deadlines + win gaps only (no time-of-day suggestion)
- Drift alerts when a goal category goes quiet
- Monday Eisenhower email

**Full Decision Engine** (Stage 10 complete):
- All of the above + energy-matched time recommendations + in-app priority card + "What to do now" button that synthesizes everything into one next action

---

## Dependency Map

```
Stage 1 ✅
  └─ Stage 2 ✅
       └─ Stage 3 ✅
            └─ Stage 4 ✅
                 └─ Stage 5 ✅
                      └─ Stage 6 ✅  ← DONE
                           └─ Stage 7 ✅
                                └─ Stage 8 🔲  ← START HERE
                                     └─ Stage 9 🔲
                                          └─ Stage 10 🔲
```

---

## Data Schema Evolution

| Stage | New fields / files |
|-------|--------------------|
| 5 | `area:` field on win blocks in `timeline-life.md` |
| 8 | `~/.win-calendar/goals.json` |
| 9 | `energy:` and `timeBlocks:` fields on win entries |

Backwards compatibility rule: all new fields are optional. The parser must not break on entries that predate the field.

---

## Open Design Questions (resolve before starting the relevant stage)

- **Stage 6 — resolved:** With only 1 week of data, the bloom shows a single ring (no placeholder, no partial state). The ring grows outward as more weeks accumulate. Empty-state copy: "No wins yet. Write your first journal entry and the bloom will grow."
- **Stage 6 — resolved:** The bloom shows the current week in progress. Data is data regardless of week completeness.
- **Stage 8:** How does the user define "weekly milestone" — free text or structured? Does the AI interpret it or is it rigid?
- **Stage 9:** Should energy be a slider (1–5) or a descriptive word (low / medium / high / exceptional)? Words are faster to input; numbers are easier to model.
- **Stage 10:** "What to do now" — does this write to ONE-THING.md in the vault, or is it app-only?
- **Stage 10 chart:** When a category has zero wins for several weeks, does the line drop to zero or hold at the last value? **Resolved: hold flat.**

---

## What This Is NOT

- Not a task manager (use Things, Notion, Linear for that)
- Not a social app (wins are private by default)
- Not a generic productivity dashboard (everything is personalized to your data)
- Not a replacement for journaling (it reads journals, doesn't replace them)

---

*Start with Stage 5. Read AGENTS.md. Read this file. Then read the relevant stage definition. Then and only then touch code.*
