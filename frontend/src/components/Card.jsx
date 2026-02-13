import React from 'react'

export default function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`bg-white dark:bg-surface-dark-2 border border-black/[.05] dark:border-white/[.06] rounded-2xl shadow-card transition-all duration-200 ${
        hover ? 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
