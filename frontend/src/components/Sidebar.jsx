// frontend/src/components/Sidebar.jsx
// Coherence pass: sidebar matches the dark blue-black system of the page bodies.
//
// Background: deep blue-navy gradient (#0c1219 → #0e1520)
// Border: rgba(255,255,255,0.07) — consistent with all page section borders
// Active state: gold left-rule (var(--gold)) + white text
// Inactive: white/38 text, white/05 hover
// Wordmark: gold dot, Inter display
// Pro badge: gold-tinted border/bg
// Upsell panel: quiet dark surface, gold CTA
// Sign out: dark-appropriate hover via inline handlers
//
// Routing, nav items, logic: unchanged.

import React, { useMemo } from 'react'
import { useApp } from '../App'
import TrialBadge from './TrialBadge'
import {
  Home,
  Wallet,
  Settings as SettingsIcon,
  LogOut,
  Crown,
  LineChart,
  Compass,
} from 'lucide-react'

function NavItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-current={active ? 'page' : undefined}
      className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
      style={
        active
          ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.95)' }
          : { color: 'rgba(255,255,255,0.38)' }
      }
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
        if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.38)'
      }}
    >
      {/* Gold active rule */}
      <span
        className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full transition-all duration-150"
        style={{ background: active ? 'var(--gold)' : 'transparent', opacity: active ? 0.80 : 0 }}
        aria-hidden="true"
      />

      <Icon size={17} style={{ opacity: active ? 0.95 : 0.60, flexShrink: 0 }} />

      <span className="flex-1 text-left text-[13px] font-semibold tracking-tightish">
        {label}
      </span>
    </button>
  )
}

export default function Sidebar() {
  const { page, setPage, isPro, subscriptionStatus, trialEnd, logout } = useApp()

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

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-[268px] lg:shrink-0"
      style={{
        background: 'linear-gradient(180deg, #0A0F1A 0%, #0F141F 100%)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Wordmark */}
      <div className="px-5 pt-6 pb-5">
        <button
          onClick={() => setPage('home')}
          className="w-full flex items-start justify-between group"
          type="button"
        >
          <div className="flex flex-col">
            <span className="font-display text-[22px] leading-none tracking-[-0.04em] text-white">
              Paddock
              <span style={{ color: 'var(--gold)', opacity: 0.85 }}>.</span>
            </span>
            <span
              className="mt-1.5 text-[10.5px] tracking-[.06em] font-medium"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              Your wealth, clearly
            </span>
          </div>

          {isPro && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold"
              style={{
                background: 'rgba(212,175,55,0.12)',
                border: '1px solid rgba(212,175,55,0.22)',
                color: 'rgba(212,175,55,0.90)',
              }}
            >
              <Crown size={10} />
              Pro
            </span>
          )}
        </button>

        <div className="mt-5 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* Nav items */}
      <div className="px-3 pb-3 flex-1 overflow-y-auto">
        <nav className="space-y-0.5">
          {items.map((it) => (
            <NavItem
              key={it.id}
              active={page === it.id}
              icon={it.icon}
              label={it.label}
              onClick={() => setPage(it.id)}
            />
          ))}
        </nav>

        {/* Trial countdown */}
        {isTrialing && (
          <div className="mt-4">
            <TrialBadge trialEnd={trialEnd} onClick={() => setPage('upgrade')} />
          </div>
        )}

        {/* Pro upsell — quiet dark panel */}
        {!isPro && (
          <div
            className="mt-5 rounded-2xl p-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div
              className="flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: 'rgba(255,255,255,0.80)' }}
            >
              <Crown size={13} style={{ color: 'var(--gold)', opacity: 0.80 }} />
              Paddock Pro
            </div>

            <div
              className="mt-1.5 text-[11.5px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Unlimited accounts, longer projections, and advanced planning tools.
            </div>

            <button
              type="button"
              onClick={() => {
                try { localStorage.setItem('upgrade_reason', 'sidebar_cta') } catch {}
                setPage('upgrade')
              }}
              className="mt-3 w-full py-2 rounded-xl text-[12px] font-semibold transition-opacity hover:opacity-90"
              style={{
                background: 'rgba(212,175,55,0.15)',
                border: '1px solid rgba(212,175,55,0.25)',
                color: 'rgba(212,175,55,0.90)',
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-3 pb-5">
        <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <button
          onClick={logout}
          type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-medium transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.28)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'rgba(255,255,255,0.28)'
          }}
        >
          <LogOut size={14} style={{ opacity: 0.65 }} />
          Sign out
        </button>
      </div>
    </aside>
  )
}