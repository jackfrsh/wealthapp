import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  const panelRef = useRef(null)
  const [mounted, setMounted] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const updateViewportHeight = () => {
      const h = window.visualViewport?.height || window.innerHeight || 0
      setViewportHeight(h)
    }

    updateViewportHeight()

    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    const prevBodyTouchAction = document.body.style.touchAction

    document.documentElement.style.overflow = 'hidden'
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
    window.addEventListener('resize', updateViewportHeight)
    window.visualViewport?.addEventListener?.('resize', updateViewportHeight)

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.body.style.touchAction = prevBodyTouchAction

      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', updateViewportHeight)
      window.visualViewport?.removeEventListener?.('resize', updateViewportHeight)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const root = panelRef.current
    if (!root) return

    const firstFocusable = root.querySelector(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus?.()
  }, [open])

  if (!open || !mounted) return null

  const mobileBottomOffset = 'calc(env(safe-area-inset-bottom) + 5.5rem)'
const mobileTopInset = 'max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))'
const mobileMaxHeight =
  'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 6.75rem)'
const desktopGap = 24

const computedMaxHeight = viewportHeight
  ? Math.max(320, viewportHeight - 96)
  : undefined

  const modal = (
    <div
      className="fixed inset-0 z-[2000]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/35 dark:bg-black/55 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />

      {/* Mobile: Apple-style bottom sheet */}
      <div className="sm:hidden absolute inset-0 pointer-events-none">
  <div
    className="h-full w-full flex items-end justify-stretch px-2"
    style={{
      paddingTop: mobileTopInset,
      paddingBottom: mobileBottomOffset,
    }}
  >
    <div
      ref={panelRef}
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto w-full rounded-t-[28px] rounded-b-[28px] bg-white dark:bg-surface-dark-2 border border-black/[.08] dark:border-white/[.10] shadow-[0_24px_60px_rgba(0,0,0,.22)] overflow-hidden flex flex-col"
      style={{
        maxHeight: mobileMaxHeight,
      }}
    >
      <div className="pt-2.5 pb-1.5 flex justify-center shrink-0">
        <div className="h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
      </div>

      <div className="px-5 pt-4.5 pb-4 border-b border-black/[.06] dark:border-white/[.07] flex items-center justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div
            id="modal-title"
            className="text-[17px] leading-tight font-semibold text-ink dark:text-white truncate pr-2"
          >
            {title}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onClose?.()}
          className="h-10 w-10 rounded-2xl border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors grid place-items-center shrink-0"
          aria-label="Close"
        >
          <X size={16} className="opacity-80" />
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-5"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)',
        }}
      >
        {children}
      </div>
    </div>
  </div>
</div>

      {/* Desktop / tablet: form sheet */}
      <div className="hidden sm:block absolute inset-0 pointer-events-none overflow-y-auto">
        <div
          className="min-h-full flex items-center justify-center p-6"
          style={{ paddingTop: `${desktopGap}px`, paddingBottom: `${desktopGap}px` }}
        >
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto w-full max-w-[560px] rounded-[28px] bg-white dark:bg-surface-dark-2 border border-black/[.08] dark:border-white/[.10] shadow-[0_24px_60px_rgba(0,0,0,.18)] overflow-hidden flex flex-col"
            style={{
              maxHeight: viewportHeight ? `${Math.max(420, viewportHeight - 48)}px` : 'calc(100vh - 3rem)',
            }}
          >
            <div className="px-7 py-5 border-b border-black/[.06] dark:border-white/[.07] flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <div
                  id="modal-title"
                  className="text-base font-semibold text-ink dark:text-white truncate"
                >
                  {title}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClose?.()}
                className="h-10 w-10 rounded-2xl border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors grid place-items-center shrink-0"
                aria-label="Close"
              >
                <X size={16} className="opacity-80" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-7 pt-6 pb-7">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}