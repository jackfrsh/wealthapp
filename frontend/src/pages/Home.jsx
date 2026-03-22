// frontend/src/pages/Home.jsx
// Wealth command centre.
//
// Structure:
//   MilestoneReceipt   ← celebration ribbon (conditional)
//   HeroStage          ← net worth, delta, milestone progress
//   ISA urgency        ← full-width interrupt (conditional)
//   CommandDeck        ← Plan · Accounts · Next move (unified slab)
//   WealthRunway       ← "If you keep going" projection module
//   OnboardingPanel    ← conditional, dismisses when complete

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api } from '../api'
import { track } from '../track'
import { useApp } from '../App'
import { GoldDelta } from '../components/surfaces'
import { fmtCurrency, fmtCurrencyCompact, fmtDate, isIsaUrgent, isSnapshotStale, getDaysSinceSnapshot } from '../utils'
import GoalSetup from './GoalSetup'
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
} from 'lucide-react'

/* ──────────────────────────────────────────────────── */
/* Milestone / forecast math (unchanged from original)  */
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

/* ──────────────────────────────────────────────────── */
/* Celebration storage (unchanged)                      */
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
/* Tax-year / ISA helpers (pure date math)              */
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
  ahead:    { label: 'Ahead of plan',           color: 'rgba(47,166,118,0.90)', bg: 'rgba(47,166,118,0.10)', border: 'rgba(47,166,118,0.20)' },
  on_track: { label: 'On track',                color: 'rgba(255,255,255,0.75)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.10)' },
  adjust:   { label: 'Needs attention',         color: 'rgba(200,155,60,0.90)',  bg: 'rgba(200,155,60,0.08)', border: 'rgba(200,155,60,0.18)' },
}

/* ──────────────────────────────────────────────────── */
/* Milestone receipt (redesigned)                       */
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
        {/* Glow */}
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
/* Onboarding panel (redesigned, logic unchanged)       */
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
/* CommandDeck — unified premium slab beneath the hero  */
/* Plan (left) · Accounts (right-top) · Next move (opt) */
/* ──────────────────────────────────────────────────── */

function CommandDeck({
  goal,
  total,
  ccy,
  forecast,
  isPro,
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
  /* ── Plan pane data ── */
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
  if (isPro && forecast?.freedom?.hit_year) supportingParts.push(`Freedom ${forecast.freedom.hit_year}`)
  else if (target > 0 && progress !== null) supportingParts.push(`${progress.toFixed(0)}% of ${fmtCurrencyCompact(target, ccy)}`)
  const supportingLine = supportingParts.join(' · ')

  /* ── Next move gate ── */
  const showNextMove = !showIsaUrgency && planShortfall > 0 && !!retirementGoal?.target_age

  return (
    <div className="rounded-xl overflow-hidden bg-black/[.012] dark:bg-white/[.018]" style={{ border: '1px solid rgba(0,0,0,0.04)' }}>
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr]">

        {/* ── Plan pane (left / top on mobile) ── */}
        <button
          type="button"
          onClick={hasGoal ? onPlan : onSetGoal}
          className="text-left transition-colors duration-150 hover:bg-black/[.02] dark:hover:bg-white/[.02] group"
        >
          <div className="px-5 pt-5 pb-5 flex flex-col justify-between h-full">
            {hasGoal ? (
              <>
                {/* Header: goal name + status badge */}
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

                  {/* Projected outcome */}
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

                {/* Progress bar + CTA */}
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
              /* No-goal state — intentional, not empty */
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

        {/* ── Right column ── */}
        <div className="flex flex-col border-t md:border-t-0 md:border-l border-black/[.05] dark:border-white/[.06]">

          {/* Accounts pane */}
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

          {/* Next move pane — only when quantified shortfall exists */}
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
/* WealthRunway — motivational projection module       */
/* "If you keep going" → projected value → chips/chart */
/* ──────────────────────────────────────────────────── */

function WealthRunway({ settingsReady, isPro, ccy }) {
  const [runwayOpen, setRunwayOpen] = useState(false)

  const deflate = useCallback((v) => Number(v || 0), [])

  const {
    projData, setProjYears, projLoading,
    HORIZONS, effectiveProjYears, projChartData, filteredMilestones,
  } = useProjectionData({ settingsReady, isPro, projOpen: runwayOpen, deflate })

  // Lead with the strongest projected value for the selected horizon
  const headlineValue = useMemo(() => {
    if (!projData?.points?.length) return null
    const last = projData.points[projData.points.length - 1]
    return last?.value || null
  }, [projData])

  if (!settingsReady) return null

  return (
    <div>
      {/* Header — always visible, sits on the page surface */}
      <button
        type="button"
        onClick={() => setRunwayOpen((v) => !v)}
        className="w-full text-left flex items-center justify-between gap-4 py-1 transition-opacity duration-150 hover:opacity-75"
      >
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-ink-muted/40 dark:text-white/28">
            If you keep going
          </div>
          {!runwayOpen && headlineValue && (
            <div className="mt-2 text-lg font-semibold tabular-nums text-ink dark:text-white tracking-tight leading-none">
              {fmtCurrencyCompact(headlineValue, ccy)}
              <span className="text-[13px] font-normal text-ink-muted/45 dark:text-white/28 ml-2">
                in {effectiveProjYears}y
              </span>
            </div>
          )}
        </div>
        <ChevronRight
          size={13}
          className={`shrink-0 text-ink-muted/30 dark:text-white/18 transition-transform duration-200 ${runwayOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expanded body — flows into page, no card wrapper */}
      {runwayOpen && (
        <div className="mt-4 space-y-5">
          {/* Projected headline */}
          {headlineValue && (
            <div>
              <div className="text-2xl font-bold tabular-nums text-ink dark:text-white tracking-tight leading-none">
                {fmtCurrencyCompact(headlineValue, ccy)}
              </div>
              <div className="mt-1.5 text-[13px] text-ink-muted/45 dark:text-white/28">
                Projected net worth in {effectiveProjYears} year{effectiveProjYears !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Horizon chips */}
          {HORIZONS.length > 1 && (
            <div className="flex bg-surface-2 dark:bg-white/5 rounded-full p-0.5 gap-0.5 w-fit">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setProjYears(h)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all min-w-[38px] ${
                    effectiveProjYears === h
                      ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                      : 'text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60'
                  }`}
                  type="button"
                >
                  {h}Y
                </button>
              ))}
            </div>
          )}

          {/* Milestones — inline text row, not cards */}
          {!projLoading && filteredMilestones.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              {filteredMilestones.map((m) => (
                <span key={m.year} className="text-[13px] tabular-nums text-ink-muted/55 dark:text-white/30">
                  <span className="font-semibold text-ink/80 dark:text-white/55">{fmtCurrencyCompact(m.projected_net_worth, ccy)}</span>
                  {' '}in {m.year}y
                </span>
              ))}
            </div>
          )}

          {/* Chart — embedded directly, minimal chrome */}
          {projLoading ? (
            <div className="h-[180px] rounded-lg skeleton opacity-15" />
          ) : projChartData.length > 1 ? (
            <div className="h-[180px] -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projChartData} margin={chartMargin}>
                  <defs>
                    <linearGradient id="homeRunwayFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT_STROKE} stopOpacity={0.06} />
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
          ) : !projLoading && (
            <div className="text-center py-6 text-[13px] text-ink-muted/35 dark:text-white/22">
              Add accounts to see your projection.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────── */
/* Inline progress bar (used inside HeroStage)         */
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

      {/* Progress track */}
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

  /* ── Loading skeleton ────────────────── */
  if (loading && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div
          className="-mx-4 sm:-mx-6 lg:-mx-8 px-6 pt-9 pb-9 sm:px-10"
          style={{ background: '#141A26' }}
        >
          <div className="h-2.5 w-24 rounded skeleton opacity-20 mb-3" />
          <div className="h-14 w-60 rounded-lg skeleton opacity-25 mb-5" />
          <div className="h-2 w-40 rounded skeleton opacity-15 mb-8" />
          <div className="h-1 w-full rounded-full skeleton opacity-15" />
        </div>
        <div className="rounded-2xl h-14 skeleton" />
        <div className="h-20 rounded-3xl skeleton" />
      </div>
    )
  }

  /* ── Error state ─────────────────────── */
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

  /* ── Derived values (unchanged) ─────── */
  const sparkValues = (data?.series || []).map((p) => Number(p.v)).filter(Number.isFinite)
  const firstVal = sparkValues[0]
  const lastVal = sparkValues[sparkValues.length - 1]
  const delta = sparkValues.length >= 2 ? lastVal - firstVal : 0
  const deltaPct = sparkValues.length >= 2 && Number.isFinite(firstVal) && firstVal !== 0
    ? (delta / Math.abs(firstVal)) * 100 : 0

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
    } finally { setSavingMilestone(false) }
  }

  const heroCelebrating = pendingCelebrate?.milestone
  const heroHighlight = heroCelebrating ? 'rgba(52,211,153,0.18)' : milestoneAchieved ? 'rgba(52,211,153,0.28)' : null

  const accountsCount = Number(data?.accounts_count ?? appAccountsCount ?? 0) || 0
  const needsGoal = typeof onboarding?.needsGoal === 'boolean' ? onboarding.needsGoal : !retirementGoal
  const needsAccounts = accountsCount === 0
  const showOnboarding = needsGoal || needsAccounts

  /* ── Signal derivations ──────────────── */
  const snapshotStale = isSnapshotStale(data?.last_snapshot_date)
  const daysSinceSnap = getDaysSinceSnapshot(data?.last_snapshot_date)

  const dataAccounts = accounts

  /* ── Freshness label (used in hero timestamp) ─── */
  const freshnessValue = data?.last_snapshot_date
    ? (daysSinceSnap === 0 ? 'Today' : `${daysSinceSnap}d ago`)
    : '—'

  /* ── ISA urgency — backend only ─ */
  const isaRemaining = data?.isa_remaining ?? null
  const taxYearDaysLeft = daysUntilTaxYearEnd()
  const taxYearEnd = getTaxYearEndLabel()
  const showIsaUrgency = isIsaUrgent(isaRemaining)

  /* ── Command deck derivations ─── */
  const totalMonthlyContribs = dataAccounts.reduce((s, a) => s + Number(a.monthly_contribution || 0), 0)
  const contributingCount = dataAccounts.filter((a) => Number(a.monthly_contribution || 0) > 0).length

  // Plan shortfall — uses forecast's own inputs to match backend computation
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

  /* ── Trial badge ─────────────────────── */
  const trialDaysLeft = subscriptionStatus === 'trialing' && trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd) - Date.now()) / 86400000))
    : null

  /* ── Change grounding line ── */
  const changeFromDate = sparkValues.length >= 2 && data.series?.[0]?.t
    ? fmtDate(data.series[0].t)
    : null

  return (
    <div className="animate-page-in pb-6">
      {/* Soft background refresh indicator */}
      {loading && data ? (
        <div className="fixed inset-0 z-[900] pointer-events-none">
          <div className="absolute top-4 right-4 text-[11px] font-semibold px-3 py-1.5 rounded-2xl bg-black/80 text-white">
            Updating…
          </div>
        </div>
      ) : null}

      {/* Milestone receipt */}
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

      {/* Trial badge — above stage */}
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
            {trialDaysLeft === 0 ? 'Trial ends today' : `${trialDaysLeft}d left in trial`}
          </button>
        </div>
      )}

      {/* ── 1. Hero — full-bleed dark stage ── */}
      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0A0F1A 0%, #141A26 50%, #0F141F 100%)',
          borderBottom: heroHighlight ? `2px solid ${heroHighlight}` : undefined,
        }}
      >
        {/* Atmospheric glows */}
        <div aria-hidden="true" className="absolute -top-24 -right-16 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 65%)' }} />
        <div aria-hidden="true" className="absolute -bottom-16 -left-10 w-[280px] h-[280px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(120,169,230,0.06) 0%, transparent 65%)' }} />

        <div className="relative px-6 pt-9 pb-8 sm:px-10 sm:pt-10 max-w-2xl">

          {/* Eyebrow */}
          <div className="text-[11px] font-semibold tracking-[.18em] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Total wealth · {baseCurrency}
          </div>

          {/* Hero number */}
          <div className={`hero-number text-white ${animatingDelta ? 'animate-delta' : ''}`}>
            {fmtCurrency(total, baseCurrency)}
          </div>

          {/* Delta — currency primary, percentage as context */}
          {sparkValues.length >= 2 && (
            <div className="-mt-0.5 mb-1">
              <GoldDelta
                value={delta}
                label={Math.abs(deltaPct) <= 99 ? ` · ${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}% 90d` : ' · 90d'}
                size="md"
              />
            </div>
          )}

          {/* What changed — grounding line */}
          {changeFromDate && (
            <div className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
              vs snapshot {changeFromDate}
            </div>
          )}

          {/* Milestone achieved badge */}
          {milestoneAchieved && (
            <div className="mt-3">
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle size={10} /> Target reached
              </div>
            </div>
          )}

          {/* Milestone progress */}
          {hasMilestone && (
            <div className="mt-5 max-w-xl">
              <MilestoneProgress
                activeMilestoneTarget={activeMilestoneTarget}
                milestoneProgressPct={milestoneProgressPct}
                milestoneRemaining={milestoneRemaining}
                milestoneAchieved={milestoneAchieved}
                reachAge={reachAge}
                usingSuggested={usingSuggested}
                editingMilestone={editingMilestone}
                milestoneInput={milestoneInput}
                setMilestoneInput={setMilestoneInput}
                saveMilestone={saveMilestone}
                savingMilestone={savingMilestone}
                setEditingMilestone={setEditingMilestone}
                startEditMilestone={startEditMilestone}
                ccy={ccy}
              />
            </div>
          )}

          {/* Snapshot freshness — trust cue; escalates to amber if stale */}
          <div
            className="flex items-center gap-2 mt-5 text-[11px]"
            style={{ color: snapshotStale ? 'rgba(200,155,60,0.65)' : 'rgba(255,255,255,0.28)' }}
          >
            {snapshotStale ? <AlertTriangle size={10} /> : <Shield size={10} />}
            <span>
              {data?.last_snapshot_date
                ? snapshotStale
                  ? `Snapshot ${freshnessValue} — update due`
                  : `Snapshot ${freshnessValue} · Encrypted`
                : 'No snapshots yet · Encrypted'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. ISA urgency — only full-width interrupt ── */}
      {showIsaUrgency && (
        <div className="mt-5">
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

      {/* ── Scene 2: Command deck ── */}
      <div className="mt-6">
        <CommandDeck
          goal={retirementGoal}
          total={total}
          ccy={ccy}
          forecast={data.forecast}
          isPro={isPro}
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
      </div>

      {/* ── Scene 3: Wealth runway ── */}
      <div className="mt-10 pt-8 border-t border-black/[.04] dark:border-white/[.04]">
        <WealthRunway settingsReady={settingsReady} isPro={isPro} ccy={ccy} />
      </div>

      {/* ── Onboarding (conditional) ── */}
      {showOnboarding && (
        <div className="mt-8">
          <OnboardingPanel
            needsGoal={needsGoal}
            needsAccounts={needsAccounts}
            accountsCount={accountsCount}
            onGoal={() => setGoalSetupOpen(true)}
            onAccounts={() => setPage('accounts')}
          />
        </div>
      )}

      {/* ── Sign out (mobile only, unchanged) ── */}
      {/* ── Goal setup overlay ── */}
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
    </div>
  )
}