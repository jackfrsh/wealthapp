// frontend/src/components/MobileNav.jsx
// Coherence pass: dark header matching page system.
//
// Background: rgba(11,17,24,0.95) blur — matches dark page environments
// Border: rgba(255,255,255,0.07)
// Labels: "Outlook" → "Plan", "Strategy" → "Decisions"
// Section badge: dark-surface appropriate
// Pro badge: gold-tinted
// Back link on Decisions → "Plan"

import React, { useMemo } from 'react'
import { useApp } from '../App'
import { ChevronLeft, Crown } from 'lucide-react'

export default function MobileNav() {
  const { page, setPage, isPro } = useApp()

  const section = useMemo(() => {
    const map = {
      home:       'Home',
      plan:       'Plan',
      decisions:  'Decisions',
      insights:   'Insights',
      accounts:   'Accounts',
      settings:   'Settings',
      upgrade:    'Pro',
      goal_setup: 'Goal',
    }
    return map[page] || ''
  }, [page])

  return (
    <div
      className="lg:hidden sticky top-0 z-40"
      style={{
        background: 'rgba(10,15,26,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Left: wordmark + section pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setPage('home')}
            className="font-display text-[17px] leading-none tracking-[-0.04em] text-white shrink-0"
          >
            Paddock<span style={{ color: 'var(--gold)', opacity: 0.80 }}>.</span>
          </button>

          {!!section && section !== 'Home' && (
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tightish"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              {section}
            </span>
          )}

          {isPro && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: 'rgba(212,175,55,0.12)',
                border: '1px solid rgba(212,175,55,0.20)',
                color: 'rgba(212,175,55,0.85)',
              }}
            >
              <Crown size={9} />
              Pro
            </span>
          )}
        </div>

        {/* Right: contextual back link on Decisions */}
        {page === 'decisions' ? (
          <button
            type="button"
            onClick={() => setPage('plan')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-opacity hover:opacity-75 shrink-0"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.60)',
            }}
          >
            <ChevronLeft size={12} />
            Plan
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>
    </div>
  )
}