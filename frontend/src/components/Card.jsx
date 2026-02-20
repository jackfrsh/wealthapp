import React from 'react'

export default function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={[
        'rounded-2xl border transition-all duration-200',
        'bg-card dark:bg-surface-dark-2',
        'border-black/[.06] dark:border-white/[.06]',
        'shadow-card',
        hover ? 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}