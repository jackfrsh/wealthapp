// frontend/src/components/surfaces/PageHeader.jsx
// Consistent page-level title block for signed-in pages.
//
// Used on: Plan (Outlook), Decisions (Strategy), Accounts.
// NOT used on Home — Home opens directly with HeroStage.
//
// Replaces the inline <h1> + subtitle + action button patterns
// currently repeated in each page. Centralises typographic treatment
// so pages feel architecturally related.
//
// Exports:
//   default PageHeader   — the main component
//   named StatusBadge    — pre-styled badge for the `badge` slot
//
// Props (PageHeader):
//   title      — string — page name (e.g. "Plan", "Decisions", "Accounts")
//   subtitle   — string | ReactNode — one-line description
//   badge      — ReactNode — status badge rendered right of title on desktop
//   action     — ReactNode — right-side CTA (e.g. a <button>)
//   eyebrow    — string — small-caps label above title (optional)
//   serif      — boolean — Playfair italic title for Plan / Decisions (default false)
//   className  — string
//
// Props (StatusBadge):
//   children   — ReactNode
//   tone       — 'neutral' | 'positive' | 'warning' | 'gold'

import React from 'react'
import clsx from 'clsx'

export default function PageHeader({
  title,
  subtitle,
  badge,
  action,
  eyebrow,
  serif = false,
  className = '',
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 flex-wrap', className)}>

      {/* Left — title block */}
      <div className="min-w-0">

        {/* Eyebrow */}
        {eyebrow && (
          <div className="mb-1.5 text-[10.5px] font-semibold tracking-[.16em] uppercase text-ink-muted/50 dark:text-white/28 select-none">
            {eyebrow}
          </div>
        )}

        {/* Title row */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className={clsx(
              'leading-tight text-ink dark:text-white',
              serif
                ? 'serif-heading text-3xl sm:text-4xl'
                : 'font-display font-bold text-3xl sm:text-4xl tracking-tight'
            )}
          >
            {title}
          </h1>

          {badge && (
            <div className="flex-shrink-0">{badge}</div>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-1.5 text-sm text-ink-muted/65 dark:text-white/38 leading-relaxed max-w-[48rem]">
            {subtitle}
          </p>
        )}

      </div>

      {/* Right — action slot */}
      {action && (
        <div className="flex-shrink-0 self-center">
          {action}
        </div>
      )}

    </div>
  )
}

// ── StatusBadge ──────────────────────────────────────────────────────────────
// Drop into PageHeader's `badge` prop.

const BADGE_STYLES = {
  neutral:  'bg-black/[.04] dark:bg-white/[.07] text-ink-muted dark:text-white/45 border-black/[.05] dark:border-white/[.07]',
  positive: 'bg-gain/[.08] dark:bg-gain/[.12] text-gain dark:text-emerald-400 border-gain/20 dark:border-gain/20',
  warning:  'bg-amber-500/[.08] dark:bg-amber-500/[.12] text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/20',
  gold:     'border-gold/25 dark:border-gold/20 text-gold-muted dark:text-gold',
}

export function StatusBadge({ children, tone = 'neutral' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'text-[10.5px] font-semibold tracking-[.10em] uppercase border',
        BADGE_STYLES[tone] || BADGE_STYLES.neutral
      )}
      style={
        tone === 'gold'
          ? { backgroundColor: 'rgba(var(--gold-soft-rgb), 0.7)' }
          : undefined
      }
    >
      {children}
    </span>
  )
}