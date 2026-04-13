import React, { useMemo, useState } from 'react'
import { api, invalidatePath } from '../api'
import { useApp } from '../App'
import { track } from '../track'
import { Target, ChevronRight } from 'lucide-react'

function toNumber(input, fallback = null) {
  const s = String(input ?? '').trim()
  if (!s) return fallback
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export default function GoalSetup({ onComplete, embedded = false }) {
  const { baseCurrency, showToast, bumpData } = useApp()

  const [form, setForm] = useState({
    name: 'Independence',
    current_age: '',
    target_age: '60',
    target_amount: '',
    monthly_contribution: '',
    expected_annual_return_pct: '7',
  })

  const [saving, setSaving] = useState(false)
  const [show25x, setShow25x] = useState(false)
  const [annualSpend, setAnnualSpend] = useState('')

  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const parsed = useMemo(() => {
    const currentAge = toNumber(form.current_age)
    const targetAge = toNumber(form.target_age)
    const targetAmount = toNumber(form.target_amount)
    const expectedReturn = toNumber(form.expected_annual_return_pct, 7)

    return {
      currentAge,
      targetAge,
      targetAmount,
      expectedReturn,
      valid:
        currentAge != null &&
        targetAge != null &&
        targetAmount != null &&
        targetAge > currentAge,
    }
  }, [form])

  const estimated25x = useMemo(() => {
    const spend = toNumber(annualSpend)
    if (spend == null || spend <= 0) return null
    return Math.round(spend * 25)
  }, [annualSpend])

  const submit = async () => {
    const { currentAge, targetAge, targetAmount, expectedReturn } = parsed

    if (currentAge == null || targetAge == null || targetAmount == null) {
      showToast?.('Please fill in all required fields', 'error')
      return
    }

    if (targetAge <= currentAge) {
      showToast?.('Target age must be greater than current age', 'error')
      return
    }

    setSaving(true)
    try {
      const monthlyContribution = toNumber(form.monthly_contribution, 0) ?? 0

      const payload = {
        goal_type: 'retirement',
        name: (form.name || 'Independence').trim() || 'Independence',
        current_age: Math.trunc(currentAge),
        target_age: Math.trunc(targetAge),
        target_amount: targetAmount,
        monthly_contribution: Math.max(0, monthlyContribution),
        expected_annual_return_pct: expectedReturn,
        is_primary: true,
      }

      const goal = await api('/goals', {
        method: 'POST',
        body: payload,
      })

      invalidatePath('/goals')
      invalidatePath('/dashboard')
      invalidatePath('/forecast')
      invalidatePath('/settings')
      bumpData?.()

      track('goal_created', {
        source: embedded ? 'goal_setup_embedded' : 'goal_setup',
      })

      showToast?.('Goal created')
      onComplete?.(goal)
    } catch (e) {
      const msg =
        e?.detail ||
        e?.message ||
        (typeof e === 'string' ? e : null) ||
        'Failed to create goal'

      showToast?.(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const skip = () => {
    track('goal_setup_skipped', { source: embedded ? 'embedded' : 'page' })
    onComplete?.(null)
  }

  /* ── Embedded (modal/sheet) mode ──────────────────────────────────── */
  if (embedded) {
    const inp =
      'w-full px-3.5 py-2.5 rounded-xl border border-white/[.09] bg-white/[.06] text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all'

    const lbl =
      'block text-[10.5px] font-semibold uppercase tracking-[.08em] text-white/40 mb-1.5'

    return (
      /* flex-1 + min-h-0 so this fills the modal container's flex axis */
      <div className="h-full min-h-0 flex flex-col">
        {/* Compact header — fixed height, never scrolls */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-5 pb-4">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(120,169,230,0.12)',
              border: '1px solid rgba(120,169,230,0.18)',
            }}
          >
            <Target size={14} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-display tracking-tight text-white leading-tight">
              Set your primary goal
            </h2>
            <p className="text-[12px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.36)' }}>
              Shape your projections and scenarios.
            </p>
          </div>
        </div>

        <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (parsed.valid && !saving) submit()
          }}
          className="flex-1 min-h-0 flex flex-col"
        >
          {/* Scrollable fields area */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
            <div>
              <label className={lbl}>Goal name</label>
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className={inp}
                placeholder="Retirement at 60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.24)' }}>
                The amount you'd like to reach by your target age.
              </p>

              {/* 25× calculator */}
              <div
                className="mt-2.5 rounded-xl p-3.5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10.5px] font-semibold tracking-[.08em] uppercase" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      Estimate
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.26)' }}>
                      A common rule:{' '}
                      <span className="font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        25× annual spending
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShow25x((v) => !v)}
                    className="text-[11px] font-semibold text-accent hover:underline whitespace-nowrap flex-shrink-0"
                  >
                    {show25x ? 'Hide' : 'Use 25×'}
                  </button>
                </div>

                {show25x && (
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <label className="block text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.26)' }}>
                        Annual spending
                      </label>
                      <input
                        value={annualSpend}
                        onChange={(e) => {
                          const value = e.target.value
                          setAnnualSpend(value)
                          const clean = toNumber(value)
                          if (clean != null && clean > 0) {
                            update('target_amount', String(Math.round(clean * 25)))
                          }
                        }}
                        className={inp}
                        placeholder="40,000"
                        inputMode="decimal"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                        ={' '}
                        <span className="font-medium" style={{ color: 'rgba(255,255,255,0.60)' }}>
                          {estimated25x != null ? estimated25x.toLocaleString() : '—'}
                        </span>{' '}
                        {baseCurrency}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAnnualSpend('')
                          setShow25x(false)
                        }}
                        className="text-[11px] font-medium hover:underline"
                        style={{ color: 'rgba(255,255,255,0.28)' }}
                      >
                        Reset
                      </button>
                    </div>

                    <div className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
                      Rough planning shortcut — refine assumptions later.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={lbl}>Monthly contribution ({baseCurrency}) <span style={{ color: 'rgba(255,255,255,0.22)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>optional</span></label>
              <input
                value={form.monthly_contribution}
                onChange={(e) => update('monthly_contribution', e.target.value)}
                className={inp}
                placeholder="500"
                inputMode="decimal"
              />
              <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.24)' }}>
                How much you save toward this goal each month. You can update this anytime.
              </p>
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
              <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.24)' }}>
                Long-term assumption for projections. Many use 4–7%.
              </p>
            </div>
          </div>

          {/* Footer — fixed at bottom of flex column, never scrolls */}
          <div
            className="flex-shrink-0 px-5 py-4"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(10,15,26,0.92)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <button
              disabled={!parsed.valid || saving}
              className="w-full h-10 rounded-xl font-semibold text-sm transition-all hover:opacity-95 active:scale-[.99] disabled:opacity-35 inline-flex items-center justify-center gap-1.5"
              style={{ background: 'var(--gold)', color: '#0A0F1A' }}
              type="submit"
            >
              {saving ? 'Creating…' : 'Create goal'}
              {!saving && <ChevronRight size={13} />}
            </button>

            <button
              type="button"
              onClick={skip}
              className="w-full mt-2 py-1.5 text-[12px] font-medium text-center transition-colors"
              style={{ color: 'rgba(255,255,255,0.28)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.48)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    )
  }

  /* ── Standalone page mode (unchanged) ────────────────────────────── */
  const inp =
    'w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'

  const lbl =
    'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide'

  return (
    <div className="max-w-[520px] mx-auto">
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center justify-center rounded-full mb-6 w-16 h-16 mx-auto"
          style={{
            background: 'rgba(120,169,230,0.12)',
            border: '1px solid rgba(120,169,230,0.18)',
          }}
        >
          <Target size={28} className="text-accent" />
        </div>

        <h1 className="font-display tracking-tight text-ink dark:text-white text-3xl sm:text-4xl">
          Set your primary goal
        </h1>

        <p className="text-ink-muted dark:text-white/40 leading-relaxed mt-3 text-sm max-w-sm mx-auto">
          Set a target that makes work optional. We'll use it to shape your
          projections and scenarios.
        </p>
      </div>

      <div className="rounded-[28px] border overflow-hidden bg-white dark:bg-surface-dark-2 border-black/[.05] dark:border-white/[.06] shadow-card">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (parsed.valid && !saving) submit()
          }}
        >
          <div className="p-7 sm:p-9 space-y-6">
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
                The amount you'd like to reach by your target age.
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
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-ink-muted/50 dark:text-white/25 mb-1">
                        Annual spending
                      </label>
                      <input
                        value={annualSpend}
                        onChange={(e) => {
                          const value = e.target.value
                          setAnnualSpend(value)
                          const clean = toNumber(value)
                          if (clean != null && clean > 0) {
                            update('target_amount', String(Math.round(clean * 25)))
                          }
                        }}
                        className={inp}
                        placeholder="40,000"
                        inputMode="decimal"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-ink-muted/60 dark:text-white/30">
                        ={' '}
                        <span className="font-medium text-ink dark:text-white">
                          {estimated25x != null ? estimated25x.toLocaleString() : '—'}
                        </span>{' '}
                        {baseCurrency}
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

                    <div className="text-[11px] text-ink-muted/50 dark:text-white/25">
                      This is a rough planning shortcut — you can refine assumptions later.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={lbl}>
                Monthly contribution ({baseCurrency}){' '}
                <span className="font-normal normal-case tracking-normal text-ink-muted/40 dark:text-white/25">
                  optional
                </span>
              </label>
              <input
                value={form.monthly_contribution}
                onChange={(e) => update('monthly_contribution', e.target.value)}
                className={inp}
                placeholder="500"
                inputMode="decimal"
              />
              <p className="text-xs text-ink-muted/50 dark:text-white/25 mt-2">
                How much you save toward this goal each month. You can update this anytime.
              </p>
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
          </div>

          <div className="px-7 sm:px-9 pb-3">
            <button
              disabled={!parsed.valid || saving}
              className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-40 min-h-[48px]"
              type="submit"
            >
              {saving ? 'Creating…' : 'Create goal'}
            </button>
          </div>

          <p className="text-center text-xs text-ink-muted/40 dark:text-white/20 px-6">
            You can refine contributions and assumptions anytime in Plan.
          </p>

          <button
            type="button"
            onClick={skip}
            className="block mx-auto mt-4 mb-7 text-sm text-ink-muted/50 dark:text-white/25 hover:text-ink-muted dark:hover:text-white/40 transition-colors"
          >
            Skip for now — I&apos;ll set a goal later
          </button>
        </form>
      </div>
    </div>
  )
}
