// frontend/src/components/surfaces/LedgerSection.jsx
// Group header for a ledger section (Assets / Liabilities).
// No card box — just a labelled separator with group total.

import React from 'react'
import clsx from 'clsx'

export default function LedgerSection({
  title,           // string — "Assets" or "Liabilities"
  total,           // string — formatted total
  totalColor,      // string — optional tailwind class override (e.g. 'text-loss')
  count,           // number | string — optional item count
  onAdd,           // () => void — optional add CTA
  addLabel,        // string — CTA label, default "Add"
  children,        // ReactNode — LedgerRow items
  className = '',
}) {
  return (
    <div className={clsx('space-y-0', className)}>
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 py-3 border-b border-black/[.06] dark:border-white/[.07]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[11px] font-semibold tracking-[.14em] uppercase text-ink-muted/55 dark:text-white/28">
            {title}
          </span>
          {count !== undefined && (
            <span className="text-[10px] font-medium text-ink-muted/40 dark:text-white/20 tabular-nums">
              {count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={clsx(
            'text-sm font-semibold tabular-nums tracking-tight',
            totalColor || 'text-ink dark:text-white'
          )}>
            {total}
          </span>

          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="text-[11px] font-semibold text-accent hover:text-accent-dark dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              + {addLabel || 'Add'}
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[.04] dark:divide-white/[.04]">
        {children}
      </div>
    </div>
  )
}
