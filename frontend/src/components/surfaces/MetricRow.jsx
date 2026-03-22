// frontend/src/components/surfaces/MetricRow.jsx
// Horizontal strip of 2–4 key metrics separated by thin dividers.
// Reads like a premium instrument panel — not a card.
//
// Border and background aligned to system-wide dark tokens:
//   dark:border-white/[.07]   (was /[.06])
//   dark:bg-white/[.03]       (was /[.025])

import React from 'react'
import clsx from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

function MetricCell({ label, value, sub, trend, onClick, last }) {
  const hasTrend = trend === 'up' || trend === 'down'
  const isPositive = trend === 'up'

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={clsx(
          'flex-1 min-w-0 text-left py-5 px-5',
          'transition-opacity duration-150',
          onClick
            ? 'hover:opacity-75 cursor-pointer'
            : 'cursor-default'
        )}
      >
        {/* Label */}
        <div className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-ink-muted/55 dark:text-white/28 mb-2">
          {label}
        </div>

        {/* Value + trend icon */}
        <div className="flex items-center gap-2">
          <div className="text-[1.35rem] sm:text-[1.5rem] font-semibold tracking-tight tabular-nums text-ink dark:text-white leading-none">
            {value}
          </div>
          {hasTrend && (
            <span
              className={clsx(
                'inline-flex items-center',
                isPositive
                  ? 'text-gain dark:text-emerald-400'
                  : 'text-loss dark:text-rose-400'
              )}
            >
              {isPositive
                ? <TrendingUp size={14} />
                : <TrendingDown size={14} />}
            </span>
          )}
        </div>

        {/* Sub-label */}
        {sub && (
          <div className="mt-1.5 text-xs text-ink-muted/50 dark:text-white/22 tabular-nums leading-none">
            {sub}
          </div>
        )}
      </button>

      {/* Divider — not after last item */}
      {!last && (
        <div className="self-stretch w-px bg-black/[.055] dark:bg-white/[.06] my-3.5 shrink-0" aria-hidden="true" />
      )}
    </>
  )
}

export default function MetricRow({
  metrics = [],
  className = '',
}) {
  if (!metrics.length) return null

  return (
    <div
      className={clsx(
        'flex items-stretch',
        'rounded-2xl border border-black/[.06] dark:border-white/[.07]',
        'bg-white/60 dark:bg-white/[.03]',
        'overflow-hidden',
        className
      )}
    >
      {metrics.map((m, i) => (
        <MetricCell
          key={i}
          label={m.label}
          value={m.value}
          sub={m.sub}
          trend={m.trend}
          onClick={m.onClick}
          last={i === metrics.length - 1}
        />
      ))}
    </div>
  )
}