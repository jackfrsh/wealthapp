import React, { useMemo } from 'react'
import { useApp } from '../App'
import { Crown } from 'lucide-react'

export default function MobileNav() {
  const { page, isPro } = useApp()

  const section = useMemo(() => {
    const map = {
      home: 'Home',
      outlook: 'Outlook',
      insights: 'Insights',
      accounts: 'Accounts',
      settings: 'Settings',
      upgrade: 'Pro',
      goal_setup: 'Goal',
    }
    return map[page] || ''
  }, [page])

  return (
    <div className="lg:hidden sticky top-0 z-40 border-b border-black/[.06] dark:border-white/[.07] bg-white/80 dark:bg-surface-dark/75 backdrop-blur-xl">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="font-display text-lg tracking-tighterish text-ink dark:text-white leading-none">
            Paddock<span className="text-accent">.</span>
          </div>

          {!!section && section !== 'Home' && (
            <div className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tightish border border-black/[.08] dark:border-white/[.10] text-ink-muted dark:text-white/55 bg-black/[.02] dark:bg-white/[.05]">
              {section}
            </div>
          )}

          {isPro && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tightish border border-black/[.08] dark:border-white/[.10] bg-black/[.04] dark:bg-white/[.06] text-ink dark:text-white">
              <Crown size={12} className="opacity-80" />
              Pro
            </span>
          )}
        </div>

        <div className="w-8" />
      </div>
    </div>
  )
}