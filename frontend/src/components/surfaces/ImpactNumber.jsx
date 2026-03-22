// frontend/src/components/surfaces/ImpactNumber.jsx
// Secondary gold impact numeral — used in Decisions page alongside the
// recommendation hero to show projected financial impact.
//
// Visual reference: the "£21,440 saved" block on the right side of the
// Decisions reference screen. Big enough to be memorable, but subordinate
// to the main HeroStage number above.
//
// Props:
//   value     — string | ReactNode — the formatted number (e.g. "£21,440")
//   label     — string — descriptor below the number (e.g. "projected 10yr saving")
//   eyebrow   — string — small caps label above (e.g. "projected impact")
//   positive  — boolean — gold rendering (default true); false = muted grey
//   size      — 'sm' | 'md' | 'lg'
//                 'sm' = large text but below hero scale
//                 'md' = .impact-number CSS class (~3.8rem, gold via CSS)
//                 'lg' = .hero-number (full hero scale, rarely needed)
//               default 'md'
//   className — string

import React from 'react'
import clsx from 'clsx'

export default function ImpactNumber({
  value,
  label,
  eyebrow,
  positive = true,
  size = 'md',
  className = '',
}) {
  return (
    <div className={clsx('space-y-1', className)}>

      {/* Eyebrow */}
      {eyebrow && (
        <div className="text-[10px] font-semibold tracking-[.16em] uppercase text-ink-muted/45 dark:text-white/25 select-none">
          {eyebrow}
        </div>
      )}

      {/* Impact number */}
      {size === 'md' ? (
        // 'md' uses the .impact-number CSS class which handles gold via var(--gold)
        // Override colour when positive=false
        <div
          className="impact-number"
          style={!positive ? { color: 'var(--text-muted)' } : undefined}
        >
          {value}
        </div>
      ) : (
        // 'sm' and 'lg' use Tailwind classes directly
        <div
          className={clsx(
            'tabular-nums font-bold tracking-tight leading-none',
            size === 'lg'
              ? 'hero-number'
              : 'text-3xl sm:text-4xl',
            positive ? 'text-gold' : 'text-ink-muted dark:text-white/40'
          )}
        >
          {value}
        </div>
      )}

      {/* Label */}
      {label && (
        <div className="text-xs text-ink-muted/55 dark:text-white/30 leading-snug">
          {label}
        </div>
      )}

    </div>
  )
}