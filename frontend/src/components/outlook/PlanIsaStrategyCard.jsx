import React, { useEffect, useMemo, useRef } from 'react'
import Card from '../Card'
import { fmtCurrency, fmtCurrencyCompact } from '../../utils'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { planTheme } from './planTheme'
import { formatShortDate, getPlanIsaGuidance, numFrom } from './planIsaGuidance'
import { getPlanFundingOrder } from './planFundingOrder'

export default function PlanIsaStrategyCard({
  goal,
  derived,
  status,
  localContrib,
  isaUsedYtd,
  setIsaUsedYtd,
  isaMonthly,
  setIsaMonthly,
  track,
}) {
  const trackedRef = useRef(false)

  const guidance = useMemo(
    () =>
      getPlanIsaGuidance({
        goal,
        derived,
        status,
        localContrib,
        isaUsedYtd,
        isaMonthly,
      }),
    [goal, derived, status, localContrib, isaUsedYtd, isaMonthly]
  )

  const fundingOrder = useMemo(
    () =>
      getPlanFundingOrder({
        goal,
        derived,
        status,
        localContrib,
        isaUsedYtd,
        isaMonthly,
      }),
    [goal, derived, status, localContrib, isaUsedYtd, isaMonthly]
  )

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true

    track?.('plan_wrapper_strategy_viewed', {
      wrapper: guidance.wrapperKey,
      confidence: guidance.confidence,
      status,
      priorities: fundingOrder.priorities.map((p) => p.key),
    })
  }, [guidance.wrapperKey, guidance.confidence, fundingOrder.priorities, status, track])

  const {
    taxYear,
    rules,
    recommendedWrapper,
    confidence,
    primaryReason,
    secondaryReason,
    nextActionTitle,
    nextActionBody,
    watchout,
    remainingAllowance,
    projectedUnusedAllowance,
    currentProgressPct,
    extensionPct,
    needsMoreIsaFunding,
    suggestedMonthlyIsa,
  } = guidance

  const planPace = Math.max(0, numFrom(localContrib, 0))
  const monthlyIsaValue = Math.max(0, numFrom(isaMonthly, 0))

  return (
    <Card className={`${planTheme.sectionCard} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className={planTheme.eyebrowAccent}>
            <span className="inline-flex items-center gap-2">
              <Sparkles size={13} />
              Wrapper strategy
            </span>
          </div>

          <div className="mt-3 text-xl sm:text-2xl font-display text-ink dark:text-white tracking-tight">
            Use this tax year deliberately
          </div>

          <div className={`mt-2 ${planTheme.body} max-w-[48rem]`}>
            One place to see remaining ISA room, the best wrapper to use now, and the order your
            next pounds should follow.
          </div>
        </div>

        <div
          className={`${planTheme.innerCard} px-3 py-2 text-xs font-semibold text-ink dark:text-white`}
        >
          {taxYear.label} tax year
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.02fr_0.98fr] gap-6">
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className={planTheme.fieldLabel}>Already used this tax year</label>
              <input
                value={isaUsedYtd}
                onChange={(e) => {
                  setIsaUsedYtd(e.target.value)
                  track?.('plan_isa_input_changed', {
                    field: 'isa_used_ytd',
                  })
                }}
                inputMode="decimal"
                placeholder="0"
                className={planTheme.fieldInput}
              />
            </div>

            <div>
              <label className={planTheme.fieldLabel}>Planned ISA funding / month</label>
              <input
                value={isaMonthly}
                onChange={(e) => {
                  setIsaMonthly(e.target.value)
                  track?.('plan_isa_input_changed', {
                    field: 'isa_monthly',
                  })
                }}
                inputMode="decimal"
                placeholder="500"
                className={planTheme.fieldInput}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setIsaMonthly(String(planPace || ''))
                track?.('plan_isa_use_plan_pace_clicked', {
                  planPace,
                  wrapper: guidance.wrapperKey,
                })
              }}
              className={planTheme.buttonSecondary}
            >
              Use plan pace
            </button>

            {needsMoreIsaFunding ? (
              <button
                type="button"
                onClick={() => {
                  setIsaMonthly(String(suggestedMonthlyIsa || ''))
                  track?.('plan_isa_use_required_pace_clicked', {
                    suggestedMonthlyIsa,
                    wrapper: guidance.wrapperKey,
                  })
                }}
                className={planTheme.buttonPrimary}
              >
                Use required pace
              </button>
            ) : null}
          </div>

          <div className="mt-3 text-[11px] text-ink-muted dark:text-white/28">
            These values are saved for this goal and reset automatically next tax year.
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`${planTheme.innerCard} p-4`}>
              <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                <Wallet size={12} />
                ISA allowance
              </div>
              <div className="mt-2 text-lg font-display text-ink dark:text-white">
                {fmtCurrency(rules.annualAllowance, 'GBP')}
              </div>
            </div>

            <div className={`${planTheme.innerCard} p-4`}>
              <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                <Wallet size={12} />
                Remaining now
              </div>
              <div className="mt-2 text-lg font-display text-ink dark:text-white">
                {fmtCurrencyCompact(remainingAllowance, 'GBP')}
              </div>
            </div>

            <div className={`${planTheme.innerCard} p-4`}>
              <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                <CalendarClock size={12} />
                Tax year ends
              </div>
              <div className="mt-2 text-lg font-display text-ink dark:text-white">
                {formatShortDate(taxYear.end)}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className={planTheme.statLabel}>Allowance usage</div>
              <div className="text-xs text-ink-muted dark:text-white/30">
                {taxYear.daysRemaining} days left
              </div>
            </div>

            <div className="relative h-2 rounded-full bg-black/[.06] dark:bg-white/[.06] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-black/[.10] dark:bg-white/[.14]"
                style={{ width: `${currentProgressPct}%` }}
              />
              <div
                className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,rgba(107,160,216,0.72),rgba(107,160,216,0.95))]"
                style={{
                  left: `${currentProgressPct}%`,
                  width: `${extensionPct}%`,
                }}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-ink-muted dark:text-white/28">
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-black/[.10] dark:bg-white/[.14]" />
                Used so far
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                Projected by year end
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`${planTheme.innerCard} p-4`}>
              <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                <Target size={12} />
                Projected unused
              </div>
              <div className="mt-2 text-lg font-display text-ink dark:text-white">
                {fmtCurrencyCompact(projectedUnusedAllowance, 'GBP')}
              </div>
            </div>

            <div className={`${planTheme.innerCard} p-4`}>
              <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                <TrendingUp size={12} />
                ISA pace
              </div>
              <div className="mt-2 text-lg font-display text-ink dark:text-white">
                {fmtCurrency(monthlyIsaValue, 'GBP')}/mo
              </div>
            </div>
          </div>

          <div className={`${planTheme.innerCard} mt-5 p-4`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-2xl flex items-center justify-center bg-white/75 dark:bg-white/[.05] border border-black/[.06] dark:border-white/[.08]">
                <CheckCircle2 size={16} className="text-ink dark:text-white" />
              </div>

              <div>
                <div className="text-sm font-semibold text-ink dark:text-white">
                  {nextActionTitle}
                </div>
                <div className={`mt-1 ${planTheme.body}`}>{nextActionBody}</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-accent/18 bg-accent/[.05] dark:bg-accent/[.10] p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[10px] font-semibold tracking-[.18em] uppercase text-accent dark:text-blue-300">
                Recommended wrapper
              </div>

              <div className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/[.03] dark:bg-white/[.05] text-ink-muted dark:text-white/70 border border-black/[.05] dark:border-white/[.08]">
                {confidence}
              </div>
            </div>

            <div className="mt-2 text-lg font-display text-ink dark:text-white">
              {recommendedWrapper}
            </div>
            <div className="mt-2 text-sm text-ink dark:text-white/90 leading-relaxed">
              {primaryReason}
            </div>
            <div className={`mt-2 ${planTheme.body}`}>{secondaryReason}</div>
          </div>

          <div className={`${planTheme.innerCard} mt-4 p-4`}>
            <div className="text-[10px] font-semibold tracking-[.18em] uppercase text-accent dark:text-blue-300">
              Funding order
            </div>

            <div className={`mt-2 ${planTheme.body}`}>{fundingOrder.summary}</div>

            <div className="mt-4 divide-y divide-black/[.06] dark:divide-white/[.06]">
              {fundingOrder.priorities.map((priority, index) => (
                <div key={priority.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 mt-0.5 rounded-full bg-black/[.05] dark:bg-white/[.06] text-[11px] font-semibold text-ink dark:text-white flex items-center justify-center shrink-0">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="text-sm font-semibold text-ink dark:text-white leading-snug">
                          {priority.title}
                        </div>
                        <div className="text-sm font-medium text-ink dark:text-white/88">
                          {priority.amountText}
                        </div>
                      </div>

                      <div className={`mt-1 ${planTheme.body}`}>{priority.body}</div>

                      {priority.action?.type === 'set_isa_monthly' ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setIsaMonthly(priority.action.value)
                              track?.('plan_funding_order_action_clicked', {
                                action: priority.action.type,
                                value: priority.action.value,
                                priority: priority.key,
                              })
                            }}
                            className={planTheme.buttonSecondary}
                          >
                            {priority.action.label}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${planTheme.innerCard} mt-4 p-4`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-2xl flex items-center justify-center bg-white/75 dark:bg-white/[.05] border border-black/[.06] dark:border-white/[.08]">
                <AlertTriangle size={16} className="text-ink dark:text-white" />
              </div>

              <div>
                <div className="text-sm font-semibold text-ink dark:text-white">Watch-out</div>
                <div className={`mt-1 ${planTheme.body}`}>{watchout}</div>
              </div>
            </div>
          </div>

          <div className={`mt-5 pt-5 border-t ${planTheme.divider}`}>
            <div className="text-xs leading-relaxed text-ink-muted dark:text-white/34">
              Lifetime ISA can be a strong wrapper, but the withdrawal rules are tighter than a
              standard ISA. Replacing withdrawn ISA money in the same tax year only preserves
              allowance in flexible ISAs.
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}