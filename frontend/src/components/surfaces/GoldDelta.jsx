// frontend/src/components/surfaces/GoldDelta.jsx
// Gold/red/neutral delta indicator for period-over-period change.
//
// Props:
//   value     — number (raw amount) or string (pre-formatted)
//   label     — optional trailing context string
//   isPercent — if true, format value as percentage (default false)
//   size      — 'sm' | 'md' | 'lg'
//   cap       — suppress % display when Math.abs(value) > cap (default 99.9)
//               Set 0 to disable cap. Prevents trust-undermining huge percentages.
//   className

import React from 'react'
import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const SIZE_CLS = {
  sm: 'text-[11px] gap-1',
  md: 'text-sm gap-1.5',
  lg: 'text-base gap-2',
}
const ICON_SIZE = { sm: 11, md: 13, lg: 15 }

export default function GoldDelta({
  value,
  label,
  isPercent = false,
  size = 'md',
  cap = 99.9,
  className = '',
}) {
  const numeric = typeof value === 'number' ? value : null
  const direction =
    numeric === null ? 'positive'
    : numeric > 0   ? 'positive'
    : numeric < 0   ? 'negative'
    :                 'neutral'

  // Suppress percentage when exaggerated (e.g. first snapshot large % gain)
  const cappedOut = isPercent && numeric !== null && cap > 0 && Math.abs(numeric) > cap

  let display
  if (typeof value === 'string') {
    display = value
  } else if (numeric !== null) {
    if (cappedOut) {
      display = null
    } else {
      const abs = Math.abs(numeric)
      const sign = numeric > 0 ? '+' : numeric < 0 ? '−' : ''
      display = isPercent
        ? `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
        : `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    }
  } else {
    display = '—'
  }

  if (display === null) return null

  const Icon =
    direction === 'positive' ? TrendingUp
    : direction === 'negative' ? TrendingDown
    : Minus

  const color =
    direction === 'positive' ? 'var(--gold)'
    : direction === 'negative' ? 'var(--negative, #e05c5c)'
    : 'var(--text-muted, rgba(107,114,128,0.8))'

  return (
    <span
      className={clsx(
        'inline-flex items-center font-semibold tabular-nums',
        SIZE_CLS[size] || SIZE_CLS.md,
        className
      )}
    >
      <Icon
        size={ICON_SIZE[size] || ICON_SIZE.md}
        aria-hidden="true"
        style={{ color, opacity: direction === 'neutral' ? 0.4 : 0.8 }}
      />
      <span style={{ color }}>{display}</span>
      {label && (
        <span
          className="font-normal"
          style={{ color: 'var(--text-muted, rgba(107,114,128,0.7))', opacity: 0.65 }}
        >
          {label}
        </span>
      )}
    </span>
  )
}