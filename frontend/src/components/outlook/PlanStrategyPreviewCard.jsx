import React, { useEffect, useMemo, useState } from 'react'
import Card from '../Card'
import { ArrowRight, Sparkles, Wallet } from 'lucide-react'
import { fmtCurrencyCompact } from '../../utils'
import { planTheme } from './planTheme'
import { getPlanIsaGuidance } from './planIsaGuidance'

function getIsaStorageKey(goalId) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()
  const startYear = month > 3 || (month === 3 && day >= 6) ? year : year - 1
  return `paddock:plan:isa:${goalId || 'default'}:${startYear}`
}

export default function PlanStrategyPreviewCard({
  goalId,
  goal,
  derived,
  status,
  localContrib,
  onOpenStrategy,
}) {
  const [isaUsedYtd, setIsaUsedYtd] = useState('')
  const [isaMonthly, setIsaMonthly] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getIsaStorageKey(goalId))
      if (!raw) {
        setIsaUsedYtd('')
        setIsaMonthly('')
        return
      }

      const parsed = JSON.parse(raw)
      setIsaUsedYtd(parsed.isaUsedYtd ?? '')
      setIsaMonthly(parsed.isaMonthly ?? '')
    } catch {
      setIsaUsedYtd('')
      setIsaMonthly('')
    }
  }, [goalId])

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

  return (
    <Card className={`${planTheme.sectionCard} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className={planTheme.eyebrowAccent}>
            <span className="inline-flex items-center gap-2">
              <Sparkles size={13} />
              Strategy
            </span>
          </div>

          <div className="mt-3 text-xl sm:text-2xl font-display text-ink dark:text-white tracking-tight">
            Wrapper strategy
          </div>

          <div className={`mt-2 ${planTheme.body} max-w-[42rem]`}>
            See the best wrapper to use now, remaining ISA room, and the funding order for the next pounds.
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenStrategy}
          className={planTheme.buttonSecondary}
        >
          Open strategy
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${planTheme.innerCard} p-4`}>
          <div className={planTheme.statLabel}>Recommended wrapper</div>
          <div className="mt-2 text-base font-semibold text-ink dark:text-white">
            {guidance.recommendedWrapper}
          </div>
        </div>

        <div className={`${planTheme.innerCard} p-4`}>
          <div className={`${planTheme.statLabel} flex items-center gap-2`}>
            <Wallet size={12} />
            Remaining ISA room
          </div>
          <div className="mt-2 text-base font-semibold text-ink dark:text-white">
            {fmtCurrencyCompact(guidance.remainingAllowance, 'GBP')}
          </div>
        </div>

        <div className={`${planTheme.innerCard} p-4`}>
          <div className={planTheme.statLabel}>Next move</div>
          <div className="mt-2 text-base font-semibold text-ink dark:text-white leading-relaxed">
            {guidance.nextActionTitle}
          </div>
        </div>
      </div>
    </Card>
  )
}