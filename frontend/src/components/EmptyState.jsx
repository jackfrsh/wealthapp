import React from 'react'

export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="text-5xl mb-5 opacity-25">{icon}</div>
      <div className="text-base font-medium text-ink-muted dark:text-white/50 mb-1.5">{title}</div>
      {subtitle && <div className="text-sm text-ink-muted/50 dark:text-white/25 mb-6 max-w-xs leading-relaxed">{subtitle}</div>}
      {action}
    </div>
  )
}
