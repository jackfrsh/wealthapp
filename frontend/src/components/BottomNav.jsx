// frontend/src/components/BottomNav.jsx
// Coherence pass: dark surface + gold active state.
//
// Background: rgba(11,17,24,0.96) blur — unified with sidebar and MobileNav
// Active indicator: gold top rule (var(--gold), not blue accent)
// Active icon/label: white
// Inactive: white/35 icon, white/30 label
// Border: rgba(255,255,255,0.07)
//
// Labels, items, routing logic: unchanged.

import React, { useMemo } from 'react'
import { useApp } from '../App'
import TrialBadge from './TrialBadge'
import {
  Home,
  LineChart,
  Compass,
  Wallet,
  Settings as SettingsIcon,
} from 'lucide-react'

function Tab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-current={active ? 'page' : undefined}
      className="group relative flex flex-col items-center justify-center flex-1 py-2 transition-all duration-150"
    >
      {/* Top active indicator — gold */}
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full transition-all duration-150"
        style={{
          background: active ? 'var(--gold)' : 'transparent',
          opacity: active ? 0.80 : 0,
        }}
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className="flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-150"
        style={{ background: active ? 'rgba(255,255,255,0.07)' : 'transparent' }}
      >
        <Icon
          size={18}
          style={{ color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.35)' }}
        />
      </div>

      {/* Label */}
      <span
        className="text-[10px] font-semibold mt-0.5 tracking-tightish transition-colors duration-150"
        style={{ color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.30)' }}
      >
        {label}
      </span>
    </button>
  )
}

export default function BottomNav() {
  const { page, setPage, subscriptionStatus, trialEnd } = useApp()

  const isTrialing = subscriptionStatus === 'trialing' && trialEnd

  const items = useMemo(
    () => [
      { id: 'home',     label: 'Home',      icon: Home },
      { id: 'plan',      label: 'Plan',       icon: LineChart },
      { id: 'decisions', label: 'Decisions',  icon: Compass },
      { id: 'accounts', label: 'Accounts',   icon: Wallet },
      { id: 'settings', label: 'Settings',   icon: SettingsIcon },
    ],
    []
  )

  const isActive = (id) => page === id

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(10,15,26,0.96)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {isTrialing && (
        <div className="flex justify-center pt-1.5 pb-0">
          <TrialBadge
            trialEnd={trialEnd}
            compact
            onClick={() => setPage('upgrade')}
          />
        </div>
      )}

      <div className="flex px-1 pb-[calc(env(safe-area-inset-bottom)+2px)]">
        {items.map((it) => (
          <Tab
            key={it.id}
            icon={it.icon}
            label={it.label}
            active={isActive(it.id)}
            onClick={() => setPage(it.id)}
          />
        ))}
      </div>
    </div>
  )
}