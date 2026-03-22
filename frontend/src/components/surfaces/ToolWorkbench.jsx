// frontend/src/components/surfaces/ToolWorkbench.jsx
// Elevated surface for interactive decision tools.
// Warm off-white background distinguishes it from informational panels.
// Contains inputs, computed outputs, and a calm interpretation line.

import React, { useState } from 'react'
import clsx from 'clsx'
import { Lock, ChevronDown, ChevronUp } from 'lucide-react'

export default function ToolWorkbench({
  title,              // string — "ISA Strategy"
  description,        // string | ReactNode — one-line purpose
  badge,              // string | ReactNode — e.g. "Tax Year 2024/25"
  proOnly = false,    // boolean — shows lock overlay for free users
  isPro = true,       // boolean — current user tier (from useApp)
  onUpgrade,          // () => void — upgrade CTA handler
  interpretation,     // string | ReactNode — result interpretation sentence
  collapsible = false,// boolean — allow collapse (for lower-priority tools)
  defaultOpen = true, // boolean
  children,           // ReactNode — the tool body (inputs + outputs)
  className = '',
}) {
  const [open, setOpen] = useState(defaultOpen)
  const locked = proOnly && !isPro

  return (
    <div
      className={clsx(
        'rounded-3xl border overflow-hidden',
        // Warm off-white in light, very slightly tinted dark
        'bg-[rgb(251,249,246)] dark:bg-white/[.04]',
        'border-black/[.06] dark:border-white/[.07]',
        'shadow-[0_2px_18px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)]',
        className
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          'px-6 pt-5 pb-4',
          'border-b border-black/[.04] dark:border-white/[.05]',
          collapsible && 'cursor-pointer select-none'
        )}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Badge row */}
            {badge && (
              <div className="mb-1.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-[.10em] uppercase bg-black/[.04] dark:bg-white/[.07] text-ink-muted dark:text-white/40 border border-black/[.04] dark:border-white/[.06]">
                  {badge}
                </span>
              </div>
            )}

            <h3 className="text-base sm:text-[1.05rem] font-semibold tracking-tight text-ink dark:text-white leading-snug">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-ink-muted/65 dark:text-white/35 leading-snug">
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {locked && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/[.04] dark:bg-white/[.06] border border-black/[.05] dark:border-white/[.07] text-[10px] font-semibold text-ink-muted dark:text-white/35">
                <Lock size={10} /> Pro
              </span>
            )}
            {collapsible && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-black/[.03] dark:bg-white/[.05] text-ink-muted dark:text-white/40">
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body — locked overlay OR content */}
      {(!collapsible || open) && (
        <div className="relative">
          {/* Locked overlay */}
          {locked && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[rgb(251,249,246)]/80 dark:bg-black/50 backdrop-blur-[3px] rounded-b-3xl">
              <div className="w-10 h-10 rounded-2xl bg-black/[.04] dark:bg-white/[.08] flex items-center justify-center">
                <Lock size={18} className="text-ink-muted dark:text-white/40" />
              </div>
              <div className="text-center max-w-[220px]">
                <div className="text-sm font-semibold text-ink dark:text-white">Pro feature</div>
                <div className="mt-1 text-xs text-ink-muted/60 dark:text-white/35">
                  Upgrade to Pro to unlock this tool.
                </div>
              </div>
              {onUpgrade && (
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="mt-1 px-5 py-2.5 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent-dark transition-colors"
                >
                  Upgrade to Pro
                </button>
              )}
            </div>
          )}

          {/* Tool content */}
          <div className={clsx('px-6 py-5', locked && 'pointer-events-none select-none blur-[2px]')}>
            {children}
          </div>

          {/* Interpretation line */}
          {interpretation && !locked && (
            <div className="px-6 pb-5 pt-0">
              <div className="rounded-2xl bg-black/[.025] dark:bg-white/[.04] border border-black/[.04] dark:border-white/[.05] px-4 py-3">
                <div className="text-xs text-ink-muted/70 dark:text-white/40 leading-relaxed">
                  {interpretation}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
