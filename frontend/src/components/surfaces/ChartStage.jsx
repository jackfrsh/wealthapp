// frontend/src/components/surfaces/ChartStage.jsx
// Full-width chart surface with integrated title, legend, and controls.
// The chart should feel like it has a stage — not a card containing a chart.

import React from 'react'
import clsx from 'clsx'

export default function ChartStage({
  title,            // string
  description,      // string | ReactNode — optional sub-description
  controls,         // ReactNode — toggle buttons, horizon selectors, etc.
  legend,           // ReactNode — chart legend
  children,         // ReactNode — the actual chart
  className = '',
}) {
  return (
    <div
      className={clsx(
        'rounded-3xl border border-black/[.05] dark:border-white/[.06]',
        'bg-white/75 dark:bg-white/[.03]',
        'shadow-[0_2px_20px_rgba(0,0,0,0.05)]',
        'overflow-hidden',
        className
      )}
    >
      {/* Stage header */}
      {(title || controls) && (
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-black/[.04] dark:border-white/[.05]">
          <div className="min-w-0">
            {title && (
              <div className="text-[11px] font-semibold tracking-[.14em] uppercase text-ink-muted/55 dark:text-white/28 mb-1">
                {title}
              </div>
            )}
            {description && (
              <div className="text-sm text-ink-muted/60 dark:text-white/30 leading-snug">
                {description}
              </div>
            )}
          </div>
          {controls && (
            <div className="shrink-0 flex items-center gap-2">
              {controls}
            </div>
          )}
        </div>
      )}

      {/* Chart area */}
      <div className="px-4 sm:px-6 py-5">
        {children}
      </div>

      {/* Legend / footer */}
      {legend && (
        <div className="px-6 pb-5 pt-0">
          {legend}
        </div>
      )}
    </div>
  )
}
