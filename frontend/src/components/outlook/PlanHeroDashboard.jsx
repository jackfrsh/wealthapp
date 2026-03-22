// frontend/src/components/outlook/PlanHeroDashboard.jsx
// Final refinement pass.
// Eyebrow: "Planning centre" → "Long-term plan"
// Removed redundant status sub-label copy.
// Summary lines tightened across all three status states.
// All calculations, props, and layout: unchanged.

import React, { useMemo } from 'react'
import { fmtCurrency, fmtCurrencyCompact } from '../../utils'
import {
  CalendarClock,
  Check,
  Crown,
  Lock,
  Pencil,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { planTheme } from './planTheme'

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export default function PlanHeroDashboard({
  goal,
  derived,
  ccy,
  status,
  statusLabels,
  statusColors,
  isPro,
  settingsReady,
  inflationAdj,
  setInflationAdj,
  openEdit,
  goUpgrade,
  localContrib,
  localReturn,
  feedback,
}) {
  const {
    targetAmt = 0,
    currentNW = 0,
    displayProjEnd = 0,
    yearsRemaining = 0,
    freedomAge = null,
    freedomYearNum = null,
    gap = 0,
    absGap = 0,
  } = derived || {}

  const {
    currentProgressPct,
    projectedProgressPct,
    projectedProgressRaw,
    extensionPct,
    deltaLabel,
  } = useMemo(() => {
    const currentRatio = targetAmt > 0 ? (Number(currentNW) / Number(targetAmt)) * 100 : 0
    const projectedRatio = targetAmt > 0 ? (Number(displayProjEnd) / Number(targetAmt)) * 100 : 0

    const currentProgressPct = clampPercent(currentRatio)
    const projectedProgressPct = clampPercent(projectedRatio)
    const extensionPct = Math.max(0, projectedProgressPct - currentProgressPct)

    return {
      currentProgressPct,
      projectedProgressPct,
      projectedProgressRaw: projectedRatio,
      extensionPct,
      deltaLabel: gap > 0 ? 'Gap' : 'Ahead by',
    }
  }, [targetAmt, currentNW, displayProjEnd, gap, status])

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,169,230,0.05),transparent_28%)] pointer-events-none" />

      <div className="relative p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className={planTheme.eyebrowAccent}>
              <span className="inline-flex items-center gap-2">
                <Sparkles size={12} />
                Long-term plan
              </span>
            </div>

            <h1 className="mt-3 font-display text-[32px] sm:text-[40px] leading-[0.98] tracking-[-0.04em] text-ink dark:text-white">
              {goal?.name || 'Plan'}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusColors[status]}`}>
                {statusLabels[status]}
              </span>

              {feedback ? (
                <span className="text-xs font-medium text-emerald-500 dark:text-emerald-300 flex items-center gap-1.5 animate-fade-in">
                  <Check size={14} /> {feedback}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {settingsReady &&
              (isPro ? (
                <button
                  onClick={() => setInflationAdj((v) => !v)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-2xl border transition-colors ${
                    inflationAdj
                      ? 'bg-accent/10 border-accent/20 text-accent dark:text-accent'
                      : 'bg-white/70 dark:bg-white/[.04] border-black/[.06] dark:border-white/[.08] text-ink-muted/70 dark:text-white/42 hover:text-ink dark:hover:text-white/65'
                  }`}
                  type="button"
                >
                  {inflationAdj ? '📉 Real terms' : '💰 Future value'}
                </button>
              ) : (
                <button
                  onClick={() => goUpgrade('inflation_locked')}
                  className={planTheme.buttonUpgrade}
                  type="button"
                >
                  <Crown size={11} />
                  Real terms
                </button>
              ))}

            <button onClick={openEdit} className={planTheme.buttonSecondary} type="button">
              <Pencil size={16} />
              Edit plan
            </button>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-8 items-start">
          <div>
            <div className={planTheme.statLabel}>Projected outcome</div>

            <div className="mt-3 flex items-end gap-3 flex-wrap">
              <div className={planTheme.statValueHero}>
                {fmtCurrencyCompact(displayProjEnd, ccy)}
              </div>
              <div className="pb-1.5 text-sm text-ink-muted dark:text-white/32">
                by age {goal?.target_age}
              </div>
            </div>

            <div className="mt-2 text-sm text-ink-muted dark:text-white/34">
              Target{' '}
              <span className="font-medium text-ink dark:text-white/82">
                {fmtCurrencyCompact(targetAmt, ccy)}
              </span>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className={planTheme.statLabel}>Progress</div>
                <div className="text-xs text-ink-muted dark:text-white/30">
                  {Math.round(projectedProgressRaw)}% projected
                </div>
              </div>

              <div className="relative h-2 rounded-full bg-black/[.06] dark:bg-white/[.06] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-black/[.10] dark:bg-white/[.14]"
                  style={{ width: `${currentProgressPct}%` }}
                />
                <div
                  className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,rgba(120,169,230,0.72),rgba(120,169,230,0.95))]"
                  style={{
                    left: `${currentProgressPct}%`,
                    width: `${extensionPct}%`,
                  }}
                />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-ink-muted dark:text-white/28">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-black/[.10] dark:bg-white/[.14]" />
                  Current wealth
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                  Projected extension
                </span>
              </div>
            </div>

            <div className={`mt-6 grid grid-cols-2 sm:grid-cols-4 gap-5 pt-6 border-t ${planTheme.divider}`}>
              <div>
                <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                  <Wallet size={11} />
                  Wealth
                </div>
                <div className="mt-2 font-display text-[28px] leading-none tracking-tight text-ink dark:text-white/90">
                  {fmtCurrencyCompact(currentNW, ccy)}
                </div>
              </div>

              <div>
                <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                  <Target size={11} />
                  {deltaLabel}
                </div>
                <div className="mt-2 font-display text-[28px] leading-none tracking-tight text-ink dark:text-white/90">
                  {fmtCurrencyCompact(absGap, ccy)}
                </div>
              </div>

              <div>
                <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                  <TrendingUp size={11} />
                  Return
                </div>
                <div className="mt-2 font-display text-[28px] leading-none tracking-tight text-ink dark:text-white/90">
                  {numFrom(localReturn, 0)}%
                </div>
              </div>

              <div>
                <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                  <Wallet size={11} />
                  Pace
                </div>
                <div className="mt-2 font-display text-[28px] leading-none tracking-tight text-ink dark:text-white/90">
                  {fmtCurrency(numFrom(localContrib, 0), ccy)}/mo
                </div>
              </div>
            </div>

          </div>

          <div className="xl:pl-2">
            <div className={planTheme.statLabel}>Freedom timeline</div>

            <div className="mt-3 font-display text-[38px] sm:text-[46px] leading-none tracking-[-0.04em] text-ink dark:text-white">
              {isPro ? (freedomAge != null ? `Age ${freedomAge}` : 'Off target') : 'Unlock Pro'}
            </div>

            <div className="mt-2 text-sm text-ink-muted dark:text-white/34">
              {isPro ? (
                freedomYearNum != null ? (
                  <>
                    Tracking toward freedom in{' '}
                    <span className="font-medium text-ink dark:text-white/82">{freedomYearNum}</span>
                  </>
                ) : (
                  'Your current path does not yet reach your freedom target.'
                )
              ) : (
                'See independence timing and deeper planning tools.'
              )}
            </div>

            <div className={`mt-6 pt-6 border-t ${planTheme.divider} space-y-4`}>
              <div>
                <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                  <CalendarClock size={11} />
                  Years left
                </div>
                <div className="mt-2 font-display text-[30px] leading-none tracking-tight text-ink dark:text-white/90">
                  {yearsRemaining}
                </div>
              </div>

              <div>
                <div className={planTheme.statLabel}>{deltaLabel}</div>
                <div className="mt-2 font-display text-[30px] leading-none tracking-tight text-ink dark:text-white/90">
                  {fmtCurrencyCompact(absGap, ccy)}
                </div>
              </div>
            </div>

            {!isPro && settingsReady ? (
              <div className={`mt-6 pt-6 border-t ${planTheme.divider}`}>
                <button
                  onClick={() => goUpgrade('independence_locked')}
                  className={planTheme.buttonUpgrade}
                  type="button"
                >
                  <Lock size={16} />
                  Go Pro
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}