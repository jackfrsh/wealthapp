// frontend/src/components/EmptyState.jsx
import React from 'react'

export default function EmptyState({
  icon = null,            // pass a component: icon={Landmark}
  title,
  subtitle,
  action = null,          // pass a node (button etc)
  className = '',
}) {
  const Icon = icon

  return (
    <div className={['p-8 text-center', className].join(' ')}>
      {Icon ? (
        <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.10] grid place-items-center">
          {/* Lucide icons are forwardRef components -> MUST be rendered as <Icon /> */}
          <Icon size={22} className="text-ink/60 dark:text-white/45" aria-hidden="true" />
        </div>
      ) : null}

      {title ? (
        <div className="font-display text-xl text-ink dark:text-white">
          {title}
        </div>
      ) : null}

      {subtitle ? (
        <div className="mt-2 text-sm text-ink-muted dark:text-white/45">
          {subtitle}
        </div>
      ) : null}

      {action ? (
        <div className="mt-6 flex justify-center">
          {action}
        </div>
      ) : null}
    </div>
  )
}