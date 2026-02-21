import React from 'react'
import clsx from 'clsx'

export default function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={clsx(
        // Base shell (your existing design language)
        'rounded-2xl border transition-all duration-200',
        'bg-card dark:bg-surface-dark-2',
        'border-black/[.06] dark:border-white/[.06]',
        'shadow-card',

        // Standardised spacing (premium consistency)
        'p-6',

        // Optional hover lift (keep your existing token)
        hover ? 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer' : '',

        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}