// frontend/src/components/ConfirmDialog.jsx
import React, { useEffect, useRef, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Premium confirm dialog — replaces native window.confirm().
 *
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="Delete account?"
 *     message="This action cannot be undone."
 *     confirmLabel="Delete"
 *     destructive
 *     onConfirm={() => { ... }}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)
  const dialogRef = useRef(null)

  // Focus trap
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement

    // Small delay to let the dialog render, then focus
    const timer = setTimeout(() => confirmRef.current?.focus(), 60)

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable.length) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(timer)
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={() => !loading && onCancel?.()}
      />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          className="w-full max-w-[380px] rounded-2xl border border-black/[.08] dark:border-white/[.10] bg-white dark:bg-surface-dark-2 shadow-[0_24px_60px_rgba(0,0,0,.18)] animate-slide-up"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-6 pb-5 text-center">
            {destructive && (
              <div className="mx-auto mb-4 w-11 h-11 rounded-full bg-loss/[.08] dark:bg-loss/[.12] flex items-center justify-center">
                <AlertTriangle size={20} className="text-loss" />
              </div>
            )}

            <h3
              id="confirm-title"
              className="text-base font-semibold text-ink dark:text-white"
            >
              {title}
            </h3>

            {message && (
              <p className="mt-2 text-sm text-ink-muted dark:text-white/40 leading-relaxed">
                {message}
              </p>
            )}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              type="button"
              onClick={() => !loading && onCancel?.()}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-ink dark:text-white border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.05] transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>

            <button
              ref={confirmRef}
              type="button"
              onClick={() => !loading && onConfirm?.()}
              disabled={loading}
              className={[
                'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50',
                destructive
                  ? 'bg-loss text-white hover:bg-loss/90'
                  : 'bg-accent text-white hover:bg-accent-dark',
              ].join(' ')}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting…
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
