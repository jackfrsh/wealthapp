import React from 'react'

export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-4xl mb-4 opacity-30">{icon}</div>
      <div className="text-sm font-medium text-ink-muted dark:text-white/50 mb-1">{title}</div>
      {subtitle && <div className="text-xs text-ink-muted/60 dark:text-white/30 mb-4">{subtitle}</div>}
      {action}
    </div>
  )
}
