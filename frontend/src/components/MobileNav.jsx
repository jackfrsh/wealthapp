import React from 'react'
import { useApp } from '../App'
import { LayoutDashboard, Wallet, Camera, TrendingUp, Settings } from 'lucide-react'

const items = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'accounts', icon: Wallet, label: 'Accounts' },
  { id: 'snapshots', icon: Camera, label: 'Snaps' },
  { id: 'projections', icon: TrendingUp, label: 'Project' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function MobileNav() {
  const { page, setPage } = useApp()
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass bg-white/80 dark:bg-surface-dark/80 border-t border-black/5 dark:border-white/5 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(item => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                active ? 'text-accent' : 'text-ink-muted dark:text-white/40'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
