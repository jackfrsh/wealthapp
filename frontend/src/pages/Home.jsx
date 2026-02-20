// frontend/src/pages/Home.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPut } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import { fmtCurrency, fmtCurrencyCompact } from '../utils'
import {
  Shield,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

/* ──────────────────────────────────────────── */
/* Milestone ladder + reach-age math             */
/* ──────────────────────────────────────────── */

const MILESTONE_LADDER = [
  1_000, 2_500, 5_000, 10_000,
  25_000, 50_000, 100_000, 250_000, 500_000,
  750_000, 1_000_000,
  1_500_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000,
]

function getNextMilestone(total) {
  const t = Number(total || 0)
  // First ladder step strictly greater than total
  const next = MILESTONE_LADDER.find((x) => x > t)
  // If user is beyond ladder, keep last (won't ever be "reached" in UI but stays graceful)
  return next || MILESTONE_LADDER[MILESTONE_LADDER.length - 1]
}

function getCrossedMilestone(prev, next) {
  const a = Number(prev ?? 0)
  const b = Number(next ?? 0)
  if (!(b > a)) return null
  let crossed = null
  for (const m of MILESTONE_LADDER) {
    if (a < m && b >= m) crossed = m
  }
  return crossed
}

function fv(pv, pmt, r, n) {
  if (n <= 0) return pv
  if (Math.abs(r) < 1e-9) return pv + pmt * n
  const a = Math.pow(1 + r, n)
  return pv * a + pmt * ((a - 1) / r)
}

function monthsToTarget({ pv, pmt, annualReturnPct, target }) {
  pv = Number(pv || 0)
  pmt = Number(pmt || 0)
  target = Number(target || 0)
  const er = Number(annualReturnPct || 0)
  const r = er / 100 / 12

  if (!(target > 0)) return 0
  if (pv >= target) return 0

  if (pmt <= 0) {
    if (r <= 0) return null
    if (pv <= 0) return null
    const ratio = target / pv
    return Math.ceil(Math.log(ratio) / Math.log(1 + r))
  }

  const MAX = 1200 // 100 years
  if (fv(pv, pmt, r, MAX) < target) return null

  let lo = 0
  let hi = MAX
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fv(pv, pmt, r, mid) >= target) hi = mid
    else lo = mid + 1
  }
  return lo
}

/* ──────────────────────────────────────────── */
/* Celebration: show once per crossed milestone  */
/* ──────────────────────────────────────────── */

const CELEBRATION_KEY = 'wealthapp:last-celebrated-milestone-v1'

function getLastCelebrated() {
  try {
    return Number(localStorage.getItem(CELEBRATION_KEY) || 0) || 0
  } catch {
    return 0
  }
}

function setLastCelebrated(m) {
  try {
    localStorage.setItem(CELEBRATION_KEY, String(m || 0))
  } catch {}
}

export default function Home() {
  const { setBaseCurrency, setPage, dataVersion, bumpData, showToast, baseCurrency } = useApp()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const prevTotal = useRef(null)
  const [animatingDelta, setAnimatingDelta] = useState(false)

  const [editingMilestone, setEditingMilestone] = useState(false)
  const [milestoneInput, setMilestoneInput] = useState('')
  const [savingMilestone, setSavingMilestone] = useState(false)

  const [showCelebrate, setShowCelebrate] = useState(false)
  const [celebratedMilestone, setCelebratedMilestone] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const d = await apiGet('/dashboard?range=3M')

      const nextTotal = Number(d?.current_total || 0)
      const prev = Number(prevTotal.current ?? 0)

      // Celebration based on crossing from previous → next
      const crossed = getCrossedMilestone(prev, nextTotal)
      if (crossed) {
        const last = getLastCelebrated()
        if (crossed > last) {
          setCelebratedMilestone(crossed)
          setShowCelebrate(true)
          setLastCelebrated(crossed)
          setTimeout(() => setShowCelebrate(false), 5000)
        }
      }

      setData(d)
      setBaseCurrency(d.base_currency || 'GBP')

      if (prevTotal.current !== null && prevTotal.current !== d.current_total) {
        setAnimatingDelta(true)
        setTimeout(() => setAnimatingDelta(false), 600)
      }

      prevTotal.current = d.current_total
    } catch (e) {
      console.error('Dashboard load error:', e)
      setError(e?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [setBaseCurrency])

  useEffect(() => {
    load()
  }, [load, dataVersion])

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-[360px] rounded-3xl skeleton" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-[140px] rounded-2xl skeleton" />
          ))}
        </div>
        <div className="h-[64px] rounded-2xl skeleton" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <AlertTriangle size={32} className="text-amber-500 mx-auto mb-4" />
          <p className="text-sm text-ink-muted dark:text-white/50 mb-2">
            Unable to load dashboard
          </p>
          <p className="text-xs text-ink-muted/50 dark:text-white/25 mb-5">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              load()
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors"
            type="button"
          >
            <RefreshCw size={15} /> Retry
          </button>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const ccy = data.base_currency || 'GBP'
  const total = Number(data.current_total || 0)

  // Trend
  const sparkValues = (data?.series || []).map((p) => Number(p.v)).filter(Number.isFinite)
  const firstVal = sparkValues[0]
  const lastVal = sparkValues[sparkValues.length - 1]
  const delta = sparkValues.length >= 2 ? lastVal - firstVal : 0
  const deltaPct =
    sparkValues.length >= 2 && Number.isFinite(firstVal) && firstVal !== 0
      ? (delta / Math.abs(firstVal)) * 100
      : 0
  const positive = sparkValues.length >= 2 ? delta >= 0 : true

  /* ──────────────────────────────────────────── */
  /* Milestone logic (premium, stable)             */
  /* ──────────────────────────────────────────── */

  // "Saved" milestone: user explicitly set it (via settings.goal) — stable until achieved
  const savedMilestoneTarget = Number(data.goal || 0) || 0
  const hasSavedMilestone = savedMilestoneTarget > 0

  // Achieved is based on the saved milestone only (closure that doesn't jitter)
  const milestoneAchieved = hasSavedMilestone && total >= savedMilestoneTarget

  // Suggested next milestone (forward-looking) — not persisted unless user saves
  const suggestedNext = getNextMilestone(total)

  // Active milestone target used for progress UI + reach-age math:
  // - If user has a saved milestone and it's not achieved, use it.
  // - Otherwise (no saved milestone OR achieved), use the suggested next.
  const activeMilestoneTarget =
    hasSavedMilestone && !milestoneAchieved ? savedMilestoneTarget : suggestedNext

  const hasMilestone = activeMilestoneTarget > 0

  const usingSuggested = !(hasSavedMilestone && !milestoneAchieved) // true when we're showing "next"
  const milestoneProgressPct = hasMilestone
    ? Math.min(100, (total / activeMilestoneTarget) * 100)
    : 0
  const milestoneRemaining = hasMilestone
    ? Math.max(activeMilestoneTarget - total, 0)
    : 0

  // Retirement goal
  const retirementGoal = data.primary_goal || null
  const retirementTarget = Number(retirementGoal?.target_amount || 0)
  const retirementProgress =
    retirementTarget > 0 ? Math.min(100, (total / retirementTarget) * 100) : null

  // Reach-age math (uses primary goal inputs)
  const goal = retirementGoal
  const currentAge = Number(goal?.current_age ?? NaN)
  const er = Number(goal?.expected_annual_return_pct ?? 0)
  const mc = Number(goal?.monthly_contribution ?? 0)

  const mToMilestone =
    hasMilestone && goal && Number.isFinite(currentAge)
      ? monthsToTarget({
          pv: total,
          pmt: mc,
          annualReturnPct: er,
          target: activeMilestoneTarget,
        })
      : null

  const reachAge =
    mToMilestone === null || !Number.isFinite(currentAge)
      ? null
      : Math.round(currentAge + mToMilestone / 12)

  const startEditMilestone = () => {
    // Edit whatever is currently active (saved if in-progress, otherwise suggested next)
    setMilestoneInput(String(activeMilestoneTarget || ''))
    setEditingMilestone(true)
  }

  const saveMilestone = async () => {
    const cleaned = Number(String(milestoneInput || '').replace(/,/g, ''))
    if (!Number.isFinite(cleaned) || cleaned <= 0) {
      showToast('Please enter a valid target amount', 'error')
      return
    }

    setSavingMilestone(true)
    try {
      await apiPut('/settings', { goal: cleaned })
      showToast('Next target updated')
      setEditingMilestone(false)
      bumpData()
      setLoading(true)
      await load()
    } catch (e) {
      showToast(e?.message || 'Failed to update target', 'error')
    } finally {
      setSavingMilestone(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ═══ Hero Card ═══ */}
      <div
        className={`hero-panel rounded-3xl p-7 sm:p-10 ${
          milestoneAchieved ? 'ring-2 ring-emerald-400/40 dark:ring-emerald-400/25' : ''
        }`}
      >
        <div className="hero-glow absolute top-[-80px] right-[-40px] w-[350px] h-[350px] bg-accent/[.05] dark:bg-accent/[.07] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
                Total Wealth
              </span>
              {milestoneAchieved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle size={10} /> Target reached
                </span>
              )}
            </div>
          </div>

          {showCelebrate && celebratedMilestone && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-100/70 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
              <span className="text-base">✨</span>
              <span className="text-sm font-semibold">
                Milestone reached — {fmtCurrencyCompact(celebratedMilestone, ccy)}
              </span>
            </div>
          )}

          <div
            className={`hero-number mt-1 mb-2 text-ink dark:text-white transition-all duration-300 ${
              animatingDelta ? 'animate-delta' : ''
            }`}
          >
            {fmtCurrency(total, baseCurrency)}
          </div>

          {hasMilestone && (
            <div className="space-y-3">
              {!editingMilestone ? (
                <div className="space-y-1">
                  <div className="text-sm text-ink-muted/60 dark:text-white/30 tabular-nums">
                    Next target{' '}
                    <span className="font-semibold text-ink dark:text-white">
                      {fmtCurrencyCompact(activeMilestoneTarget, ccy)}
                    </span>

                    <button
                      onClick={startEditMilestone}
                      className="ml-2 text-xs font-semibold text-accent hover:text-accent-dark dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      type="button"
                    >
                      Edit
                    </button>

                    {usingSuggested && (
                      <span className="ml-2 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-black/[.04] dark:bg-white/[.06] text-ink-muted/60 dark:text-white/30">
                        Suggested
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-ink-muted/55 dark:text-white/25">
                    {reachAge ? (
                      <>
                        At this pace, you reach it at{' '}
                        <span className="font-semibold text-ink dark:text-white">age {reachAge}</span>.
                      </>
                    ) : (
                      <>At this pace, it’s not reachable with your current plan.</>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted/60 dark:text-white/30">
                    Edit next target
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={milestoneInput}
                      onChange={(e) => setMilestoneInput(e.target.value)}
                      inputMode="decimal"
                      className="flex-1 px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                      placeholder="100000"
                    />
                    <button
                      onClick={saveMilestone}
                      disabled={savingMilestone}
                      className="px-4 py-3 rounded-2xl bg-accent text-white font-semibold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50"
                      type="button"
                    >
                      {savingMilestone ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingMilestone(false)}
                      className="px-3 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-sm font-semibold text-ink-muted hover:text-ink dark:text-white/40 dark:hover:text-white/70 transition-colors"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="h-[6px] bg-black/[.06] dark:bg-white/[.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      milestoneAchieved
                        ? 'bg-emerald-500 dark:bg-gradient-to-r dark:from-emerald-500/90 dark:to-emerald-400/90'
                        : 'bg-accent dark:bg-gradient-to-r dark:from-accent dark:to-blue-400'
                    }`}
                    style={{ width: `${milestoneProgressPct.toFixed(1)}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-ink-muted/55 dark:text-white/25 tabular-nums">
                  <span>{milestoneProgressPct.toFixed(0)}%</span>
                  <span>
                    Remaining{' '}
                    <span className="font-semibold text-ink dark:text-white">
                      {fmtCurrency(milestoneRemaining, ccy)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-ink-muted/30 dark:text-white/12 pt-2">
            <Shield size={12} />
            <span>Updated today · Encrypted</span>
          </div>
        </div>
      </div>

      {/* ═══ Trend + Retirement ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35">
                Trend (90D)
              </div>
              <div className="text-xs text-ink-muted/60 dark:text-white/25 mt-1">
                First snapshot in range → latest
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${
                sparkValues.length >= 2
                  ? positive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                  : 'text-ink-muted/60 dark:text-white/30'
              }`}
            >
              {sparkValues.length >= 2 ? (
                <>
                  {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {positive ? '+' : ''}
                  {deltaPct.toFixed(1)}%
                </>
              ) : (
                '—'
              )}
            </div>
          </div>

          <div className="text-ink/35 dark:text-white/25 w-full h-14">
            <MiniSparkline data={sparkValues} />
          </div>

          <div className="mt-3 text-xs text-ink-muted/55 dark:text-white/25 tabular-nums">
            {sparkValues.length >= 2 ? (
              <>{fmtCurrency(delta, ccy)} over 90D</>
            ) : (
              <>Add another snapshot to see trend</>
            )}
          </div>
        </Card>

        <Card className="p-6 cursor-pointer" hover onClick={() => setPage('outlook')}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35">
                Retirement plan
              </div>
              {retirementGoal?.name ? (
                <div className="text-xs text-ink-muted/60 dark:text-white/25 mt-1">
                  {retirementGoal.name}
                </div>
              ) : (
                <div className="text-xs text-ink-muted/60 dark:text-white/25 mt-1">Primary goal</div>
              )}
            </div>
          </div>

          {retirementGoal ? (
            <>
              <div className="font-display text-[1.6rem] sm:text-[1.75rem] text-ink/90 dark:text-white tracking-tight tabular-nums">
                {fmtCurrencyCompact(retirementGoal.target_amount, ccy)}
              </div>

              {retirementProgress !== null && (
                <div className="mt-3">
                  <div className="h-[6px] bg-black/[.06] dark:bg-white/[.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-black/30 dark:bg-white/30 transition-all duration-700"
                      style={{ width: `${retirementProgress.toFixed(1)}%` }}
                    />
                  </div>
                  <div className="text-xs text-ink-muted/55 dark:text-white/25 mt-1.5 tabular-nums">
                    {retirementProgress.toFixed(0)}% funded
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm text-ink dark:text-white font-semibold">Set up your plan</div>
              <div className="text-xs text-ink-muted/50 dark:text-white/25 mt-1.5">
                Add a retirement goal to unlock your outlook →
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ═══ Stats bar ═══ */}
      <Card className="px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setPage('accounts')}
            className="text-left flex-1 min-w-0 hover:opacity-90 transition-opacity"
            type="button"
          >
            <div className="text-[10px] font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
              Accounts
            </div>
            <div className="text-sm font-semibold text-ink dark:text-white tabular-nums mt-1">
              {data.accounts_count || 0}{' '}
              <span className="text-ink-muted/60 dark:text-white/30 font-medium">total</span>
            </div>
          </button>

          <div className="w-px h-10 bg-black/[.06] dark:bg-white/[.06]" />

          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
              Snapshots
            </div>
            <div className="text-sm font-semibold text-ink dark:text-white tabular-nums mt-1">
              {data.total_snapshots || 0}{' '}
              <span className="text-ink-muted/60 dark:text-white/30 font-medium">recorded</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function MiniSparkline({ data = [] }) {
  if (!data || data.length === 0) return null

  const values = data.length === 1 ? [data[0], data[0]] : data

  const width = 240
  const height = 56
  const padding = 3

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const pts = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const d = `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')}`
  const area = `${d} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`
  const last = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <path d={area} fill="currentColor" opacity="0.06" />
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        opacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="1.7" fill="currentColor" opacity="0.75" />
    </svg>
  )
}