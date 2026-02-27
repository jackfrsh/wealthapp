// frontend/src/components/Modal.jsx
import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35 dark:bg-black/55 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />

      {/* Centering wrapper */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        {/* Panel */}
        <div
          className="w-full max-w-[560px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className={[
              'rounded-3xl border border-black/[.08] dark:border-white/[.10]',
              'bg-white dark:bg-surface-dark-2',
              'shadow-[0_24px_60px_rgba(0,0,0,.18)]',
              // ✅ mobile-safe sizing
              'max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]',
              // ✅ allow body scroll while keeping header fixed
              'overflow-hidden flex flex-col',
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

            {/* ✅ scrolling body */}
            <div className="p-6 sm:p-7 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}