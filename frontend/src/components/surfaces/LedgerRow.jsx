// frontend/src/components/surfaces/LedgerRow.jsx
// Individual account / item row within a LedgerSection.
// Left: type icon. Center: name + subtitle. Right: value + actions.
// Edit/delete appear on hover (desktop) or via a trailing action button.

import React, { useState } from 'react'
import clsx from 'clsx'
import { MoreHorizontal, Pencil, Trash2, Camera } from 'lucide-react'

export default function LedgerRow({
  icon: Icon,       // LucideIcon component
  iconColor,        // string — optional tailwind text-* color
  name,             // string
  sub,              // string — account type or short note
  value,            // string — formatted balance
  valueColor,       // string — optional tailwind text-* class (e.g. 'text-loss')
  negative = false, // boolean — shorthand for loss-colored value
  included = true,  // boolean — whether included in net worth
  onEdit,           // () => void
  onDelete,         // () => void
  onSnapshot,       // () => void
  onClick,          // () => void — row-level click (optional)
  className = '',
}) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const hasActions = onEdit || onDelete || onSnapshot

  return (
    <div
      className={clsx(
        'group relative flex items-center gap-3.5 py-3.5 px-1',
        'transition-colors duration-150',
        'hover:bg-black/[.018] dark:hover:bg-white/[.03] rounded-xl',
        onClick && 'cursor-pointer',
        !included && 'opacity-50',
        className
      )}
      onClick={onClick}
    >
      {/* Left: type icon */}
      <div
        className={clsx(
          'shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center',
          'bg-black/[.04] dark:bg-white/[.06]',
          'border border-black/[.04] dark:border-white/[.06]',
        )}
      >
        {Icon && (
          <Icon
            size={16}
            className={clsx(
              iconColor || 'text-ink-muted dark:text-white/50'
            )}
          />
        )}
      </div>

      {/* Center: name + sub */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink dark:text-white truncate leading-snug">
          {name}
        </div>
        {sub && (
          <div className="text-xs text-ink-muted/55 dark:text-white/30 mt-0.5 truncate">
            {sub}
          </div>
        )}
      </div>

      {/* Right: value */}
      <div className="shrink-0 text-right">
        <div
          className={clsx(
            'text-sm font-semibold tabular-nums tracking-tight leading-snug',
            valueColor
              ? valueColor
              : negative
                ? 'text-loss dark:text-rose-400'
                : 'text-ink dark:text-white'
          )}
        >
          {value}
        </div>
      </div>

      {/* Actions — appear on hover (desktop), always on mobile via ... */}
      {hasActions && (
        <div
          className={clsx(
            'shrink-0 relative',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
            actionsOpen && 'opacity-100'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setActionsOpen((v) => !v)}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/[.05] dark:hover:bg-white/[.08] transition-colors text-ink-muted dark:text-white/40"
          >
            <MoreHorizontal size={15} />
          </button>

          {/* Dropdown */}
          {actionsOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setActionsOpen(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-44 rounded-2xl border border-black/[.06] dark:border-white/[.09] bg-white dark:bg-surface-dark-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
                {onSnapshot && (
                  <ActionItem
                    icon={Camera}
                    label="Take snapshot"
                    onClick={() => { setActionsOpen(false); onSnapshot() }}
                  />
                )}
                {onEdit && (
                  <ActionItem
                    icon={Pencil}
                    label="Edit"
                    onClick={() => { setActionsOpen(false); onEdit() }}
                  />
                )}
                {onDelete && (
                  <ActionItem
                    icon={Trash2}
                    label="Delete"
                    destructive
                    onClick={() => { setActionsOpen(false); onDelete() }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ActionItem({ icon: Icon, label, destructive = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-2.5',
        'text-sm font-medium text-left',
        'transition-colors duration-100',
        destructive
          ? 'text-loss hover:bg-loss-light/60 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : 'text-ink dark:text-white hover:bg-black/[.04] dark:hover:bg-white/[.05]'
      )}
    >
      <Icon size={14} className="opacity-75 shrink-0" />
      {label}
    </button>
  )
}
