import React, { useMemo } from 'react'
import { useApp } from '../App'
import { Home, LineChart, BarChart3, Wallet, Settings as SettingsIcon } from 'lucide-react'

function Tab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={[
        'group relative flex flex-col items-center justify-center flex-1',
        'py-2.5',
        'transition-all duration-180 ease-smooth',
      ].join(' ')}
    >
      {/* Active rail */}
      <span
        className={[
          'absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full',
          'transition-all duration-180 ease-smooth',
          active ? 'bg-accent/90' : 'bg-transparent group-hover:bg-accent/35',
        ].join(' ')}
        aria-hidden="true"
      />

      <div
        className={[
          'flex items-center justify-center h-9 w-9 rounded-xl',
          'transition-all duration-180 ease-smooth',
          active ? 'bg-black/[.035] dark:bg-white/[.06]' : 'bg-transparent',
        ].join(' ')}
      >
        <Icon
          size={19}
          className={[
            'transition-colors duration-180 ease-smooth',
            active ? 'text-accent' : 'text-ink-muted dark:text-white/50',
          ].join(' ')}
        />
      </div>

      <span
        className={[
          'text-[10.5px] font-semibold mt-1 tracking-tightish',
          'transition-colors duration-180 ease-smooth',
          active ? 'text-ink dark:text-white' : 'text-ink-muted dark:text-white/45',
        ].join(' ')}
      >
        {label}
      </span>
    </button>
  )
}

export default function BottomNav() {
  const { page, setPage } = useApp()

  const items = useMemo(
    () => [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'outlook', label: 'Outlook', icon: LineChart },
      { id: 'insights', label: 'Insights', icon: BarChart3 },
      { id: 'accounts', label: 'Accounts', icon: Wallet },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
    []
  )

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-black/[.06] dark:border-white/[.07] bg-white/85 dark:bg-surface-dark/75 backdrop-blur-xl">
      <div className="flex px-2 pb-[calc(env(safe-area-inset-bottom)+2px)]">
        {items.map((it) => (
          <Tab
            key={it.id}
            icon={it.icon}
            label={it.label}
            active={page === it.id}
            onClick={() => setPage(it.id)}
          />
        ))}
      </div>
    </div>
  )
}