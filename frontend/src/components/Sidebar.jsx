import React from 'react'
import { useApp } from '../App'
import { LayoutDashboard, Wallet, Camera, TrendingUp, Settings, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'snapshots', label: 'History', icon: Camera },
  { id: 'projections', label: 'Projections', icon: TrendingUp },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ onLogout }) {
  const { page, setPage, username } = useApp()

  return (
    <nav className="hidden lg:flex flex-col w-[260px] flex-shrink-0 bg-surface-dark dark:bg-surface-dark-2 border-r border-transparent dark:border-white/5 sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-7 pt-9 pb-7 border-b border-white/[.06]">
        <div className="font-display text-2xl text-white tracking-tight">
          wealth<span className="text-accent">.</span>
        </div>
        <div className="text-xs text-white/25 tracking-widest uppercase mt-1">
          Wealth Planner
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-4">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3.5 px-7 py-3 text-sm font-medium transition-all duration-200
                ${active
                  ? 'text-white bg-white/[.07] border-l-[3px] border-accent'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[.03] border-l-[3px] border-transparent'
                }`}
            >
              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* User */}
      <div className="px-7 py-6 border-t border-white/[.06]">
        <div className="text-sm font-semibold text-white/60">{username || '—'}</div>
        <div className="text-xs text-white/25 mt-0.5">Personal account</div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 mt-4 text-xs text-white/25 hover:text-white/50 transition-colors min-h-[44px]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </nav>
  )
}
