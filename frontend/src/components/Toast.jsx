import React, { useEffect } from 'react'
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react'

export default function Toast({ toast, onClose }) {
  // Always run hooks unconditionally (Rules of Hooks).
  useEffect(() => {
    if (!toast?.message) return
    const t = window.setTimeout(() => onClose?.(), 2600)
    return () => window.clearTimeout(t)
  }, [toast?.id, toast?.message, onClose])

  // Render nothing if there's no message (after hooks!)
  if (!toast?.message) return null

  const kind = toast?.kind || 'success'

  const Icon =
    kind === 'error' ? AlertTriangle : kind === 'info' ? Info : CheckCircle

  const cls =
    kind === 'error'
      ? 'bg-loss text-white'
      : kind === 'info'
      ? 'bg-black/80 text-white dark:bg-white/10'
      : 'bg-accent text-white'

  return (
    <div className="fixed bottom-24 lg:bottom-8 right-4 sm:right-6 z-[9999] animate-slide-up">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-card-lg ${cls} text-sm font-medium`}
        role="status"
        aria-live="polite"
      >
        <Icon size={18} />

        <span className="min-w-0 truncate">{toast.message}</span>

        <button
          onClick={onClose}
          className="ml-1 p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          type="button"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}