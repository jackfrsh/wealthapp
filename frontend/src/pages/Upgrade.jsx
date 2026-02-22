import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../App'
import UpgradeButton from '../components/UpgradeButton'
import { api } from '../api' // ✅ use the shared API helper (function)

export default function Upgrade() {
  const { setPage, isPro, setIsPro, refreshSettings } = useApp()
  const [isLoading, setIsLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const reason = useMemo(() => {
    try {
      return localStorage.getItem('upgrade_reason') || ''
    } catch {
      return ''
    }
  }, [])

  const isAccountLimit = reason === 'account_limit'

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const stripe = params.get('stripe') || ''
  const success = stripe === 'success' || params.get('success') === 'true'
  const cancel = stripe === 'cancel' || params.get('cancel') === 'true'

  useEffect(() => {
    let cancelled = false

    const refreshEntitlement = async () => {
      if (!success && !cancel) return

      if (cancel) {
        setStatusMsg('No worries — checkout cancelled.')
        return
      }

      setStatusMsg('Finalising your upgrade…')

      try {
        const s = await refreshSettings?.()
        if (cancelled) return

        const pro = !!s?.is_pro
        if (typeof setIsPro === 'function') setIsPro(pro)

        setStatusMsg(pro ? 'Pro activated ✓' : 'Payment received — activating Pro…')

        if (pro) setTimeout(() => setPage('home'), 1200)
      } catch (e) {
        if (cancelled) return
        setStatusMsg('Upgrade complete — refresh in a moment if Pro doesn’t unlock.')
      } finally {
        try {
          const url = new URL(window.location.href)
          url.searchParams.delete('stripe')
          url.searchParams.delete('success')
          url.searchParams.delete('cancel')
          window.history.replaceState({}, '', url.toString())
        } catch {}
      }
    }

    refreshEntitlement()
    return () => {
      cancelled = true
    }
  }, [success, cancel, refreshSettings, setIsPro, setPage])

  const handleUpgrade = async () => {
    setStatusMsg('')
    setIsLoading(true)

    try {
      localStorage.setItem('upgrade_reason', 'upgrade_cta')
    } catch {}

    try {
      // ✅ Your backend route is /api/billing/create-checkout (router prefix /api + router prefix /billing)
      const res = await api('/billing/create-checkout', { method: 'POST' })
      if (res?.url) {
        window.location.href = res.url
        return
      }
      throw new Error('No URL returned')
    } catch (err) {
      console.error('Checkout error:', err)
      setStatusMsg('Could not start checkout. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-xs font-semibold tracking-[.18em] uppercase text-ink-muted/50 dark:text-white/25">
          Wealth Pro
        </div>

        <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-ink dark:text-white">
          {isAccountLimit ? 'Upgrade to add more accounts.' : 'Upgrade your planning.'}
        </h1>

        <p className="text-sm sm:text-base text-ink-muted/70 dark:text-white/35 max-w-xl mx-auto">
          {isAccountLimit
            ? 'Free supports up to 3 accounts. Pro unlocks unlimited accounts plus advanced modelling tools.'
            : 'Unlock advanced modelling tools, one-off projections, and deeper financial insights.'}
        </p>

        {!!statusMsg && (
          <div className="mt-3 text-sm font-medium text-ink-muted/70 dark:text-white/35">
            {statusMsg}
          </div>
        )}
      </div>

      {/* Pricing Card */}
      <div className="max-w-md mx-auto">
        <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-white/5 shadow-[0_20px_40px_rgba(0,0,0,.08)] p-8 space-y-6">
          <div className="text-center">
            <div className="text-lg font-semibold text-ink dark:text-white">[Paddock]. Pro</div>

            <div className="mt-3 text-4xl font-display tracking-tight text-ink dark:text-white">
              £6
              <span className="text-base font-medium text-ink-muted/50 dark:text-white/25">
                {' '}
                /month
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3 text-sm">
            {[
              ['Unlimited accounts', '✓'],
              ['One-off projection modelling', '✓'],
              ['Advanced timeline acceleration', '✓'],
              ['Deeper contribution insights', '✓'],
              ['Inflation adjustments', '✓'],
              ['Priority features', 'Coming Soon', 'text-ink-muted/60 dark:text-white/30'],
            ].map(([label, value, className]) => (
              <div key={label} className={`flex justify-between ${className || ''}`}>
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          {!isPro ? (
            <UpgradeButton onClick={handleUpgrade} size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? 'Loading…' : 'Upgrade to Pro'}
            </UpgradeButton>
          ) : (
            <div className="text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              You’re already Pro ✓
            </div>
          )}

          <button
            onClick={() => {
              try {
                localStorage.removeItem('upgrade_reason')
              } catch {}
              setPage('home')
            }}
            className="w-full text-sm text-ink-muted/60 dark:text-white/35 hover:underline"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}