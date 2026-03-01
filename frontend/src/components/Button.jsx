// src/components/Button.jsx
import React from 'react'
import clsx from 'clsx'

const BASE =
  'inline-flex items-center justify-center gap-2 select-none ' +
  'transition-[transform,box-shadow,background-color,border-color,color,opacity] ' +
  'duration-220 ease-smooth ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'font-semibold tracking-tightish [font-variant-numeric:tabular-nums] ' +
  'pressable relative overflow-hidden'

const SIZES = {
  sm: 'h-9 px-4 text-[12px] rounded-xl',
  md: 'h-11 px-5 text-[13px] rounded-2xl',
  lg: 'h-12 px-6 text-[13px] rounded-2xl',
}

const VARIANTS = {
  primary:
    'bg-accent text-white ' +
    'hover:bg-accent-dark ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_10px_22px_rgba(15,23,42,0.14)] ' +
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.16)_inset,0_16px_34px_rgba(15,23,42,0.18)] ' +
    'active:shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_8px_18px_rgba(15,23,42,0.12)]',

  secondary:
    'bg-black/[.03] text-ink dark:bg-white/[.05] dark:text-white ' +
    'border border-black/[.08] dark:border-white/[.10] ' +
    'hover:bg-black/[.045] dark:hover:bg-white/[.07] ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_10px_22px_rgba(15,23,42,0.08)] ' +
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_14px_30px_rgba(15,23,42,0.12)]',

  ghost:
    'bg-transparent text-ink dark:text-white ' +
    'hover:bg-black/[.04] dark:hover:bg-white/[.06] ' +
    'shadow-none',

  pro:
    'text-white ' +
    'bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 ' +
    'hover:from-amber-500 hover:via-amber-600 hover:to-amber-700 ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_14px_34px_rgba(15,23,42,0.18)] ' +
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_20px_46px_rgba(15,23,42,0.22)] ' +
    'active:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_12px_28px_rgba(15,23,42,0.16)]',
}

export default function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  icon: Icon = null,
  disabled = false,
  type = 'button',
  ...props
}) {
  const v = VARIANTS[variant] || VARIANTS.primary
  const s = SIZES[size] || SIZES.md

  return (
    <button
      type={type}
      disabled={disabled}
      className={clsx(
        BASE,
        s,
        v,
        'shadow-inner-ring',
        'active:translate-y-[0.5px] active:scale-[0.995]',
        className
      )}
      {...props}
    >
      {/* subtle material highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[.10] dark:opacity-[.08]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.25) 22%, rgba(255,255,255,0) 60%)',
        }}
      />
      {Icon ? <Icon className="h-4 w-4 opacity-90" aria-hidden="true" /> : null}
      <span className="relative">{children}</span>
    </button>
  )
}