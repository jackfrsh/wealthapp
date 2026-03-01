// frontend/src/pages/GoalSetup.jsx
import React, { useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import { track } from '../track'
import { Target } from 'lucide-react'

function toNumber(input, fallback = null) {
  const s = String(input ?? '').trim()
  if (!s) return fallback
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export default function GoalSetup({ onComplete }) {
  const { baseCurrency, showToast, setPage } = useApp()

  const [form, setForm] = useState({
    name: 'Independence',
    current_age: '',
    target_age: '60',
    target_amount: '',
    expected_annual_return_pct: '7',
  })
  const [saving, setSaving] = useState(false)

  const [show25x, setShow25x] = useState(false)
  const [annualSpend, setAnnualSpend] = useState('')

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const submit = async () => {
    const currentAge = toNumber(form.current_age)
    const targetAge = toNumber(form.target_age)
    const targetAmount = toNumber(form.target_amount)
    const expectedReturn = toNumber(form.expected_annual_return_pct, 7)

    if (currentAge == null || targetAge == null || targetAmount == null) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    if (targetAge <= currentAge) {
      showToast('Target age must be greater than current age', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        goal_type: 'retirement',
        name: (form.name || 'Independence').trim() || 'Independence',
        current_age: Math.trunc(currentAge),
        target_age: Math.trunc(targetAge),
        target_amount: targetAmount,
        monthly_contribution: 0,
        expected_annual_return_pct: expectedReturn,
        is_primary: true,
      }

      // Create goal (no premature navigation)
      const goal = await api('/goals', {
        method: 'POST',
        body: payload,
      })

      // Track only after success (fire-and-forget)
      track('goal_created', { source: 'goal_setup' })

      showToast('Goal created')

      // Next step: add first account
      setPage('accounts')

      // Let parent lock state immediately for routing
      onComplete?.(goal)
    } catch (e) {
      const msg =
        e?.detail ||
        e?.message ||
        (typeof e === 'string' ? e : null) ||
        'Failed to create goal'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inp =
    'w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide'

  const valid = form.current_age && form.target_age && form.target_amount

  return (
    <div className="max-w-[480px] mx-auto">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-accent/10 dark:bg-accent/15 flex items-center justify-center mx-auto mb-6">
          <Target size={28} className="text-accent" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
          Set your primary goal
        </h1>
        <p className="text-sm text-ink-muted dark:text-white/40 mt-3 leading-relaxed max-w-sm mx-auto">
Set a target that makes work optional. We’ll use it to shape your projections and scenarios.
</p>
      </div>

      <div className="bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card border border-black/[.05] dark:border-white/[.06] p-7 sm:p-9">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !saving) submit()
          }}
          className="space-y-6 animate-fade-in"
        >
          <div>
            <label className={lbl}>Goal name</label>
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inp}
              placeholder="Retirement at 60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Your age</label>
              <input
                value={form.current_age}
                onChange={(e) => update('current_age', e.target.value)}
                className={inp}
                placeholder="32"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className={lbl}>Target age</label>
              <input
                value={form.target_age}
                onChange={(e) => update('target_age', e.target.value)}
                className={inp}
                placeholder="60"
                inputMode="numeric"
              />
            </div>
          </div>

          <div>
  <label className={lbl}>Target amount ({baseCurrency})</label>

  <input
    value={form.target_amount}
    onChange={(e) => update('target_amount', e.target.value)}
    className={inp}
    placeholder="1,000,000"
    inputMode="decimal"
  />

<p className="text-xs text-ink-muted/50 dark:text-white/25 mt-2">
  The amount you’d like to reach by your target age.
</p>

<div className="mt-3 rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.03] p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-xs font-semibold text-ink-3 dark:text-white/50 tracking-wide">
        Estimate
      </div>
      <div className="text-xs text-ink-muted/60 dark:text-white/30 mt-1">
        A common rule of thumb is <span className="font-medium">25× annual spending</span>.
      </div>
    </div>

    <button
      type="button"
      onClick={() => setShow25x((v) => !v)}
      className="text-xs font-semibold text-accent hover:underline whitespace-nowrap"
    >
      {show25x ? 'Hide' : 'Use 25×'}
    </button>
  </div>

  {show25x && (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
      <div>
        <label className="block text-xs text-ink-muted/50 dark:text-white/25 mb-1">
          Annual spending
        </label>
        <input
          value={annualSpend}
          onChange={(e) => {
            const v = e.target.value
            setAnnualSpend(v)
            const clean = Number(String(v).replace(/,/g, ''))
            if (!isNaN(clean) && clean > 0) {
              update('target_amount', String(Math.round(clean * 25)))
            }
          }}
          className={inp}
          placeholder="40,000"
          inputMode="decimal"
        />
      </div>

      <div className="text-xs text-ink-muted/60 dark:text-white/30 sm:pb-3">
        ={' '}
        <span className="font-medium text-ink dark:text-white">
          {(() => {
            const clean = Number(String(annualSpend).replace(/,/g, ''))
            if (!Number.isFinite(clean) || clean <= 0) return '—'
            return (Math.round(clean * 25)).toLocaleString()
          })()}
        </span>{' '}
        {baseCurrency}
      </div>

      <div className="sm:col-span-2 flex items-center justify-between">
        <div className="text-[11px] text-ink-muted/50 dark:text-white/25">
          This is a rough planning shortcut — you can refine assumptions later.
        </div>
        <button
          type="button"
          onClick={() => {
            setAnnualSpend('')
            setShow25x(false)
          }}
          className="text-[11px] font-semibold text-ink-muted/60 dark:text-white/30 hover:underline"
        >
          Reset
        </button>
      </div>
    </div>
  )}
</div>
</div>
          <div>
            <label className={lbl}>Expected annual return (%)</label>
            <input
              value={form.expected_annual_return_pct}
              onChange={(e) => update('expected_annual_return_pct', e.target.value)}
              className={inp}
              placeholder="7"
              inputMode="decimal"
            />
            <p className="text-xs text-ink-muted/50 dark:text-white/25 mt-2">
  A long-term assumption used for projections. You can change this anytime.
</p>
<p className="text-xs text-ink-muted/50 dark:text-white/25 mt-1">
  Many people use 4–7% for long-term planning.
</p>
          </div>

          <button
            disabled={!valid || saving}
            className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-40 min-h-[48px]"
            type="submit"
          >
            {saving ? 'Creating...' : 'Create goal'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-ink-muted/40 dark:text-white/20 mt-6">
        You can refine contributions and assumptions anytime in Outlook.
      </p>

      <button
        type="button"
        onClick={() => {
          track('goal_setup_skipped')
          onComplete?.(null)
        }}
        className="block mx-auto mt-4 text-sm text-ink-muted/50 dark:text-white/25 hover:text-ink-muted dark:hover:text-white/40 transition-colors"
      >
        Skip for now — I'll set a goal later
      </button>
    </div>
  )
}