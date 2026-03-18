import React from 'react'
import Card from '../Card'
import { Crown, Lock, Sparkles, TrendingUp } from 'lucide-react'
import { fmtCurrency, fmtCurrencyCompact } from '../../utils'
import { planTheme } from './planTheme'

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export default function PlanPriorityCard({
  status,
  derived,
  ccy,
  isPro,
  settingsReady,
  localContrib,
  setLocalContrib,
  setDirty,
  applyAssumptions,
  goUpgrade,
}) {
  const currentContribution = numFrom(localContrib, 0)

  const setRecommendedContribution = async () => {
    if (derived?.reqMc == null) return
    const next = Math.ceil(derived.reqMc)
    setLocalContrib(String(next))
    setDirty(true)
    await applyAssumptions({ mcOverride: next })
  }

  let eyebrow = 'Next move'
  let title = 'Keep the plan moving'
  let body =
    'Use this space to turn your forecast into a concrete decision, not just another chart.'
  let meta = null
  let action = null

  if (status === 'adjust' && derived?.reqMc != null) {
    const recommended = Math.ceil(derived.reqMc)
    const delta = Math.max(0, Math.ceil((derived.reqMc || 0) - currentContribution))

    eyebrow = 'Highest-impact move'
    title = `Increase to ${fmtCurrency(recommended, ccy)}/mo`
    body =
      delta > 0
        ? `That is roughly ${fmtCurrency(delta, ccy)}/mo more than your current pace and is the clearest way to close the gap.`
        : 'You are already at the required pace. Keep this contribution steady to stay on track.'
    meta = `Projected gap: ${fmtCurrencyCompact(derived.absGap, ccy)}`
    action = isPro ? (
      <button type="button" onClick={setRecommendedContribution} className={planTheme.buttonPrimary}>
        Set & update
      </button>
    ) : null
  } else if (status === 'ahead') {
    eyebrow = 'Optionality'
    title = 'You are ahead of plan'
    body =
      'You can stay the course, model an earlier target age, or test lighter contributions without losing progress.'
    meta =
      derived?.absGap != null
        ? `Projected surplus: ${fmtCurrencyCompact(derived.absGap, ccy)}`
        : null
  } else if (status === 'on_track') {
    eyebrow = 'Stay focused'
    title = 'Your current pace is working'
    body =
      'You are broadly on track. The smartest next step is usually consistency, then testing upside scenarios when income changes.'
    meta = `Current contribution: ${fmtCurrency(currentContribution, ccy)}/mo`
  }

  return (
    <Card className={`${planTheme.sectionCard} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={planTheme.eyebrowAccent}>
            <span className="inline-flex items-center gap-2">
              <Sparkles size={13} />
              {eyebrow}
            </span>
          </div>

          <div className="mt-3 text-xl sm:text-2xl font-display text-ink dark:text-white tracking-tight">
            {title}
          </div>

          <div className={`mt-2 ${planTheme.body} max-w-[44rem]`}>{body}</div>

          {meta ? (
            <div className={`mt-4 inline-flex items-center gap-2 ${planTheme.innerCard} px-3 py-2 text-xs font-semibold text-ink dark:text-white`}>
              <TrendingUp size={13} />
              {meta}
            </div>
          ) : null}
        </div>

        {!isPro && settingsReady ? (
          <button
            type="button"
            onClick={() => goUpgrade('next_move_locked')}
            className={`${planTheme.buttonUpgrade} shrink-0`}
          >
            <Lock size={15} />
            Go Pro
          </button>
        ) : null}
      </div>

      {!isPro && settingsReady ? (
        <div className={`mt-5 pt-5 border-t ${planTheme.divider}`}>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
            <Crown size={15} className="text-amber-500" />
            Unlock precise next-move guidance
          </div>
          <div className={`mt-1 ${planTheme.body}`}>
            Pro turns your forecast into a recommended action, with optimisation and faster scenario planning.
          </div>
        </div>
      ) : null}

      {isPro && action ? (
        <div className={`mt-5 pt-5 border-t ${planTheme.divider} flex items-center justify-end`}>
          {action}
        </div>
      ) : null}
    </Card>
  )
}