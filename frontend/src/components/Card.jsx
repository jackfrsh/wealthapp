import React from 'react'
import clsx from 'clsx'

export default function Card({
  children,
  className = '',
  hover = false,
  inset = false,     // subtle inset background
  pad = 'md',        // 'sm' | 'md' | 'lg' | 'none'
  ...props
}) {
  const padCls =
    pad === 'none' ? '' : pad === 'sm' ? 'p-5' : pad === 'lg' ? 'p-8' : 'p-6'

  return (
    <div
      className={clsx(
        // Material base
        'relative overflow-hidden rounded-3xl border',
        'transition-[transform,box-shadow,border-color,background-color] duration-220 ease-smooth',
        inset
          ? 'bg-surface-2 dark:bg-surface-dark-3'
          : 'bg-card dark:bg-surface-dark-2',

        // Softer border = more luxury
        'border-black/[.05] dark:border-white/[.06]',

        // Elevation base
        'shadow-card shadow-inner-ring',

        // Subtle top light (less glossy, more natural)
        !inset &&
          'before:content-[""] before:absolute before:inset-0 before:pointer-events-none ' +
            'before:opacity-[.06] dark:before:opacity-[.05] ' +
            'before:bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.18)_20%,rgba(255,255,255,0)_60%)]',

        padCls,

        // Hover physics (only when explicitly enabled)
        hover &&
          'hover:-translate-y-[2px] hover:shadow-card-hover cursor-pointer ' +
          'active:translate-y-0 active:shadow-card',

        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}