import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    const prevTouchAction = document.body.style.touchAction

    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()

      if (e.key === 'Tab') {
        const root = panelRef.current
        if (!root) return

        const focusables = root.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusables.length) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.touchAction = prevTouchAction
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/35 dark:bg-black/55 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />

      <div className="absolute inset-0 overflow-y-auto overscroll-contain">
        <div className="min-h-full flex items-start justify-center p-4 sm:p-6">
          <div
            ref={panelRef}
            className="w-full max-w-[560px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={[
                'rounded-3xl border border-black/[.08] dark:border-white/[.10]',
                'bg-white dark:bg-surface-dark-2',
                'shadow-[0_24px_60px_rgba(0,0,0,.18)]',
              ].join(' ')}
            >
              <div className="px-6 sm:px-7 py-5 border-b border-black/[.06] dark:border-white/[.07] flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-ink dark:text-white truncate">
                    {title}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onClose?.()}
                  className="h-10 w-10 rounded-2xl border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors grid place-items-center"
                  aria-label="Close"
                >
                  <X size={16} className="opacity-80" />
                </button>
              </div>

              <div className="p-6 sm:p-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}