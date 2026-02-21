import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  const sheetRef = useRef(null)

  // Drag state
  const startYRef = useRef(0)
  const lastYRef = useRef(0)
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const resetSheet = () => {
    const el = sheetRef.current
    if (!el) return
    el.style.transition = 'transform 180ms ease'
    el.style.transform = 'translateY(0px)'
    window.setTimeout(() => {
      if (!sheetRef.current) return
      sheetRef.current.style.transition = ''
    }, 200)
  }

  const closeBySwipe = () => {
    const el = sheetRef.current
    if (!el) {
      onClose?.()
      return
    }
    el.style.transition = 'transform 180ms ease'
    el.style.transform = 'translateY(110%)'
    window.setTimeout(() => onClose?.(), 170)
  }

  const onTouchStart = (e) => {
    const el = sheetRef.current
    if (!el) return

    // Only allow dragging if the sheet is scrolled to top.
    // Prevents fighting with scrolling the form.
    if (el.scrollTop > 0) return

    draggingRef.current = true
    startYRef.current = e.touches[0].clientY
    lastYRef.current = startYRef.current
    el.style.transition = '' // stop snapping during drag
  }

  const onTouchMove = (e) => {
    const el = sheetRef.current
    if (!el) return
    if (!draggingRef.current) return

    const y = e.touches[0].clientY
    const delta = y - startYRef.current

    // Only drag downward
    if (delta <= 0) return

    // Keep the page from scrolling behind the sheet while dragging
    e.preventDefault()

    lastYRef.current = y
    el.style.transform = `translateY(${delta}px)`
  }

  const onTouchEnd = () => {
    const el = sheetRef.current
    if (!el) return
    if (!draggingRef.current) return
    draggingRef.current = false

    const delta = lastYRef.current - startYRef.current
    const threshold = 120

    if (delta > threshold) closeBySwipe()
    else resetSheet()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9990]">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={() => onClose?.()}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
      />

      {/* Bottom sheet container */}
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center">
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          // Swipe-down to close on mobile (touch devices)
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={`
            w-full
            sm:max-w-md

            max-h-[75vh] sm:max-h-[90vh]
            overflow-y-auto

            bg-white dark:bg-[#151922]

            border-t sm:border border-black/[.06] dark:border-white/[.06]

            rounded-t-3xl sm:rounded-3xl

            shadow-[0_-10px_40px_rgba(0,0,0,0.08)]
            dark:shadow-[0_-10px_40px_rgba(0,0,0,0.35)]

            p-5 sm:p-8

            animate-slide-up

            touch-pan-y
          `}
        >
          {/* Drag indicator */}
          <div className="sm:hidden flex justify-center mb-4">
            <div className="w-10 h-1.5 rounded-full bg-black/10 dark:bg-white/10" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <h2 className="font-display text-xl sm:text-2xl text-ink dark:text-white leading-tight">
              {title}
            </h2>

            <button
              onClick={onClose}
              className="p-2 -mr-1 rounded-xl text-ink-muted dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              type="button"
            >
              <X size={20} />
            </button>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}