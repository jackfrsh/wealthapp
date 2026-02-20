import React, { useState } from 'react'
import { apiPost } from "../api";
import { useApp } from '../App'
import { Target } from 'lucide-react'

export default function GoalSetup({ onComplete }) {
  const { baseCurrency, showToast } = useApp()
  const [form, setForm] = useState({
    name: 'Retirement',
    current_age: '',
    target_age: '60',
    target_amount: '',
    expected_annual_return_pct: '7',
  })
  const [saving, setSaving] = useState(false)

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const submit = async () => {
    if (!form.current_age || !form.target_age || !form.target_amount) {
      showToast('Please fill in all required fields', 'error')
      return
    }
    setSaving(true)
    try {
      const goal = await apiPost('/goals', {
          goal_type: 'retirement',
          name: form.name || 'Retirement',
          current_age: Number(form.current_age),
          target_age: Number(form.target_age),
          target_amount: Number(String(form.target_amount).replace(/,/g, '')),
          monthly_contribution: 0,
          expected_annual_return_pct: Number(form.expected_annual_return_pct || '7'),
          is_primary: true,
        })
      showToast('Goal created')
      onComplete(goal)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inp = "w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
  const lbl = "block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide"

  const valid = form.current_age && form.target_age && form.target_amount

  return (
    <div className="max-w-[480px] mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-accent/10 dark:bg-accent/15 flex items-center justify-center mx-auto mb-6">
          <Target size={28} className="text-accent" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
          Set your primary goal
        </h1>
        <p className="text-sm text-ink-muted dark:text-white/40 mt-3 leading-relaxed max-w-sm mx-auto">
          Your wealth plan starts with a clear destination. Everything else — tracking, projections, insights — flows from this.
        </p>
      </div>

      {/* Single-step form */}
      <div className="bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card border border-black/[.05] dark:border-white/[.06] p-7 sm:p-9">
        <div className="space-y-6 animate-fade-in">
          <div>
            <label className={lbl}>Goal name</label>
            <input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              className={inp}
              placeholder="Retirement at 60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Your current age</label>
              <input
                value={form.current_age}
                onChange={e => update('current_age', e.target.value)}
                className={inp}
                placeholder="32"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className={lbl}>Target retirement age</label>
              <input
                value={form.target_age}
                onChange={e => update('target_age', e.target.value)}
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
              onChange={e => update('target_amount', e.target.value)}
              className={inp}
              placeholder="1,000,000"
              inputMode="decimal"
            />
            <p className="text-xs text-ink-muted/50 dark:text-white/25 mt-2">How much do you want to have by your target age?</p>
          </div>

          <div>
            <label className={lbl}>Expected annual return (%)</label>
            <input
              value={form.expected_annual_return_pct}
              onChange={e => update('expected_annual_return_pct', e.target.value)}
              className={inp}
              placeholder="7"
              inputMode="decimal"
            />
            <p className="text-xs text-ink-muted/50 dark:text-white/25 mt-2">A global equity index has historically returned ~7% p.a. after inflation.</p>
          </div>

          <button
            onClick={submit}
            disabled={!valid || saving}
            className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-40 min-h-[48px]"
          >
            {saving ? 'Creating...' : 'Create goal'}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-ink-muted/40 dark:text-white/20 mt-6">
        You can refine contributions and assumptions anytime in Strategy.
      </p>
    </div>
  )
}
