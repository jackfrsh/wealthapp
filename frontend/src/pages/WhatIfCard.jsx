import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../App'
import { Lock } from 'lucide-react'

const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

function formatDurationMonths(m) {
  if (m == null) return '—'
  const years = Math.floor(m / 12)
  const months = m % 12
  if (years <= 0) return `${months} months`
  if (months === 0) return `${years} years`
  return `${years}y ${months}m`
}

function getIncludeFlag(a) {
  return a?.include_in_net_worth === true || a?.includeInNetWorth === true
}

function getMonthlyContribution(a) {
  return Number(a?.monthly_contribution ?? a?.monthlyContribution ?? 0) || 0
}

function getAnnualReturnPct(a, fallbackAnnualReturnPct) {
  const v =
    a?.annual_interest_rate_percent ??
    a?.annualInterestRatePercent ??
    a?.expected_annual_return_pct ??
    a?.expectedAnnualReturnPct ??
    fallbackAnnualReturnPct
  const n = Number(v)
  return Number.isFinite(n) ? n : Number(fallbackAnnualReturnPct || 0)
}

function monthsToReachGoal_perAccount({
  accounts,
  goalTarget,
  extraAmount = 0,
  extraAccountId = null,
  fallbackAnnualReturnPct = 0,
  mode = 'monthly', // 'monthly' | 'lump'
  maxMonths = 12 * 120,
}) {
  if (!goalTarget || goalTarget <= 0) return null

  const items = (accounts || [])
    .filter(getIncludeFlag)
    .map((a) => {
      const baseBal = Number(a?.balance || 0)
      const isSelected = extraAccountId != null && String(a.id) === String(extraAccountId)
      const lumpAdd = mode === 'lump' && isSelected ? Number(extraAmount || 0) : 0

      return {
        id: a.id,
        bal: baseBal + lumpAdd,
        m: getMonthlyContribution(a),
        r: (getAnnualReturnPct(a, fallbackAnnualReturnPct) / 100) / 12,
      }
    })

  if (items.length === 0) return null

  let months = 0
  const sum = () => items.reduce((s, x) => s + x.bal, 0)

  while (months < maxMonths && sum() < goalTarget) {
    for (const x of items) {
      const isSelected = extraAccountId != null && String(x.id) === String(extraAccountId)
      const monthlyAdd = mode === 'monthly' && isSelected ? Number(extraAmount || 0) : 0
      x.bal = x.bal * (1 + x.r) + x.m + monthlyAdd
    }
    months += 1
  }

  return months >= maxMonths ? null : months
}

function projectTotal_perAccount({
  accounts,
  months,
  extraAmount = 0,
  extraAccountId = null,
  fallbackAnnualReturnPct = 0,
  mode = 'monthly',
}) {
  const items = (accounts || [])
    .filter(getIncludeFlag)
    .map((a) => {
      const baseBal = Number(a?.balance || 0)
      const isSelected = extraAccountId != null && String(a.id) === String(extraAccountId)
      const lumpAdd = mode === 'lump' && isSelected ? Number(extraAmount || 0) : 0

      return {
        id: a.id,
        bal: baseBal + lumpAdd,
        m: getMonthlyContribution(a),
        r: (getAnnualReturnPct(a, fallbackAnnualReturnPct) / 100) / 12,
      }
    })

  for (let i = 0; i < months; i++) {
    for (const x of items) {
      const isSelected = extraAccountId != null && String(x.id) === String(extraAccountId)
      const monthlyAdd = mode === 'monthly' && isSelected ? Number(extraAmount || 0) : 0
      x.bal = x.bal * (1 + x.r) + x.m + monthlyAdd
    }
  }

  return items.reduce((s, x) => s + x.bal, 0)
}

export default function WhatIfCard({
  goalTarget = null,
  accounts = [],
  portfolioAnnualReturnPct = 7,
  onSimulationChange,
}) {
  const { isPro, setPage } = useApp()

  const included = useMemo(() => (accounts || []).filter(getIncludeFlag), [accounts])

  const [mode, setMode] = useState('monthly') // 'monthly' | 'lump'
  const [amount, setAmount] = useState(100)
  const [accountId, setAccountId] = useState('')

  useEffect(() => {
    if (accountId || included.length === 0) return
    const best = [...included].sort((a, b) => {
      const ra = getAnnualReturnPct(a, portfolioAnnualReturnPct)
      const rb = getAnnualReturnPct(b, portfolioAnnualReturnPct)
      return rb - ra
    })[0]
    setAccountId(best?.id ?? included[0].id)
  }, [accountId, included, portfolioAnnualReturnPct])

  useEffect(() => {
    if (mode === 'monthly') {
      if (amount > 500) setAmount(100)
    } else {
      if (amount < 1000) setAmount(5000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    if (!onSimulationChange) return
    onSimulationChange({ mode, amount, accountId })
  }, [mode, amount, accountId, onSimulationChange])

  const canCompute = Boolean(goalTarget) && included.length > 0

  const baselineMonths = useMemo(() => {
    if (!canCompute) return null
    return monthsToReachGoal_perAccount({
      accounts: included,
      goalTarget,
      extraAmount: 0,
      extraAccountId: accountId,
      fallbackAnnualReturnPct: portfolioAnnualReturnPct,
      mode,
    })
  }, [canCompute, included, goalTarget, accountId, portfolioAnnualReturnPct, mode])

  const whatIfMonths = useMemo(() => {
    if (!canCompute) return null
    return monthsToReachGoal_perAccount({
      accounts: included,
      goalTarget,
      extraAmount: amount,
      extraAccountId: accountId,
      fallbackAnnualReturnPct: portfolioAnnualReturnPct,
      mode,
    })
  }, [canCompute, included, goalTarget, accountId, portfolioAnnualReturnPct, mode, amount])

  const savedMonths =
    baselineMonths != null && whatIfMonths != null
      ? clamp(baselineMonths - whatIfMonths, -9999, 9999)
      : null

  const moneyDeltaByBaselineDate = useMemo(() => {
    if (!canCompute || baselineMonths == null) return null

    const baseTotal = projectTotal_perAccount({
      accounts: included,
      months: baselineMonths,
      extraAmount: 0,
      extraAccountId: accountId,
      fallbackAnnualReturnPct: portfolioAnnualReturnPct,
      mode,
    })

    const whatIfTotal = projectTotal_perAccount({
      accounts: included,
      months: baselineMonths,
      extraAmount: amount,
      extraAccountId: accountId,
      fallbackAnnualReturnPct: portfolioAnnualReturnPct,
      mode,
    })

    return whatIfTotal - baseTotal
  }, [canCompute, baselineMonths, included, accountId, portfolioAnnualReturnPct, mode, amount])

  const selected = included.find((a) => String(a.id) === String(accountId))
  const selectedRate = selected
    ? getAnnualReturnPct(selected, portfolioAnnualReturnPct)
    : portfolioAnnualReturnPct

  const toggleBtn = (active) =>
    [
      'px-4 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 ease-smooth',
      active
        ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-[0_1px_0_rgba(255,255,255,.06)_inset]'
        : 'text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white/65',
    ].join(' ')

  return (
    <div className="rounded-3xl border border-black/[.06] dark:border-white/[.07] bg-card dark:bg-surface-dark-2 shadow-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-tightish text-ink-muted/70 dark:text-white/35">
            What-if
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tightish text-ink dark:text-white">
            Accelerate your milestone
          </div>
          <div className="mt-1 text-sm text-ink-muted/70 dark:text-white/35">
            Model contributions and see how much sooner you reach your target.
          </div>
        </div>

        {!isPro && (
          <button
            type="button"
            onClick={() => setPage('upgrade')}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-black/[.08] dark:border-white/[.10] bg-black/[.02] dark:bg-white/[.05] text-xs font-semibold text-ink dark:text-white hover:bg-black/[.04] dark:hover:bg-white/[.07] transition-colors"
          >
            <Lock size={14} className="opacity-75" />
            Pro
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4">
        {/* Mode toggle */}
        <div className="flex rounded-2xl bg-black/[.03] dark:bg-white/[.05] p-1 w-fit">
          <button type="button" onClick={() => setMode('monthly')} className={toggleBtn(mode === 'monthly')}>
            Monthly
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPro) {
                setPage('upgrade')
                return
              }
              setMode('lump')
            }}
            className={toggleBtn(mode === 'lump')}
          >
            One-off
          </button>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-ink-muted/70 dark:text-white/35">
            {mode === 'monthly' ? 'Extra per month' : 'One-off deposit'}
          </div>
          <div className="text-sm font-semibold tabular-nums text-ink dark:text-white">
            £{Number(amount || 0).toLocaleString()}
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={mode === 'monthly' ? 500 : 10000}
          step={mode === 'monthly' ? 25 : 100}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />

        {/* Allocation */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-ink-muted/70 dark:text-white/35">Allocate extra to</div>

          <select
            value={accountId || ''}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={included.length === 0}
            className="text-sm bg-transparent border border-black/[.08] dark:border-white/[.10] rounded-2xl px-3 py-2 text-ink dark:text-white disabled:opacity-50"
          >
            {included.length === 0 ? (
              <option value="">No included accounts</option>
            ) : (
              included.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))
            )}
          </select>
        </div>

        {selected ? (
          <div className="text-xs text-ink-muted/60 dark:text-white/25">
            Using {Number(selectedRate).toFixed(1)}% expected annual return
          </div>
        ) : null}

        {/* Result */}
        <div className="mt-2 rounded-2xl bg-black/[.03] dark:bg-white/[.04] p-4">
          {!canCompute ? (
            <div className="text-sm text-ink-muted/70 dark:text-white/35">
              {goalTarget
                ? 'Add an account included in net worth to see acceleration.'
                : 'Set a target goal to see acceleration.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <div className="text-sm text-ink-muted/70 dark:text-white/35">Current pace</div>
                <div className="text-sm font-semibold tabular-nums text-ink dark:text-white">
                  {formatDurationMonths(baselineMonths)}
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="text-sm text-ink-muted/70 dark:text-white/35">
                  With {mode === 'monthly' ? `+£${amount}/mo` : `+£${amount} now`}
                </div>
                <div className="text-sm font-semibold tabular-nums text-ink dark:text-white">
                  {formatDurationMonths(whatIfMonths)}
                </div>
              </div>

              <div className="pt-2 text-sm">
                <span className="text-ink-muted/70 dark:text-white/35">Impact: </span>
                <span className="font-semibold text-ink dark:text-white tabular-nums">
                  {savedMonths == null
                    ? '—'
                    : savedMonths > 0
                      ? `${formatDurationMonths(savedMonths)} sooner`
                      : savedMonths === 0
                        ? 'No change'
                        : `${formatDurationMonths(Math.abs(savedMonths))} later`}
                </span>
              </div>

              {moneyDeltaByBaselineDate != null && (
                <div className="pt-1 text-sm">
                  {isPro ? (
                    <div className="text-ink-muted/70 dark:text-white/35">
                      That’s{' '}
                      <span className="font-semibold text-ink dark:text-white tabular-nums">
                        £{Math.round(moneyDeltaByBaselineDate).toLocaleString()}
                      </span>{' '}
                      more by your original target date.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPage('upgrade')}
                      className="inline-flex items-center gap-2 text-xs font-semibold tracking-tightish text-accent hover:text-accent-dark transition-colors"
                    >
                      <Lock size={13} className="opacity-80" />
                      Unlock projected gain impact
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}