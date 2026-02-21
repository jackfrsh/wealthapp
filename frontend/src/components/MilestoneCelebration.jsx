// frontend/src/components/MilestoneCelebration.jsx
import { useEffect, useMemo, useState } from "react"
import { fmtCurrency } from "../utils"
import { Trophy, X } from "lucide-react"

export default function MilestoneCelebration({
  milestone,
  currency,
  onClose,
  // set to 0 to disable auto close
  autoCloseMs = 4500,
  title = "Milestone unlocked",
  subtitle = "Your net worth crossed a new threshold.",
}) {
  const [visible, setVisible] = useState(false)

  const amountLabel = useMemo(() => {
    if (!milestone) return ""
    return fmtCurrency(milestone, currency)
  }, [milestone, currency])

  const close = () => {
    setVisible(false)
    // allow exit animation to finish
    setTimeout(() => {
      onClose?.()
    }, 240)
  }

  useEffect(() => {
    if (!milestone) return
    setVisible(true)

    if (!autoCloseMs || autoCloseMs <= 0) return
    const t = setTimeout(() => close(), autoCloseMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone, autoCloseMs])

  if (!milestone) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 sm:px-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss milestone"
        onClick={close}
        className={[
          "absolute inset-0",
          "bg-black/20 dark:bg-black/35",
          "backdrop-blur-[6px]",
          "transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      {/* Card */}
      <div
        className={[
          "relative w-full max-w-[460px]",
          "rounded-3xl overflow-hidden",
          // thinner, more “glass”
          "bg-white/80 dark:bg-white/[.06]",
          "backdrop-blur-xl",
          // rim light
          "border border-black/[.06] dark:border-white/[.10]",
          "shadow-[0_18px_55px_rgba(0,0,0,0.18)]",
          "px-6 sm:px-7 py-5 sm:py-6",
          "transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)]",
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.97]",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
      >
        {/* subtle glow */}
        <div className="pointer-events-none absolute -top-20 -left-16 h-44 w-44 rounded-full bg-emerald-500/12 blur-[55px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56 rounded-full bg-accent/10 blur-[70px]" />

        {/* top line */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/12 border border-emerald-500/15">
              <Trophy size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-ink-muted/70 dark:text-white/40">
                {title}
              </div>

              <div className="mt-1 font-display text-3xl sm:text-4xl tracking-tight text-ink dark:text-white tabular-nums leading-tight">
                {amountLabel}
              </div>

              <div className="mt-1.5 text-sm text-ink-muted/60 dark:text-white/35 leading-relaxed">
                {subtitle}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-2xl p-2 hover:bg-black/[.04] dark:hover:bg-white/[.08] transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-ink-muted/70 dark:text-white/55" />
          </button>
        </div>

        {/* bottom shimmer line */}
        <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent" />
      </div>
    </div>
  )
}