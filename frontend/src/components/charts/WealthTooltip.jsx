import React from 'react'

/**
 * Shared Recharts tooltip — styled with the app's card tokens.
 *
 * bg-card / dark:bg-surface-dark-2, subtle border, rounded-2xl, shadow-card
 */

function fmtMoney(n, currency = 'GBP') {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(v)
}

export default function WealthTooltip({
  active,
  payload,
  label,
  currency = 'GBP',
  labelFormatter,
  valueFormatter,
}) {
  if (!active || !payload || !payload.length) return null

  const title = labelFormatter ? labelFormatter(label) : label

  return (
    <div
      className={
        'rounded-2xl px-3 py-2.5 ' +
        'bg-card dark:bg-surface-dark-2 ' +
        'border border-black/[.06] dark:border-white/[.06] ' +
        'shadow-card ' +
        'min-w-[130px] max-w-[200px]'
      }
    >
      {/* Header */}
      <div
        className="text-[10px] font-medium tracking-wider text-ink-muted/60 dark:text-white/35 uppercase mb-1.5 leading-none"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {title}
      </div>

      <div className="space-y-1">
        {payload.map((p) => {
          const name = p.name ?? p.dataKey ?? 'Value'
          const val = valueFormatter
            ? valueFormatter(p.value, p)
            : fmtMoney(p.value, currency)

          return (
            <div key={String(name)} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: p.color || 'currentColor',
                  }}
                />
                <span className="text-[11px] font-normal text-ink-muted dark:text-white/50 leading-none">
                  {name}
                </span>
              </div>
              <span
                className="text-[11px] font-medium text-ink dark:text-white leading-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {val}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
