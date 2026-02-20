import React from 'react'
import { useApp } from '../App'
import UpgradeButton from '../components/UpgradeButton'
import {
  Home,
  TrendingUp,
  Compass,
  Wallet,
  Settings,
  Crown,
  LogOut,
  Sparkles,
} from 'lucide-react'

const NavItem = ({ icon: Icon, label, active, onClick, badge }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
        active
          ? 'bg-black/[.05] dark:bg-white/[.08] text-ink dark:text-white'
          : 'text-ink-muted/80 dark:text-white/40 hover:text-ink dark:hover:text-white hover:bg-black/[.04] dark:hover:bg-white/[.06]'
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
            active
              ? 'bg-white/70 dark:bg-white/10'
              : 'bg-black/[.03] dark:bg-white/[.05]'
          }`}
        >
          <Icon size={18} />
        </span>
        {label}
      </span>

      {badge && (
        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {badge}
        </span>
      )}
    </button>
  )
}

const SectionLabel = ({ children }) => (
  <div className="px-3 pt-6 pb-2 text-[11px] font-semibold tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25">
    {children}
  </div>
)

export default function Sidebar() {
  const { page, setPage, isPro, handleLogout } = useApp()

  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-black/[.06] dark:border-white/[.06] bg-white/70 dark:bg-[#141821]/60 glass">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl text-ink dark:text-white tracking-tight">
            wealth<span className="text-accent">.</span>
          </div>

          {isPro && (
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              Pro
            </span>
          )}
        </div>

        <div className="mt-2 text-xs text-ink-muted/60 dark:text-white/25">
          Premium Wealth Tracker
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 flex-1 overflow-y-auto">
        <SectionLabel>App</SectionLabel>

        <div className="space-y-1">
          <NavItem
            icon={Home}
            label="Home"
            active={page === 'home'}
            onClick={() => setPage('home')}
          />
          <NavItem
            icon={Compass}
            label="Outlook"
            active={page === 'outlook'}
            onClick={() => setPage('outlook')}
          />
          <NavItem
            icon={TrendingUp}
            label="Insights"
            active={page === 'insights'}
            onClick={() => setPage('insights')}
          />
          <NavItem
            icon={Wallet}
            label="Accounts"
            active={page === 'accounts'}
            onClick={() => setPage('accounts')}
          />
        </div>

        {/* Pro section */}
        <SectionLabel>Pro</SectionLabel>

        <div className="space-y-2">
          {isPro ? (
            /* Active Pro badge */
            <div className="rounded-3xl border border-amber-500/15 bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-500/[.06] dark:to-amber-600/[.03] p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                  <Sparkles size={15} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-ink dark:text-white tracking-tight">
                    Wealth Pro
                  </div>
                  <div className="text-[11px] font-medium text-amber-700/70 dark:text-amber-300/60">
                    Premium Member
                  </div>
                </div>
              </div>

              <button
                onClick={() => setPage('settings')}
                className="mt-3 w-full px-4 py-2 rounded-2xl text-xs font-medium text-ink-muted/70 dark:text-white/30 hover:text-ink dark:hover:text-white/60 border border-black/[.06] dark:border-white/[.06] hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
              >
                Manage subscription
              </button>
            </div>
          ) : (
            /* Upgrade card */
            <div className="rounded-3xl border border-black/[.06] dark:border-white/[.06] bg-white dark:bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-amber-500" />
                    <div className="text-sm font-semibold text-ink dark:text-white">
                      Wealth Pro
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-ink-muted/60 dark:text-white/25 leading-relaxed">
                    Advanced modelling and strategic planning tools.
                  </div>
                </div>

                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  New
                </span>
              </div>

              <UpgradeButton onClick={() => setPage('upgrade')} size="sm">
  Upgrade
</UpgradeButton>

              <div className="mt-2 text-[11px] text-ink-muted/60 dark:text-white/25">
                From £6/month · Cancel anytime
              </div>
            </div>
          )}

          <NavItem
            icon={Settings}
            label="Settings"
            active={page === 'settings'}
            onClick={() => setPage('settings')}
          />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-loss/80 hover:text-loss hover:bg-loss-light dark:hover:bg-loss/10 transition-colors"
          >
            <span className="w-9 h-9 rounded-2xl flex items-center justify-center bg-loss-light dark:bg-loss/10">
              <LogOut size={18} />
            </span>
            Logout
          </button>
        </div>
      </nav>

      <div className="px-5 py-4 text-[10px] text-ink-muted/35 dark:text-white/15">
        Built for clarity.
      </div>
    </aside>
  )
}
