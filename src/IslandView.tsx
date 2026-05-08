import { useEffect, useState } from 'react'
import { MonthGrid } from './MonthGrid'
import type { Win, WinsByDate } from './wins'

import isabelleIcon from './assets/ac-icons/isabelle.png'
import leafIcon from './assets/ac-icons/leaf.png'
import starFragmentIcon from './assets/ac-icons/star-fragment.png'
import tomNookIcon from './assets/ac-icons/tom-nook.png'
import bellCoinIcon from './assets/ac-icons/bell-coin.png'
import nookMilesIcon from './assets/ac-icons/nook-miles.png'
import recipeCardIcon from './assets/ac-icons/recipe-card.png'
import giftboxIcon from './assets/ac-icons/giftbox.png'
import peachIcon from './assets/ac-icons/peach.png'

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

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

const AREA_ICONS: Record<string, string> = {
  finance: bellCoinIcon,
  social: giftboxIcon,
  growth: leafIcon,
  health: peachIcon,
  career: recipeCardIcon,
}

const TOKEN_UNLOCKS = [
  { threshold: 10, label: 'Choose your weekly quest' },
  { threshold: 25, label: 'Rest day — no pushback' },
  { threshold: 50, label: 'Big picture session' },
  { threshold: 100, label: 'Full retrospective' },
]

function nextUnlock(tokens: number): { threshold: number; label: string } | null {
  return TOKEN_UNLOCKS.find((u) => tokens < u.threshold) ?? null
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="island-progress-track">
      <div className="island-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function VillagerBadge({ status }: { status: VillagerStatus }) {
  const map: Record<VillagerStatus, { bg: string; color: string; label: string }> = {
    active: { bg: 'var(--ctp-peach)', color: '#fff', label: 'active' },
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

function IslandCard({
  children,
  fullWidth,
  grouped,
}: {
  children: React.ReactNode
  fullWidth?: boolean
  grouped?: boolean
}) {
  const mods = [
    fullWidth ? 'island-card--full' : '',
    grouped ? 'island-card--grouped' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return <div className={`island-card${mods ? ` ${mods}` : ''}`}>{children}</div>
}

function IslandTab1({ game, goals }: { game: GameState; goals: Goal[] }) {
  const [questDone, setQuestDone] = useState(false)
  const unlock = nextUnlock(game.tokens)

  return (
    <div className="island-tab-content">
      <div className="island-hero-card island-card island-card--grouped">
        <span className="island-hero-emoji" aria-hidden="true">
          🏝️
        </span>
        <div className="island-hero-copy">
          <div className="island-hero-title">Your island</div>
          <div className="island-hero-sub">
            {game.streak > 0 ? `${game.streak}-day streak` : 'No streak yet'} ·{' '}
            <img src={leafIcon} alt="" className="island-inline-icon" />
            {' '}
            {game.tokens} tokens
          </div>
        </div>
      </div>

      <div className="island-grid">
        <IslandCard grouped>
          <div className="island-card-header">
            <span className="island-card-label">Today&apos;s quest</span>
            <img src={isabelleIcon} alt="" className="island-card-icon" />
          </div>
          {game.activeQuest ? (
            <>
              <div className="island-card-body">{game.activeQuest}</div>
              {!questDone ? (
                <button type="button" className="island-btn island-btn--green" onClick={() => setQuestDone(true)}>
                  Mark done
                </button>
              ) : (
                <div className="island-card-done">Quest logged.</div>
              )}
            </>
          ) : (
            <div className="island-card-empty">No quest set — ask Tom Nook.</div>
          )}
        </IslandCard>

        <IslandCard grouped>
          <div className="island-card-header">
            <span className="island-card-label">Weekly challenge</span>
            <img src={nookMilesIcon} alt="" className="island-card-icon" />
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
            <div className="island-card-empty">No weekly challenge set.</div>
          )}
        </IslandCard>

        <IslandCard fullWidth grouped>
          <div className="island-card-header">
            <span className="island-card-label">Sprint arc</span>
            <img src={starFragmentIcon} alt="" className="island-card-icon" />
          </div>
          {game.activeArc ? (
            <>
              <div className="island-card-body">
                {game.activeArc}
                {game.arcDay && <span className="island-arc-day"> · Day {game.arcDay}</span>}
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
            <div className="island-card-empty">No active arc.</div>
          )}
        </IslandCard>

        <IslandCard fullWidth grouped>
          <div className="island-card-header island-card-header--villagers">
            <img src={tomNookIcon} alt="" className="island-card-icon island-card-icon--left" />
            <span className="island-card-label">Villagers</span>
          </div>
          {game.villagers.length > 0 ? (
            <ul className="island-villager-list">
              {game.villagers.map((villager, index) => (
                <li key={index} className="island-villager-row">
                  <div className="island-villager-info">
                    <span className="island-villager-emoji">{villager.emoji}</span>
                    <div>
                      <div className="island-villager-name">{villager.name}</div>
                      {villager.detail && (
                        <div className="island-villager-detail">{villager.detail}</div>
                      )}
                    </div>
                  </div>
                  <VillagerBadge status={villager.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="island-card-empty">No patterns identified yet.</div>
          )}
        </IslandCard>

        <IslandCard fullWidth grouped>
          <div className="island-card-header">
            <img src={leafIcon} alt="" className="island-card-icon island-card-icon--left" />
            <span className="island-card-label">Clarity tokens</span>
          </div>
          <div className="island-token-count">{game.tokens}</div>
          {unlock && (
            <>
              <ProgressBar value={game.tokens} max={unlock.threshold} color="var(--ctp-lavender)" />
              <div className="island-progress-label">
                {unlock.threshold - game.tokens} tokens until {unlock.label}
              </div>
            </>
          )}
          {!unlock && <div className="island-card-done">All unlocks reached.</div>}
        </IslandCard>

        {goals.filter((goalEntry) => goalEntry.status === 'active').length > 0 && (
          <IslandCard fullWidth grouped>
            <div className="island-card-header">
              <span className="island-card-label">Season goals</span>
            </div>
            <ul className="island-goals-list">
              {goals
                .filter((goalEntry) => goalEntry.status === 'active')
                .map((goalEntry) => {
                  const icon = AREA_ICONS[goalEntry.area] ?? leafIcon
                  const current = goalEntry.currentValue ?? 0
                  const target = goalEntry.targetValue ?? 0
                  const pct = target > 0 ? Math.round((current / target) * 100) : 0
                  const areaColor: Record<string, string> = {
                    finance: 'var(--ctp-yellow)',
                    social: 'var(--ctp-pink)',
                    growth: 'var(--ctp-green)',
                    health: 'var(--ctp-peach)',
                    career: 'var(--ctp-blue)',
                  }
                  return (
                    <li key={goalEntry.id} className="island-goal-row">
                      <img src={icon} alt={goalEntry.area} className="island-goal-icon" />
                      <div className="island-goal-info">
                        <div className="island-goal-title">{goalEntry.title}</div>
                        {target > 0 && (
                          <>
                            <ProgressBar
                              value={current}
                              max={target}
                              color={areaColor[goalEntry.area] ?? 'var(--ctp-lavender)'}
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

function ProfileTab({ profile, goals }: { profile: Profile; goals: Goal[] }) {
  return (
    <div className="island-tab-content island-profile-stack">
      <section className="island-profile-hero island-card island-card--grouped">
        <div className="island-profile-hero-label">Passport</div>
        <div className="island-profile-name">{profile.name}</div>
        <div className="island-profile-tagline">{profile.tagline}</div>
      </section>

      <section className="island-group island-card island-card--grouped island-card--inset-list">
        <div className="island-group-header">
          <span className="island-group-title">How you operate</span>
        </div>
        <p className="island-profile-text">{profile.operatingMode}</p>
        <ul className="island-inset-meta">
          <li className="island-inset-row">
            <span className="island-inset-label">Peak</span>
            <span className="island-inset-value">{profile.peakWindow}</span>
          </li>
          <li className="island-inset-row island-inset-row--stack">
            <span className="island-inset-label">Fuel</span>
            <span className="island-inset-value">{profile.fuel}</span>
          </li>
        </ul>
      </section>

      {profile.strengths.length > 0 && (
        <section className="island-group island-card island-card--grouped island-card--inset-list">
          <div className="island-group-header">
            <span className="island-group-title">How you think</span>
          </div>
          <ul className="island-strength-inset-list">
            {profile.strengths.map((strengthRow, index) => (
              <li key={index} className="island-strength-inset-row">
                <span className="island-strength-name">{strengthRow.strength}</span>
                <span className="island-strength-expr">{strengthRow.expression}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {goals.filter((goalEntry) => goalEntry.status === 'active').length > 0 && (
        <section className="island-group island-card island-card--grouped">
          <div className="island-group-header">
            <span className="island-group-title">Season goals</span>
          </div>
          <ul className="island-goals-list">
            {goals
              .filter((goalEntry) => goalEntry.status === 'active')
              .map((goalEntry) => {
                const icon = AREA_ICONS[goalEntry.area] ?? leafIcon
                const current = goalEntry.currentValue ?? 0
                const target = goalEntry.targetValue ?? 0
                const pct = target > 0 ? Math.round((current / target) * 100) : 0
                return (
                  <li key={goalEntry.id} className="island-goal-row">
                    <img src={icon} alt={goalEntry.area} className="island-goal-icon" />
                    <div className="island-goal-info">
                      <div className="island-goal-title">{goalEntry.title}</div>
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
        </section>
      )}
    </div>
  )
}

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
  onExitIsland: () => void
}

export function IslandView(props: IslandViewProps) {
  const [tab, setTab] = useState<IslandTab>('island')
  const [game, setGame] = useState<GameState | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/island/game-state').then((response) => response.json()),
      fetch('/api/island/profile').then((response) => response.json()),
      fetch('/api/goals')
        .then((response) => response.json())
        .catch(() => []),
    ])
      .then(([gameJson, profileJson, goalsJson]) => {
        setGame(gameJson as GameState)
        setProfile(profileJson as Profile)
        setGoals(Array.isArray(goalsJson) ? goalsJson : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="island-root island-root--loading">
        <div className="island-loading">
          <span>Loading your island…</span>
        </div>
      </div>
    )
  }

  const tabs: { id: IslandTab; label: string; icon?: string }[] = [
    { id: 'island', label: 'Island', icon: leafIcon },
    { id: 'profile', label: 'Profile', icon: isabelleIcon },
    { id: 'wins', label: 'Wins', icon: starFragmentIcon },
  ]

  return (
    <div className="island-root">
      <header className="island-shell-header">
        <button
          type="button"
          className="island-shell-back"
          onClick={props.onExitIsland}
          aria-label="Back to GrowthOS calendar"
        >
          Calendar
        </button>
        <div className="island-shell-title-block">
          <span className="island-shell-eyebrow">Personal OS</span>
          <span className="island-shell-title">Island</span>
        </div>
        <button type="button" className="island-shell-journal" onClick={props.onOpenJournal}>
          Journal
        </button>
      </header>

      <div className="island-segmented" role="tablist" aria-label="Island sections">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            role="tab"
            aria-selected={tab === tabItem.id}
            className={`island-segment${tab === tabItem.id ? ' island-segment--active' : ''}`}
            onClick={() => setTab(tabItem.id)}
          >
            {tabItem.icon && (
              <img src={tabItem.icon} alt="" className="island-segment-icon" width={18} height={18} />
            )}
            <span>{tabItem.label}</span>
          </button>
        ))}
      </div>

      <main className="island-main">
        {tab === 'island' && game && <IslandTab1 game={game} goals={goals} />}
        {tab === 'profile' && profile && <ProfileTab profile={profile} goals={goals} />}
        {tab === 'wins' && (
          <div className="island-wins-panel">
            <div className="island-month-toolbar">
              <button
                type="button"
                className="island-toolbar-btn island-toolbar-btn--nav"
                onClick={props.onPreviousMonth}
                aria-label="Previous month"
              >
                ‹
              </button>
              <button type="button" className="island-toolbar-month" onClick={props.onJumpToToday}>
                {MONTH_LABELS[props.month]}
              </button>
              <button
                type="button"
                className="island-toolbar-btn island-toolbar-btn--nav"
                onClick={props.onNextMonth}
                aria-label="Next month"
              >
                ›
              </button>
              <span className="island-toolbar-year">{props.year}</span>
            </div>
            <div className="island-month-surface">
              <MonthGrid
                year={props.year}
                month={props.month}
                winsByDate={props.winsByDate}
                onSelectWin={props.onSelectWin}
                onDeleteWin={props.onDeleteWin}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
