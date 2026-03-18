import React from 'react'
import Card from '../Card'
import { CalendarClock, Crown, Lock, Sparkles, Target, TrendingUp } from 'lucide-react'
import { fmtCurrency, fmtCurrencyCompact } from '../../utils'
import { planTheme } from './planTheme'

export default function PlanReviewCard({
  derived,
  ccy,
  isPro,
  settingsReady,
  localContrib,
  localReturn,
  goUpgrade,
}) {
  const currentContribution = Number(localContrib || 0)
  const expectedReturn = Number(localReturn || 0)

  let title = 'Keep the plan alive'
  let summary =
    'Your plan works best when you revisit it after real changes: income, contributions, rates, markets, or priorities.'
  let biggestLeverLabel = 'Strongest lever'
  let biggestLeverValue = 'Consistency'
  let revisitLabel = 'Revisit when'
  let revisitValue = 'Income or priorities change'
  let focusLabel = 'What to watch next'
  let focusValue = `Keep contributing ${fmtCurrency(currentContribution, ccy)}/mo at ${expectedReturn}% expected return.`

  if (derived.status === 'adjust') {
    title = 'Your biggest opportunity is closing the gap'
    summary =
      'Right now, contribution rate matters more than fine-tuning. The clearest path is increasing what goes into the plan each month.'
    biggestLeverValue =
      derived.reqMc != null
        ? `Move toward ${fmtCurrency(Math.ceil(derived.reqMc), ccy)}/mo`
        : 'Increase contributions'
    revisitValue = 'After any pay rise, bonus, or cost change'
    focusValue =
      derived.deltaMc != null && derived.deltaMc > 0
        ? `You are about ${fmtCurrency(Math.ceil(derived.deltaMc), ccy)}/mo short of the pace needed to hit your target.`
        : `Your projected gap is ${fmtCurrencyCompact(derived.absGap, ccy)}.`
  } else if (derived.status === 'ahead') {
    title = 'You have room to optimise'
    summary =
      'You are ahead of plan. This is the moment to decide whether to buy back time, raise the target, or keep building optionality.'
    biggestLeverValue =
      derived.absGap > 0 ? `Use your ${fmtCurrencyCompact(derived.absGap, ccy)} surplus wisely` : 'Model earlier freedom'
    revisitValue = 'When you want to change pace or target age'
    focusValue =
      derived.freedomYearNum != null
        ? `You are currently tracking toward freedom in ${derived.freedomYearNum}. Test scenarios before changing course.`
        : 'Run scenarios to decide whether to reduce pace or increase ambition.'
  } else if (derived.status === 'on_track') {
    title = 'Stay steady, then test upside'
    summary =
      'The core plan is working. The smartest behaviour now is staying consistent, then using scenarios when life changes.'
    biggestLeverValue = 'Keep the plan funded'
    revisitValue = 'After pay rises, bonuses, or tax-year changes'
    focusValue =
      derived.freedomYearNum != null
        ? `You are currently on pace for freedom in ${derived.freedomYearNum}.`
        : `Your target remains achievable if you keep contributing ${fmtCurrency(currentContribution, ccy)}/mo.`
  }

  return (
    <Card className={`${planTheme.sectionCard} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={planTheme.eyebrowAccent}>
            <span className="inline-flex items-center gap-2">
              <Sparkles size={13} />
              Plan review
            </span>
          </div>

          <div className="mt-3 text-xl sm:text-2xl font-display text-ink dark:text-white tracking-tight">
            {title}
          </div>

          <div className={`mt-2 ${planTheme.body} max-w-[44rem]`}>{summary}</div>
        </div>

        {!isPro && settingsReady ? (
          <button
            type="button"
            onClick={() => goUpgrade('plan_review_locked')}
            className={`${planTheme.buttonUpgrade} shrink-0`}
          >
            <Lock size={15} />
            Go Pro
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${planTheme.innerCard} p-4`}>
          <div className={`${planTheme.statLabel} flex items-center gap-2`}>
            <TrendingUp size={12} />
            {biggestLeverLabel}
          </div>
          <div className="mt-2 text-sm font-semibold text-ink dark:text-white leading-relaxed">
            {biggestLeverValue}
          </div>
        </div>

        <div className={`${planTheme.innerCard} p-4`}>
          <div className={`${planTheme.statLabel} flex items-center gap-2`}>
            <CalendarClock size={12} />
            {revisitLabel}
          </div>
          <div className="mt-2 text-sm font-semibold text-ink dark:text-white leading-relaxed">
            {revisitValue}
          </div>
        </div>

        <div className={`${planTheme.innerCard} p-4`}>
          <div className={`${planTheme.statLabel} flex items-center gap-2`}>
            <Target size={12} />
            {focusLabel}
          </div>
          <div className="mt-2 text-sm font-semibold text-ink dark:text-white leading-relaxed">
            {focusValue}
          </div>
        </div>
      </div>

      {!isPro && settingsReady ? (
        <div className={`mt-5 pt-5 border-t ${planTheme.divider}`}>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
            <Crown size={15} className="text-amber-500" />
            Pro turns review into action
          </div>
          <div className={`mt-1 ${planTheme.body}`}>
            Unlock richer scenario planning, real-terms modelling, and deeper strategic tools across your plan.
          </div>
        </div>
      ) : null}
    </Card>
  )
}