import React, { useMemo } from 'react'
import { useApp } from '../App'
import UpgradeButton from './UpgradeButton'
import {
  Home,
  BarChart3,
  Wallet,
  Settings as SettingsIcon,
  LogOut,
  Crown,
  LineChart,
} from 'lucide-react'

function NavItem({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-current={active ? 'page' : undefined}
      className={[
        'group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl',
        'transition-all duration-180 ease-smooth',
        active
          ? 'bg-black/[.05] dark:bg-white/[.08] text-ink dark:text-white shadow-[0_1px_0_rgba(255,255,255,.06)_inset]'
          : 'text-ink-muted dark:text-white/45 hover:bg-black/[.035] dark:hover:bg-white/[.05] hover:text-ink dark:hover:text-white',
      ].join(' ')}
    >
      <span
        className={[
          'absolute left-1 top-1.5 bottom-1.5 w-[2px] rounded-full',
          'transition-all duration-180 ease-smooth',
          active ? 'bg-accent/90' : 'bg-transparent group-hover:bg-accent/35',
        ].join(' ')}
        aria-hidden="true"
      />
      <Icon
        size={18}
        className={[
          'transition-opacity duration-180 ease-smooth',
          active ? 'opacity-100' : 'opacity-85 group-hover:opacity-95',
        ].join(' ')}
      />
      <span className="flex-1 text-left text-[13px] font-semibold tracking-tightish">
        {label}
      </span>
    </button>
  )
}

export default function Sidebar() {
  const { page, setPage, isPro, logout } = useApp()

  const items = useMemo(
    () => [
      { id: 'home', label: 'Dashboard', icon: Home },
      { id: 'outlook', label: 'Outlook', icon: LineChart },
      { id: 'insights', label: 'Insights', icon: BarChart3 },
      { id: 'accounts', label: 'Accounts', icon: Wallet },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
    []
  )

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-[288px] lg:shrink-0 border-r border-black/[.06] dark:border-white/[.07] bg-white/55 dark:bg-surface-dark/55 backdrop-blur-xl">
      <div className="px-5 pt-5 pb-4">
        <button
          onClick={() => setPage('home')}
          className="w-full flex items-start justify-between"
          type="button"
        >
          <div className="flex flex-col">
            <span className="font-display text-2xl text-ink dark:text-white tracking-tighterish leading-none">
              Paddock<span className="text-accent">.</span>
            </span>
            <span className="mt-1 text-[11px] text-ink-muted dark:text-white/35 tracking-tightish">
              Private net worth tracking & wealth planning
            </span>
          </div>

          {isPro && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tightish border border-black/[.08] dark:border-white/[.10] bg-black/[.04] dark:bg-white/[.06] text-ink dark:text-white">
              <Crown size={12} className="opacity-80" />
              Pro
            </span>
          )}
        </button>

        <div className="mt-4 h-px bg-black/[.06] dark:bg-white/[.07]" />
      </div>

      <div className="px-4 pb-4 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {items.map((it) => (
            <NavItem
              key={it.id}
              active={page === it.id}
              icon={it.icon}
              label={it.label}
              onClick={() => setPage(it.id)}
            />
          ))}
        </div>

        {!isPro && (
          <div className="mt-5 rounded-3xl border border-black/[.06] dark:border-white/[.08] bg-surface-2 dark:bg-white/[.05] p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-[.08] bg-gradient-to-br from-accent/40 via-transparent to-amber-500/30" />

            <div className="relative">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                <Crown size={16} className="opacity-80" />
                <span>Paddock Pro</span>
              </div>

              <div className="mt-1.5 text-xs text-ink-muted dark:text-white/40 leading-relaxed">
                Unlimited accounts, longer projections, and advanced planning tools.
              </div>

              <UpgradeButton
                onClick={() => {
                  try {
                    localStorage.setItem('upgrade_reason', 'sidebar_cta')
                  } catch {}
                  setPage('upgrade')
                }}
                className="w-full mt-3"
                size="md"
                variant="pro"
              >
                Upgrade
              </UpgradeButton>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-5">
        <div className="h-px bg-black/[.06] dark:bg-white/[.07] mb-3" />
        <button
          onClick={logout}
          type="button"
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-semibold tracking-tightish border border-black/[.08] dark:border-white/[.10] text-ink dark:text-white hover:bg-black/[.035] dark:hover:bg-white/[.05] transition-all duration-180 ease-smooth"
        >
          <LogOut size={16} className="opacity-85" />
          Log out
        </button>
      </div>
    </aside>
  )
}