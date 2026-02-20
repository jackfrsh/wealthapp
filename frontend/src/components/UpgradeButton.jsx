import React from 'react'
import clsx from 'clsx'

export default function UpgradeButton({
  children = 'Upgrade',
  onClick,
  className,
  icon = null,
  size = 'md', // 'sm' | 'md'
  disabled = false,
  type = 'button',
}) {
  const sizeCls =
    size === 'sm'
      ? 'px-3 py-2 text-xs rounded-xl'
      : 'px-4 py-2.5 text-sm rounded-2xl'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:focus-visible:ring-offset-surface-dark',
        'active:scale-[0.99]',
        sizeCls,

        // Light mode: premium inset surface (token driven)
        'bg-surface-2 text-ink hover:bg-surface-3/40',

        // Dark mode: premium glass (not white)
        'dark:bg-white/[0.10] dark:text-white dark:hover:bg-white/[0.14]',

        // Borders
        'border border-black/10 dark:border-white/12',

        // Depth: use the same “material” tokens as Card
        'shadow-card hover:shadow-card-hover',

        disabled && 'opacity-50 cursor-not-allowed hover:shadow-card active:scale-100',
        className
      )}
    >
      {icon}
      {children}
    </button>
  )
}