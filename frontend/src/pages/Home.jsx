// frontend/src/pages/Home.jsx
// Wealth command centre.
//
// Structure:
//   MilestoneReceipt   ← celebration ribbon (conditional)
//   HeroStage          ← eyebrow · total · delta · milestone strip · trust line
//   OnboardingPanel    ← conditional, full-width, directly below hero
//   ── Two-column grid (lg+) ──────────────────────────────────
//   Sidebar (right):
//     WealthCheckIn    ← compact check-in prompt (stale accounts only)
//     WealthMix        ← grouped asset breakdown (2+ groups only)
//   Main (left):
//     SnapshotStale    ← amber notice (stale snapshot, conditional)
//     IsaUrgency       ← amber interrupt (tax-year deadline, conditional)
//     CommandDeck      ← Plan · Accounts · Next move (unified slab)
//     WealthRunway     ← forecast module

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api, invalidatePath } from '../api'
import { track } from '../track'
import { useApp } from '../App'
import { GoldDelta } from '../components/surfaces'
import { fmtCurrency, fmtCurrencyCompact, fmtCurrencyCompactStable, fmtDate, isIsaUrgent, getSnapshotFreshnessState, accountFreshnessLabel, WEALTH_GROUPS, groupDefFor } from '../utils'
import GoalSetup from './GoalSetup'
import QuickUpdateModal from '../components/QuickUpdateModal'
import useProjectionData from '../hooks/outlook/useProjectionData'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import WealthTooltip from '../components/charts/WealthTooltip'
import {
  xAxisProps, yAxisProps, gridProps, tooltipProps,
  chartMargin, ACCENT_STROKE, activeDotStyle,
} from '../components/charts/chartTheme'
import {
  Shield,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Trophy,
  X,
  ChevronRight,
  Clock,
  Crown,
} from 'lucide-react'

/* ──────────────────────────────────────────────────── */
/* Milestone / forecast math (unchanged from original) */
/* ──────────────────────────────────────────────────── */

const MILESTONE_LADDER = [
  1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000,
  1_500_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000,
]

function getNextMilestone(total) {
  const t = Number(total || 0)
  return MILESTONE_LADDER.find((x) => x > t) || MILESTONE_LADDER[MILESTONE_LADDER.length - 1]
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
    if (r <= 0 || pv <= 0) return null
    return Math.ceil(Math.log(target / pv) / Math.log(1 + r))
  }
  const MAX = 1200
  if (fv(pv, pmt, r, MAX) < target) return null
  let lo = 0, hi = MAX
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fv(pv, pmt, r, mid) >= target) hi = mid
    else lo = mid + 1
  }
  return lo
}

function shouldSuppressDelta(spanDays, deltaValue, totalWealth) {
  // Suppress when span is too short to be meaningful
  if (spanDays == null || !Number.isFinite(spanDays) || spanDays < 7) return true
  // Suppress when the absolute delta is implausibly large relative to total wealth
  const absD = Math.abs(Number(deltaValue))
  if (!Number.isFinite(absD)) return true
  const w = Number(totalWealth)
  if (!Number.isFinite(w) || w <= 0) return true
  return absD / w >= 0.85
}

/* ──────────────────────────────────────────────────── */
/* Net worth change breakdown movers                    */
/* ──────────────────────────────────────────────────── */

function ChangeBreakdown({ items, ccy }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mt-3 space-y-1">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4">
          <span
            className="text-[12px] truncate"
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            {item.name}
          </span>
          <span
            className="text-[12px] tabular-nums font-semibold shrink-0"
            style={{ color: item.delta >= 0 ? 'rgba(47,166,118,0.82)' : 'rgba(200,90,70,0.82)' }}
          >
            {item.delta >= 0 ? '+' : ''}{fmtCurrencyCompact(item.delta, ccy)}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────────── */
/* Celebration storage (unchanged)                     */
/* ──────────────────────────────────────────────────── */

const CELEBRATION_LAST_KEY = 'wealthapp:last-celebrated-milestone-v1'
const CELEBRATION_PENDING_KEY = 'wealthapp:pending-celebration-v1'

function getLastCelebrated() {
  try { return Number(localStorage.getItem(CELEBRATION_LAST_KEY) || 0) || 0 } catch { return 0 }
}
function setLastCelebrated(m) {
  try { localStorage.setItem(CELEBRATION_LAST_KEY, String(m || 0)) } catch {}
}
function getPendingCelebration() {
  try {
    const raw = localStorage.getItem(CELEBRATION_PENDING_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return p?.milestone ? p : null
  } catch { return null }
}
function setPendingCelebration(payload) {
  try { localStorage.setItem(CELEBRATION_PENDING_KEY, JSON.stringify(payload)) } catch {}
}
function clearPendingCelebration() {
  try { localStorage.removeItem(CELEBRATION_PENDING_KEY) } catch {}
}

function toCents(n) {
  const x = Number(n || 0)
  return Number.isFinite(x) ? Math.round(x * 100) : 0
}

/* ──────────────────────────────────────────────────── */
/* Tax-year / ISA helpers                              */
/* ──────────────────────────────────────────────────── */

function getTaxYearEnd() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const endYear = m > 3 || (m === 3 && d >= 6) ? y + 1 : y
  return new Date(endYear, 3, 5, 23, 59, 59)
}

function daysUntilTaxYearEnd() {
  return Math.max(0, Math.ceil((getTaxYearEnd().getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function getTaxYearEndLabel() {
  const end = getTaxYearEnd()
  return `5 April ${end.getFullYear()}`
}

function getCurrentTaxYearLabel() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const startYear = m > 3 || (m === 3 && d >= 6) ? y : y - 1
  return `${startYear}/${String(startYear + 1).slice(-2)}`
}

/* Plan status config — matches Outlook.jsx statusLabels */
const PLAN_STATUS = {
  ahead:    { label: 'Ahead of plan',   color: 'rgba(47,166,118,0.90)', bg: 'rgba(47,166,118,0.10)', border: 'rgba(47,166,118,0.20)' },
  on_track: { label: 'On track',        color: 'rgba(255,255,255,0.75)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.10)' },
  adjust:   { label: 'Needs attention', color: 'rgba(200,155,60,0.90)', bg: 'rgba(200,155,60,0.08)', border: 'rgba(200,155,60,0.18)' },
}

/* Account types that represent liabilities — must match Accounts.jsx */
const LIABILITY_TYPES = new Set(['mortgage', 'loan'])

/* ──────────────────────────────────────────────────── */
/* Milestone receipt                                   */
/* ──────────────────────────────────────────────────── */

function MilestoneReceipt({ visible, milestone, ccy, onDismiss }) {
  if (!milestone) return null
  return (
    <div
      className={[
        'rounded-3xl border overflow-hidden',
        'bg-white/80 dark:bg-white/[.06] backdrop-blur-xl',
        'border-emerald-200/50 dark:border-emerald-500/20',
        'shadow-[0_4px_24px_rgba(0,0,0,0.08)]',
        'transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none',
      ].join(' ')}
    >
      <div className="relative px-5 sm:px-6 py-3.5 flex items-center gap-4">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-emerald-500/[.04] via-transparent to-transparent" />
        <div className="shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
            <Trophy size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="min-w-0 flex-1 relative">
          <div className="text-[10px] font-semibold tracking-[.18em] uppercase text-emerald-700/80 dark:text-emerald-300/80">
            Milestone achieved
          </div>
          <div className="mt-0.5 font-display text-lg sm:text-xl text-ink dark:text-white tabular-nums leading-tight">
            {fmtCurrencyCompact(milestone, ccy)}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted/55 dark:text-white/30">
            You've crossed a new net worth threshold.
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="shrink-0 p-2 rounded-xl hover:bg-black/[.04] dark:hover:bg-white/[.06] transition-colors"
          aria-label="Dismiss"
          type="button"
        >
          <X size={15} className="text-ink-muted dark:text-white/40" />
        </button>
      </div>

      <div className="h-px bg-gradient-to-r from-emerald-500/20 via-emerald-500/40 to-transparent" />
    </div>
  )
}

/* ──────────────────────────────────────────────────── */
/* Onboarding panel                                    */
/* ──────────────────────────────────────────────────── */

function OnboardingPanel({ needsGoal, needsAccounts, accountsCount = 0, onGoal, onAccounts }) {
  const totalSteps = 2
  const doneSteps = (needsGoal ? 0 : 1) + (needsAccounts ? 0 : 1)
  const pct = Math.round((doneSteps / totalSteps) * 100)
  const allDone = !needsGoal && !needsAccounts

  const [closing, setClosing] = useState(false)
  const [showDoneToast, setShowDoneToast] = useState(false)

  useEffect(() => {
    if (!allDone) return
    setClosing(true)
    const t1 = window.setTimeout(() => setShowDoneToast(true), 260)
    const t2 = window.setTimeout(() => setShowDoneToast(false), 2400)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [allDone])

  const Step = ({ done, title, subtitle, actionLabel, onAction }) => (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {done ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-accent mt-0.5 shrink-0" />
          )}
          <div className="text-[13.5px] font-semibold text-ink dark:text-white">{title}</div>
          {done && (
            <span className="text-[10px] font-semibold tracking-[.14em] uppercase px-2 py-0.5 rounded-full bg-black/[.03] dark:bg-white/[.06] text-ink-muted/50 dark:text-white/25">
              Done
            </span>
          )}
        </div>
        <div className="mt-1 ml-7 text-xs text-ink-muted/55 dark:text-white/30 leading-relaxed">
          {subtitle}
        </div>
      </div>
      {!done && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction?.() }}
          className="shrink-0 px-3.5 py-2 rounded-2xl text-xs font-semibold bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.10] text-ink dark:text-white hover:bg-black/[.05] dark:hover:bg-white/[.09] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )

  return (
    <div className="relative">
      <div
        className={[
          'rounded-3xl border overflow-hidden',
          'bg-white/70 dark:bg-white/[.04] backdrop-blur-xl',
          'border-black/[.06] dark:border-white/[.07]',
          'shadow-[0_2px_16px_rgba(0,0,0,0.06)]',
          'transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
          closing
            ? 'opacity-0 -translate-y-1 scale-[0.98] max-h-0 pointer-events-none'
            : 'opacity-100 translate-y-0 scale-100 max-h-[420px]',
        ].join(' ')}
      >
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-6 mb-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25">
                Getting started
              </div>
              <div className="mt-1 text-[13.5px] font-semibold text-ink dark:text-white">
                Finish setting up
              </div>
              <div className="mt-0.5 text-xs text-ink-muted/50 dark:text-white/30">
                {doneSteps} of {totalSteps} done
                {accountsCount > 0 ? ` · ${accountsCount} account${accountsCount !== 1 ? 's' : ''}` : ''}
              </div>
            </div>
            <div className="text-sm font-semibold tabular-nums text-ink-muted/50 dark:text-white/25 shrink-0">
              {pct}%
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-black/[.05] dark:bg-white/[.07] overflow-hidden mb-5">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="space-y-4">
            <Step
              done={!needsAccounts}
              title="Add your first account"
              subtitle="ISA, pension, bank, savings, property — anything that counts toward net worth."
              actionLabel="Add account"
              onAction={onAccounts}
            />
            <div className="h-px bg-black/[.05] dark:bg-white/[.07]" />
            <Step
              done={!needsGoal}
              title="Set a long-term goal"
              subtitle="Give your plan a target and unlock your trajectory."
              actionLabel="Set goal"
              onAction={onGoal}
            />
          </div>
        </div>
      </div>

      {showDoneToast && (
        <div className="mt-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-sm animate-fade-in">
            <CheckCircle size={14} className="opacity-90" />
            <span className="text-xs font-semibold">Setup complete</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────── */
/* CommandDeck                                          */
/* ──────────────────────────────────────────────────── */

function CommandDeck({
  goal,
  total,
  ccy,
  forecast,
  planShortfall,
  showIsaUrgency,
  totalMonthlyContribs,
  contributingCount,
  retirementGoal,
  onPlan,
  onSetGoal,
  onAccounts,
  onStrategy,
}) {
  const hasGoal = !!goal
  const target = Number(goal?.target_amount || 0)
  const projectedEnd = Number(forecast?.projected_end_value || 0)
  const status = PLAN_STATUS[forecast?.status] || null
  const progress = target > 0 ? Math.min(100, (total / target) * 100) : null
  const targetAge = goal?.target_age ? `age ${goal.target_age}` : null
  const isAdjust = forecast?.status === 'adjust'
  const isAhead = forecast?.status === 'ahead'

  const barColor = isAdjust
    ? 'rgba(200,155,60,0.75)'
    : isAhead
    ? 'rgba(47,166,118,0.80)'
    : 'var(--accent)'

  const planCta = isAdjust ? 'Review your plan' : 'Open your plan'

  const supportingParts = []
  if (projectedEnd > 0 && targetAge) supportingParts.push(`Projected by ${targetAge}`)
  if (target > 0 && progress !== null) supportingParts.push(`${progress.toFixed(0)}% of ${fmtCurrencyCompact(target, ccy)}`)
  const supportingLine = supportingParts.join(' · ')

  const showNextMove = !showIsaUrgency && planShortfall > 0 && !!retirementGoal?.target_age

  return (
    <div className="rounded-xl overflow-hidden bg-black/[.012] dark:bg-white/[.018]" style={{ border: '1px solid rgba(0,0,0,0.04)' }}>
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr]">
        <button
          type="button"
          onClick={hasGoal ? onPlan : onSetGoal}
          className="text-left transition-colors duration-150 hover:bg-black/[.02] dark:hover:bg-white/[.02] group"
        >
          <div className="px-5 pt-5 pb-5 flex flex-col justify-between h-full">
            {hasGoal ? (
              <>
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-semibold text-ink dark:text-white truncate">
                      {goal.name || 'Long-term plan'}
                    </div>
                    {status && (
                      <span
                        className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color }}
                      >
                        {status.label}
                      </span>
                    )}
                  </div>

                  {projectedEnd > 0 && (
                    <div className="text-2xl font-bold tabular-nums text-ink dark:text-white tracking-tight leading-none">
                      {fmtCurrencyCompact(projectedEnd, ccy)}
                    </div>
                  )}
                  {supportingLine && (
                    <div className="mt-1.5 text-[13px] text-ink-muted/55 dark:text-white/35 tabular-nums">
                      {supportingLine}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  {progress !== null && (
                    <div className="h-[3px] rounded-full w-full mb-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, progress).toFixed(1)}%`, background: barColor }}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: isAdjust ? 'rgba(200,155,60,0.80)' : 'var(--accent)' }}
                    >
                      {planCta}
                    </span>
                    <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-ink-muted/40 dark:text-white/25" />
                  </div>
                </div>
              </>
            ) : (
              <div className="py-4">
                <div className="text-lg font-bold text-ink dark:text-white leading-tight">
                  Set your target
                </div>
                <div className="mt-2 text-[13px] text-ink-muted/55 dark:text-white/35 leading-relaxed max-w-xs">
                  Define a long-term goal and unlock your projected trajectory.
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
                    Get started
                  </span>
                  <ChevronRight size={13} className="text-ink-muted/30 dark:text-white/20" />
                </div>
              </div>
            )}
          </div>
        </button>

        <div className="flex flex-col border-t md:border-t-0 md:border-l border-black/[.05] dark:border-white/[.06]">
          <button
            type="button"
            onClick={onAccounts}
            className="flex-1 text-left px-5 py-5 transition-colors duration-150 hover:bg-black/[.02] dark:hover:bg-white/[.02]"
          >
            <div className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25 mb-2">
              Accounts
            </div>
            <div className="text-2xl font-bold tabular-nums text-ink dark:text-white tracking-tight leading-none">
              {totalMonthlyContribs > 0 ? `${fmtCurrency(totalMonthlyContribs, ccy)}/mo` : 'No monthly investing'}
            </div>
            <div className="mt-1.5 text-[13px] text-ink-muted/60 dark:text-white/38 leading-snug">
              {contributingCount > 0
                ? `${contributingCount} contributing account${contributingCount !== 1 ? 's' : ''}`
                : 'No contributing accounts'}
            </div>
          </button>

          {showNextMove && (
            <>
              <div className="h-px bg-black/[.05] dark:bg-white/[.06]" aria-hidden="true" />
              <button
                type="button"
                onClick={onStrategy}
                className="text-left px-5 py-5 transition-colors duration-150 hover:bg-black/[.02] dark:hover:bg-white/[.02]"
              >
                <div className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25 mb-2">
                  Next move
                </div>
                <div className="text-lg font-semibold tabular-nums text-ink dark:text-white tracking-tight leading-none">
                  +{fmtCurrencyCompact(planShortfall, ccy)}/mo
                </div>
                <div className="mt-1.5 text-[13px] text-ink-muted/50 dark:text-white/28 leading-none">
                  To reach target by age {retirementGoal.target_age}
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────── */
/* WealthRunway                                         */
/* ──────────────────────────────────────────────────── */

function WealthRunway({ settingsReady, isPro, ccy, defaultProjYears }) {
  const [runwayOpen, setRunwayOpen] = useState(false)

  const deflate = useCallback((v) => Number(v || 0), [])

  const {
    projData, setProjYears, projLoading,
    HORIZONS, effectiveProjYears, projChartData, filteredMilestones,
  } = useProjectionData({
    settingsReady,
    isPro,
    projOpen: runwayOpen,
    deflate,
    defaultProjYears,
  })

  const headlineValue = useMemo(() => {
    if (!projData?.points?.length) return null
    const last = projData.points[projData.points.length - 1]
    return last?.value || null
  }, [projData])

  if (!settingsReady) return null

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.022) 0%, rgba(255,255,255,0.014) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)',
      }}
    >
      <button
        type="button"
        onClick={() => setRunwayOpen((v) => !v)}
        className="w-full text-left px-6 py-5 sm:px-7 sm:py-5 flex items-start justify-between gap-4 transition-opacity duration-150 hover:opacity-80"
      >
        <div className="min-w-0">
          <div
            className="text-[10.5px] font-semibold tracking-[.16em] uppercase"
            style={{ color: 'rgba(255,255,255,0.34)' }}
          >
            Current forecast
          </div>

          <div
            className="mt-1.5 text-[13px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.36)' }}
          >
            Projected from your current accounts and contributions.
          </div>

          {!runwayOpen && headlineValue && (
            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <div className="text-[32px] sm:text-[36px] font-bold tabular-nums text-white tracking-tight leading-none">
                {fmtCurrencyCompactStable(headlineValue, ccy)}
              </div>
              <div
                className="text-[13px] font-medium"
                style={{ color: 'rgba(255,255,255,0.34)' }}
              >
                in {effectiveProjYears}y
              </div>
            </div>
          )}
        </div>

        <ChevronRight
          size={13}
          className={`shrink-0 mt-1 text-white/25 transition-transform duration-200 ${runwayOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {runwayOpen && (
        <div className="px-6 pb-6 sm:px-7 sm:pb-7">
          <div className="pt-4">
            <div
              className="mb-4 h-px"
              style={{
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 72%, transparent 100%)',
              }}
            />
            <div className="space-y-4">
              <div className="pt-5 space-y-5">
                {headlineValue && (
                  <div>
                    <div className="flex items-end gap-2.5 flex-wrap">
                      <div className="text-[30px] sm:text-[34px] font-bold tabular-nums text-white tracking-tight leading-none">
                        {fmtCurrencyCompactStable(headlineValue, ccy)}
                      </div>
                      <div
                        className="text-[12px] font-medium pb-[3px]"
                        style={{ color: 'rgba(255,255,255,0.32)' }}
                      >
                        in {effectiveProjYears} year{effectiveProjYears !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div
                      className="mt-1.5 text-[12.5px] leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.32)' }}
                    >
                      If you keep going at your current pace.
                    </div>
                  </div>
                )}
              </div>

              {HORIZONS.length > 1 && (
                <div className="flex bg-white/[.04] rounded-full p-0.5 gap-0.5 w-fit flex-wrap">
                  {HORIZONS.map((h) => (
                    <button
                      key={h}
                      onClick={() => setProjYears(h)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all min-w-[38px] ${
                        effectiveProjYears === h
                          ? 'bg-white/[.10] text-white shadow-sm'
                          : 'text-white/35 hover:text-white/65'
                      }`}
                      type="button"
                    >
                      {h}Y
                    </button>
                  ))}
                </div>
              )}

              {!projLoading && filteredMilestones.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filteredMilestones.map((m) => (
                    <div
                      key={m.year}
                      className="px-3 py-2 rounded-2xl"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div
                        className="text-[10px] font-semibold tracking-[.14em] uppercase"
                        style={{ color: 'rgba(255,255,255,0.24)' }}
                      >
                        {m.year}y
                      </div>
                      <div
                        className="mt-1 text-[13px] font-semibold tabular-nums"
                        style={{ color: 'rgba(255,255,255,0.72)' }}
                      >
                        {fmtCurrencyCompactStable(m.projected_net_worth, ccy)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {projLoading ? (
                <div className="h-[230px] rounded-2xl skeleton opacity-15" />
              ) : projChartData.length > 1 ? (
                <div
                  className="rounded-2xl px-2 pt-3"
                  style={{
                    background: 'rgba(255,255,255,0.022)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projChartData} margin={chartMargin}>
                        <defs>
                          <linearGradient id="homeRunwayFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ACCENT_STROKE} stopOpacity={0.08} />
                            <stop offset="100%" stopColor={ACCENT_STROKE} stopOpacity={0} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid {...gridProps} />

                        <XAxis
                          dataKey="date"
                          {...xAxisProps}
                          tickFormatter={(d) =>
                            new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                          }
                        />

                        <YAxis {...yAxisProps} tickFormatter={(v) => Math.round(v / 1000) + 'k'} />

                        <Tooltip content={<WealthTooltip currency={ccy} />} {...tooltipProps} />

                        <Area
                          type="monotone"
                          dataKey="actual"
                          stroke={ACCENT_STROKE}
                          strokeWidth={1.5}
                          fill="url(#homeRunwayFill)"
                          dot={false}
                          connectNulls={false}
                          activeDot={activeDotStyle}
                        />

                        <Area
                          type="monotone"
                          dataKey="projected"
                          stroke={ACCENT_STROKE}
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          fill="none"
                          dot={false}
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div
                  className="text-center py-8 text-[13px]"
                  style={{ color: 'rgba(255,255,255,0.24)' }}
                >
                  Add accounts to see your current forecast.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────── */
/* Inline milestone progress                            */
/* ──────────────────────────────────────────────────── */

function MilestoneProgress({
  activeMilestoneTarget,
  milestoneProgressPct,
  milestoneRemaining,
  milestoneAchieved,
  reachAge,
  usingSuggested,
  editingMilestone,
  milestoneInput,
  setMilestoneInput,
  saveMilestone,
  savingMilestone,
  setEditingMilestone,
  startEditMilestone,
  ccy,
}) {
  return (
    <div className="space-y-3">
      {!editingMilestone ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <span>
              Next target{' '}
              <span className="font-semibold text-white tabular-nums">
                {fmtCurrencyCompact(activeMilestoneTarget, ccy)}
              </span>
            </span>
            <button
              onClick={startEditMilestone}
              className="text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--gold)', opacity: 0.70 }}
              type="button"
            >
              Edit
            </button>
            {usingSuggested && (
              <span className="text-[10px] font-medium tracking-[.14em] uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.28)' }}>
                Suggested
              </span>
            )}
          </div>

          {reachAge ? (
            <div className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              At this pace, you reach it at{' '}
              <span className="font-semibold text-white">age {reachAge}</span>.
            </div>
          ) : (
            <div className="text-[13px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
              Not reachable on current plan.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold tracking-[.18em] uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Edit next target
          </div>
          <div className="flex items-center gap-2">
            <input
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
              inputMode="decimal"
              className="flex-1 px-4 py-2.5 rounded-2xl text-sm text-white focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
              placeholder="100000"
            />
            <button
              onClick={saveMilestone}
              disabled={savingMilestone}
              className="px-4 py-2.5 rounded-2xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--gold)', color: '#0A0F1A' }}
              type="button"
            >
              {savingMilestone ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingMilestone(false)}
              className="px-3 py-2.5 rounded-2xl text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${milestoneProgressPct.toFixed(1)}%`,
              background: milestoneAchieved ? '#2FA676' : 'rgba(120,169,230,0.85)',
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[13px] tabular-nums" style={{ color: 'rgba(255,255,255,0.60)' }}>
          <span>{milestoneProgressPct.toFixed(0)}%</span>
          <span>{fmtCurrencyCompact(milestoneRemaining, ccy)} remaining</span>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────── */
/* Main Home component                                  */
/* ──────────────────────────────────────────────────── */

export default function Home() {
  const {
    setBaseCurrency,
    primaryGoal,
    onboarding,
    accountsCount: appAccountsCount,
    setPage,
    dataVersion,
    bumpData,
    showToast,
    baseCurrency,
    subscriptionStatus,
    trialEnd,
    isPro,
    settingsReady,
  } = useApp()

  const [data, setData] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [goalSetupOpen, setGoalSetupOpen] = useState(false)
  const [quickUpdateOpen, setQuickUpdateOpen] = useState(false)

  const prevTotal = useRef(null)
  const [animatingDelta, setAnimatingDelta] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState(false)
  const [milestoneInput, setMilestoneInput] = useState('')
  const [savingMilestone, setSavingMilestone] = useState(false)
  const [pendingCelebrate, setPendingCelebrate] = useState(null)
  const [celebrateVisible, setCelebrateVisible] = useState(false)

  const total = useMemo(() => Number(data?.current_total || 0), [data])
  const totalCents = useMemo(() => toCents(total), [total])
  const ccy = useMemo(() => data?.base_currency || 'GBP', [data])

  const DASH_CACHE_KEY = 'wealthapp:dash:3M:v1'
  const hasMountedRef = useRef(false)
  const inflightRef = useRef(null)
  const lastLoadAtRef = useRef(0)

  const readDashCache = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(DASH_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed && 'current_total' in parsed ? parsed : null
    } catch { return null }
  }, [])

  const writeDashCache = useCallback((d) => {
    try { sessionStorage.setItem(DASH_CACHE_KEY, JSON.stringify(d || null)) } catch {}
  }, [])

  useEffect(() => { track('page_view', { page: 'home' }) }, [])

  const clearCelebration = useCallback(() => {
    setCelebrateVisible(false)
    window.setTimeout(() => {
      setPendingCelebrate(null)
      setCelebrateVisible(false)
      clearPendingCelebration()
    }, 220)
  }, [])

  useEffect(() => {
    const p = getPendingCelebration()
    if (p?.milestone) {
      setPendingCelebrate(p)
      const t = window.setTimeout(() => setCelebrateVisible(true), 30)
      return () => window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!data || !pendingCelebrate?.milestone) return
    const savedCents = Number(pendingCelebrate.total_at_time_cents ?? NaN)
    if (Number.isFinite(savedCents) && totalCents !== savedCents) clearCelebration()
  }, [data, totalCents, pendingCelebrate, clearCelebration])

  const load = useCallback(
    async ({ reason = 'load', forceOverlay = false } = {}) => {
      setError(null)
      const now = Date.now()
      if (reason === 'effect' && now - lastLoadAtRef.current < 500) return null
      lastLoadAtRef.current = now
      if (inflightRef.current) return inflightRef.current

      if (!hasMountedRef.current) {
        hasMountedRef.current = true
        const cached = readDashCache()
        if (cached && !data) {
          setData(cached)
          setBaseCurrency(cached?.base_currency || 'GBP')
          setLoading(false)
        }
      }

      let overlayTimer = null
      if (forceOverlay || !data) setLoading(true)
      else overlayTimer = window.setTimeout(() => setLoading(true), 150)

      const run = (async () => {
        try {
          const [d, accts] = await Promise.all([
            api('/dashboard?range=3M'),
            api('/accounts').catch(() => []),
          ])
          writeDashCache(d)
          setData(d)
          setAccounts(Array.isArray(accts) ? accts : [])
          setBaseCurrency(d?.base_currency || 'GBP')

          const nextTotal = Number(d?.current_total || 0)
          const nextTotalCents = toCents(nextTotal)

          if (prevTotal.current !== null && prevTotal.current !== nextTotal) {
            setAnimatingDelta(true)
            window.setTimeout(() => setAnimatingDelta(false), 600)
          }

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

          const reached = getHighestReached(nextTotal)
          if (reached) {
            const last = getLastCelebrated()
            if (reached > last) {
              setLastCelebrated(reached)
              const payload = { milestone: reached, total_at_time_cents: nextTotalCents, created_at: Date.now() }
              setPendingCelebration(payload)
              setPendingCelebrate(payload)
              setCelebrateVisible(false)
              window.setTimeout(() => setCelebrateVisible(true), 30)
            }
          }
          prevTotal.current = nextTotal
        } catch (e) {
          console.error('Dashboard load error:', e)
          setError(e?.message || 'Failed to load dashboard')
        } finally {
          if (overlayTimer) window.clearTimeout(overlayTimer)
          setLoading(false)
          inflightRef.current = null
        }
      })()

      inflightRef.current = run
      return run
    },
    [data, readDashCache, setBaseCurrency, writeDashCache]
  )

  useEffect(() => { load({ reason: 'effect' }) }, [load, dataVersion])

  // ── Wealth mix (must be above all early returns — Rules of Hooks) ──────────
  //
  // Depends only on `accounts` (a stable useState array, always an array).
  // Safe to call unconditionally: returns [] when accounts is empty or data is null.
  // Unknown future subtype strings fall through safely via groupDefFor (utils.js).
  const wealthMixGroups = useMemo(() => {
    if (!Array.isArray(accounts) || !accounts.length) return []
    const buckets = Object.fromEntries(WEALTH_GROUPS.map(g => [g.key, []]))
    for (const a of accounts) {
      buckets[groupDefFor(a).key].push(a)
    }
    return WEALTH_GROUPS
      .map(g => {
        const ga = buckets[g.key]
        const subtotal = ga.reduce((sum, a) => {
          if (!g.isLiability && a.include_in_net_worth === false) return sum
          return sum + (Number(a.balance) || 0)
        }, 0)
        return { ...g, subtotal }
      })
      .filter(g => g.subtotal > 0)
  }, [accounts])

  const wealthMixAssetGroups = useMemo(
    () => wealthMixGroups.filter(g => !g.isLiability),
    [wealthMixGroups]
  )

  // ──────────────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div
          className="-mx-4 sm:-mx-6 lg:-mx-8 px-6 pt-10 pb-10 sm:px-10"
          style={{ background: '#141A26' }}
        >
          <div className="h-2.5 w-24 rounded skeleton opacity-20 mb-3" />
          <div className="h-14 w-60 rounded-lg skeleton opacity-25 mb-5" />
          <div className="h-3 w-32 rounded skeleton opacity-15 mb-6" />
          <div className="h-2.5 w-44 rounded skeleton opacity-10" />
        </div>
        <div className="rounded-2xl h-14 skeleton" />
        <div className="h-20 rounded-3xl skeleton" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl border border-black/[.05] dark:border-white/[.06] bg-white dark:bg-surface-dark-2 p-8 text-center">
        <AlertTriangle size={28} className="text-amber-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-ink dark:text-white mb-1">Unable to load</p>
        <p className="text-xs text-ink-muted/55 dark:text-white/25 mb-5">{error}</p>
        <button
          onClick={() => load({ forceOverlay: true, reason: 'retry' })}
          className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors"
          type="button"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const seriesPoints = data?.series || []
  const sparkValues = seriesPoints.map((p) => Number(p.v)).filter(Number.isFinite)
  const firstVal = sparkValues[0]
  const lastVal = sparkValues[sparkValues.length - 1]
  const delta = sparkValues.length >= 2 ? lastVal - firstVal : 0
  const deltaPct = sparkValues.length >= 2 && Number.isFinite(firstVal) && firstVal !== 0
    ? (delta / Math.abs(firstVal)) * 100
    : 0

  const firstSeriesPoint = seriesPoints[0]
  const lastSeriesPoint = seriesPoints[seriesPoints.length - 1]
  const seriesSpanDays =
    firstSeriesPoint?.t && lastSeriesPoint?.t
      ? Math.max(0, Math.floor((new Date(lastSeriesPoint.t) - new Date(firstSeriesPoint.t)) / 86400000))
      : null

  const changeFromDate = firstSeriesPoint?.t ? fmtDate(firstSeriesPoint.t) : null

  const showHeroPct =
    Number.isFinite(deltaPct) &&
    seriesSpanDays != null &&
    seriesSpanDays >= 30 &&
    Math.abs(deltaPct) <= 99

  const deltaContextLabel = showHeroPct
    ? ` · ${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`
    : undefined

  const suppressDelta = shouldSuppressDelta(seriesSpanDays, delta, total)

  const changeGroundingLabel = !suppressDelta && changeFromDate
    ? `Change since ${changeFromDate}`
    : null

  const changeExplainer = !suppressDelta && changeFromDate
    ? seriesSpanDays != null && seriesSpanDays < 30
      ? 'Includes account additions, contributions, balance updates, and market movement.'
      : 'Includes contributions, balance updates, and market movement between recorded snapshots.'
    : null

  const dashboardGoal =
    data?.primary_goal && (data.primary_goal.id || data.primary_goal.name) &&
    Number(data.primary_goal?.target_amount || 0) > 0 ? data.primary_goal : null
  const appGoal =
    primaryGoal && (primaryGoal.id || primaryGoal.name) &&
    Number(primaryGoal?.target_amount || 0) > 0 ? primaryGoal : null
  const retirementGoal = appGoal || dashboardGoal

  const savedMilestoneTarget = Number(data.goal || 0) || 0
  const hasSavedMilestone = savedMilestoneTarget > 0
  const milestoneAchieved = hasSavedMilestone && total >= savedMilestoneTarget
  const suggestedNext = getNextMilestone(total)
  const activeMilestoneTarget = hasSavedMilestone && !milestoneAchieved ? savedMilestoneTarget : suggestedNext
  const hasMilestone = activeMilestoneTarget > 0
  const usingSuggested = !(hasSavedMilestone && !milestoneAchieved)
  const milestoneProgressPct = hasMilestone ? Math.min(100, (total / activeMilestoneTarget) * 100) : 0
  const milestoneRemaining = hasMilestone ? Math.max(activeMilestoneTarget - total, 0) : 0

  const currentAge = Number(retirementGoal?.current_age ?? NaN)
  const er = Number(retirementGoal?.expected_annual_return_pct ?? 0)
  const mc = Number(retirementGoal?.monthly_contribution ?? 0)
  const mToMilestone = hasMilestone && retirementGoal && Number.isFinite(currentAge)
    ? monthsToTarget({ pv: total, pmt: mc, annualReturnPct: er, target: activeMilestoneTarget }) : null
  const reachAge = mToMilestone === null || !Number.isFinite(currentAge)
    ? null : Math.round(currentAge + mToMilestone / 12)

  const startEditMilestone = () => {
    setMilestoneInput(String(activeMilestoneTarget || ''))
    setEditingMilestone(true)
  }

  const saveMilestone = async () => {
    const cleaned = Number(String(milestoneInput || '').replace(/,/g, ''))
    if (!Number.isFinite(cleaned) || cleaned <= 0) {
      showToast?.('Please enter a valid target amount', 'error')
      return
    }
    setSavingMilestone(true)
    try {
      await api('/settings', { method: 'PUT', body: { goal: cleaned } })
      showToast?.('Next target updated')
      setEditingMilestone(false)
      bumpData?.()
    } catch (e) {
      showToast?.(e?.message || 'Failed to update target', 'error')
    } finally {
      setSavingMilestone(false)
    }
  }

  const heroCelebrating = pendingCelebrate?.milestone
  const heroHighlight = heroCelebrating ? 'rgba(52,211,153,0.18)' : milestoneAchieved ? 'rgba(52,211,153,0.28)' : null

  const accountsCount = Number(data?.accounts_count ?? appAccountsCount ?? 0) || 0
  const needsGoal = typeof onboarding?.needsGoal === 'boolean' ? onboarding.needsGoal : !retirementGoal
  const needsAccounts = accountsCount === 0
  const showOnboarding = needsGoal || needsAccounts

  const snapshotFreshness = getSnapshotFreshnessState(data?.last_snapshot_date)
  const dataAccounts = accounts

  const freshnessValue = data?.last_snapshot_date
    ? (snapshotFreshness.days === 0 ? 'Today' : `${snapshotFreshness.days}d ago`)
    : '—'

  const snapshotTone =
    snapshotFreshness.state === 'stale'
      ? {
          icon: AlertTriangle,
          color: 'rgba(200,155,60,0.72)',
          label: `Snapshot ${freshnessValue} — update due`,
        }
      : snapshotFreshness.state === 'aging'
      ? {
          icon: Clock,
          color: 'rgba(200,155,60,0.58)',
          label: `Snapshot ${freshnessValue} — consider updating soon`,
        }
      : {
          icon: Shield,
          color: 'rgba(255,255,255,0.28)',
          label: data?.last_snapshot_date
            ? `Snapshot ${freshnessValue} · Encrypted`
            : 'No snapshots yet · Encrypted',
        }

  const SnapshotFreshnessIcon = snapshotTone.icon

  const isaRemaining = data?.isa_remaining ?? null
  const taxYearDaysLeft = daysUntilTaxYearEnd()
  const taxYearEnd = getTaxYearEndLabel()
  const showIsaUrgency = isIsaUrgent(isaRemaining)

  const assetAccounts = dataAccounts.filter((a) => !LIABILITY_TYPES.has(a.type))
  const totalMonthlyContribs = assetAccounts.reduce((s, a) => s + Math.max(0, Number(a.monthly_contribution || 0)), 0)
  const contributingCount = assetAccounts.filter((a) => Number(a.monthly_contribution || 0) > 0).length

  // Stale account detection — accounts included in net worth with state === 'stale' (30+ days).
  // Uses accountFreshnessLabel so the threshold and state logic live in one place.
  const staleAccountCount = dataAccounts.filter(
    (a) => a.include_in_net_worth !== false && accountFreshnessLabel(a.updated_at)?.state === 'stale'
  ).length

  // Derived from the hook-safe memos above — plain expressions, not hooks.
  const wealthMixAssetTotal = wealthMixAssetGroups.reduce((s, g) => s + g.subtotal, 0)
  const wealthMixLargest = [...wealthMixAssetGroups].sort((a, b) => b.subtotal - a.subtotal)[0]
  // Headline: percentage copy only when 2+ distinct asset groups exist and total > 0.
  const wealthMixHeadline = (() => {
    if (wealthMixAssetGroups.length < 2 || !wealthMixLargest || wealthMixAssetTotal <= 0) return null
    const pct = Math.round((wealthMixLargest.subtotal / wealthMixAssetTotal) * 100)
    return `${wealthMixLargest.label} make up ${pct}% of your tracked wealth.`
  })()
  // Show card only when ≥2 groups have non-zero balances — a single group adds no comparison value.
  const showWealthMix = wealthMixGroups.length >= 2

  const forecastMonthsRemaining = (data.forecast?.years_remaining || 0) * 12
  let planShortfall = 0
  if (data.forecast?.status === 'adjust' && retirementGoal && forecastMonthsRemaining > 0) {
    const tgt = Number(retirementGoal.target_amount || 0)
    const r = Number(retirementGoal.expected_annual_return_pct || 0) / 100 / 12
    const currentMc = Number(retirementGoal.monthly_contribution || 0)
    const gf = Math.pow(1 + r, forecastMonthsRemaining)
    const pmtNeeded = Math.abs(r) < 1e-9
      ? (tgt - total) / forecastMonthsRemaining
      : (tgt - total * gf) * r / (gf - 1)
    planShortfall = Math.max(0, Math.ceil(pmtNeeded - currentMc))
  }

  const goalHorizonYears = (() => {
    const targetAge = Number(retirementGoal?.target_age)
    const currentAge = Number(retirementGoal?.current_age)
    if (!Number.isFinite(targetAge) || !Number.isFinite(currentAge)) return null
    const years = Math.round(targetAge - currentAge)
    return years > 0 ? years : null
  })()

  const trialDaysLeft = subscriptionStatus === 'trialing' && trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd) - Date.now()) / 86400000))
    : null

  return (
    <div className="animate-page-in pb-6">
      {loading && data ? (
        <div className="fixed inset-0 z-[900] pointer-events-none">
          <div className="absolute top-4 right-4 text-[11px] font-semibold px-3 py-1.5 rounded-2xl bg-black/80 text-white">
            Updating…
          </div>
        </div>
      ) : null}

      {pendingCelebrate?.milestone ? (
        <div className="mb-5">
          <MilestoneReceipt
            visible={celebrateVisible}
            milestone={pendingCelebrate?.milestone}
            ccy={baseCurrency}
            onDismiss={clearCelebration}
          />
        </div>
      ) : null}

      {trialDaysLeft !== null && trialDaysLeft <= 14 && (
        <div className="mb-3">
          <button
            onClick={() => {
              track('upgrade_clicked', { page: 'home', source: 'trial_badge' })
              setPage('upgrade')
            }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 transition-colors"
            type="button"
          >
            <Crown size={10} />
            {trialDaysLeft === 0 ? 'Trial ends today' : `${trialDaysLeft}d left in trial`}
          </button>
        </div>
      )}

      {/* Hero */}
      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0A0F1A 0%, #141A26 50%, #0F141F 100%)',
          borderBottom: heroHighlight ? `2px solid ${heroHighlight}` : undefined,
        }}
      >
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-16 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 65%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -left-10 w-[280px] h-[280px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(120,169,230,0.06) 0%, transparent 65%)' }}
        />

        <div className="relative px-6 pt-10 pb-10 sm:px-10 sm:pt-12 sm:pb-12 max-w-2xl">

          {editingMilestone ? (

            /* ── Edit mode: always single-column, full-width input ──────────── */
            <>
              <div className="text-[11px] font-semibold tracking-[.18em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Total wealth · {baseCurrency}
              </div>
              <div className={`hero-number text-white ${animatingDelta ? 'animate-delta' : ''}`}>
                {fmtCurrency(total, baseCurrency)}
              </div>
              {!suppressDelta && sparkValues.length >= 2 && (
                <div className="mt-4">
                  <GoldDelta value={delta} label={deltaContextLabel} size="md" currency={ccy} />
                </div>
              )}
              <div className="mt-5 flex items-center gap-2">
                <input
                  value={milestoneInput}
                  onChange={(e) => setMilestoneInput(e.target.value)}
                  inputMode="decimal"
                  className="flex-1 px-3.5 py-2 rounded-2xl text-sm text-white focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                  placeholder="e.g. 250000"
                />
                <button
                  onClick={saveMilestone}
                  disabled={savingMilestone}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'rgba(212,175,55,0.85)', color: '#0A0F1A' }}
                  type="button"
                >
                  {savingMilestone ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingMilestone(false)}
                  className="p-2 rounded-xl transition-opacity hover:opacity-80"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                  aria-label="Cancel"
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-5 text-[11px]" style={{ color: snapshotTone.color }}>
                <SnapshotFreshnessIcon size={10} />
                <span>{snapshotTone.label}</span>
              </div>
            </>

          ) : (

            /* ── View mode: two-zone on desktop, stacked on mobile ──────────── */
            /*    Left: wealth number + delta + trust (primary)                  */
            /*    Right: next-target strip (secondary, bottom-aligned)           */
            <div className="md:flex md:items-end md:gap-x-12">

              {/* Primary zone */}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold tracking-[.18em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Total wealth · {baseCurrency}
                </div>
                <div className={`hero-number text-white ${animatingDelta ? 'animate-delta' : ''}`}>
                  {fmtCurrency(total, baseCurrency)}
                </div>
                {!suppressDelta && sparkValues.length >= 2 && (
                  <div className="mt-4">
                    <GoldDelta value={delta} label={deltaContextLabel} size="md" currency={ccy} />
                  </div>
                )}
                {/* Trust line anchors the bottom of the primary zone */}
                <div className="flex items-center gap-2 mt-5 text-[11px]" style={{ color: snapshotTone.color }}>
                  <SnapshotFreshnessIcon size={10} />
                  <span>{snapshotTone.label}</span>
                </div>
              </div>

              {/* Secondary zone: milestone strip
                  - Mobile: mt-5, appears below trust line (still within hero)
                  - Desktop: md:shrink-0 md:w-48, bottom-aligned with primary zone */}
              {hasMilestone && (
                <div className="mt-5 md:mt-0 md:shrink-0 md:w-48">

                  {/* Eyebrow */}
                  <div className="text-[10px] font-semibold tracking-[.14em] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    Next target
                  </div>

                  {/* Target amount */}
                  <div className="text-[18px] font-bold tabular-nums text-white leading-tight">
                    {fmtCurrencyCompact(activeMilestoneTarget, ccy)}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(0, Math.min(100, milestoneProgressPct)).toFixed(1)}%`,
                        background: milestoneAchieved
                          ? 'rgba(47,166,118,0.85)'
                          : 'rgba(120,169,230,0.78)',
                      }}
                    />
                  </div>

                  {/* Supporting: % complete · age · remaining — calm copy when NW ≤ 0 */}
                  {total > 0 ? (
                    <div className="mt-1.5 text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.30)' }}>
                      <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {milestoneProgressPct.toFixed(0)}% complete
                      </span>
                      {(reachAge || milestoneRemaining > 0) && (
                        <>
                          <span className="mx-1.5" style={{ color: 'rgba(255,255,255,0.18)' }}>·</span>
                          {[
                            reachAge ? `Around age ${reachAge}` : null,
                            milestoneRemaining > 0
                              ? `${fmtCurrencyCompact(milestoneRemaining, ccy)} remaining`
                              : null,
                          ].filter(Boolean).join(' · ')}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      Progress starts once net worth moves above {fmtCurrencyCompact(0, ccy)}.
                    </div>
                  )}

                  {/* Edit / suggested — quietest level */}
                  <div className="mt-2 flex items-center gap-2">
                    {usingSuggested && (
                      <span className="text-[10px] font-medium uppercase tracking-[.10em]" style={{ color: 'rgba(255,255,255,0.20)' }}>
                        suggested
                      </span>
                    )}
                    <button
                      onClick={startEditMilestone}
                      className="text-[10px] font-semibold transition-opacity hover:opacity-80"
                      style={{ color: 'rgba(212,175,55,0.55)' }}
                      type="button"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>

          )}
        </div>
      </div>

      {/* Onboarding moved directly below hero for incomplete setup */}
      {showOnboarding && (
        <div className="mt-6">
          <OnboardingPanel
            needsGoal={needsGoal}
            needsAccounts={needsAccounts}
            accountsCount={accountsCount}
            onGoal={() => setGoalSetupOpen(true)}
            onAccounts={() => setPage('accounts')}
          />
        </div>
      )}

      {hasMilestone && false}

      {/*
        ── Two-column layout ──────────────────────────────────────────────────
        Sidebar (check-in prompt + Wealth Mix) is DOM-first so it stacks
        naturally above CommandDeck on mobile.  On desktop (lg+) CSS grid
        repositions it into the right column, keeping the main content left.

        The grid wrapper is only applied when there is sidebar content —
        otherwise the outer div is a plain block and main fills full width.
      */}
      <div className={`mt-8${staleAccountCount > 0 || showWealthMix ? ' lg:grid lg:grid-cols-[1fr_272px] xl:grid-cols-[1fr_296px] lg:gap-x-8 lg:items-start' : ''}`}>

        {/* ── Sidebar ───────────────────────────────────────────────────────
            DOM position 1 → appears above main on mobile (natural stacking).
            lg:col-start-2 + lg:row-start-1 → pinned right column on desktop. */}
        {(staleAccountCount > 0 || showWealthMix) && (
          <div className="lg:col-start-2 lg:row-start-1 flex flex-col gap-3 mb-5 lg:mb-0">

            {/* Compact wealth check-in prompt */}
            {staleAccountCount > 0 && (
              <button
                type="button"
                onClick={() => setQuickUpdateOpen(true)}
                className="w-full text-left group"
              >
                <div
                  className="rounded-2xl px-4 py-3 transition-opacity group-hover:opacity-80"
                  style={{ background: 'rgba(200,155,60,0.07)', border: '1px solid rgba(200,155,60,0.18)' }}
                >
                  <div className="flex items-start gap-3">
                    <Clock size={13} style={{ color: 'rgba(200,155,60,0.72)', flexShrink: 0, marginTop: 1 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold leading-snug" style={{ color: 'rgba(220,185,100,0.92)' }}>
                        Time for a quick wealth check-in
                      </p>
                      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'rgba(200,155,60,0.58)' }}>
                        {staleAccountCount === 1
                          ? "1 account hasn't been updated in over 30 days."
                          : `${staleAccountCount} accounts haven't been updated in over 30 days.`}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[10px] font-semibold" style={{ color: 'rgba(200,155,60,0.75)' }}>
                          Review accounts
                        </span>
                        <ChevronRight size={9} style={{ color: 'rgba(200,155,60,0.75)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* Compact wealth mix */}
            {showWealthMix && (
              <div className="rounded-2xl p-4 bg-black/[.02] dark:bg-white/[.025] border border-black/[.06] dark:border-white/[.065]">
                <p
                  className="text-[10px] font-semibold tracking-[.16em] uppercase"
                  style={{ color: 'rgba(160,170,190,0.48)' }}
                >
                  Wealth mix
                </p>

                {wealthMixHeadline && (
                  <p
                    className="mt-2 text-[12px] font-semibold leading-snug"
                    style={{ color: 'rgba(230,235,245,0.76)' }}
                  >
                    {wealthMixHeadline}
                  </p>
                )}

                <div className="mt-2.5 space-y-1.5">
                  {wealthMixGroups.map(g => (
                    <div key={g.key} className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px]" style={{ color: 'rgba(180,190,210,0.50)' }}>
                        {g.label}
                      </span>
                      <span
                        className="text-[11px] font-semibold tabular-nums"
                        style={{
                          color: g.isLiability
                            ? 'rgba(192,90,70,0.75)'
                            : 'rgba(220,228,242,0.76)',
                        }}
                      >
                        {g.isLiability ? '−' : ''}{fmtCurrencyCompactStable(g.subtotal, baseCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Main column ───────────────────────────────────────────────────
            DOM position 2 → renders below sidebar on mobile.
            lg:col-start-1 + lg:row-start-1 → left column on desktop. */}
        <div className="lg:col-start-1 lg:row-start-1 min-w-0">

          {snapshotFreshness.state === 'stale' && data?.last_snapshot_date && (
            <div className="mb-5">
              <div
                className="rounded-2xl px-5 py-4"
                style={{ background: 'rgba(200,155,60,0.07)', border: '1px solid rgba(200,155,60,0.16)' }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={14} style={{ color: 'rgba(200,155,60,0.75)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'rgba(200,155,60,0.92)' }}>
                      Last snapshot was {snapshotFreshness.days} days ago.
                    </div>
                    <div className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(200,155,60,0.65)' }}>
                      Figures may not reflect current balances until you record a new snapshot.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showIsaUrgency && (
            <div className="mb-5">
              <button
                type="button"
                onClick={() => {
                  track('isa_urgency_clicked', { page: 'home', days_left: taxYearDaysLeft })
                  setPage('decisions')
                }}
                className="w-full text-left group"
              >
                <div
                  className="rounded-2xl px-5 py-4 transition-opacity group-hover:opacity-90"
                  style={{ background: 'rgba(200,155,60,0.07)', border: '1px solid rgba(200,155,60,0.16)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Clock size={12} style={{ color: 'rgba(200,155,60,0.75)', flexShrink: 0 }} />
                        <span className="text-[10px] font-semibold tracking-[.14em] uppercase" style={{ color: 'rgba(200,155,60,0.65)' }}>
                          ISA deadline · {taxYearDaysLeft} days
                        </span>
                      </div>
                      <div className="text-sm font-semibold leading-snug" style={{ color: 'rgba(200,155,60,0.92)' }}>
                        {fmtCurrencyCompact(isaRemaining, baseCurrency)} of tax-free allowance unused before {taxYearEnd}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(200,155,60,0.65)' }}>
                        Directing new money into wrappers first is the clearest next move.
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 text-xs font-semibold mt-0.5" style={{ color: 'rgba(200,155,60,0.65)' }}>
                      Decide <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          <CommandDeck
            goal={retirementGoal}
            total={total}
            ccy={ccy}
            forecast={data.forecast}
            planShortfall={planShortfall}
            showIsaUrgency={showIsaUrgency}
            totalMonthlyContribs={totalMonthlyContribs}
            contributingCount={contributingCount}
            retirementGoal={retirementGoal}
            onPlan={() => setPage('plan')}
            onSetGoal={() => setGoalSetupOpen(true)}
            onAccounts={() => setPage('accounts')}
            onStrategy={() => setPage('decisions')}
          />

          <div className="mt-10 pt-8 border-t border-black/[.04] dark:border-white/[.04]">
            <WealthRunway
              settingsReady={settingsReady}
              isPro={isPro}
              ccy={ccy}
              defaultProjYears={goalHorizonYears}
            />
          </div>
        </div>
      </div>

      {goalSetupOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setGoalSetupOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />
          <div className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full px-4 pt-20 sm:pt-24 pb-6 flex items-start justify-center">
              <div className="relative w-full max-w-[560px]">
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setGoalSetupOpen(false)}
                  className="absolute -top-10 right-0 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white"
                >
                  <X size={16} />
                </button>
                <GoalSetup onComplete={() => { setGoalSetupOpen(false); bumpData?.() }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <QuickUpdateModal
        open={quickUpdateOpen}
        onClose={() => setQuickUpdateOpen(false)}
        accounts={accounts}
        baseCurrency={baseCurrency}
        onSaved={() => { invalidatePath('/accounts'); invalidatePath('/dashboard'); invalidatePath('/dashboard?range=3M'); bumpData?.() }}
      />
    </div>
  )
}