import React from 'react'
import { fmtCurrencyCompactShort } from '../../utils'

function fmtMoney(n, currency = 'GBP') {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return fmtCurrencyCompactShort(v, currency)
}

export default function WealthTooltip({
  active,
  payload,
  label,
  currency = 'GBP',
  labelFormatter,
  nameFormatter,
  valueFormatter,
  extraItems = [],
}) {
  if (!active || !payload || !payload.length) return null

  const title = labelFormatter ? labelFormatter(label) : label
  const items = [
    ...payload.filter((p) => p && p.value != null),
    ...extraItems.filter((p) => p && p.value != null),
  ]
  if (!items.length) return null

  return (
    <div className="rounded-2xl px-3.5 py-3 bg-card dark:bg-surface-dark-2 border border-black/[.06] dark:border-white/[.07] shadow-card min-w-[140px] max-w-[220px]">
      <div
        className="text-[11px] font-semibold tracking-tightish text-ink-muted dark:text-white/45 mb-2 leading-none"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {title}
      </div>

      <div className="space-y-1.5">
        {items.map((p, idx) => {
          const name = nameFormatter
            ? nameFormatter(p.name ?? p.dataKey ?? 'Value', p)
            : p.name ?? p.dataKey ?? 'Value'
          const val = valueFormatter
            ? valueFormatter(p.value, p)
            : fmtMoney(p.value, currency)

          return (
            <div key={`${String(p.dataKey ?? name)}-${idx}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-1.5 w-1.5 rounded-full flex-none"
                  style={{ background: p.color || 'currentColor' }}
                />
                <span className="text-[11px] text-ink-muted dark:text-white/45 leading-none truncate">
                  {name}
                </span>
              </div>

              <span
                className="text-[11px] font-semibold text-ink dark:text-white leading-none"
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
