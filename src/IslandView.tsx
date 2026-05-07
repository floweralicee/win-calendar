import { useEffect, useState } from 'react'
import { Calendar } from './Calendar'
import type { Win, WinsByDate } from './wins'

// ── Icon imports ──────────────────────────────────────────────────────────────
import isabelleIcon from './assets/ac-icons/isabelle.png'
import leafIcon from './assets/ac-icons/leaf.png'
import starFragmentIcon from './assets/ac-icons/star-fragment.png'
import tomNookIcon from './assets/ac-icons/tom-nook.png'
import bellCoinIcon from './assets/ac-icons/bell-coin.png'
import nookMilesIcon from './assets/ac-icons/nook-miles.png'
import recipeCardIcon from './assets/ac-icons/recipe-card.png'
import giftboxIcon from './assets/ac-icons/giftbox.png'
import peachIcon from './assets/ac-icons/peach.png'

// ── Types ─────────────────────────────────────────────────────────────────────
type VillagerStatus = 'active' | 'quiet' | 'dormant'

type Villager = {
  emoji: string
  name: string
  status: VillagerStatus
  detail: string
}

type GameState = {
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

type Strength = { strength: string; expression: string }

type Profile = {
  name: string
  tagline: string
  operatingMode: string
  peakWindow: string
  fuel: string
  strengths: Strength[]
}

type Goal = {
  id: string
  title: string
  area: string
  status: string
  milestone?: number
  currentValue?: number
  targetValue?: number
  deadline?: string
}

type IslandTab = 'island' | 'profile' | 'wins'

// ── Area icon map ─────────────────────────────────────────────────────────────
const AREA_ICONS: Record<string, string> = {
  finance: bellCoinIcon,
  social: giftboxIcon,
  growth: leafIcon,
  health: peachIcon,
  career: recipeCardIcon,
}

// ── Token unlock thresholds ───────────────────────────────────────────────────
const TOKEN_UNLOCKS = [
  { threshold: 10, label: 'Choose your weekly quest' },
  { threshold: 25, label: 'Rest day — no pushback' },
  { threshold: 50, label: 'Big picture session' },
  { threshold: 100, label: 'Full retrospective' },
]

function nextUnlock(tokens: number): { threshold: number; label: string } | null {
  return TOKEN_UNLOCKS.find((u) => tokens < u.threshold) ?? null
}

// ── Progress bar component ─────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="island-progress-track">
      <div
        className="island-progress-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────
function VillagerBadge({ status }: { status: VillagerStatus }) {
  const map: Record<VillagerStatus, { bg: string; color: string; label: string }> = {
    active: { bg: 'var(--ctp-peach-color)', color: '#fff', label: 'active' },
    quiet: { bg: 'var(--ctp-yellow)', color: '#fff', label: 'quiet' },
    dormant: { bg: 'var(--ctp-surface0)', color: 'var(--ctp-subtext)', label: 'dormant' },
  }
  const s = map[status]
  return (
    <span className="island-badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ── Card wrapper ───────────────────────────────────────────────────────────────
function IslandCard({ children, fullWidth }: { children: React.ReactNode; fullWidth?: boolean }) {
  return <div className={`island-card${fullWidth ? ' island-card--full' : ''}`}>{children}</div>
}

// ── Tab 1: Island ─────────────────────────────────────────────────────────────
function IslandTab1({ game, goals }: { game: GameState; goals: Goal[] }) {
  const [questDone, setQuestDone] = useState(false)
  const unlock = nextUnlock(game.tokens)

  return (
    <div className="island-tab-content">
      {/* Header */}
      <div className="island-header">
        <span className="island-header-icon">🏝️</span>
        <div>
          <div className="island-header-title">Your Island</div>
          <div className="island-header-sub">
            {game.streak > 0 ? `${game.streak}-day streak` : 'No streak yet'} ·{' '}
            <img src={leafIcon} alt="tokens" className="island-inline-icon" />
            {' '}{game.tokens} tokens
          </div>
        </div>
      </div>

      <div className="island-grid">
        {/* Today's Quest */}
        <IslandCard>
          <div className="island-card-header">
            <span className="island-card-label">Today's Quest</span>
            <img src={isabelleIcon} alt="Isabelle" className="island-card-icon" />
          </div>
          {game.activeQuest ? (
            <>
              <div className="island-card-body">{game.activeQuest}</div>
              {!questDone ? (
                <button
                  className="island-btn island-btn--green"
                  onClick={() => setQuestDone(true)}
                >
                  Mark Done ✓
                </button>
              ) : (
                <div className="island-card-done">✓ Quest logged!</div>
              )}
            </>
          ) : (
            <div className="island-card-empty">No quest set — ask Tom Nook</div>
          )}
        </IslandCard>

        {/* Weekly Challenge */}
        <IslandCard>
          <div className="island-card-header">
            <span className="island-card-label">Weekly Challenge</span>
            <img src={nookMilesIcon} alt="Nook Miles" className="island-card-icon" />
          </div>
          {game.weeklyQuest ? (
            <>
              <div className="island-card-body">{game.weeklyQuest}</div>
              {game.weeklyQuestProgress && (
                <>
                  <ProgressBar
                    value={game.weeklyQuestProgress.current}
                    max={game.weeklyQuestProgress.total}
                    color="var(--ctp-blue)"
                  />
                  <div className="island-progress-label">
                    {game.weeklyQuestProgress.current} / {game.weeklyQuestProgress.total} days
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="island-card-empty">No weekly challenge set</div>
          )}
        </IslandCard>

        {/* Sprint Arc */}
        <IslandCard fullWidth>
          <div className="island-card-header">
            <span className="island-card-label">Sprint Arc</span>
            <img src={starFragmentIcon} alt="Star Fragment" className="island-card-icon" />
          </div>
          {game.activeArc ? (
            <>
              <div className="island-card-body">
                {game.activeArc}
                {game.arcDay && (
                  <span className="island-arc-day"> · Day {game.arcDay}</span>
                )}
              </div>
              {game.arcProgress && (
                <>
                  <ProgressBar
                    value={game.arcProgress.current}
                    max={game.arcProgress.total}
                    color="var(--ctp-mauve)"
                  />
                  <div className="island-progress-label">{game.arcProgress.label}</div>
                </>
              )}
            </>
          ) : (
            <div className="island-card-empty">No active arc</div>
          )}
        </IslandCard>

        {/* Villagers */}
        <IslandCard fullWidth>
          <div className="island-card-header">
            <img src={tomNookIcon} alt="Tom Nook" className="island-card-icon island-card-icon--left" />
            <span className="island-card-label">Villagers</span>
          </div>
          {game.villagers.length > 0 ? (
            <ul className="island-villager-list">
              {game.villagers.map((v, i) => (
                <li key={i} className="island-villager-row">
                  <div className="island-villager-info">
                    <span className="island-villager-emoji">{v.emoji}</span>
                    <div>
                      <div className="island-villager-name">{v.name}</div>
                      {v.detail && (
                        <div className="island-villager-detail">{v.detail}</div>
                      )}
                    </div>
                  </div>
                  <VillagerBadge status={v.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="island-card-empty">No patterns identified yet</div>
          )}
        </IslandCard>

        {/* Token Unlock */}
        <IslandCard fullWidth>
          <div className="island-card-header">
            <img src={leafIcon} alt="Leaf" className="island-card-icon island-card-icon--left" />
            <span className="island-card-label">Clarity Tokens</span>
          </div>
          <div className="island-token-count">{game.tokens}</div>
          {unlock && (
            <>
              <ProgressBar
                value={game.tokens}
                max={unlock.threshold}
                color="var(--ctp-lavender)"
              />
              <div className="island-progress-label">
                {unlock.threshold - game.tokens} tokens until {unlock.label}
              </div>
            </>
          )}
          {!unlock && (
            <div className="island-card-done">All unlocks reached 🎉</div>
          )}
        </IslandCard>

        {/* Season Goals */}
        {goals.filter((g) => g.status === 'active').length > 0 && (
          <IslandCard fullWidth>
            <div className="island-card-header">
              <span className="island-card-label">Season Goals</span>
            </div>
            <ul className="island-goals-list">
              {goals
                .filter((g) => g.status === 'active')
                .map((g) => {
                  const icon = AREA_ICONS[g.area] ?? leafIcon
                  const current = g.currentValue ?? 0
                  const target = g.targetValue ?? 0
                  const pct = target > 0 ? Math.round((current / target) * 100) : 0
                  const areaColor: Record<string, string> = {
                    finance: 'var(--ctp-yellow)',
                    social: 'var(--ctp-pink)',
                    growth: 'var(--ctp-green)',
                    health: 'var(--ctp-peach-color)',
                    career: 'var(--ctp-blue)',
                  }
                  return (
                    <li key={g.id} className="island-goal-row">
                      <img src={icon} alt={g.area} className="island-goal-icon" />
                      <div className="island-goal-info">
                        <div className="island-goal-title">{g.title}</div>
                        {target > 0 && (
                          <>
                            <ProgressBar
                              value={current}
                              max={target}
                              color={areaColor[g.area] ?? 'var(--ctp-lavender)'}
                            />
                            <div className="island-progress-label">
                              {current.toLocaleString()} → {target.toLocaleString()} · {pct}%
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
            </ul>
          </IslandCard>
        )}
      </div>
    </div>
  )
}

// ── Tab 2: Profile ────────────────────────────────────────────────────────────
function ProfileTab({ profile, goals }: { profile: Profile; goals: Goal[] }) {
  return (
    <div className="island-tab-content">
      {/* Profile header */}
      <IslandCard fullWidth>
        <div className="island-profile-name">{profile.name}</div>
        <div className="island-profile-tagline">{profile.tagline}</div>
      </IslandCard>

      {/* Operating System */}
      <IslandCard fullWidth>
        <div className="island-card-label">⚡ How You Operate</div>
        <p className="island-profile-text">{profile.operatingMode}</p>
        <div className="island-profile-pills">
          <span className="island-pill" style={{ background: 'var(--ctp-sky)', color: '#fff' }}>
            Peak: {profile.peakWindow}
          </span>
          {profile.fuel.split(' · ').map((f, i) => (
            <span key={i} className="island-pill" style={{ background: 'var(--ctp-mantle)', color: 'var(--ctp-text)' }}>
              {f}
            </span>
          ))}
        </div>
      </IslandCard>

      {/* Intelligence */}
      {profile.strengths.length > 0 && (
        <IslandCard fullWidth>
          <div className="island-card-label">🧠 How You Think</div>
          <ul className="island-strengths-list">
            {profile.strengths.map((s, i) => (
              <li key={i} className="island-strength-row">
                <span className="island-strength-name">{s.strength}</span>
                <span className="island-strength-expr">{s.expression}</span>
              </li>
            ))}
          </ul>
        </IslandCard>
      )}

      {/* Season Goals */}
      {goals.filter((g) => g.status === 'active').length > 0 && (
        <IslandCard fullWidth>
          <div className="island-card-label">Season Goals</div>
          <ul className="island-goals-list">
            {goals
              .filter((g) => g.status === 'active')
              .map((g) => {
                const icon = AREA_ICONS[g.area] ?? leafIcon
                const current = g.currentValue ?? 0
                const target = g.targetValue ?? 0
                const pct = target > 0 ? Math.round((current / target) * 100) : 0
                return (
                  <li key={g.id} className="island-goal-row">
                    <img src={icon} alt={g.area} className="island-goal-icon" />
                    <div className="island-goal-info">
                      <div className="island-goal-title">{g.title}</div>
                      {target > 0 && (
                        <>
                          <ProgressBar value={current} max={target} color="var(--ctp-lavender)" />
                          <div className="island-progress-label">
                            {current.toLocaleString()} → {target.toLocaleString()} · {pct}%
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
          </ul>
        </IslandCard>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
type IslandViewProps = {
  winsByDate: WinsByDate
  year: number
  month: number
  onSelectWin: (win: Win) => void
  onDeleteWin: (win: Win) => void
  onUpdateWinAreas: (win: Win, areas: import('./wins').LifeArea[]) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onJumpToToday: () => void
  onOpenJournal: () => void
}

export function IslandView(props: IslandViewProps) {
  const [tab, setTab] = useState<IslandTab>('island')
  const [game, setGame] = useState<GameState | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/island/game-state').then((r) => r.json()),
      fetch('/api/island/profile').then((r) => r.json()),
      fetch('/api/goals').then((r) => r.json()).catch(() => []),
    ])
      .then(([g, p, gs]) => {
        setGame(g as GameState)
        setProfile(p as Profile)
        setGoals(Array.isArray(gs) ? gs : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="island-loading">
        <span>🌿 Loading your island…</span>
      </div>
    )
  }

  const tabs: { id: IslandTab; label: string }[] = [
    { id: 'island', label: '🏝️ Island' },
    { id: 'profile', label: '👤 Profile' },
    { id: 'wins', label: '⭐ Wins' },
  ]

  return (
    <div className="island-root">
      {/* Tab switcher */}
      <div className="island-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`island-tab-btn${tab === t.id ? ' island-tab-btn--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'island' && game && (
        <IslandTab1 game={game} goals={goals} />
      )}

      {tab === 'profile' && profile && (
        <ProfileTab profile={profile} goals={goals} />
      )}

      {tab === 'wins' && (
        <div className="island-wins-wrapper">
          <Calendar
            year={props.year}
            month={props.month}
            winsByDate={props.winsByDate}
            onSelectWin={props.onSelectWin}
            onDeleteWin={props.onDeleteWin}
            onUpdateWinAreas={props.onUpdateWinAreas}
            onPreviousMonth={props.onPreviousMonth}
            onNextMonth={props.onNextMonth}
            onJumpToToday={props.onJumpToToday}
            onOpenJournal={props.onOpenJournal}
            activeView="month"
            onSetView={() => {}}
          />
        </div>
      )}
    </div>
  )
}
