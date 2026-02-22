import React from 'react'
import { useApp } from '../App'
import { Home, Compass, TrendingUp, Wallet, Crown, Sparkles } from 'lucide-react'

const Item = ({ active, icon: Icon, label, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-2xl transition-colors touch-press min-w-[64px] ${
      active
        ? 'text-ink dark:text-white'
        : 'text-ink-muted/70 dark:text-white/35'
    }`}
    type="button"
  >
    <div className="relative">
      <Icon size={18} />
      {badge && (
        <span className="absolute -top-2 -right-2 h-2 w-2 rounded-full bg-amber-500" />
      )}
    </div>
    <span className="text-[10px] font-semibold tracking-wide">{label}</span>
  </button>
)

export default function MobileNav() {
  const { page, setPage, isPro } = useApp()

  return (
    <div
      className="lg:hidden fixed left-0 right-0 bottom-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-white/80 dark:bg-[#141821]/75 glass border-t border-black/[.06] dark:border-white/[.06]" />

      {/* Content */}
      <div className="relative max-w-[960px] mx-auto px-3 pt-2 pb-2">
        <div className="flex items-center justify-between">
          <Item
            icon={Home}
            label="Home"
            active={page === 'home'}
            onClick={() => setPage('home')}
          />

          <Item
            icon={Compass}
            label="Outlook"
            active={page === 'outlook'}
            onClick={() => setPage('outlook')}
          />

          <Item
            icon={TrendingUp}
            label="Insights"
            active={page === 'insights'}
            onClick={() => setPage('insights')}
          />

          <Item
            icon={Wallet}
            label="Accounts"
            active={page === 'accounts'}
            onClick={() => setPage('accounts')}
          />

          <button
            onClick={() => setPage(isPro ? 'settings' : 'upgrade')}
            className={`relative flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-2xl transition-colors touch-press min-w-[64px] ${
              page === 'upgrade' || (isPro && page === 'settings')
                ? 'text-ink dark:text-white'
                : 'text-ink-muted/70 dark:text-white/35'
            }`}
            type="button"
          >
            <div className="relative">
              {isPro ? (
                <Sparkles
                  size={18}
                  className="text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]"
                />
              ) : (
                <>
                  <Crown size={18} />
                  <span className="absolute -top-2 -right-2 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                </>
              )}
            </div>

            <span className="text-[10px] font-semibold tracking-wide">
              {isPro ? 'Pro' : 'Upgrade'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}