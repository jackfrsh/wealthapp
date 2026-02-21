import React from 'react'
import clsx from 'clsx'

const BASE =
  'inline-flex items-center justify-center gap-2 select-none ' +
  'transition-all duration-200 active:translate-y-[1px] ' +
  'focus:outline-none focus:ring-4 focus:ring-blue-900/10 dark:focus:ring-white/10 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'font-medium tracking-[-0.01em] [font-variant-numeric:tabular-nums]'

const SIZES = {
  md: 'h-11 px-5 text-sm rounded-2xl',
  sm: 'h-9 px-4 text-xs rounded-xl',
}

const VARIANTS = {
  primary:
    // Deep blue-grey (premium, not loud)
    'bg-blue-600/45 text-white ' +
    'hover:bg-blue-500 ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_8px_20px_rgba(0,0,0,0.10)]',

  secondary:
    // Soft neutral surface
    'bg-slate-100 text-slate-800 ' +
    'dark:bg-white/5 dark:text-white ' +
    'border border-slate-200 dark:border-white/10 ' +
    'hover:bg-slate-200 dark:hover:bg-white/10',

  ghost:
    'bg-transparent text-slate-700 dark:text-white ' +
    'hover:bg-slate-100 dark:hover:bg-white/10',

  pro:
    // Slightly stronger blue but still controlled
    'bg-blue-500 text-white ' +
    'hover:bg-blue-700 ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_10px_25px_rgba(0,0,0,0.12)]',
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
      className={clsx(BASE, s, v, className)}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4 opacity-90" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}