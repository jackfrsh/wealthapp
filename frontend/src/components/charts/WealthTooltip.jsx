import React from 'react'

/**
 * Enhanced Glassmorphism Wealth Tooltip
 * Matches the dark, neutral charcoal theme of the "Wealth" app.
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
      className="
        /* Significantly smaller padding & rounded corners */
        rounded-xl px-2.5 py-2
        /* Neutral Charcoal Glass */
        bg-[#16171d]/85 backdrop-blur-xl
        border border-white/10
        shadow-[0_12px_40px_rgba(0,0,0,0.6)]
        /* Reduced min-width to prevent it from stretching */
        min-w-[140px] max-w-[200px]
      "
    >
      {/* Muted, tight header */}
      <div className="text-[9px] font-bold tracking-wider text-white/40 uppercase mb-1.5 leading-none">
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
                {/* Smaller dot */}
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ 
                    background: p.color || 'rgba(255,255,255,0.5)',
                  }}
                />
                <span className="text-[11px] font-medium text-white/50 leading-none">
                  {name}
                </span>
              </div>
              <span className="text-[11px] font-bold text-white leading-none">
                {val}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}