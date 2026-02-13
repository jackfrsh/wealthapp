import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fmtPct, fmtCurrency } from '../utils'

export default function ChangePill({ change, changePct, currency, size = 'md', showAmount = true }) {
  const isPos = change > 0
  const isNeg = change < 0
  const isZero = change === 0

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  }

  const colors = isZero
    ? 'bg-black/[.04] dark:bg-white/[.06] text-ink-muted dark:text-white/50'
    : isPos
      ? 'bg-gain-light dark:bg-gain/10 text-gain dark:text-emerald-400'
      : 'bg-loss-light dark:bg-loss/10 text-loss dark:text-red-400'

  const Icon = isZero ? Minus : isPos ? TrendingUp : TrendingDown

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${sizes[size]} ${colors}`}>
      <Icon size={size === 'sm' ? 11 : size === 'lg' ? 15 : 13} strokeWidth={2.5} />
      {showAmount && <span className="tabular-nums">{change >= 0 ? '+' : ''}{fmtCurrency(change, currency)}</span>}
      <span className="tabular-nums">{fmtPct(changePct)}</span>
    </span>
  )
}
