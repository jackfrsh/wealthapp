// frontend/src/components/surfaces/InsightRail.jsx
// Redesigned: guided meaning, not three parallel cards.
//
// Layout:
//   - First insight: full-width, prominent, left accent bar, headline + body
//   - Additional insights: compact stacked rows, quieter weight
//
// Reads as "here's what matters most, plus two supporting observations"
// rather than "here are three equal things."

import React from 'react'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'

const TONE_CONFIG = {
  positive: {
    accent: '#2FA676',
    accentBg: 'rgba(47,166,118,0.09)',
    accentBorder: 'rgba(47,166,118,0.16)',
    titleColor: 'text-emerald-900 dark:text-emerald-100',
    bodyColor: 'text-emerald-800/60 dark:text-emerald-200/42',
    iconColor: 'rgba(47,166,118,0.80)',
  },
  neutral: {
    accent: '#78A9E6',
    accentBg: 'rgba(120,169,230,0.08)',
    accentBorder: 'rgba(120,169,230,0.14)',
    titleColor: 'text-blue-950 dark:text-blue-50',
    bodyColor: 'text-blue-800/55 dark:text-blue-200/38',
    iconColor: 'rgba(120,169,230,0.75)',
  },
  warning: {
    accent: '#D97706',
    accentBg: 'rgba(217,119,6,0.08)',
    accentBorder: 'rgba(217,119,6,0.15)',
    titleColor: 'text-amber-950 dark:text-amber-50',
    bodyColor: 'text-amber-800/58 dark:text-amber-200/42',
    iconColor: 'rgba(217,119,6,0.80)',
  },
  discipline: {
    accent: '#7C3AED',
    accentBg: 'rgba(124,58,237,0.07)',
    accentBorder: 'rgba(124,58,237,0.13)',
    titleColor: 'text-violet-950 dark:text-violet-50',
    bodyColor: 'text-violet-800/55 dark:text-violet-200/38',
    iconColor: 'rgba(124,58,237,0.75)',
  },
}

/* Primary insight — full-width, prominent */
function PrimaryInsight({ title, body, tone = 'neutral', onClick }) {
  const cfg = TONE_CONFIG[tone] || TONE_CONFIG.neutral

  const inner = (
    <div className="flex items-stretch">
      <div className="w-[3px] shrink-0" style={{ background: cfg.accent }} aria-hidden="true" />
      <div className="flex-1 min-w-0 px-4 py-3.5">
        <div className={clsx('text-[13.5px] font-semibold leading-snug', cfg.titleColor)}>
          {title}
        </div>
        {body && (
          <div className={clsx('mt-1 text-[11.5px] leading-relaxed', cfg.bodyColor)}>
            {body}
          </div>
        )}
      </div>
      {onClick && (
        <div className="flex items-center pr-4 pl-1">
          <ChevronRight size={14} style={{ color: cfg.iconColor, opacity: 0.50 }} />
        </div>
      )}
    </div>
  )

  const baseClass = 'w-full text-left rounded-2xl overflow-hidden'
  const style = { background: cfg.accentBg, border: `1px solid ${cfg.accentBorder}` }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(baseClass, 'transition-opacity duration-150 cursor-pointer hover:opacity-88')}
        style={style}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={baseClass} style={style}>
      {inner}
    </div>
  )
}

/* Secondary insight — single quiet row */
function SecondaryInsight({ title, tone = 'neutral', onClick }) {
  const cfg = TONE_CONFIG[tone] || TONE_CONFIG.neutral

  const inner = (
    <>
      <div
        className="shrink-0 w-[5px] h-[5px] rounded-full"
        style={{ background: cfg.accent, opacity: 0.55 }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 text-[12px] font-medium leading-snug text-ink-muted/60 dark:text-white/35 truncate">
        {title}
      </div>
      {onClick && (
        <ChevronRight size={11} style={{ color: cfg.iconColor, opacity: 0.30, flexShrink: 0 }} />
      )}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left flex items-center gap-3 py-2 transition-opacity duration-150 cursor-pointer hover:opacity-70"
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="w-full flex items-center gap-3 py-2">
      {inner}
    </div>
  )
}

export default function InsightRail({
  insights = [],
  loading = false,
  className = '',
}) {
  if (loading) {
    return (
      <div className={clsx('space-y-2', className)}>
        <div className="h-[68px] rounded-2xl skeleton opacity-35" />
        <div className="h-7 rounded-xl skeleton opacity-18" />
      </div>
    )
  }

  if (!insights.length) return null

  const [primary, ...secondary] = insights

  return (
    <div className={clsx('space-y-1', className)}>
      {/* Section label */}
      <div className="px-0.5 mb-2">
        <div className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-ink-muted/45 dark:text-white/25">
          Worth noting
        </div>
      </div>

      {/* Primary — full prominence */}
      <PrimaryInsight
        title={primary.title}
        body={primary.body}
        tone={primary.tone}
        onClick={primary.onClick}
      />

      {/* Secondaries — compact, stacked */}
      {secondary.length > 0 && (
        <div className="pt-0.5 px-0.5 divide-y divide-black/[.04] dark:divide-white/[.04]">
          {secondary.map((ins, i) => (
            <SecondaryInsight
              key={i}
              title={ins.title}
              tone={ins.tone}
              onClick={ins.onClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}