import React from 'react'
import { useApp } from '../App'
import { LayoutDashboard, Wallet, Camera, TrendingUp, Settings } from 'lucide-react'

const items = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'accounts', icon: Wallet, label: 'Accounts' },
  { id: 'snapshots', icon: Camera, label: 'History' },
  { id: 'projections', icon: TrendingUp, label: 'Project' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function MobileNav() {
  const { page, setPage } = useApp()
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass bg-white/85 dark:bg-surface-dark/85 border-t border-black/[.06] dark:border-white/[.06] safe-bottom">
      <div className="flex items-center justify-around px-2 py-1.5">
        {items.map(item => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex flex-col items-center gap-1 min-w-[56px] min-h-[44px] px-3 py-2 rounded-xl transition-colors touch-press ${
                active ? 'text-accent' : 'text-ink-muted dark:text-white/35'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[11px] font-semibold leading-none">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
