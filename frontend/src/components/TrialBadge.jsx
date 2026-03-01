// frontend/src/components/TrialBadge.jsx
import React, { useMemo } from 'react'
import { Clock } from 'lucide-react'

/**
 * Shows "Trial · N days left" with a subtle progress bar.
 * Only renders when subscriptionStatus === 'trialing' and trialEnd exists.
 */
export default function TrialBadge({ trialEnd, onClick, compact = false }) {
  const daysLeft = useMemo(() => {
    if (!trialEnd) return null
    const end = new Date(trialEnd)
    const now = new Date()
    const diff = end - now
    const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    return days
  }, [trialEnd])

  if (daysLeft === null) return null

  const urgent = daysLeft <= 2
  const totalDays = 7 // trial period
  const progressPct = Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100))

  if (compact) {
    return (
      <button
        onClick={onClick}
        type="button"
        className={[
          'flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full transition-colors',
          urgent
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-accent/10 dark:bg-accent/15 text-accent dark:text-blue-400',
        ].join(' ')}
      >
        <Clock size={10} />
        {daysLeft === 0 ? 'Trial ends today' : `${daysLeft}d left`}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      type="button"
      className={[
        'w-full rounded-2xl p-3.5 text-left transition-all hover:opacity-90',
        urgent
          ? 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200/50 dark:border-amber-700/20'
          : 'bg-accent/[.06] dark:bg-accent/[.08] border border-accent/10 dark:border-accent/15',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <div className={[
          'w-7 h-7 rounded-lg flex items-center justify-center',
          urgent ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-accent/10 dark:bg-accent/15',
        ].join(' ')}>
          <Clock size={14} className={urgent ? 'text-amber-600 dark:text-amber-400' : 'text-accent'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={[
            'text-xs font-semibold',
            urgent ? 'text-amber-700 dark:text-amber-400' : 'text-ink dark:text-white',
          ].join(' ')}>
            {daysLeft === 0
              ? 'Trial ends today'
              : daysLeft === 1
                ? 'Trial · 1 day left'
                : `Trial · ${daysLeft} days left`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1 rounded-full bg-black/[.06] dark:bg-white/[.08] overflow-hidden">
        <div
          className={[
            'h-full rounded-full transition-all',
            urgent ? 'bg-amber-500' : 'bg-accent',
          ].join(' ')}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </button>
  )
}
