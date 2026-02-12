import React from 'react'
import { useApp } from '../App'
import { LayoutDashboard, Wallet, Camera, TrendingUp, Settings, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'snapshots', label: 'Snapshots', icon: Camera },
  { id: 'projections', label: 'Projections', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ onLogout }) {
  const { page, setPage, username } = useApp()

  return (
    <nav className="hidden lg:flex flex-col w-[240px] flex-shrink-0 bg-ink dark:bg-surface-dark-2 border-r border-transparent dark:border-white/5 sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-6 pt-8 pb-6 border-b border-white/5">
        <div className="font-display text-[22px] text-white tracking-tight">
          wealth<span className="text-accent">.</span>
        </div>
        <div className="text-[11px] text-white/30 tracking-widest uppercase mt-0.5">
          Net Worth Tracker
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-3">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-all duration-200
                ${active
                  ? 'text-white bg-white/[.06] border-l-[3px] border-accent'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[.03] border-l-[3px] border-transparent'
                }`}
            >
              <Icon size={17} strokeWidth={active ? 2 : 1.5} />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* User */}
      <div className="px-6 py-5 border-t border-white/5">
        <div className="text-sm font-semibold text-white/70">{username || '—'}</div>
        <div className="text-[11px] text-white/30 mt-0.5">Personal account</div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 mt-3 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </nav>
  )
}
