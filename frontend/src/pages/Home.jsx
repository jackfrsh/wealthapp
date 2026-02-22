// frontend/src/pages/Home.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api } from '../api'
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
  LogOut,
  Trophy,
  X,
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
  const next = MILESTONE_LADDER.find((x) => x > t)
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

function getHighestReached(total) {
  const t = Number(total || 0)
  let best = 0
  for (const m of MILESTONE_LADDER) {
    if (t >= m) best = m
    else break
  }
  return best || null
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
/* Celebration persistence (receipt-style)       */
/* ──────────────────────────────────────────── */

const CELEBRATION_LAST_KEY = 'wealthapp:last-celebrated-milestone-v1'
const CELEBRATION_PENDING_KEY = 'wealthapp:pending-celebration-v1'

function getLastCelebrated() {
  try {
    return Number(localStorage.getItem(CELEBRATION_LAST_KEY) || 0) || 0
  } catch (e) {
    console.warn('[celebration] localStorage blocked (getLastCelebrated)', e)
    return 0
  }
}
function setLastCelebrated(m) {
  try {
    localStorage.setItem(CELEBRATION_LAST_KEY, String(m || 0))
  } catch (e) {
    console.warn('[celebration] localStorage blocked (setLastCelebrated)', e)
  }
}

function getPendingCelebration() {
  try {
    const raw = localStorage.getItem(CELEBRATION_PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.milestone) return null
    return parsed
  } catch (e) {
    console.warn('[celebration] localStorage blocked (getPendingCelebration)', e)
    return null
  }
}

function setPendingCelebration(payload) {
  try {
    localStorage.setItem(CELEBRATION_PENDING_KEY, JSON.stringify(payload))
  } catch (e) {
    console.warn('[celebration] localStorage blocked (setPendingCelebration)', e)
  }
}

function clearPendingCelebration() {
  try {
    localStorage.removeItem(CELEBRATION_PENDING_KEY)
  } catch (e) {
    console.warn('[celebration] localStorage blocked (clearPendingCelebration)', e)
  }
}

function toCents(n) {
  const x = Number(n || 0)
  return Number.isFinite(x) ? Math.round(x * 100) : 0
}

/* ──────────────────────────────────────────── */
/* Premium milestone receipt banner              */
/* ──────────────────────────────────────────── */

function MilestoneReceipt({ visible, milestone, ccy, onDismiss }) {
  if (!milestone) return null

  return (
    <div
      className={[
        'rounded-3xl border overflow-hidden',
        'bg-white/70 dark:bg-white/[.06] backdrop-blur-xl',
        'border-black/[.06] dark:border-white/[.08]',
        'shadow-[0_18px_50px_rgba(0,0,0,0.10)]',
        'transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none',
      ].join(' ')}
    >
      {/* Rim light + subtle glow */}
      <div className="relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-16 -top-16 w-40 h-40 rounded-full bg-emerald-500/10 blur-[40px]" />
          <div className="absolute -right-16 -top-20 w-44 h-44 rounded-full bg-accent/10 blur-[45px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-white/70 dark:bg-white/10" />
        </div>

        <div className="relative px-5 sm:px-6 py-3.5 flex items-center gap-4">
          <div className="shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
              <Trophy size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
  <div className="text-[10px] font-semibold tracking-[.18em] uppercase text-emerald-700/80 dark:text-emerald-300/80">
    Milestone achieved
  </div>

  {/* Mobile: 3 lines. Desktop: amount + message inline */}
  <div className="mt-1 min-w-0">
    {/* Line 2: money */}
    <div className="font-display text-lg sm:text-2xl text-ink dark:text-white tabular-nums leading-tight break-words">
      {fmtCurrencyCompact(milestone, ccy)}
    </div>

    {/* Line 3: message */}
    <div className="mt-1 text-xs sm:text-xs text-ink-muted/60 dark:text-white/35 leading-snug">
      You’ve crossed a new net worth threshold.
    </div>
  </div>

  {/* Optional: if you WANT inline on >=sm, swap to this pattern instead:
      - keep the above for mobile only, and add an sm:flex row below.
      But honestly 3-line looks premium and avoids layout stress.
  */}
</div>

          <button
            onClick={onDismiss}
            className="shrink-0 p-2 rounded-2xl hover:bg-black/[.04] dark:hover:bg-white/[.06] transition-colors"
            aria-label="Dismiss"
            type="button"
          >
            <X size={16} className="text-ink-muted dark:text-white/50" />
          </button>
        </div>

        {/* hairline bottom sparkle */}
        <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      </div>
    </div>
  )
}

export default function Home() {
  const { setBaseCurrency, setPage, dataVersion, bumpData, showToast, baseCurrency, handleLogout } = useApp()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const prevTotal = useRef(null)
  const [animatingDelta, setAnimatingDelta] = useState(false)

  // milestone edit
  const [editingMilestone, setEditingMilestone] = useState(false)
  const [milestoneInput, setMilestoneInput] = useState('')
  const [savingMilestone, setSavingMilestone] = useState(false)

  // celebration receipt (persistent)
  const [pendingCelebrate, setPendingCelebrate] = useState(null)
  const [celebrateVisible, setCelebrateVisible] = useState(false)

  const [dismissAddAccountNudge, setDismissAddAccountNudge] = useState(() => {
  try {
    return localStorage.getItem('dismiss_add_account_nudge') === 'true'
  } catch {
    return false
  }
})

const dismissNudge = () => {
  setDismissAddAccountNudge(true)
  try {
    localStorage.setItem('dismiss_add_account_nudge', 'true')
  } catch {}
}

    // Derived (safe even when data is null)
  const total = useMemo(() => Number(data?.current_total || 0), [data])
  const totalCents = useMemo(() => toCents(total), [total])
  const ccy = useMemo(() => data?.base_currency || 'GBP', [data])

  const clearCelebration = useCallback(() => {
  // animate out
  setCelebrateVisible(false)

  window.setTimeout(() => {
    setPendingCelebrate(null)
    setCelebrateVisible(false)

    // Clear pending payload
    clearPendingCelebration()

    // Clear all gating keys (legacy + current)
    clearCelebrationStorage()

    // (Optional) also reset in-memory gate, if your logic uses it
    setLastCelebrated(0)
  }, 220)
}, [])

  // 1) On mount: hydrate pending celebration from storage (so it survives page switching)
  useEffect(() => {
  const p = getPendingCelebration()
  if (p?.milestone) {
    setPendingCelebrate(p)
    const t = window.setTimeout(() => setCelebrateVisible(true), 30)
    return () => window.clearTimeout(t)
  }
}, [])

  // 2) While Home is open: if net worth changes vs the saved receipt value, auto-close it
  useEffect(() => {
    if (!data) return
    if (!pendingCelebrate?.milestone) return

    const savedCents = Number(pendingCelebrate.total_at_time_cents ?? NaN)
    if (!Number.isFinite(savedCents)) return

    if (totalCents !== savedCents) {
      clearCelebration()
    }
  }, [data, totalCents, pendingCelebrate?.milestone, pendingCelebrate?.total_at_time_cents, clearCelebration])

  const load = useCallback(async () => {
    setError(null)
    try {
      const d = await api('/dashboard?range=3M')

      // Set data first so the page renders even if celebration logic fails
      setData(d)
      setBaseCurrency(d.base_currency || 'GBP')

      const nextTotal = Number(d?.current_total || 0)
      const nextTotalCents = toCents(nextTotal)

      // delta animation
      if (prevTotal.current !== null && prevTotal.current !== nextTotal) {
        setAnimatingDelta(true)
        setTimeout(() => setAnimatingDelta(false), 600)
      }

// 1) If a pending receipt exists, keep showing it until net worth changes.
const existingPending = getPendingCelebration()
if (existingPending?.milestone) {
  const savedCents = Number(existingPending.total_at_time_cents ?? NaN)

  if (Number.isFinite(savedCents) && savedCents !== nextTotalCents) {
    clearPendingCelebration()
    setPendingCelebrate(null)
    setCelebrateVisible(false)
  } else {
    setPendingCelebrate(existingPending)
    setCelebrateVisible(true)
  }
}

// 2) ✅ Reliable trigger: highest milestone reached based on current total
const reached = getHighestReached(nextTotal)
if (reached) {
  const last = getLastCelebrated()

  if (reached > last) {
    setLastCelebrated(reached)

    const payload = {
  milestone: reached,
  total_at_time_cents: nextTotalCents,
  created_at: Date.now(), // optional
}
setPendingCelebration(payload)
setPendingCelebrate(payload)
setCelebrateVisible(false)
setTimeout(() => setCelebrateVisible(true), 30)
  }
}

prevTotal.current = nextTotal
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

  /* ──────────────────────────────────────────── */
  /* Early UI states                              */
  /* ──────────────────────────────────────────── */

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
          <p className="text-sm text-ink-muted dark:text-white/50 mb-2">Unable to load dashboard</p>
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

  /* ──────────────────────────────────────────── */
  /* Page computations                            */
  /* ──────────────────────────────────────────── */

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

  // Milestone target logic (saved goal is sticky until achieved)
  const savedMilestoneTarget = Number(data.goal || 0) || 0
  const hasSavedMilestone = savedMilestoneTarget > 0
  const milestoneAchieved = hasSavedMilestone && total >= savedMilestoneTarget

  const suggestedNext = getNextMilestone(total)
  const activeMilestoneTarget =
    hasSavedMilestone && !milestoneAchieved ? savedMilestoneTarget : suggestedNext

  const hasMilestone = activeMilestoneTarget > 0
  const usingSuggested = !(hasSavedMilestone && !milestoneAchieved)

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

  // reach-age estimate
  const currentAge = Number(retirementGoal?.current_age ?? NaN)
  const er = Number(retirementGoal?.expected_annual_return_pct ?? 0)
  const mc = Number(retirementGoal?.monthly_contribution ?? 0)

  const mToMilestone =
    hasMilestone && retirementGoal && Number.isFinite(currentAge)
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
      await api('/settings', { method: 'PUT', body: { goal: cleaned } })
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

  const heroRing =
    pendingCelebrate?.milestone
      ? 'ring-2 ring-emerald-400/20 dark:ring-emerald-400/15 transition-all duration-700'
      : milestoneAchieved
      ? 'ring-2 ring-emerald-400/40 dark:ring-emerald-400/25'
      : ''

  return (
    <div className="space-y-6">
      {/* Thin premium receipt (persists + fades) */}
      {pendingCelebrate?.milestone ? (
        <MilestoneReceipt
  visible={celebrateVisible}
  milestone={pendingCelebrate?.milestone}
  ccy={baseCurrency}
  onDismiss={clearCelebration}
/>
      ) : null}

      {/* ═══ Hero Card ═══ */}
      <div className={`hero-panel relative rounded-3xl p-7 sm:p-10 ${heroRing}`}>
        <div className="hero-glow absolute top-[-80px] right-[-40px] w-[350px] h-[350px] bg-accent/[.05] dark:bg-accent/[.07] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
                Total Wealth
              </span>

              {milestoneAchieved && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle size={10} /> Target reached
                </span>
              )}
            </div>
          </div>

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
                      <span className="ml-2 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-black/[.04] dark:bg-white/[.06] text-ink-muted/60 dark:text-white/30">
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

{(data.accounts_count || 0) === 0 && !dismissAddAccountNudge && (
  <Card className="px-5 py-4 mt-4">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
          Next step
        </div>
        <div className="mt-1 text-sm font-semibold text-ink dark:text-white">
          Add your first account
        </div>
        <div className="mt-1 text-xs text-ink-muted/60 dark:text-white/30 leading-snug">
          Add your ISA, SIPP, bank & savings accounts — anything you want included in your net worth.
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setPage('accounts')}
            className="px-4 py-2 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent-dark active:scale-[.98] transition-all"
            type="button"
          >
            Add account
          </button>

          <button
            onClick={dismissNudge}
            className="px-3 py-2 rounded-2xl text-xs font-semibold text-ink-muted/70 dark:text-white/35 hover:bg-black/[.04] dark:hover:bg-white/[.06] transition-colors"
            type="button"
          >
            Not now
          </button>
        </div>
      </div>

      <button
        onClick={dismissNudge}
        className="p-2 -mr-1 rounded-xl text-ink-muted dark:text-white/35 hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        type="button"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  </Card>
)}

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
            {sparkValues.length >= 2 ? <>{fmtCurrency(delta, ccy)} over 90D</> : <>Add another snapshot to see trend</>}
          </div>
        </Card>

        <Card className="p-6 cursor-pointer" hover onClick={() => setPage('outlook')}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35">
                Retirement plan
              </div>
              {retirementGoal?.name ? (
                <div className="text-xs text-ink-muted/60 dark:text-white/25 mt-1">{retirementGoal.name}</div>
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

      {/* ═══ Stats bar (Accounts + Snapshots) ═══ */}
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

    <button
      onClick={() => setPage('snapshots')}
      className="text-left flex-1 min-w-0 hover:opacity-90 transition-opacity"
      type="button"
    >
      <div className="text-[10px] font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
        Snapshots
      </div>
      <div className="text-sm font-semibold text-ink dark:text-white tabular-nums mt-1">
        {data.total_snapshots || 0}{' '}
        <span className="text-ink-muted/60 dark:text-white/30 font-medium">recorded</span>
      </div>
    </button>
  </div>
</Card>

      {/* Mobile logout — only visible on small screens */}
      <div className="lg:hidden mt-6 pb-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium text-loss/80 hover:text-loss border border-loss/20 hover:bg-loss-light/60 dark:hover:bg-loss/10 transition-colors"
          type="button"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────── */
/* Mini sparkline (no deps)                      */
/* ──────────────────────────────────────────── */

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