// frontend/src/components/ProPreview.jsx
/**
 * Frosted-glass Pro preview.
 *
 * Renders children behind a blur overlay with an upgrade CTA.
 * Used on Outlook to show free users what Pro features look like,
 * converting "text description" into "visual teaser" — the #1
 * pattern for increasing conversion in freemium SaaS.
 */
import React from 'react'
import { Lock } from 'lucide-react'
import { useApp } from '../App'

export default function ProPreview({ children, title, subtitle, className = '' }) {
  const { setPage } = useApp()

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      {/* The actual content, blurred */}
      <div
        className="select-none pointer-events-none"
        style={{ filter: 'blur(6px)', WebkitFilter: 'blur(6px)' }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-white/60 dark:bg-surface-dark/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center px-6">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center mb-3">
          <Lock size={18} className="text-amber-600 dark:text-amber-300" />
        </div>
        {title && (
          <div className="text-sm font-semibold text-ink dark:text-white mb-1">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-xs text-ink-muted dark:text-white/40 mb-4 max-w-xs">
            {subtitle}
          </div>
        )}
        <button
  onClick={() => setPage('upgrade')}
  className="inline-flex items-center justify-center gap-2 min-h-[50px] px-5 rounded-[18px]
             text-sm font-semibold
             bg-accent text-white hover:bg-accent-dark
             transition-all duration-180"
  type="button"
>
  Unlock with Pro
</button>
      </div>
    </div>
  )
}
