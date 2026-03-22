// frontend/src/components/surfaces/HeroStage.jsx
// The dominant hero stage. Used exactly once per page, always first.
//
// Design intent: this is a STAGE, not a card. Architecturally distinct from
// everything below it — wider spacing, richer shadow, ambient glows, no
// generic rounded-box feel.
//
// Props (fully backward-compatible with previous version):
//   eyebrow      — string label above the number (unchanged)
//   value        — ReactNode dominant number (unchanged)
//   children     — ReactNode slotted below value (unchanged)
//   glow         — boolean ambient glows (unchanged, default true)
//   ring         — string extra className for milestone ring states (unchanged)
//   muted        — boolean loading/dimmed variant (unchanged)
//   className    — string extra class (unchanged)
//
// New props (additive, non-breaking):
//   delta        — ReactNode | string shown below the value in gold
//                  e.g. <GoldDelta value={2.4} isPercent label="· £1,200" />
//   numberSize   — 'default' | 'lg'
//                  'default' = .hero-number  (Home, Decisions)
//                  'lg'      = .hero-number-lg  (Plan projection)

import React from 'react'
import clsx from 'clsx'

export default function HeroStage({
  eyebrow,
  value,
  delta,
  children,
  glow = true,
  ring = '',
  muted = false,
  numberSize = 'default',
  className = '',
}) {
  return (
    <div
      className={clsx(
        // Stage base — not a card
        'relative w-full overflow-hidden rounded-3xl',
        // Light: clean white. Dark: deep blue-black / ink navy, not neutral charcoal.
        'bg-white dark:bg-[#1E2535]',
        // Thinner, quieter border than Card
        'border border-black/[.045] dark:border-white/[.06]',
        // Cinematic shadow — deeper and more directional than card
        'shadow-[0_4px_32px_rgba(0,0,0,0.07),0_1px_4px_rgba(0,0,0,0.04)]',
        'dark:shadow-[0_6px_48px_rgba(0,0,0,0.45),0_1px_6px_rgba(0,0,0,0.30)]',
        // Generous stage breathing room
        'px-8 py-9 sm:px-12 sm:py-12',
        'transition-all duration-300',
        ring,
        muted && 'opacity-60',
        className
      )}
    >
      {/* ── Atmospheric sweep — top-left warmth, like the reference screens ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.01) 35%, transparent 60%)',
        }}
      />

      {/* ── Gold ambient glow — top right ── */}
      {glow && (
        <div
          aria-hidden="true"
          className="absolute -top-28 -right-20 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(212,175,55,0.055) 0%, transparent 68%)',
          }}
        />
      )}

      {/* ── Accent ambient glow — bottom left ── */}
      {glow && (
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -left-12 w-[320px] h-[320px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(120,169,230,0.06) 0%, transparent 65%)',
          }}
        />
      )}

      {/* ── Content ── */}
      <div className="relative space-y-4">

        {/* Eyebrow */}
        {eyebrow && (
          <div className="text-[10.5px] font-semibold tracking-[.18em] uppercase text-ink-muted/50 dark:text-white/28 select-none">
            {eyebrow}
          </div>
        )}

        {/* Dominant value */}
        {value !== undefined && (
          <div
            className={clsx(
              'text-ink dark:text-white',
              numberSize === 'lg' ? 'hero-number-lg' : 'hero-number'
            )}
          >
            {value}
          </div>
        )}

        {/* Gold delta — new slot, renders nothing if omitted */}
        {delta != null && (
          <div className="-mt-1">
            {delta}
          </div>
        )}

        {/* Slotted content — milestone progress, badges, timestamps */}
        {children}

      </div>
    </div>
  )
}