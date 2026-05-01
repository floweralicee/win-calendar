import { useState, useEffect, useCallback } from 'react'
import {
  fetchGoals,
  createGoal,
  updateGoal,
  removeGoal,
  type Goal,
  type GoalInput,
  type GoalStatus,
} from './api'
import type { LifeArea } from './wins'

// ─── Constants ────────────────────────────────────────────────────────────────

const SELECTABLE_AREAS: LifeArea[] = ['finance', 'social', 'growth', 'health', 'career']

const AREA_LABELS: Record<LifeArea, string> = {
  finance: 'Finance',
  social: 'Social',
  growth: 'Growth',
  health: 'Health',
  career: 'Career',
  unclassified: 'Other',
}

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Active',
  achieved: 'Achieved ✓',
  paused: 'Paused',
}

const STATUS_ORDER: GoalStatus[] = ['active', 'achieved', 'paused']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weeksUntil(targetDateISO: string): number {
  const target = new Date(targetDateISO + 'T00:00:00')
  const now = new Date()
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)
}

function formatDeadline(targetDateISO: string): string {
  const weeks = weeksUntil(targetDateISO)
  if (weeks < 0) return 'Overdue'
  if (weeks < 1) return 'This week'
  if (weeks < 2) return 'Next week'
  return `${Math.round(weeks)} wk`
}

function todayISO(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

// ─── Blank form state ─────────────────────────────────────────────────────────

type FormState = {
  title: string
  area: LifeArea
  targetDate: string
  weeklyMilestone: string
  status: GoalStatus
}

function blankForm(): FormState {
  return {
    title: '',
    area: 'career',
    targetDate: '',
    weeklyMilestone: '',
    status: 'active',
  }
}

function goalToForm(goal: Goal): FormState {
  return {
    title: goal.title,
    area: goal.area,
    targetDate: goal.targetDate,
    weeklyMilestone: goal.weeklyMilestone ?? '',
    status: goal.status,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type GoalCardProps = {
  goal: Goal
  onEdit: (goal: Goal) => void
  onStatusChange: (goal: Goal, status: GoalStatus) => void
  onDelete: (goal: Goal) => void
}

function GoalCard({ goal, onEdit, onStatusChange, onDelete }: GoalCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deadline = formatDeadline(goal.targetDate)
  const isOverdue = weeksUntil(goal.targetDate) < 0 && goal.status === 'active'

  return (
    <div className="goal-card">
      <div className="goal-card-top">
        <span className="goal-card-area-dot" data-area={goal.area} aria-hidden="true" />
        <div className="goal-card-body">
          <span className="goal-card-title">{goal.title}</span>
          {goal.weeklyMilestone && (
            <span className="goal-card-milestone">
              This week: {goal.weeklyMilestone}
            </span>
          )}
        </div>
        <span
          className={`goal-card-deadline${isOverdue ? ' goal-card-deadline-overdue' : ''}`}
        >
          {deadline}
        </span>
      </div>

      <div className="goal-card-actions">
        <div className="goal-card-status-row">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className="goal-status-btn"
              aria-pressed={goal.status === s}
              onClick={() => onStatusChange(goal, s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="goal-card-action-btns">
          <button
            type="button"
            className="goal-action-btn"
            onClick={() => onEdit(goal)}
          >
            Edit
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                className="goal-action-btn goal-action-btn-danger"
                onClick={() => onDelete(goal)}
              >
                Confirm delete
              </button>
              <button
                type="button"
                className="goal-action-btn"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="goal-action-btn"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Inline form ─────────────────────────────────────────────────────────────

type GoalFormProps = {
  initialValues: FormState
  submitLabel: string
  onSubmit: (values: FormState) => Promise<void>
  onCancel: () => void
}

function GoalForm({ initialValues, submitLabel, onSubmit, onCancel }: GoalFormProps) {
  const [values, setValues] = useState<FormState>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!values.title.trim()) { setError('Title is required.'); return }
    if (!values.targetDate) { setError('Target date is required.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="goal-form" onSubmit={handleSubmit}>
      <div className="goal-form-field">
        <label className="goal-form-label">Title</label>
        <input
          className="goal-form-input"
          type="text"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. $5K MRR by December 2026"
          autoFocus
        />
      </div>

      <div className="goal-form-field">
        <label className="goal-form-label">Area</label>
        <div className="goal-form-area-row">
          {SELECTABLE_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              className="win-detail-area-btn"
              aria-pressed={values.area === area}
              data-area={area}
              onClick={() => set('area', area)}
            >
              {AREA_LABELS[area]}
            </button>
          ))}
        </div>
      </div>

      <div className="goal-form-row">
        <div className="goal-form-field">
          <label className="goal-form-label">Target date</label>
          <input
            className="goal-form-input"
            type="date"
            value={values.targetDate}
            min={todayISO()}
            onChange={(e) => set('targetDate', e.target.value)}
          />
        </div>
        <div className="goal-form-field">
          <label className="goal-form-label">Status</label>
          <select
            className="goal-form-select"
            value={values.status}
            onChange={(e) => set('status', e.target.value as GoalStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="goal-form-field">
        <label className="goal-form-label">
          This week's milestone <span className="goal-form-optional">(optional)</span>
        </label>
        <input
          className="goal-form-input"
          type="text"
          value={values.weeklyMilestone}
          onChange={(e) => set('weeklyMilestone', e.target.value)}
          placeholder="e.g. Send 10 cold emails"
        />
      </div>

      {error && <p className="goal-form-error">{error}</p>}

      <div className="goal-form-actions">
        <button
          type="submit"
          className="goal-form-submit"
          disabled={saving}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          className="goal-form-cancel"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

type EditingState =
  | { mode: 'adding' }
  | { mode: 'editing'; goal: Goal }
  | null

export function GoalsView() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingState>(null)

  const loadGoals = useCallback(async () => {
    try {
      const loaded = await fetchGoals()
      setGoals(loaded)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load goals.')
    }
  }, [])

  useEffect(() => { loadGoals() }, [loadGoals])

  async function handleCreate(values: FormState) {
    const input: GoalInput = {
      title: values.title,
      area: values.area,
      targetDate: values.targetDate,
      weeklyMilestone: values.weeklyMilestone || undefined,
      status: values.status,
    }
    const created = await createGoal(input)
    setGoals((prev) => [...prev, created])
    setEditing(null)
  }

  async function handleUpdate(goal: Goal, values: FormState) {
    const updated = await updateGoal(goal.id, {
      title: values.title,
      area: values.area,
      targetDate: values.targetDate,
      weeklyMilestone: values.weeklyMilestone || undefined,
      status: values.status,
    })
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    setEditing(null)
  }

  async function handleStatusChange(goal: Goal, status: GoalStatus) {
    const updated = await updateGoal(goal.id, { status })
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
  }

  async function handleDelete(goal: Goal) {
    await removeGoal(goal.id)
    setGoals((prev) => prev.filter((g) => g.id !== goal.id))
  }

  const activeGoals = goals.filter((g) => g.status === 'active')
  const achievedGoals = goals.filter((g) => g.status === 'achieved')
  const pausedGoals = goals.filter((g) => g.status === 'paused')

  if (loadError) {
    return (
      <div className="goals-error">
        <p>{loadError}</p>
      </div>
    )
  }

  return (
    <div className="goals-container">
      <div className="goals-header">
        <p className="goals-summary">
          {activeGoals.length} active goal{activeGoals.length !== 1 ? 's' : ''}
          {achievedGoals.length > 0 && ` · ${achievedGoals.length} achieved`}
        </p>
        {editing === null && (
          <button
            type="button"
            className="goals-add-btn"
            onClick={() => setEditing({ mode: 'adding' })}
          >
            + New goal
          </button>
        )}
      </div>

      {editing?.mode === 'adding' && (
        <div className="goals-form-section">
          <h2 className="goals-section-heading">New goal</h2>
          <GoalForm
            initialValues={blankForm()}
            submitLabel="Add goal"
            onSubmit={handleCreate}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {goals.length === 0 && editing === null && (
        <div className="goals-empty">
          <p>No goals yet. Add one to start tracking what matters.</p>
        </div>
      )}

      {[
        { label: 'Active', items: activeGoals },
        { label: 'Achieved', items: achievedGoals },
        { label: 'Paused', items: pausedGoals },
      ]
        .filter(({ items }) => items.length > 0)
        .map(({ label, items }) => (
          <section key={label} className="goals-section">
            <h2 className="goals-section-heading">
              {label} <span className="goals-section-count">{items.length}</span>
            </h2>
            <div className="goals-list">
              {items.map((goal) =>
                editing?.mode === 'editing' && editing.goal.id === goal.id ? (
                  <div key={goal.id} className="goals-form-section">
                    <GoalForm
                      initialValues={goalToForm(goal)}
                      submitLabel="Save changes"
                      onSubmit={(values) => handleUpdate(goal, values)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                ) : (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={(g) => setEditing({ mode: 'editing', goal: g })}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ),
              )}
            </div>
          </section>
        ))}
    </div>
  )
}
