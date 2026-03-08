// frontend/src/pages/Upgrade.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App'
import UpgradeButton from '../components/UpgradeButton'
import { track } from '../track'
import { Crown, ShieldCheck, Check } from 'lucide-react'

function withTimeout(promise, ms = 3500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function Upgrade() {
  const { setPage, isPro, api, setIsPro, refreshSettings, syncBilling } = useApp()

  const [isLoading, setIsLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [plan, setPlan] = useState('annual') // 'monthly' | 'annual'

  const reason = useMemo(() => {
    try {
      return localStorage.getItem('upgrade_reason') || ''
    } catch {
      return ''
    }
  }, [])

  const isAccountLimit = reason === 'account_limit'

  // Guard so return flow only runs once per mount
  const returnRanRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (returnRanRef.current) return
    returnRanRef.current = true

    const url = new URL(window.location.href)
    const success = url.searchParams.get('success') === 'true'
    const cancel = url.searchParams.get('cancel') === 'true'
    const sessionId = url.searchParams.get('session_id') || ''

    const cleanUrlNow = () => {
      try {
        url.searchParams.delete('success')
        url.searchParams.delete('cancel')
        url.searchParams.delete('session_id')
        window.history.replaceState({}, '', url.toString())
      } catch {}
    }

    if (success || cancel) cleanUrlNow()

    const run = async () => {
      if (!success && !cancel) return

      if (cancel) {
        if (cancelled) return
        setStatusMsg('Checkout cancelled.')
        return
      }

      if (cancelled) return
      setStatusMsg('Finalising your upgrade…')

      let verified = false
      if (sessionId) {
        try {
          const r = await withTimeout(
            api(`/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}`),
            2500
          )
          if (cancelled) return
          if (r?.paid) {
            verified = true
            setIsPro?.(true)
            setStatusMsg('Activated — syncing your account…')
          }
        } catch {}
      }

      try {
        setStatusMsg('Syncing billing…')
        if (typeof syncBilling === 'function') {
          await withTimeout(syncBilling(), 4500)
        } else {
          await withTimeout(api('/billing/sync', { method: 'POST' }), 4500)
        }
      } catch {}
      if (cancelled) return

      let s = null
      try {
        setStatusMsg('Updating your plan…')
        s =
          typeof refreshSettings === 'function'
            ? await withTimeout(refreshSettings({ force: true }), 4500)
            : await withTimeout(api('/settings'), 4500)
      } catch {}
      if (cancelled) return

      const proNow = !!s?.is_pro || verified || !!isPro
      setIsPro?.(proNow)
      setStatusMsg(proNow ? 'Pro activated ✓ Loading your dashboard…' : 'Payment received — activation may take a moment.')

      try {
        setTimeout(() => {
          if (cancelled) return
          window.location.replace('/home')
        }, 350)
      } catch {
        setPage?.('home', { replace: true })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [api, refreshSettings, syncBilling, setIsPro, isPro, setPage])

  const handleUpgrade = async () => {
    if (isLoading) return
    setIsLoading(true)
    setStatusMsg('')

    try {
      try {
        localStorage.setItem('upgrade_reason', 'upgrade_cta')
      } catch {}

      track?.('upgrade_clicked', { plan, reason })

      const res = await api('/billing/create-checkout', {
        method: 'POST',
        body: { plan },
      })

      if (res?.url) {
        window.location.href = res.url
        return
      }

      throw new Error('No checkout URL returned.')
    } catch (err) {
      console.error('Checkout error:', err)
      setStatusMsg(err?.message || 'Could not start checkout. Please try again.')
      setIsLoading(false)
    }
  }

  const price = plan === 'monthly' ? '£6' : '£60'
  const cadence = plan === 'monthly' ? '/month' : '/year'

  const headline = isAccountLimit ? 'Upgrade to add more accounts.' : 'Unlock the full model.'
  const subhead = isAccountLimit
    ? 'Free supports up to 3 accounts. Pro unlocks unlimited accounts and long-horizon projections.'
    : 'Long-horizon projections, real-terms modelling, and tools to close the gap to your target.'

  // Pro features: concrete + outcome-led
  const proBullets = [
    'Unlimited accounts',
    '5–40 year projections + milestones',
    'Net-worth trajectory modelling',
    'One-off deposit modelling',
    'Inflation-adjusted (real terms) view',
    'Scenario peeks (+£100/+£250 per month)',
    'Optimiser: calculates required monthly contribution',
    'One-tap “Set & update” from the Optimiser',
    'What-if scenario comparisons',
  ]

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-xs font-semibold tracking-[.18em] uppercase text-ink-muted/50 dark:text-white/25">
          Paddock Pro
        </div>

        <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-ink dark:text-white">
          {headline}
        </h1>

        <p className="text-sm sm:text-base text-ink-muted/70 dark:text-white/35 max-w-xl mx-auto">
          {subhead}
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
          <div className="text-center space-y-3">
            <div className="text-lg font-semibold text-ink dark:text-white flex items-center justify-center gap-2">
              <Crown size={18} className="text-amber-500" />
              Paddock Pro
            </div>

            {/* Plan toggle */}
            <div className="inline-flex p-1 rounded-2xl border border-black/[.08] dark:border-white/[.10] bg-black/[.02] dark:bg-white/[.06]">
              <button
                onClick={() => setPlan('monthly')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  plan === 'monthly'
                    ? 'bg-white dark:bg-surface-dark text-ink dark:text-white shadow-sm'
                    : 'text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white'
                }`}
                type="button"
              >
                Monthly
              </button>

              <button
                onClick={() => setPlan('annual')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  plan === 'annual'
                    ? 'bg-white dark:bg-surface-dark text-ink dark:text-white shadow-sm'
                    : 'text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white'
                }`}
                type="button"
              >
                Annual
              </button>
            </div>

            {/* Price display */}
            <div className="space-y-1">
              <div className="text-4xl font-display tracking-tight text-ink dark:text-white">
                {price}
                <span className="text-base font-medium text-ink-muted/50 dark:text-white/25">
                  {' '}
                  {cadence}
                </span>
              </div>

              <div className="text-xs text-ink-muted/60 dark:text-white/30">
                {plan === 'annual' ? 'Annual includes a 7-day trial.' : 'Monthly has no trial. Switch to annual anytime.'}
              </div>
            </div>

            <div className="text-xs text-ink-muted/60 dark:text-white/30 flex items-center justify-center gap-2">
              <ShieldCheck size={14} />
              Secure checkout powered by Stripe.
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3 text-sm">
            {proBullets.map((t) => (
              <div key={t} className="flex items-start gap-2">
                <span className="mt-0.5">
                  <Check size={16} className="opacity-70" />
                </span>
                <span className="text-ink dark:text-white/80">{t}</span>
              </div>
            ))}

            <div className="pt-2 text-xs text-ink-muted/60 dark:text-white/30">
              Coming soon: pensions tools, ISA bridge, mortgage overpayment modelling.
            </div>
          </div>

          {/* CTA */}
          {!isPro ? (
            <UpgradeButton onClick={handleUpgrade} size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? 'Redirecting…' : 'Upgrade'}
            </UpgradeButton>
          ) : (
            <button
              onClick={() => setPage('home')}
              className="w-full px-6 py-4 rounded-2xl text-sm font-semibold bg-surface-2 dark:bg-white/[.06] text-ink dark:text-white hover:opacity-90 transition-opacity"
              type="button"
            >
              You’re Pro ✓
            </button>
          )}
        </div>
      </div>

      {/* Comparison */}
      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border border-black/[.06] dark:border-white/[.08] bg-white/60 dark:bg-white/[.04] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink dark:text-white text-center">Free vs Pro</h2>
          <p className="text-sm text-ink-muted/70 dark:text-white/35 text-center mt-2">
            Start free. Upgrade when you want long horizons and tools to close the gap.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.04] p-5">
              <div className="text-sm font-semibold text-ink dark:text-white">Free</div>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted dark:text-white/45">
                <li>Up to 3 accounts</li>
                <li>1 year outlook</li>
                <li>Core net worth dashboard</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-black/[.08] dark:border-white/[.10] bg-black/[.02] dark:bg-white/[.06] p-5">
              <div className="text-sm font-semibold text-ink dark:text-white flex items-center gap-2">
                <Crown size={16} className="text-amber-500" />
                Pro
              </div>
              <ul className="mt-3 space-y-2 text-sm text-ink dark:text-white/80">
                <li>Unlimited accounts</li>
                <li>5–40 year projections + milestones</li>
                <li>Optimiser + real-terms modelling</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setPage('home')}
              className="text-sm font-semibold text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white transition-colors"
            >
              Not now — continue free
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}