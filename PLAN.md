# PLAN.md — Animini Focus Mode (Phase 5)

Branch: `feature/desktop`  
Last updated: 2026-05-10

---

## Goal

Add a Focus Challenge flow to the desktop pet. The pet helps the user turn a vague
thought into a concrete timed task, runs a countdown, then celebrates with a burp
when they report back what they did.

---

## The Full Flow

```
[idle]
  ↓ double-click

[BUBBLE: "What's on your mind today?"]
  user types anything — a worry, a task, a vague thing
  ↓ Enter / Submit

[REFRAMING]
  num1/num2 sprite flicker (existing processing animation)
  POST /api/reframe → Claude rewrites it
  ↓

[CONFIRM]
  Bubble shows the reframed task:
    "Work on your thesis for 25 minutes"
  Two buttons:
    [✊ Accept]          [↩ Nah, something else]

  → "Nah": bubble returns to input, pre-filled with original text, user edits and resubmits
  → loops until user accepts

[TIMER]
  Bubble shows:
    big blue monospace countdown  "25:00"
    small grey text               "you're doing it."
  Timer ticks down every second.

  ↓ hits 00:00

[DEBRIEF]
  Bubble shows:
    "What did you accomplish in 25 mins?"
  Textarea — user types what they actually did
  ↓ Enter / Submit

[BURP]
  Existing scheduleBurpAnimationThenFinish() fires
  Burp sound plays
  Pet shows burp1 → burp2 → burp3 frames
  ↓ dismiss — back to idle
```

---

## What Changes

### `server/src/prompts.ts`
Add `REFRAME_SYSTEM_PROMPT`:

```
You are a productivity assistant inside a desktop pet.

Rewrite the user's task as a simple, input-based action with a time limit.
That means: tell them what to DO and for HOW LONG — not what to finish.

Rules:
- One sentence only
- Plain, simple English — like talking to a friend
- Must include a time limit (default 25 min unless they mention one)
- Start with a verb
- No fancy words, no hype, no extra flair
- Return JSON only: { "reframed": "...", "durationMins": 25 }

Examples:
Input: "write my thesis"          → { "reframed": "Work on your thesis for 25 minutes", "durationMins": 25 }
Input: "clean my room"            → { "reframed": "Clean your room for 20 minutes", "durationMins": 20 }
Input: "I have so many emails"    → { "reframed": "Go through your emails for 25 minutes", "durationMins": 25 }
Input: "finish the presentation"  → { "reframed": "Work on your presentation for 25 minutes", "durationMins": 25 }
Input: "I need to call my mom"    → { "reframed": "Call your mom for 10 minutes", "durationMins": 10 }
```

### `server/src/routes/reframe.ts` *(new file)*
```
POST /api/reframe
Body:  { task: string }
Returns: { reframed: string, durationMins: number }
```
- Calls Claude via existing AI Gateway wrapper (`claude.ts` pattern)
- Parses JSON response
- Returns 400 if task is empty

### `server/src/index.ts`
Mount the new route: `app.route('/api/reframe', reframeRoute)`

### `desktop/src/main.ts`
New IPC handler:
```
ipcMain.handle('task:reframe', async (_, raw: string) => {
  const res = await fetch('http://127.0.0.1:8787/api/reframe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: raw }),
  })
  return res.json() // { reframed, durationMins }
})
```

### `desktop/src/preload.ts`
Add to contextBridge:
```ts
reframeTask: (raw: string) =>
  ipcRenderer.invoke('task:reframe', raw) as Promise<{ reframed: string; durationMins: number }>
```

### `desktop/src/renderer/hana.d.ts`
Add:
```ts
reframeTask(raw: string): Promise<{ reframed: string; durationMins: number }>
```

### `desktop/src/renderer/Pet.tsx`
New flow states (extend existing `SubmitStatus` / overlay pattern):

```ts
type FocusStep =
  | 'idle'        // normal pet — existing behaviour
  | 'input'       // "What's on your mind today?" textarea
  | 'reframing'   // num1/num2 flicker, waiting for Claude
  | 'confirm'     // show reframed task + Accept / Nah buttons
  | 'timer'       // countdown running
  | 'debrief'     // "What did you accomplish in X mins?" textarea
```

Key logic:
- `handleOpenFocus()` — double-click sets step to `'input'`, clears state
- `handleSubmitInput()` — calls `window.hana.reframeTask(raw)`, sets step to `'reframing'`, on response sets step to `'confirm'`
- `handleAccept()` — sets step to `'timer'`, starts `setInterval` countdown
- `handleNah()` — sets step to `'input'`, pre-fills textarea with original text
- `handleTimerEnd()` — clears interval, sets step to `'debrief'`
- `handleSubmitDebrief()` — calls existing `scheduleBurpAnimationThenFinish()`, then `dismissFocusState()`

Bubble renders different content per step. Existing journal flow (write win → burp) stays untouched as an alternative path — double-click still opens `'input'` with the new focus prompt; the debrief submit is what feeds the existing win pipeline.

### `desktop/src/renderer/styles.css`
New styles:
- `.challenge-card` — reframed task display, clean readable text
- `.accept-nah-row` — flex row, two buttons side by side
- `.btn-accept` — solid, dark
- `.btn-nah` — ghost/outline
- `.focus-timer` — `font-family: monospace`, large, `color: #4a90d9` (cool blue), `letter-spacing: 0.05em`
- `.focus-timer-label` — small grey "you're doing it." below the digits

---

## What Does NOT Change

- `scheduleBurpAnimationThenFinish()` — reused as-is for the debrief submit
- Win calendar, Obsidian pipeline, autolayer — untouched
- Pet sprites — same art, same states
- Existing journal flow — still works; the debrief text feeds the same `submitJournal` IPC

---

## Build Order

1. `server/src/prompts.ts` — add reframe prompt
2. `server/src/routes/reframe.ts` — new endpoint
3. `server/src/index.ts` — mount route
4. `desktop/src/main.ts` — `task:reframe` IPC handler
5. `desktop/src/preload.ts` + `hana.d.ts` — expose to renderer
6. `desktop/src/renderer/Pet.tsx` — focus flow states + bubble UI
7. `desktop/src/renderer/styles.css` — challenge card, timer, buttons

---

## Open Questions

- Should the debrief text also be saved as a win via the existing journal pipeline? (Likely yes — reuse `submitJournal` IPC so the burp fires on real wins.)
- Should the timer be cancellable mid-session? (Add a small "× stop" ghost link in the timer bubble.)
- Rare burp variant for future: if user completes 3 sessions in a day, trigger a different burp frame sequence.
